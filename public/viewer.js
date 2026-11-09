import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let renderer, scene, camera, controls, machineGroup, floor, grid, initialized = false, currentMode = 'desktop';
let host;
const PALETTE = { board: 0x0c9f86, dark: 0x16273a, gold: 0xd9aa4d, blue: 0x3e85db, red: 0xe55b69, cream: 0xeaf0f4 };

function material(color, roughness = 0.55, metalness = 0.12) { return new THREE.MeshStandardMaterial({ color, roughness, metalness }); }
function box(parent, w, h, d, color, x, y, z, r = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color));
  mesh.position.set(x, y, z); mesh.rotation.y = r; mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function cylinder(parent, radiusTop, radiusBottom, height, color, x, y, z, segments = 24) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material(color));
  mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh;
}
function createBoard() {
  const group = new THREE.Group();
  box(group, 3.2, .16, 2.0, PALETTE.board, 0, .08, 0);
  box(group, 2.85, .035, 1.74, 0x16a78d, 0, .18, 0);
  // Main MCU
  box(group, 1.0, .18, .8, PALETTE.dark, 0, .30, 0);
  box(group, .74, .035, .54, 0x263f56, 0, .405, 0);
  for (let i = 0; i < 6; i++) {
    box(group, .05, .08, .05, 0x101a27, -0.3 + i * .12, .45, -.08);
    box(group, .05, .08, .05, 0x101a27, -0.3 + i * .12, .45, .08);
  }
  // USB, regulator, antenna and headers
  box(group, .48, .17, .33, 0xc7d4df, -1.28, .22, -.55);
  box(group, .38, .12, .28, 0x253849, -1.2, .21, .65);
  box(group, .75, .08, .18, 0xd8b354, .9, .25, -.72);
  box(group, .75, .08, .18, 0xd8b354, .9, .25, .72);
  for (let i = 0; i < 13; i++) {
    cylinder(group, .028, .028, .12, PALETTE.gold, -.8 + i * .135, .26, -.87, 8);
    cylinder(group, .028, .028, .12, PALETTE.gold, -.8 + i * .135, .26, .87, 8);
  }
  // Status LEDs
  cylinder(group, .075, .075, .08, PALETTE.red, -0.86, .29, .47, 16);
  cylinder(group, .055, .055, .07, 0x48d5ae, -.67, .28, .47, 16);
  return group;
}
function addUltrasonic(parent, x, z, scale = 1) {
  const g = new THREE.Group();
  box(g, .72 * scale, .12 * scale, .38 * scale, 0x2672c9, 0, .09 * scale, 0);
  for (const dx of [-.21, .21]) {
    cylinder(g, .16 * scale, .16 * scale, .11 * scale, 0x182b40, dx * scale * 1.05, .18 * scale, 0, 32);
    cylinder(g, .12 * scale, .12 * scale, .115 * scale, 0x9db8c7, dx * scale * 1.05, .20 * scale, 0, 32);
    cylinder(g, .085 * scale, .085 * scale, .12 * scale, 0x263d52, dx * scale * 1.05, .22 * scale, 0, 32);
  }
  g.position.set(x, .2, z); parent.add(g); return g;
}
function addSensorBoard(parent, id, x, z, color = 0x298caa) {
  const g = new THREE.Group();
  box(g, .48, .09, .38, color, 0, .05, 0);
  box(g, .18, .07, .15, 0x1b2b3d, .02, .12, -.01);
  for (let i = 0; i < 3; i++) cylinder(g, .022, .022, .08, PALETTE.gold, -.16 + i * .15, .04, .18, 8);
  if (id.includes('soil')) {
    box(g, .06, .8, .06, 0x6f8398, 0, -.34, 0);
    box(g, .05, .3, .055, 0xc8b46f, 0, -.72, 0);
  } else if (id.includes('dht') || id.includes('temp')) {
    box(g, .12, .18, .12, 0xf2eee1, .12, .16, -.02);
  } else if (id.includes('rain')) {
    box(g, .33, .06, .28, 0xd2b15a, 0, .13, 0);
    for (let i = 0; i < 4; i++) box(g, .02, .015, .22, 0x624e36, -.12 + i * .08, .17, 0);
  } else if (id.includes('pir')) {
    cylinder(g, .14, .14, .12, 0xf4f2de, 0, .16, 0, 24);
    cylinder(g, .1, .1, .04, 0xd0e0e1, 0, .24, 0, 24);
  } else if (id.includes('mq')) {
    cylinder(g, .11, .11, .14, 0xd2d9df, 0, .15, 0, 16);
    cylinder(g, .07, .07, .025, 0x7b91a0, 0, .23, 0, 16);
  } else if (id.includes('ph') || id.includes('water-level') || id.includes('turbidity')) {
    box(g, .05, .72, .05, 0x9aa9b5, 0, -.3, 0);
    cylinder(g, .06, .06, .1, 0xe5edf1, 0, -.69, 0, 16);
  }
  g.position.set(x, .19, z); parent.add(g); return g;
}
function addActuator(parent, id, x, z, index) {
  const g = new THREE.Group();
  if (id === 'servo') {
    box(g, .38, .25, .34, 0x2c8fcb, 0, .14, 0);
    cylinder(g, .11, .11, .14, 0xe7e9ef, 0, .33, 0, 16);
    box(g, .68, .05, .09, 0xf3f4f8, .2, .43, 0, -.25);
  } else if (id === 'pump' || id === 'aerator' || id === 'dc-motor') {
    cylinder(g, .23, .23, .43, 0x536c84, 0, .21, 0, 24);
    cylinder(g, .14, .14, .07, 0x7fd1c4, 0, .45, 0, 24);
  } else if (id === 'buzzer') {
    cylinder(g, .16, .16, .18, 0x24374c, 0, .15, 0, 24);
    cylinder(g, .10, .10, .04, 0x0f1b2a, 0, .26, 0, 24);
  } else if (id === 'led' || id === 'rgb-led') {
    cylinder(g, .10, .10, .2, 0x7b8b9a, 0, .12, 0, 16);
    const light = new THREE.Mesh(new THREE.SphereGeometry(.13, 20, 16), new THREE.MeshStandardMaterial({ color: id === 'led' ? 0xef6171 : 0x8c79e9, emissive: id === 'led' ? 0xd72d42 : 0x5f49d0, emissiveIntensity: .5 }));
    light.position.y = .28; g.add(light);
  } else {
    box(g, .35, .22, .3, 0x26384d, 0, .14, 0);
    box(g, .24, .05, .18, 0x70c8bd, 0, .27, 0);
  }
  g.position.set(x, .16, z); parent.add(g); return g;
}

function rebuild(device) {
  if (!initialized || !machineGroup) return;
  while (machineGroup.children.length) {
    const child = machineGroup.children[0]; machineGroup.remove(child);
    child.traverse?.((o) => { o.geometry?.dispose?.(); if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose()); else o.material?.dispose?.(); });
  }
  machineGroup.add(createBoard());
  const components = device.components || [];
  const sensors = components.filter((id) => id !== 'esp32' && id !== 'arduino-uno' && ['soil-moisture','dht22','rain-sensor','ultrasonic','ir-obstacle','pir','ldr','mq2','water-level','ph-sensor','turbidity','water-temp'].includes(id));
  const actuators = components.filter((id) => ['servo','relay','pump','buzzer','led','rgb-led','lcd','dc-motor','aerator'].includes(id));
  if (sensors.includes('ultrasonic')) addUltrasonic(machineGroup, -1.35, -1.3, .85);
  const otherSensors = sensors.filter((id) => id !== 'ultrasonic');
  otherSensors.forEach((id, i) => {
    const angle = (i / Math.max(1, otherSensors.length)) * Math.PI * 2 + .2;
    addSensorBoard(machineGroup, id, Math.cos(angle) * 1.85, Math.sin(angle) * 1.35, [0x248d9c,0x438d6b,0x8d80ae,0xb58b52][i % 4]);
  });
  actuators.forEach((id, i) => addActuator(machineGroup, id, -1.0 + (i % 3) * .95, 1.33 + Math.floor(i / 3) * .55, i));
}

export async function initViewer() {
  if (initialized) return true;
  host = document.getElementById('threeView');
  if (!host) return false;
  try {
    scene = new THREE.Scene(); scene.background = new THREE.Color(0xe7f0f4);
    camera = new THREE.PerspectiveCamera(42, host.clientWidth / host.clientHeight, .1, 100);
    camera.position.set(4.4, 3.6, 5.4);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.innerHTML = ''; host.appendChild(renderer.domElement);
    controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.target.set(0, .2, 0); controls.maxDistance = 11; controls.minDistance = 3.2;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8299a7, 2.0));
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(4, 8, 5); key.castShadow = true; scene.add(key);
    const rim = new THREE.DirectionalLight(0x65dbc6, 1.0); rim.position.set(-5, 3, -4); scene.add(rim);
    floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), material(0xe6eef2, .95, 0)); floor.rotation.x = -Math.PI / 2; floor.position.y = -.06; floor.receiveShadow = true; scene.add(floor);
    grid = new THREE.GridHelper(20, 40, 0xbacdd5, 0xd0dce1); grid.position.y = -.045; scene.add(grid);
    machineGroup = new THREE.Group(); scene.add(machineGroup);
    renderer.setAnimationLoop(() => { if (currentMode === 'desktop') controls.update(); renderer.render(scene, camera); });
    const resize = new ResizeObserver(() => {
      if (!renderer || !host) return;
      const w = host.clientWidth; const h = host.clientHeight;
      camera.aspect = w / Math.max(h, 1); camera.updateProjectionMatrix(); renderer.setSize(w, h);
    }); resize.observe(host);
    initialized = true;
    return true;
  } catch (error) {
    console.error('3D viewer:', error); host.innerHTML = '<div class="scene-placeholder">Visualisasi 3D tidak dapat dimuat pada browser ini.</div>'; return false;
  }
}

export function updateViewer(device) { rebuild(device); }

async function startXR(mode) {
  if (!renderer || !navigator.xr) throw new Error('Browser atau perangkat ini belum mendukung WebXR. Coba Chrome pada perangkat Android yang kompatibel.');
  const sessionType = mode === 'ar' ? 'immersive-ar' : 'immersive-vr';
  const supported = await navigator.xr.isSessionSupported(sessionType);
  if (!supported) throw new Error(`Mode ${mode.toUpperCase()} belum didukung perangkat atau browser ini.`);
  const session = await navigator.xr.requestSession(sessionType, mode === 'ar'
    ? { optionalFeatures: ['local', 'hit-test', 'dom-overlay'], domOverlay: { root: document.body } }
    : { optionalFeatures: ['local-floor', 'bounded-floor'] });
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local');
  currentMode = mode;
  controls.enabled = false;
  if (mode === 'ar') {
    scene.background = null; floor.visible = false; grid.visible = false;
    machineGroup.position.set(0, -.1, -1.15); machineGroup.scale.setScalar(.48);
  } else {
    scene.background = new THREE.Color(0x142439); floor.visible = true; grid.visible = true;
    machineGroup.position.set(0, .0, -2.1); machineGroup.scale.setScalar(.85);
  }
  session.addEventListener('end', () => {
    currentMode = 'desktop'; renderer.xr.enabled = false; controls.enabled = true;
    scene.background = new THREE.Color(0xe7f0f4); floor.visible = true; grid.visible = true;
    machineGroup.position.set(0, 0, 0); machineGroup.scale.setScalar(1);
    const label = document.getElementById('sceneStatus'); if (label) label.textContent = 'DESKTOP 3D VIEW';
  }, { once: true });
  await renderer.xr.setSession(session);
  const label = document.getElementById('sceneStatus'); if (label) label.textContent = mode.toUpperCase() + ' MODE ACTIVE';
}

export async function enterAR() { await startXR('ar'); }
export async function enterVR() { await startXR('vr'); }
