const COOKIE_NAME = 'iotlab_session';
const SESSION_DAYS = 7;
const PBKDF2_ITERATIONS = 150000;
const AI_MODEL = '@cf/google/gemma-4-26b-a4b-it';
const DEVICE_TYPES = new Set([
  'smart-irrigation', 'smart-trash', 'flood-warning',
  'smart-parking', 'smart-home', 'fish-pond'
]);
const ALLOWED_COMPONENTS = new Set([
  'esp32','arduino-uno','soil-moisture','dht22','rain-sensor','ultrasonic',
  'ir-obstacle','pir','ldr','mq2','water-level','ph-sensor','turbidity','water-temp',
  'servo','relay','pump','aerator','dc-motor','buzzer','led','rgb-led','lcd'
]);
const encoder = new TextEncoder();

function response(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...extraHeaders,
    },
  });
}
function fail(message, status = 400) { return response({ error: message }, status); }
function b64url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function fromB64url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
async function sha256(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}
async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2', salt: fromB64url(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256',
  }, key, 256);
  return b64url(new Uint8Array(bits));
}
function safeEqual(a, b) {
  const aa = encoder.encode(String(a)); const bb = encoder.encode(String(b));
  if (aa.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i];
  return diff === 0;
}
function normalizeNim(value) { return String(value ?? '').trim().toUpperCase(); }
function validNim(value) { return /^[A-Z0-9.-]{4,24}$/.test(value); }
function getCookie(request, name) {
  const raw = request.headers.get('Cookie') || '';
  const item = raw.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : null;
}
function cookieHeader(token, maxAge) {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
async function parseJson(request, maxBytes = 50000) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > maxBytes) throw new Error('Ukuran data terlalu besar.');
  const text = await request.text();
  if (text.length > maxBytes) throw new Error('Ukuran data terlalu besar.');
  return JSON.parse(text || '{}');
}
function validOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}
async function ensureBootstrapTeacher(env) {
  if (!env.ADMIN_NIM || !env.ADMIN_PASSWORD) return;
  const nim = normalizeNim(env.ADMIN_NIM);
  if (!validNim(nim) || String(env.ADMIN_PASSWORD).length < 10) return;
  const exists = await env.DB.prepare('SELECT id FROM users WHERE nim = ?').bind(nim).first();
  if (exists) return;
  const salt = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const passwordHash = await hashPassword(String(env.ADMIN_PASSWORD), salt);
  await env.DB.prepare(
    `INSERT INTO users (id, nim, full_name, role, password_hash, password_salt, must_change_password)
     VALUES (?, ?, ?, 'teacher', ?, ?, 0)`
  ).bind(crypto.randomUUID(), nim, String(env.ADMIN_NAME || 'Dosen Pengampu').trim().slice(0, 100), passwordHash, salt).run();
}
async function currentUser(request, env) {
  const token = getCookie(request, COOKIE_NAME);
  if (!token || !env.DB) return null;
  const tokenHash = b64url(await sha256(token));
  const row = await env.DB.prepare(
    `SELECT u.id, u.nim, u.full_name, u.role, u.must_change_password, u.is_active
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ? LIMIT 1`
  ).bind(tokenHash, Math.floor(Date.now() / 1000)).first();
  if (!row || !row.is_active) return null;
  return { id: row.id, nim: row.nim, name: row.full_name, role: row.role, mustChangePassword: Boolean(row.must_change_password) };
}
async function requireUser(request, env) {
  const user = await currentUser(request, env);
  return user || null;
}
async function createSession(userId, env) {
  const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = b64url(await sha256(token));
  const expires = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400;
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(tokenHash, userId, expires).run();
  return token;
}
async function rateLimited(nim, ipHash, env) {
  const since = Math.floor(Date.now() / 1000) - 600;
  const row = await env.DB.prepare(
    'SELECT COUNT(*) AS total FROM login_attempts WHERE nim = ? AND ip_hash = ? AND attempted_at > ? AND succeeded = 0'
  ).bind(nim, ipHash, since).first();
  return Number(row?.total || 0) >= 7;
}
async function recordLoginAttempt(nim, ipHash, succeeded, env) {
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare('INSERT INTO login_attempts (nim, ip_hash, succeeded, attempted_at) VALUES (?, ?, ?, ?)')
    .bind(nim, ipHash, succeeded ? 1 : 0, now).run();
  await env.DB.prepare('DELETE FROM login_attempts WHERE attempted_at < ?').bind(now - 86400).run();
}
async function handleApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  if (path === '/api/health' && method === 'GET') {
    let dbReady = false; let adminExists = false;
    try {
      if (env.DB) {
        await env.DB.prepare('SELECT 1 AS ok').first(); dbReady = true;
        await ensureBootstrapTeacher(env);
        const admin = await env.DB.prepare("SELECT id FROM users WHERE role = 'teacher' LIMIT 1").first();
        adminExists = Boolean(admin);
      }
    } catch (error) { console.error('Health check:', error); }
    return response({ status: 'ok', databaseConfigured: Boolean(env.DB), databaseReady: dbReady, teacherConfigured: adminExists, aiConfigured: Boolean(env.AI), aiModel: AI_MODEL });
  }

  if (!env.DB) return fail('Database belum dihubungkan. Tambahkan binding D1 bernama DB.', 503);
  try { await ensureBootstrapTeacher(env); }
  catch (error) { console.error('Bootstrap teacher:', error); return fail('Database belum siap. Jalankan SQL inisialisasi terlebih dahulu.', 503); }

  if (method !== 'GET' && !validOrigin(request)) return fail('Asal permintaan tidak valid.', 403);

  if (path === '/api/auth/login' && method === 'POST') {
    let body;
    try { body = await parseJson(request, 5000); } catch { return fail('Data login tidak valid.'); }
    const nim = normalizeNim(body.nim); const password = String(body.password || '');
    if (!validNim(nim) || !password || password.length > 200) return fail('NIM atau password tidak valid.', 401);
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const ipHash = b64url(await sha256(ip));
    if (await rateLimited(nim, ipHash, env)) return fail('Terlalu banyak percobaan login. Coba kembali dalam 10 menit.', 429);
    const user = await env.DB.prepare('SELECT * FROM users WHERE nim = ? AND is_active = 1 LIMIT 1').bind(nim).first();
    let ok = false;
    if (user) {
      const candidate = await hashPassword(password, user.password_salt);
      ok = safeEqual(candidate, user.password_hash);
    }
    await recordLoginAttempt(nim, ipHash, ok, env);
    if (!ok) return fail('NIM atau password salah.', 401);
    const token = await createSession(user.id, env);
    await env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(Math.floor(Date.now() / 1000)).run();
    return response({ user: { id: user.id, nim: user.nim, name: user.full_name, role: user.role, mustChangePassword: Boolean(user.must_change_password) } }, 200, { 'set-cookie': cookieHeader(token, SESSION_DAYS * 86400) });
  }

  if (path === '/api/auth/logout' && method === 'POST') {
    const token = getCookie(request, COOKIE_NAME);
    if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(b64url(await sha256(token))).run();
    return response({ ok: true }, 200, { 'set-cookie': cookieHeader('', 0) });
  }

  if (path === '/api/auth/me' && method === 'GET') {
    const user = await currentUser(request, env);
    return user ? response({ user }) : response({ user: null }, 401);
  }

  const user = await requireUser(request, env);
  if (!user) return fail('Silakan login terlebih dahulu.', 401);
  if (user.mustChangePassword && path !== '/api/auth/change-password') return fail('Ganti password awal sebelum menggunakan fitur aplikasi.', 403);

  if (path === '/api/auth/change-password' && method === 'POST') {
    let body;
    try { body = await parseJson(request, 5000); } catch { return fail('Data tidak valid.'); }
    const oldPassword = String(body.oldPassword || ''); const newPassword = String(body.newPassword || '');
    if (newPassword.length < 8 || newPassword.length > 128) return fail('Password baru minimal 8 karakter.');
    const row = await env.DB.prepare('SELECT password_hash, password_salt FROM users WHERE id = ?').bind(user.id).first();
    if (!row || !safeEqual(await hashPassword(oldPassword, row.password_salt), row.password_hash)) return fail('Password lama tidak sesuai.', 401);
    const salt = b64url(crypto.getRandomValues(new Uint8Array(16)));
    const hash = await hashPassword(newPassword, salt);
    await env.DB.prepare('UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = 0 WHERE id = ?').bind(hash, salt, user.id).run();
    return response({ ok: true });
  }

  if (path === '/api/teacher/students' && method === 'GET') {
    if (user.role !== 'teacher') return fail('Akses dosen diperlukan.', 403);
    const rows = await env.DB.prepare(
      `SELECT u.id, u.nim, u.full_name, u.is_active, u.created_at,
       COUNT(p.id) AS project_count,
       SUM(CASE WHEN p.status IN ('submitted','graded') THEN 1 ELSE 0 END) AS submitted_count
       FROM users u LEFT JOIN projects p ON p.user_id = u.id
       WHERE u.role = 'student' GROUP BY u.id ORDER BY u.full_name COLLATE NOCASE`
    ).all();
    return response({ students: rows.results || [] });
  }

  if (path === '/api/teacher/students' && method === 'POST') {
    if (user.role !== 'teacher') return fail('Akses dosen diperlukan.', 403);
    let body;
    try { body = await parseJson(request, 8000); } catch { return fail('Data mahasiswa tidak valid.'); }
    const nim = normalizeNim(body.nim); const name = String(body.name || '').trim(); const password = String(body.password || '');
    if (!validNim(nim)) return fail('NIM harus 4–24 karakter berupa huruf, angka, titik, atau tanda hubung.');
    if (name.length < 3 || name.length > 100) return fail('Nama mahasiswa harus 3–100 karakter.');
    if (password.length < 8 || password.length > 128) return fail('Password awal minimal 8 karakter.');
    const exists = await env.DB.prepare('SELECT id FROM users WHERE nim = ?').bind(nim).first();
    if (exists) return fail('NIM sudah terdaftar.', 409);
    const salt = b64url(crypto.getRandomValues(new Uint8Array(16)));
    const hash = await hashPassword(password, salt);
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO users (id, nim, full_name, role, password_hash, password_salt, must_change_password)
       VALUES (?, ?, ?, 'student', ?, ?, 1)`
    ).bind(id, nim, name, hash, salt).run();
    return response({ ok: true, student: { id, nim, name, mustChangePassword: true } }, 201);
  }

  const resetStudentMatch = path.match(/^\/api\/teacher\/students\/([\w-]+)\/reset-password$/);
  if (resetStudentMatch && method === 'POST') {
    if (user.role !== 'teacher') return fail('Akses dosen diperlukan.', 403);
    let body;
    try { body = await parseJson(request, 5000); } catch { return fail('Data password tidak valid.'); }
    const password = String(body.password || '');
    if (password.length < 8 || password.length > 128) return fail('Password sementara minimal 8 karakter.');
    const student = await env.DB.prepare("SELECT id FROM users WHERE id = ? AND role = 'student'").bind(resetStudentMatch[1]).first();
    if (!student) return fail('Mahasiswa tidak ditemukan.', 404);
    const salt = b64url(crypto.getRandomValues(new Uint8Array(16)));
    const hash = await hashPassword(password, salt);
    await env.DB.prepare('UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = 1 WHERE id = ?').bind(hash, salt, student.id).run();
    await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(student.id).run();
    return response({ ok: true });
  }

  const projectsPath = path === '/api/projects';
  if (projectsPath && method === 'GET') {
    const sql = user.role === 'teacher'
      ? `SELECT p.id, p.device_type, p.title, p.status, p.created_at, p.updated_at, p.submitted_at,
          u.nim, u.full_name AS student_name, g.score, g.feedback, g.graded_at
         FROM projects p JOIN users u ON u.id = p.user_id LEFT JOIN grades g ON g.project_id = p.id
         ORDER BY CASE p.status WHEN 'submitted' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, p.updated_at DESC LIMIT 500`
      : `SELECT p.id, p.device_type, p.title, p.status, p.created_at, p.updated_at, p.submitted_at,
          NULL AS nim, NULL AS student_name, g.score, g.feedback, g.graded_at
         FROM projects p LEFT JOIN grades g ON g.project_id = p.id WHERE p.user_id = ? ORDER BY p.updated_at DESC LIMIT 100`;
    const result = user.role === 'teacher' ? await env.DB.prepare(sql).all() : await env.DB.prepare(sql).bind(user.id).all();
    return response({ projects: result.results || [] });
  }

  if (path === '/api/projects/autosave' && method === 'POST') {
    if (user.role !== 'student') return fail('Hanya akun mahasiswa yang dapat menyimpan proyek.', 403);
    let body;
    try { body = await parseJson(request, 40000); } catch { return fail('Data proyek tidak valid atau terlalu besar.'); }
    const id = String(body.id || crypto.randomUUID()); const deviceType = String(body.deviceType || '');
    const title = String(body.title || 'Proyek IoT').trim().slice(0, 100);
    const config = body.config && typeof body.config === 'object' ? body.config : {};
    if (!DEVICE_TYPES.has(deviceType)) return fail('Jenis perangkat tidak dikenal.');
    if (!/^[\w-]{8,60}$/.test(id)) return fail('ID proyek tidak valid.');
    const configJson = JSON.stringify(config);
    if (configJson.length > 30000) return fail('Konfigurasi proyek terlalu besar.');
    const result = await env.DB.prepare(
      `INSERT INTO projects (id, user_id, device_type, title, config_json, status)
       VALUES (?, ?, ?, ?, ?, 'draft')
       ON CONFLICT(id) DO UPDATE SET device_type = excluded.device_type, title = excluded.title,
       config_json = excluded.config_json, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE projects.user_id = excluded.user_id AND projects.status = 'draft'`
    ).bind(id, user.id, deviceType, title || 'Proyek IoT', configJson).run();
    if ((result.meta?.changes ?? 0) < 1) return fail('Proyek tidak dapat disimpan. Periksa kepemilikan atau status pengumpulan.', 409);
    return response({ ok: true, id, savedAt: new Date().toISOString() });
  }

  const submitMatch = path.match(/^\/api\/projects\/([\w-]+)\/submit$/);
  if (submitMatch && method === 'POST') {
    if (user.role !== 'student') return fail('Hanya mahasiswa yang dapat mengumpulkan proyek.', 403);
    const result = await env.DB.prepare(
      `UPDATE projects SET status = 'submitted', submitted_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ? AND user_id = ? AND status = 'draft'`
    ).bind(submitMatch[1], user.id).run();
    if ((result.meta?.changes ?? 0) < 1) return fail('Proyek tidak ditemukan atau sudah dikumpulkan.', 409);
    return response({ ok: true });
  }

  const projectMatch = path.match(/^\/api\/projects\/([\w-]+)$/);
  if (projectMatch && method === 'GET') {
    const row = await env.DB.prepare(
      `SELECT p.*, u.nim, u.full_name AS student_name, g.score, g.feedback, g.rubric_json, g.graded_at
       FROM projects p JOIN users u ON u.id = p.user_id LEFT JOIN grades g ON g.project_id = p.id WHERE p.id = ? LIMIT 1`
    ).bind(projectMatch[1]).first();
    if (!row) return fail('Proyek tidak ditemukan.', 404);
    if (user.role !== 'teacher' && row.user_id !== user.id) return fail('Akses ditolak.', 403);
    row.config = JSON.parse(row.config_json); delete row.config_json;
    return response({ project: row });
  }

  const gradeMatch = path.match(/^\/api\/teacher\/projects\/([\w-]+)\/grade$/);
  if (gradeMatch && method === 'POST') {
    if (user.role !== 'teacher') return fail('Akses dosen diperlukan.', 403);
    let body;
    try { body = await parseJson(request, 10000); } catch { return fail('Data penilaian tidak valid.'); }
    const score = Number(body.score); const feedback = String(body.feedback || '').trim().slice(0, 3000);
    if (!Number.isFinite(score) || score < 0 || score > 100) return fail('Nilai harus antara 0 sampai 100.');
    const project = await env.DB.prepare('SELECT id, status FROM projects WHERE id = ?').bind(gradeMatch[1]).first();
    if (!project || !['submitted','graded'].includes(project.status)) return fail('Proyek belum dikumpulkan atau tidak ditemukan.', 404);
    const gradeId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO grades (id, project_id, grader_id, score, feedback, rubric_json)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(project_id) DO UPDATE SET grader_id = excluded.grader_id, score = excluded.score,
       feedback = excluded.feedback, rubric_json = excluded.rubric_json,
       graded_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`
    ).bind(gradeId, project.id, user.id, score, feedback, JSON.stringify(body.rubric || {})).run();
    await env.DB.prepare("UPDATE projects SET status = 'graded', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").bind(project.id).run();
    return response({ ok: true });
  }

  if (path === '/api/ai/challenge' && method === 'POST') {
    if (!env.AI) return fail('Binding Workers AI belum tersedia. Aktifkan binding AI.', 503);
    let body;
    try { body = await parseJson(request, 10000); } catch { return fail('Permintaan AI tidak valid.'); }
    const deviceType = String(body.deviceType || '');
    if (!DEVICE_TYPES.has(deviceType)) return fail('Pilih salah satu perangkat yang tersedia.');
    const components = Array.isArray(body.components) ? [...new Set(body.components.map((x) => String(x)).filter((x) => ALLOWED_COMPONENTS.has(x)))].slice(0, 24) : [];
    const difficulty = ['Dasar','Menengah','Lanjut'].includes(body.difficulty) ? body.difficulty : 'Menengah';
    const now = Math.floor(Date.now() / 1000);
    const recentAi = await env.DB.prepare('SELECT COUNT(*) AS total FROM ai_requests WHERE user_id = ? AND requested_at > ?').bind(user.id, now - 600).first();
    if (Number(recentAi?.total || 0) >= 5) return fail('Batas pembuatan tantangan AI adalah 5 kali dalam 10 menit per akun. Coba kembali beberapa saat lagi.', 429);
    await env.DB.prepare('INSERT INTO ai_requests (user_id, requested_at) VALUES (?, ?)').bind(user.id, now).run();
    await env.DB.prepare('DELETE FROM ai_requests WHERE requested_at < ?').bind(now - 7 * 86400).run();
    const prompt = `Anda adalah tutor praktikum IoT untuk mahasiswa D-III Teknik Komputer. Buat SATU tantangan praktikum yang berbeda dan dapat dikerjakan menggunakan simulator. Jawab dalam Bahasa Indonesia.\nPerangkat: ${deviceType}\nKomponen: ${components.join(', ')}\nKesulitan: ${difficulty}\nBerikan: judul tantangan, skenario singkat, tujuan, langkah pengujian, kondisi input sensor, kriteria keberhasilan, dan satu pertanyaan refleksi. Pastikan logika teknis realistis dan tidak memberi klaim keselamatan untuk sistem nyata.`;
    try {
      const result = await env.AI.run(AI_MODEL, { messages: [
        { role: 'system', content: 'Anda tutor laboratorium IoT. Berikan instruksi yang akurat, singkat, terstruktur, dan aman.' },
        { role: 'user', content: prompt },
      ], max_tokens: 700, temperature: 0.55 });
      const text = typeof result === 'string' ? result : (result?.response || result?.output_text || '');
      if (!text) throw new Error('Model tidak mengembalikan teks.');
      return response({ challenge: text, model: AI_MODEL, generated: true });
    } catch (error) {
      console.error('AI challenge error:', error);
      return fail('AI belum dapat membuat tantangan. Periksa binding AI dan kuota Workers AI.', 502);
    }
  }

  if (path.startsWith('/api/')) return fail('Endpoint API tidak ditemukan.', 404);
  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try { return await handleApi(request, env); }
      catch (error) {
        console.error('API failure:', error);
        return fail('Terjadi kesalahan pada server. Periksa konfigurasi database dan log Worker.', 500);
      }
    }
    return env.ASSETS.fetch(request);
  },
};
