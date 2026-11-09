import { initViewer, updateViewer, enterAR, enterVR } from './viewer.js';

const DEVICE_LIST = [
  { id:'smart-irrigation', name:'Smart Irrigation', short:'Irigasi otomatis', icon:'🌱', tint:'#e7f8ef', code:'DEVICE 01',
    description:'Mengatur penyiraman berdasarkan kelembapan tanah dan intensitas hujan.',
    components:['esp32','soil-moisture','dht22','rain-sensor','relay','pump','led'],
    inputs:[{key:'soilPct',component:'soil-moisture',label:'Kelembapan tanah',unit:'%',min:0,max:100,step:1,low:'Kering',high:'Jenuh'},{key:'rainPct',component:'rain-sensor',label:'Intensitas hujan',unit:'%',min:0,max:100,step:1,low:'Tidak hujan',high:'Hujan lebat'},{key:'tempC',component:'dht22',label:'Suhu udara',unit:'°C',min:15,max:45,step:1,low:'15°C',high:'45°C'}],
    thresholds:{soilDry:35,rainMax:40}, thresholdDefs:[{key:'soilDry',label:'Batas tanah kering',unit:'%',min:10,max:70},{key:'rainMax',label:'Batas hujan maksimum',unit:'%',min:0,max:100}],
    logic:'IF kelembapan tanah di bawah batas kering AND hujan di bawah batas maksimum THEN pompa ON. Jika salah satu kondisi tidak terpenuhi, pompa OFF.' },
  { id:'smart-trash', name:'Smart Trash Bin', short:'Tempat sampah pintar', icon:'🗑️', tint:'#f0edff', code:'DEVICE 02',
    description:'Membuka tutup tempat sampah saat tangan terdeteksi dan memberi peringatan saat penuh.',
    components:['esp32','ultrasonic','ir-obstacle','servo','buzzer','led','lcd'],
    inputs:[{key:'handDetected',component:'ir-obstacle',label:'Objek/tangan terdeteksi IR',type:'toggle',onLabel:'Objek terdeteksi',offLabel:'Tidak ada objek'},{key:'handCm',component:'ultrasonic',label:'Jarak tangan',unit:'cm',min:2,max:100,step:1,low:'2 cm',high:'100 cm'},{key:'fillPct',component:'ultrasonic',label:'Kapasitas tempat sampah',unit:'%',min:0,max:100,step:1,low:'Kosong',high:'Penuh'}],
    thresholds:{openCm:25,fullLimit:85}, thresholdDefs:[{key:'openCm',label:'Jarak buka tutup',unit:'cm',min:5,max:60},{key:'fullLimit',label:'Batas kapasitas penuh',unit:'%',min:50,max:100}],
    logic:'IF jarak tangan lebih kecil dari batas buka THEN servo membuka tutup. IF kapasitas mencapai batas penuh THEN buzzer dan LED peringatan aktif.' },
  { id:'flood-warning', name:'Flood Early Warning', short:'Peringatan dini banjir', icon:'🌊', tint:'#e7f3ff', code:'DEVICE 03',
    description:'Memantau kenaikan permukaan air dan intensitas hujan untuk memberi peringatan dini.',
    components:['esp32','ultrasonic','water-level','rain-sensor','buzzer','led','lcd'],
    inputs:[{key:'waterPct',component:'water-level',label:'Ketinggian air (indeks)',unit:'%',min:0,max:100,step:1,low:'Normal',high:'Kritis'},{key:'rainPct',component:'rain-sensor',label:'Intensitas hujan',unit:'%',min:0,max:100,step:1,low:'Tidak hujan',high:'Hujan lebat'}],
    thresholds:{floodLimit:65,rainLimit:80}, thresholdDefs:[{key:'floodLimit',label:'Ambang ketinggian air',unit:'%',min:30,max:95},{key:'rainLimit',label:'Ambang intensitas hujan',unit:'%',min:40,max:100}],
    logic:'IF indeks ketinggian air mencapai ambang banjir OR intensitas hujan mencapai ambang hujan lebat THEN buzzer dan LED merah aktif.' },
  { id:'smart-parking', name:'Smart Parking System', short:'Parkir otomatis', icon:'🅿️', tint:'#e9f6ff', code:'DEVICE 04',
    description:'Mendeteksi slot parkir kosong dan mengendalikan palang masuk secara otomatis.',
    components:['esp32','ultrasonic','ir-obstacle','servo','led','lcd'],
    inputs:[{key:'slotCm',component:'ultrasonic',label:'Jarak objek di slot',unit:'cm',min:2,max:150,step:1,low:'Dekat',high:'Kosong'},{key:'approachDetected',component:'ir-obstacle',label:'Kendaraan terdeteksi IR',type:'toggle',onLabel:'Kendaraan terdeteksi',offLabel:'Tidak ada kendaraan'}],
    thresholds:{occupiedCm:15}, thresholdDefs:[{key:'occupiedCm',label:'Batas slot terisi',unit:'cm',min:5,max:40}],
    logic:'IF jarak slot lebih kecil dari batas maka slot TERISI. IF slot KOSONG AND kendaraan mendekati palang THEN servo membuka palang.' },
  { id:'smart-home', name:'Smart Home Automation', short:'Otomatisasi rumah', icon:'🏠', tint:'#fff2e7', code:'DEVICE 05',
    description:'Mengatur lampu dan kipas berdasarkan gerakan, cahaya, suhu, dan mendeteksi gas.',
    components:['esp32','pir','ldr','dht22','mq2','relay','led','dc-motor','buzzer'],
    inputs:[{key:'motion',component:'pir',label:'Deteksi gerakan PIR',type:'toggle',onLabel:'Gerakan terdeteksi',offLabel:'Tidak ada gerakan'},{key:'lightLux',component:'ldr',label:'Intensitas cahaya',unit:'%',min:0,max:100,step:1,low:'Gelap',high:'Terang'},{key:'gasPpm',component:'mq2',label:'Indeks gas/asap',unit:'ppm*',min:0,max:1000,step:10,low:'Rendah',high:'Tinggi'},{key:'tempC',component:'dht22',label:'Suhu ruangan',unit:'°C',min:15,max:45,step:1,low:'15°C',high:'45°C'}],
    thresholds:{darkLimit:35,gasLimit:350,hotLimit:32}, thresholdDefs:[{key:'darkLimit',label:'Batas kondisi gelap',unit:'%',min:5,max:70},{key:'gasLimit',label:'Ambang indeks gas',unit:'ppm*',min:100,max:900},{key:'hotLimit',label:'Batas suhu kipas',unit:'°C',min:25,max:40}],
    logic:'IF gerakan terdeteksi AND cahaya di bawah batas gelap THEN lampu ON. IF indeks gas tinggi THEN buzzer aktif. IF suhu tinggi THEN kipas ON.' },
  { id:'fish-pond', name:'Smart Fish Pond', short:'Monitoring kolam ikan', icon:'🐟', tint:'#e7f8fb', code:'DEVICE 06',
    description:'Memantau suhu, pH, kekeruhan, dan ketinggian air kolam untuk mendukung pengelolaan.',
    components:['esp32','water-temp','ph-sensor','turbidity','water-level','relay','pump','aerator','lcd','buzzer'],
    inputs:[{key:'waterTempC',component:'water-temp',label:'Suhu air',unit:'°C',min:15,max:40,step:1,low:'15°C',high:'40°C'},{key:'ph',component:'ph-sensor',label:'Nilai pH',unit:'pH',min:4,max:10,step:.1,low:'Asam',high:'Basa'},{key:'turbidity',component:'turbidity',label:'Indeks kekeruhan',unit:'NTU*',min:0,max:100,step:1,low:'Jernih',high:'Keruh'},{key:'waterLevel',component:'water-level',label:'Ketinggian air',unit:'%',min:0,max:100,step:1,low:'Rendah',high:'Penuh'}],
    thresholds:{tempMax:30,phMin:6.5,phMax:8.5,turbidityMax:65,levelMin:25}, thresholdDefs:[{key:'tempMax',label:'Batas suhu air',unit:'°C',min:20,max:38},{key:'phMin',label:'Batas pH bawah',unit:'pH',min:4,max:8,step:.1},{key:'phMax',label:'Batas pH atas',unit:'pH',min:6,max:10,step:.1},{key:'turbidityMax',label:'Batas kekeruhan',unit:'NTU*',min:20,max:100},{key:'levelMin',label:'Batas ketinggian air',unit:'%',min:5,max:70}],
    logic:'IF suhu air atau kekeruhan melebihi ambang THEN aerator aktif. IF pH di luar rentang atau air terlalu rendah THEN sistem memberi peringatan.' },
];

const COMPONENTS = [
  {id:'esp32',name:'ESP32 DevKit',category:'controller',symbol:'▦',note:'Wi-Fi dan Bluetooth'},
  {id:'arduino-uno',name:'Arduino Uno R3',category:'controller',symbol:'▣',note:'Mikrokontroler ATmega328P'},
  {id:'soil-moisture',name:'Soil Moisture',category:'sensor',symbol:'⌁',note:'Kelembapan tanah'},
  {id:'dht22',name:'DHT22',category:'sensor',symbol:'🌡',note:'Suhu dan kelembapan udara'},
  {id:'rain-sensor',name:'Rain Sensor',category:'sensor',symbol:'☂',note:'Deteksi intensitas hujan'},
  {id:'ultrasonic',name:'HC-SR04',category:'sensor',symbol:'◉',note:'Jarak ultrasonik'},
  {id:'ir-obstacle',name:'IR Obstacle',category:'sensor',symbol:'◍',note:'Deteksi objek inframerah'},
  {id:'pir',name:'PIR Motion',category:'sensor',symbol:'⌖',note:'Deteksi gerakan'},
  {id:'ldr',name:'LDR',category:'sensor',symbol:'☼',note:'Intensitas cahaya'},
  {id:'mq2',name:'MQ-2 Gas',category:'sensor',symbol:'〰',note:'Indikasi gas/asap'},
  {id:'water-level',name:'Water Level',category:'sensor',symbol:'≋',note:'Ketinggian air'},
  {id:'ph-sensor',name:'pH Sensor',category:'sensor',symbol:'pH',note:'Tingkat keasaman air'},
  {id:'turbidity',name:'Turbidity',category:'sensor',symbol:'◌',note:'Kekeruhan air'},
  {id:'water-temp',name:'Water Temp',category:'sensor',symbol:'♨',note:'Suhu air'},
  {id:'servo',name:'Servo Motor',category:'actuator',symbol:'↻',note:'Gerak sudut mekanis'},
  {id:'relay',name:'Relay Module',category:'actuator',symbol:'▤',note:'Saklar elektronik'},
  {id:'pump',name:'Water Pump',category:'actuator',symbol:'♧',note:'Pompa air DC'},
  {id:'aerator',name:'Aerator',category:'actuator',symbol:'◉',note:'Aerasi kolam'},
  {id:'dc-motor',name:'DC Motor',category:'actuator',symbol:'⚙',note:'Motor arus searah'},
  {id:'buzzer',name:'Buzzer',category:'actuator',symbol:'♫',note:'Alarm suara'},
  {id:'led',name:'LED',category:'actuator',symbol:'●',note:'Indikator visual'},
  {id:'rgb-led',name:'RGB LED',category:'actuator',symbol:'◉',note:'Indikator tiga warna'},
  {id:'lcd',name:'LCD 16×2',category:'display',symbol:'▭',note:'Display karakter'},
];
const ESP32_PIN_OPTIONS = ['D2','D4','D5','D12','D13','D14','D15','D18','D19','D21','D22','D23','D25','D26','D27','D32','D33','A0','A1','A2','A3'];
const ARDUINO_PIN_OPTIONS = ['D2','D3','D4','D5','D6','D7','D8','D9','D10','D11','D12','D13','A0','A1','A2','A3','A4','A5'];
const PIN_DEFAULT = {'ultrasonic':'D5','soil-moisture':'A0','dht22':'D4','rain-sensor':'A1','ir-obstacle':'D13','pir':'D14','ldr':'A2','mq2':'A3','water-level':'A0','ph-sensor':'A1','turbidity':'A2','water-temp':'D4','servo':'D18','relay':'D19','pump':'D19','buzzer':'D22','led':'D2','rgb-led':'D2','lcd':'D21','aerator':'D19','dc-motor':'D23'};
const ARDUINO_PIN_DEFAULT = {'ultrasonic':'D5','soil-moisture':'A0','dht22':'D2','rain-sensor':'A1','ir-obstacle':'D6','pir':'D7','ldr':'A2','mq2':'A3','water-level':'A0','ph-sensor':'A1','turbidity':'A2','water-temp':'D2','servo':'D9','relay':'D10','pump':'D10','buzzer':'D11','led':'D13','rgb-led':'D3','lcd':'A4','aerator':'D10','dc-motor':'D12'};
const EMPTY_INPUTS = {
  'smart-irrigation':{soilPct:28,rainPct:10,tempC:29}, 'smart-trash':{handDetected:false,handCm:45,fillPct:40},
  'flood-warning':{waterPct:22,rainPct:40}, 'smart-parking':{slotCm:80,approachDetected:false},
  'smart-home':{motion:false,lightLux:25,gasPpm:80,tempC:27}, 'fish-pond':{waterTempC:27,ph:7.2,turbidity:24,waterLevel:80},
};
let currentUser=null, demoMode=false, currentPage='builder', currentProjectId=null, currentProjectStatus='draft';
let state={...makeDefaults('smart-irrigation'),catalogCategory:'all'};
let saveTimer=null, saveInFlight=null, saveAgain=false, activeGradeProject=null, teacherProjects=[], teacherStudents=[];
const $=(id)=>document.getElementById(id);
const api=async(path,options={})=>{
  const response=await fetch(path,{credentials:'same-origin',headers:{'content-type':'application/json',...(options.headers||{})},...options});
  let data={};try{data=await response.json()}catch{}
  if(!response.ok){const error=new Error(data.error||`Permintaan gagal (${response.status})`);error.status=response.status;throw error}
  return data;
};
function toast(message,error=false){const el=$('toast');el.textContent=message;el.className='toast show'+(error?' error':'');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.className='toast',3200)}
function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function getDevice(id=state.deviceType){return DEVICE_LIST.find(d=>d.id===id)||DEVICE_LIST[0]}
function currentController(){return state?.components?.includes('arduino-uno')?'arduino-uno':'esp32'}
function pinOptions(){return currentController()==='arduino-uno'?ARDUINO_PIN_OPTIONS:ESP32_PIN_OPTIONS}
function defaultPinFor(id,board='esp32'){return (board==='arduino-uno'?ARDUINO_PIN_DEFAULT:PIN_DEFAULT)[id]||'D2'}
function makeDefaults(deviceId){const d=getDevice(deviceId);return {deviceType:d.id,title:`Proyek ${d.name}`,components:[...d.components],pins:Object.fromEntries(d.components.filter(x=>PIN_DEFAULT[x]).map(x=>[x,defaultPinFor(x,'esp32')])),inputs:{...EMPTY_INPUTS[d.id]},thresholds:{...d.thresholds}}}
function friendlyStatus(status){return status==='graded'?'Sudah dinilai':status==='submitted'?'Menunggu penilaian':'Draft'}
function statusClass(status){return status==='graded'?'graded':status==='submitted'?'submitted':''}
function setLoginVisible(){ $('loginScreen').classList.remove('hidden'); $('appShell').classList.add('hidden'); }
function setAppVisible(){ $('loginScreen').classList.add('hidden'); $('appShell').classList.remove('hidden'); }
function setRoleUI(){
  const isTeacher=currentUser?.role==='teacher';$('studentNav').classList.toggle('hidden',isTeacher);$('teacherNav').classList.toggle('hidden',!isTeacher);
  $('userName').textContent=currentUser?.name||'Demo Mode';$('userRole').textContent=isTeacher?'Dosen Pengampu':demoMode?'Mode Demo':`Mahasiswa · ${currentUser?.nim||''}`;
  $('userAvatar').textContent=(currentUser?.name||'IoT').split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase();$('footerMode').textContent=demoMode?'MODE DEMO':isTeacher?'LECTURER CONSOLE':'STUDENT WORKSPACE';
}
function pageName(page){return ({builder:'IoT Device Builder Lab',projects:'Proyek Saya',challenge:'AI Practice Studio',teacher:'Dashboard Dosen',students:'Kelola Mahasiswa',submissions:'Penilaian Praktikum'})[page]||'IoT Device Builder Lab'}
function navigate(page){
  if(currentUser?.role==='teacher'&&!['teacher','students','submissions'].includes(page))page='teacher';
  if(currentUser?.role==='student'&&!['builder','projects','challenge'].includes(page))page='builder';
  currentPage=page;$('pageTitle').textContent=pageName(page);
  document.querySelectorAll('.page').forEach(el=>el.classList.add('hidden'));
  const pageEl=$(`${page}Page`);if(pageEl)pageEl.classList.remove('hidden');
  document.querySelectorAll('.side-link').forEach(el=>el.classList.toggle('active',el.dataset.page===page));
  if(page==='projects')loadMyProjects();if(page==='teacher')loadTeacherDashboard();if(page==='students')loadStudents();if(page==='submissions')loadSubmissions();
}
function showChangePassword(){
  const modal=document.createElement('div');modal.className='modal-backdrop';modal.innerHTML=`<form class="modal-card" id="passwordChangeForm"><div class="eyebrow">KEAMANAN AKUN</div><h2>Ganti password awal</h2><p>Untuk melindungi akun, buat password pribadi sebelum melanjutkan.</p><label>Password awal<input name="oldPassword" type="password" required autocomplete="current-password"></label><label>Password baru<input name="newPassword" type="password" minlength="8" required autocomplete="new-password"></label><label>Ulangi password baru<input name="confirmPassword" type="password" minlength="8" required autocomplete="new-password"></label><div class="modal-error" id="passwordError"></div><button class="btn primary full" type="submit">Simpan password baru</button></form>`;
  document.body.appendChild(modal);modal.querySelector('form').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target);const oldPassword=f.get('oldPassword'),newPassword=f.get('newPassword');if(newPassword!==f.get('confirmPassword')){$('passwordError').textContent='Konfirmasi password tidak sama.';return}try{await api('/api/auth/change-password',{method:'POST',body:JSON.stringify({oldPassword,newPassword})});currentUser.mustChangePassword=false;modal.remove();toast('Password berhasil diperbarui.');if(currentUser.role==='student')renderBuilder();navigate(currentUser.role==='teacher'?'teacher':'builder')}catch(err){$('passwordError').textContent=err.message}});
}
async function login(nim,password){const data=await api('/api/auth/login',{method:'POST',body:JSON.stringify({nim,password})});currentUser=data.user;demoMode=false;currentProjectId=null;currentProjectStatus='draft';if(currentUser.role==='student')state={...makeDefaults('smart-irrigation'),catalogCategory:'all'};setAppVisible();setRoleUI();renderChallengeDevice();if(currentUser.mustChangePassword)showChangePassword();else{if(currentUser.role==='student')renderBuilder();navigate(currentUser.role==='teacher'?'teacher':'builder')}}
async function logout(){try{if(!demoMode)await api('/api/auth/logout',{method:'POST',body:'{}'})}catch{}currentUser=null;demoMode=false;currentProjectId=null;currentProjectStatus='draft';state={...makeDefaults('smart-irrigation'),catalogCategory:'all'};setLoginVisible();$('loginPassword').value='';$('loginMessage').textContent=''}

function renderDeviceCards(){
  $('deviceGrid').innerHTML=DEVICE_LIST.map(d=>`<button class="device-card ${d.id===state.deviceType?'active':''}" data-device="${d.id}" style="--device-tint:${d.tint}"><span class="device-icon">${d.icon}</span><b>${d.name}</b><small>${d.short}</small></button>`).join('');
}
function renderComponents(){
  $('componentCount').textContent=`${state.components.length} komponen`;
  $('selectedComponents').innerHTML=state.components.map(id=>{const c=COMPONENTS.find(x=>x.id===id);if(!c)return '';const locked=['esp32','arduino-uno'].includes(id);return `<span class="component-chip ${locked?'locked':''}">${c.symbol} ${c.name}${locked?'<small> · board</small>':`<button type="button" data-remove="${id}" title="Lepaskan">×</button>`}</span>`}).join('')||'<span class="muted">Belum ada komponen.</span>';
  const category=state.catalogCategory;
  const available=COMPONENTS.filter(c=>(category==='all'||c.category===category)&&!state.components.includes(c.id));
  $('componentCatalog').innerHTML=available.map(c=>`<button class="catalog-item" data-add="${c.id}"><span class="catalog-symbol">${c.symbol}</span><span class="catalog-copy"><b>${c.name}</b><small>${c.note}</small></span><span class="catalog-plus">＋</span></button>`).join('')||'<div class="empty-state">Semua komponen pada kategori ini sudah terpasang.</div>';
  $('pinMap').innerHTML=state.components.filter(id=>PIN_DEFAULT[id]).map(id=>{const c=COMPONENTS.find(x=>x.id===id);const options=pinOptions();let selected=state.pins[id]||defaultPinFor(id,currentController());if(!options.includes(selected)){selected=defaultPinFor(id,currentController());state.pins[id]=selected;}return `<div class="pin-row"><span>${esc(c?.name||id)}</span><select data-pin="${id}">${options.map(pin=>`<option ${pin===selected?'selected':''}>${pin}</option>`).join('')}</select></div>`}).join('')||'<div class="empty-state">Tambahkan komponen untuk mengatur pin.</div>';
  updateViewer({components:state.components});
}
function renderThresholds(){const d=getDevice();$('logicDescription').textContent=d.logic;
  const container=$('logicResult');const outputs=evaluateDevice();container.className='logic-result '+(outputs.level==='alert'?'alert':outputs.level==='warn'?'warn':'');container.textContent=outputs.summary;
  const outputsList=$('simOutputs');outputsList.innerHTML=outputs.outputs.map(out=>`<div class="output-pill ${out.on?'on':''} ${out.available?'':'missing'}"><i></i>${esc(out.label)} <b>${out.available?(out.on?esc(out.onText||'ON'):esc(out.offText||'OFF')):'BELUM DIPASANG'}</b></div>`).join('');
}
function renderSensorControls(){
  const d=getDevice();const inputHtml=d.inputs.map(def=>{
    const value=state.inputs[def.key];const installed=!def.component||state.components.includes(def.component);
    if(def.type==='toggle')return `<div class="sensor-control"><div class="sensor-control-head"><span>${def.label}${installed?'':' · sensor belum dipasang'}</span><label class="toggle-control"><input type="checkbox" data-input="${def.key}" ${value?'checked':''} ${installed?'':'disabled'}><span class="toggle-text">${value?def.onLabel:def.offLabel}</span></label></div></div>`;
    return `<div class="sensor-control"><div class="sensor-control-head"><span>${def.label}${installed?'':' · sensor belum dipasang'}</span><b id="value-${def.key}">${value} ${def.unit}</b></div><input type="range" data-input="${def.key}" min="${def.min}" max="${def.max}" step="${def.step}" value="${value}" ${installed?'':'disabled'}><div class="range-meta"><span>${def.low}</span><span>${def.high}</span></div></div>`;
  }).join('');
  const thresholds=d.thresholdDefs.map(def=>`<div class="threshold-row"><label>${def.label}<div><input type="number" data-threshold="${def.key}" min="${def.min}" max="${def.max}" step="${def.step||1}" value="${state.thresholds[def.key]}"><small>${def.unit}</small></div></label></div>`).join('');
  $('sensorControls').innerHTML=inputHtml+`<div class="threshold-area"><div class="threshold-heading">Atur ambang keputusan</div>${thresholds}</div>`;
  $('simDeviceName').textContent=d.name;
}
function evaluateDevice(){
  const i=state.inputs,t=state.thresholds;const outputs=[];let summary='',level='ok';
  const has=(id)=>state.components.includes(id);
  const names=(ids)=>ids.filter(id=>!has(id)).map(id=>COMPONENTS.find(c=>c.id===id)?.name||id);
  const add=(label,on,onText='ON',offText='OFF',available=true)=>outputs.push({label,on:Boolean(on)&&available,available,onText,offText});
  const describeMissing=(ids)=>{const list=names(ids);return list.length?` Komponen belum terpasang: ${list.join(', ')}.`:''};
  switch(state.deviceType){
    case 'smart-irrigation':{
      const sensors=['soil-moisture','rain-sensor'];const sensorReady=sensors.every(has);const pumpReady=has('pump')&&has('relay');
      const pump=sensorReady&&pumpReady&&Number(i.soilPct)<Number(t.soilDry)&&Number(i.rainPct)<Number(t.rainMax);
      add('Pembacaan sensor',sensorReady,'TERBACA','TIDAK TERSEDIA',sensorReady);add('Pompa air',pump,'AKTIF','MATI',pumpReady);add('LED status',pump,'PENYIRAMAN','SIAGA',has('led'));
      summary=sensorReady?(pumpReady?(pump?'Tanah kering dan hujan rendah: pompa dinyalakan.':'Kondisi belum memenuhi syarat penyiraman: pompa mati.'):'Sensor terbaca, tetapi pompa dan relay belum lengkap.'):'Pasang sensor kelembapan tanah dan sensor hujan untuk membaca kondisi lahan.';
      summary+=describeMissing([...sensors,...(!pumpReady?['pump','relay']:[])]);if(!sensorReady||!pumpReady)level='warn';break;
    }
    case 'smart-trash':{
      const sensorReady=has('ultrasonic')&&has('ir-obstacle');const servoReady=has('servo');const buzzerReady=has('buzzer');const open=sensorReady&&servoReady&&Boolean(i.handDetected)&&Number(i.handCm)<Number(t.openCm);const full=sensorReady&&Number(i.fillPct)>=Number(t.fullLimit);
      add('Sensor IR + ultrasonik',sensorReady,'TERBACA','TIDAK TERSEDIA',sensorReady);add('Servo tutup',open,'TERBUKA','TERTUTUP',servoReady);add('Buzzer penuh',full,'ALARM','DIAM',buzzerReady);add('LED indikator',full,'MERAH','HIJAU',has('led'));
      summary=sensorReady?(open?'Tangan terdeteksi dekat: tutup terbuka. ':'Tidak ada tangan dekat: tutup tertutup. ')+(full?'Kapasitas melewati ambang penuh.':'Kapasitas masih tersedia.'):'Pasang IR Obstacle dan HC-SR04 untuk mendeteksi objek serta mengukur jaraknya.';
      summary+=describeMissing(['ultrasonic','ir-obstacle',...(!servoReady?['servo']:[]),...(!buzzerReady?['buzzer']:[])]);if(!sensorReady||!servoReady||!buzzerReady)level='warn';break;
    }
    case 'flood-warning':{
      const sensorsReady=has('water-level')&&has('rain-sensor');const alert=sensorsReady&&(Number(i.waterPct)>=Number(t.floodLimit)||Number(i.rainPct)>=Number(t.rainLimit));
      add('Pembacaan level air & hujan',sensorsReady,'TERBACA','TIDAK TERSEDIA',sensorsReady);add('Buzzer peringatan',alert,'AKTIF','MATI',has('buzzer'));add('LED indikator',alert,'MERAH','HIJAU',has('led'));add('LCD status',alert,'WASPADA','NORMAL',has('lcd'));
      summary=sensorsReady?(alert?'Ambang risiko simulasi terlampaui: peringatan diaktifkan.':'Ketinggian air dan hujan masih di bawah ambang simulasi.'):'Pasang sensor water level dan rain sensor agar sistem dapat menilai kondisi banjir.';
      summary+=describeMissing(['water-level','rain-sensor',...(!has('buzzer')?['buzzer']:[])]);if(!sensorsReady||!has('buzzer'))level='warn';if(alert)level='alert';break;
    }
    case 'smart-parking':{
      const sensorsReady=has('ultrasonic')&&has('ir-obstacle');const occupied=sensorsReady&&Number(i.slotCm)<Number(t.occupiedCm);const gate=sensorsReady&&!occupied&&Boolean(i.approachDetected);
      add('Pembacaan slot & kendaraan',sensorsReady,'TERBACA','TIDAK TERSEDIA',sensorsReady);add('Status slot',occupied,'TERISI','KOSONG',has('lcd'));add('Servo palang',gate,'TERBUKA','TERTUTUP',has('servo'));add('LED status',occupied,'MERAH','HIJAU',has('led'));
      summary=sensorsReady?(occupied?'Slot terdeteksi terisi: palang tidak dibuka.':gate?'Slot kosong dan kendaraan mendekat: palang dibuka.':'Slot kosong, belum ada kendaraan dekat palang.'):'Pasang HC-SR04 dan IR Obstacle untuk memantau slot serta kendaraan yang mendekat.';
      summary+=describeMissing(['ultrasonic','ir-obstacle',...(!has('servo')?['servo']:[])]);if(!sensorsReady||!has('servo'))level='warn';break;
    }
    case 'smart-home':{
      const motionReady=has('pir'),lightReady=has('ldr'),gasReady=has('mq2'),tempReady=has('dht22');
      const light=motionReady&&lightReady&&Boolean(i.motion)&&Number(i.lightLux)<Number(t.darkLimit);const gas=gasReady&&Number(i.gasPpm)>=Number(t.gasLimit);const fan=tempReady&&Number(i.tempC)>=Number(t.hotLimit);
      add('Lampu otomatis',light,'MENYALA','MATI',has('led')||has('relay'));add('Kipas',fan,'MENYALA','MATI',has('dc-motor')||has('relay'));add('Buzzer gas',gas,'ALARM','DIAM',has('buzzer'));
      summary=`Lampu ${light?'menyala':motionReady&&lightReady?'mati':'belum tersedia'}, kipas ${fan?'aktif':tempReady?'mati':'belum tersedia'}, alarm gas ${gas?'aktif':gasReady?'normal':'belum tersedia'}.`;
      summary+=describeMissing(['pir','ldr','mq2','dht22',...(!has('led')&&!has('relay')?['led/relay']:[])]);if(!motionReady||!lightReady||!gasReady||!tempReady)level='warn';if(gas)level='alert';break;
    }
    case 'fish-pond':{
      const tempReady=has('water-temp'),phReady=has('ph-sensor'),turbidityReady=has('turbidity'),levelReady=has('water-level');
      const aerator=(tempReady&&Number(i.waterTempC)>Number(t.tempMax))||(turbidityReady&&Number(i.turbidity)>Number(t.turbidityMax));const phAlert=phReady&&(Number(i.ph)<Number(t.phMin)||Number(i.ph)>Number(t.phMax));const low=levelReady&&Number(i.waterLevel)<Number(t.levelMin);
      add('Aerator',aerator,'AKTIF','MATI',has('aerator'));add('Pompa isi air',low,'AKTIF','MATI',has('pump'));add('Buzzer kualitas air',phAlert||low,'PERINGATAN','DIAM',has('buzzer'));add('LCD monitoring',true,'DATA TERBACA','MATI',has('lcd'));
      summary=`Aerator ${aerator?'aktif':'siaga'}; pompa ${low?'mengisi':'mati'}; `+(phReady?(phAlert?'pH di luar rentang.':'pH dalam rentang simulasi.'):'sensor pH belum tersedia.');
      summary+=describeMissing(['water-temp','ph-sensor','turbidity','water-level',...(!has('aerator')?['aerator']:[])]);if(!tempReady||!phReady||!turbidityReady||!levelReady||!has('aerator'))level='warn';if(phAlert||low)level='alert';break;
    }
  }
  return {outputs,summary,level};
}
function renderBuilder(){
  const d=getDevice();renderDeviceCards();$('deviceCode').textContent=d.code;$('simControllerName').textContent=currentController()==='arduino-uno'?'Arduino Uno · VIRTUAL CONTROLLER':'ESP32 · VIRTUAL CONTROLLER';$('projectTitle').value=state.title;$('projectTitle').disabled=currentProjectStatus!=='draft'&&!demoMode;
  renderComponents();renderSensorControls();renderThresholds();$('projectMeta').textContent=`${currentProjectId?'Proyek tersimpan':'Draft baru'} · ${friendlyStatus(currentProjectStatus)}`;
  const locked=currentProjectStatus!=='draft'&&!demoMode;
  $('submitProjectButton').disabled=locked;$('newProjectButton').disabled=demoMode===false&&currentUser?.role!=='student';
  $('saveIndicator').classList.toggle('hidden',demoMode);$('saveIndicator').querySelector('span').textContent='Autosave aktif';
  document.querySelectorAll('.catalog-tab').forEach(b=>b.classList.toggle('active',b.dataset.category===state.catalogCategory));
  if(locked){document.querySelectorAll('#deviceGrid button, #componentCatalog button, #selectedComponents button, #pinMap select, #sensorControls input, #projectTitle, .catalog-tab').forEach(el=>el.disabled=true);$('resetSimulation').disabled=true;$('saveNow').disabled=true;}else{$('resetSimulation').disabled=false;$('saveNow').disabled=false;}
}
function setDirty(){
  if(demoMode){localStorage.setItem('iot-device-builder-demo',JSON.stringify({state,currentProjectId}));$('autosaveText').textContent='✓ Tersimpan pada browser ini (demo)';return}
  if(currentUser?.role!=='student'||currentProjectStatus!=='draft')return;
  $('autosaveText').className='save-status saving';$('autosaveText').innerHTML='<i></i> Menyimpan perubahan…';
  clearTimeout(saveTimer);saveTimer=setTimeout(()=>saveProject(true),850);
}
async function saveProject(silent=false){
  if(demoMode){localStorage.setItem('iot-device-builder-demo',JSON.stringify({state,currentProjectId}));$('autosaveText').className='save-status';$('autosaveText').innerHTML='<i></i> Tersimpan di browser demo';return true}
  if(currentUser?.role!=='student'||currentProjectStatus!=='draft')return false;
  if(saveInFlight){saveAgain=true;return saveInFlight;}
  if(!currentProjectId)currentProjectId=crypto.randomUUID();
  const snapshot={id:currentProjectId,deviceType:state.deviceType,title:state.title,config:{components:[...state.components],pins:{...state.pins},inputs:{...state.inputs},thresholds:{...state.thresholds}}};
  saveInFlight=(async()=>{
    try{
      const data=await api('/api/projects/autosave',{method:'POST',body:JSON.stringify(snapshot)});
      $('autosaveText').className='save-status';$('autosaveText').innerHTML=`<i></i> Tersimpan otomatis · ${new Date(data.savedAt).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}`;
      $('projectMeta').textContent=`ID ${snapshot.id.slice(0,8)} · Draft tersimpan`;return true;
    }catch(error){$('autosaveText').className='save-status error';$('autosaveText').innerHTML='<i></i> Gagal menyimpan';if(!silent)toast(error.message,true);return false}
  })();
  try{return await saveInFlight;}
  finally{saveInFlight=null;if(saveAgain){saveAgain=false;clearTimeout(saveTimer);saveTimer=setTimeout(()=>saveProject(true),150);}}
}
function resetForDevice(deviceId){const defaults=makeDefaults(deviceId);state={...defaults,catalogCategory:'all'};currentProjectStatus='draft';renderBuilder();setDirty()}
async function newProject(){clearTimeout(saveTimer);if(!demoMode&&currentUser?.role==='student'&&currentProjectStatus==='draft')await saveProject(true);currentProjectId=null;currentProjectStatus='draft';resetForDevice('smart-irrigation');toast('Draft proyek baru dibuat.');}

async function loadMyProjects(){
  const box=$('myProjectsList');box.innerHTML='<div class="empty-state">Memuat proyek...</div>';
  try{const data=await api('/api/projects');const projects=data.projects||[];if(!projects.length){box.innerHTML='<div class="panel empty-state">Belum ada proyek. Mulai dari salah satu perangkat pada Device Builder.</div>';return}
    box.innerHTML=projects.map(p=>`<article class="project-row"><div><h3>${esc(p.title)}</h3><p>${esc(getDevice(p.device_type).name)} · Diubah ${new Date(p.updated_at).toLocaleString('id-ID')}</p>${p.score!==null&&p.score!==undefined?`<p><b>Nilai: ${p.score}/100</b> · ${esc(p.feedback||'')}</p>`:''}</div><div><span class="status-tag ${statusClass(p.status)}">${friendlyStatus(p.status)}</span><br><button class="table-action open-own-project" data-open-project="${esc(p.id)}" data-status="${esc(p.status)}">${p.status==='draft'?'Lanjutkan':'Lihat'}</button></div></article>`).join('');
    box.querySelectorAll('[data-open-project]').forEach(b=>b.addEventListener('click',()=>openProject(b.dataset.openProject,b.dataset.status)));
  }catch(error){box.innerHTML=`<div class="empty-state">${esc(error.message)}</div>`}
}
async function openProject(id,status){
  try{const data=await api(`/api/projects/${id}`);const p=data.project;currentProjectId=p.id;currentProjectStatus=p.status;state={deviceType:p.device_type,title:p.title,...p.config,catalogCategory:'all'};renderBuilder();navigate('builder');if(p.status!=='draft')toast(`Proyek ${friendlyStatus(p.status).toLowerCase()} · hanya dapat dilihat.`)}catch(error){toast(error.message,true)}
}
async function submitProject(){
  if(demoMode){toast('Mode demo tidak dapat mengumpulkan penilaian. Login dengan akun mahasiswa.',true);return}
  if(!currentProjectId){const ok=await saveProject();if(!ok)return}
  const ok=await saveProject();if(!ok)return;
  if(!confirm('Kumpulkan proyek ini untuk dinilai dosen? Setelah dikumpulkan, konfigurasi tidak dapat diedit.'))return;
  try{await api(`/api/projects/${currentProjectId}/submit`,{method:'POST',body:'{}'});currentProjectStatus='submitted';renderBuilder();toast('Praktikum berhasil dikumpulkan.');}catch(error){toast(error.message,true)}
}

function renderChallengeDevice(){ $('challengeDevice').innerHTML=DEVICE_LIST.map(d=>`<option value="${d.id}">${d.name}</option>`).join('');$('challengeDevice').value=state.deviceType; }
async function generateChallenge(){
  const button=$('generateChallenge');button.disabled=true;button.textContent='✳ Menyusun tantangan…';$('challengeResult').innerHTML='<div class="empty-state">AI sedang menyusun skenario praktikum…</div>';
  try{const device=getDevice($('challengeDevice').value);const challengeComponents=device.id===state.deviceType?state.components:device.components;const data=await api('/api/ai/challenge',{method:'POST',body:JSON.stringify({deviceType:device.id,components:challengeComponents,difficulty:$('challengeDifficulty').value})});$('challengeResult').textContent=data.challenge;$('challengeResult').classList.add('challenge-result');}
  catch(error){$('challengeResult').innerHTML=`<div class="empty-state">${esc(error.message)}<br><br>Pastikan binding Workers AI sudah aktif dan kuota tersedia.</div>`}
  finally{button.disabled=false;button.textContent='✳ Buat tantangan dengan AI'}
}

async function loadTeacherDashboard(){
  if(currentUser?.role!=='teacher')return;
  try{const [s,p]=await Promise.all([api('/api/teacher/students'),api('/api/projects')]);teacherStudents=s.students||[];teacherProjects=p.projects||[];
    $('statStudents').textContent=teacherStudents.length;$('statProjects').textContent=teacherProjects.length;$('statPending').textContent=teacherProjects.filter(x=>x.status==='submitted').length;$('statGraded').textContent=teacherProjects.filter(x=>x.status==='graded').length;
    const recent=teacherProjects.slice(0,7);$('teacherRecent').innerHTML=makeProjectsTable(recent,false);
  }catch(error){$('teacherRecent').innerHTML=`<div class="empty-state">${esc(error.message)}</div>`}
}
function makeProjectsTable(projects,withAction=true){
  if(!projects.length)return '<div class="empty-state">Belum ada proyek yang tercatat.</div>';
  return `<table class="data-table"><thead><tr><th>MAHASISWA</th><th>PROYEK</th><th>STATUS</th><th>NILAI</th>${withAction?'<th>AKSI</th>':''}</tr></thead><tbody>${projects.map(p=>`<tr><td><b>${esc(p.student_name||p.nim||'Mahasiswa')}</b><br><small>${esc(p.nim||'')}</small></td><td>${esc(p.title)}<br><small>${esc(getDevice(p.device_type).name)}</small></td><td><span class="status-tag ${statusClass(p.status)}">${friendlyStatus(p.status)}</span></td><td>${p.score===null||p.score===undefined?'—':`${p.score}/100`}</td>${withAction?`<td><button class="table-action review-project" data-review="${esc(p.id)}">${p.status==='draft'?'Lihat draft':'Periksa'}</button></td>`:''}</tr>`).join('')}</tbody></table>`;
}
async function loadStudents(){
  try{const data=await api('/api/teacher/students');teacherStudents=data.students||[];$('studentCount').textContent=`${teacherStudents.length} mahasiswa`;
    $('studentTable').innerHTML=teacherStudents.length?`<table class="data-table"><thead><tr><th>NIM</th><th>NAMA</th><th>PROYEK</th><th>STATUS / AKSI</th></tr></thead><tbody>${teacherStudents.map(s=>`<tr><td><b>${esc(s.nim)}</b></td><td>${esc(s.full_name)}</td><td>${s.project_count||0}</td><td>${s.is_active?'Aktif':'Nonaktif'} · <button class="table-action" data-reset-student="${esc(s.id)}" data-nim="${esc(s.nim)}">Reset password</button></td></tr>`).join('')}</tbody></table>`:'<div class="empty-state">Belum ada akun mahasiswa.</div>';
    document.querySelectorAll('[data-reset-student]').forEach(button=>button.addEventListener('click',()=>resetStudentPassword(button.dataset.resetStudent,button.dataset.nim)));
  }catch(error){$('studentTable').innerHTML=`<div class="empty-state">${esc(error.message)}</div>`}
}
async function loadSubmissions(){
  try{const data=await api('/api/projects');teacherProjects=data.projects||[];$('submissionTable').innerHTML=makeProjectsTable(teacherProjects,true);document.querySelectorAll('[data-review]').forEach(b=>b.addEventListener('click',()=>reviewProject(b.dataset.review)));}
  catch(error){$('submissionTable').innerHTML=`<div class="empty-state">${esc(error.message)}</div>`}
}
async function reviewProject(id){
  try{const data=await api(`/api/projects/${id}`);const p=data.project;activeGradeProject=p.id;$('gradingPanel').classList.remove('hidden');$('gradingTitle').textContent=p.title;$('gradeScore').value=p.score??85;$('gradeFeedback').value=p.feedback||'';$('saveGrade').disabled=p.status==='draft';$('saveGrade').title=p.status==='draft'?'Mahasiswa harus mengumpulkan proyek sebelum dinilai.':'';
    const device=getDevice(p.device_type);const c=p.config||{};$('gradingDetails').textContent=`Mahasiswa: ${p.student_name} (${p.nim})\nPerangkat: ${device.name}\nStatus: ${friendlyStatus(p.status)}\nKomponen: ${(c.components||[]).map(id=>COMPONENTS.find(x=>x.id===id)?.name||id).join(', ')}\nPemetaan pin: ${JSON.stringify(c.pins||{})}\nInput simulasi: ${JSON.stringify(c.inputs||{})}\nAmbang logika: ${JSON.stringify(c.thresholds||{})}`;
    $('gradingPanel').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(error){toast(error.message,true)}
}
async function createStudent(e){
  e.preventDefault();const name=$('studentName').value.trim(),nim=$('studentNim').value.trim(),password=$('studentPassword').value;
  try{await api('/api/teacher/students',{method:'POST',body:JSON.stringify({name,nim,password})});$('studentForm').reset();$('studentFormMessage').className='form-message';$('studentFormMessage').textContent='Akun berhasil dibuat. Sampaikan NIM dan password awal secara pribadi kepada mahasiswa.';toast('Akun mahasiswa berhasil dibuat.');loadStudents();}
  catch(error){$('studentFormMessage').className='form-message error';$('studentFormMessage').textContent=error.message}
}
async function resetStudentPassword(id,nim){
  const password=prompt(`Masukkan password sementara baru untuk NIM ${nim} (minimal 8 karakter):`);
  if(password===null)return;
  if(password.length<8){toast('Password minimal 8 karakter.',true);return}
  try{await api(`/api/teacher/students/${id}/reset-password`,{method:'POST',body:JSON.stringify({password})});toast('Password berhasil direset. Mahasiswa wajib menggantinya saat login.');}
  catch(error){toast(error.message,true)}
}

async function saveGrade(){
  if(!activeGradeProject)return;const score=Number($('gradeScore').value),feedback=$('gradeFeedback').value;
  try{await api(`/api/teacher/projects/${activeGradeProject}/grade`,{method:'POST',body:JSON.stringify({score,feedback})});toast('Penilaian berhasil disimpan.');$('gradingPanel').classList.add('hidden');loadSubmissions();loadTeacherDashboard();}
  catch(error){toast(error.message,true)}
}

function bindEvents(){
  $('loginForm').addEventListener('submit',async e=>{e.preventDefault();$('loginMessage').textContent='Memeriksa akun…';try{await login($('loginNim').value,$('loginPassword').value)}catch(error){$('loginMessage').textContent=error.message}});
  $('demoButton').addEventListener('click',()=>{demoMode=true;currentUser={id:'demo',nim:'DEMO',name:'Pengguna Demo',role:'student'};const saved=localStorage.getItem('iot-device-builder-demo');if(saved){try{const v=JSON.parse(saved);state=v.state;currentProjectId=v.currentProjectId}catch{state=makeDefaults('smart-irrigation')}}else state=makeDefaults('smart-irrigation');currentProjectStatus='draft';setAppVisible();setRoleUI();renderBuilder();navigate('builder');toast('Mode demo aktif. Data hanya tersimpan pada browser ini.')});
  $('logoutButton').addEventListener('click',logout);
  document.querySelectorAll('.side-link').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.page)));
  document.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.goto)));
  $('deviceGrid').addEventListener('click',e=>{const b=e.target.closest('[data-device]');if(b){if(currentProjectStatus!=='draft'&&!demoMode){toast('Proyek yang sudah dikumpulkan tidak dapat diedit.',true);return}resetForDevice(b.dataset.device)}});
  $('componentCatalog').addEventListener('click',e=>{const b=e.target.closest('[data-add]');if(!b)return;if(currentProjectStatus!=='draft'&&!demoMode)return;const id=b.dataset.add;if(['esp32','arduino-uno'].includes(id)){state.components=state.components.filter(x=>!['esp32','arduino-uno'].includes(x));state.components.unshift(id);for(const component of Object.keys(state.pins))state.pins[component]=defaultPinFor(component,id);}else if(!state.components.includes(id)){state.components.push(id);state.pins[id]=defaultPinFor(id,currentController());}renderComponents();renderSensorControls();renderThresholds();setDirty()});
  $('selectedComponents').addEventListener('click',e=>{const b=e.target.closest('[data-remove]');if(!b)return;const id=b.dataset.remove;state.components=state.components.filter(x=>x!==id);delete state.pins[id];renderComponents();renderSensorControls();renderThresholds();setDirty()});
  $('pinMap').addEventListener('change',e=>{const id=e.target.dataset.pin;if(id){state.pins[id]=e.target.value;setDirty()}});
  document.querySelectorAll('.catalog-tab').forEach(b=>b.addEventListener('click',()=>{state.catalogCategory=b.dataset.category;renderComponents();document.querySelectorAll('.catalog-tab').forEach(x=>x.classList.toggle('active',x===b))}));
  $('projectTitle').addEventListener('input',e=>{state.title=e.target.value;setDirty()});
  $('sensorControls').addEventListener('input',e=>{
    const input=e.target.dataset.input,threshold=e.target.dataset.threshold;
    if(input){const def=getDevice().inputs.find(x=>x.key===input);state.inputs[input]=def?.type==='toggle'?e.target.checked:Number(e.target.value);const valueEl=$(`value-${input}`);if(valueEl)valueEl.textContent=`${state.inputs[input]} ${def.unit}`;const toggle=e.target.closest('.sensor-control')?.querySelector('.toggle-text');if(toggle&&def)toggle.textContent=state.inputs[input]?def.onLabel:def.offLabel;renderThresholds();setDirty()}
    if(threshold){state.thresholds[threshold]=Number(e.target.value);renderThresholds();setDirty()}
  });
  $('resetSimulation').addEventListener('click',()=>{state.inputs={...EMPTY_INPUTS[state.deviceType]};renderSensorControls();renderThresholds();setDirty()});
  $('saveNow').addEventListener('click',()=>saveProject());$('newProjectButton').addEventListener('click',newProject);$('newProjectFromList').addEventListener('click',async()=>{await newProject();navigate('builder')});$('submitProjectButton').addEventListener('click',submitProject);
  $('challengeDevice').addEventListener('change',e=>{});$('generateChallenge').addEventListener('click',generateChallenge);
  $('studentForm').addEventListener('submit',createStudent);$('refreshTeacher').addEventListener('click',loadTeacherDashboard);$('refreshSubmissions').addEventListener('click',loadSubmissions);$('saveGrade').addEventListener('click',saveGrade);$('closeGrading').addEventListener('click',()=>$('gradingPanel').classList.add('hidden'));
  $('arModeButton').addEventListener('click',async()=>{try{await enterAR()}catch(error){toast(error.message,true)}});$('vrModeButton').addEventListener('click',async()=>{try{await enterVR()}catch(error){toast(error.message,true)}});
  $('helpButton').addEventListener('click',()=>toast('Pilih perangkat, tambahkan komponen, ubah input sensor, lalu amati respons aktuator. Mahasiswa login untuk menyimpan pekerjaan otomatis.'));
}
async function init(){
  bindEvents();
  try{const data=await api('/api/auth/me');currentUser=data.user;if(currentUser){demoMode=false;setAppVisible();setRoleUI();renderChallengeDevice();if(currentUser.mustChangePassword)showChangePassword();else{if(currentUser.role==='student')renderBuilder();navigate(currentUser.role==='teacher'?'teacher':'builder')}}else setLoginVisible()}
  catch{setLoginVisible()}
  initViewer().then(ok=>{if(ok)updateViewer({components:state.components})});
  renderChallengeDevice();
}
init();
