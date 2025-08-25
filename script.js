// === Carmilla's Curse - Three.js cube + Hemodynamics puzzle ===

// Buttons & overlays
const resetBtn     = document.getElementById('resetBtn');
const musicBtn     = document.getElementById('musicBtn');
const certificate  = document.getElementById('certificate');
const closeCertBtn = document.getElementById('closeCertBtn');
const bgMusic      = document.getElementById('bgMusic');

// Puzzle modal
const puzzleModal   = document.getElementById('puzzleModal');
const puzzleContent = document.getElementById('puzzleContent');
const puzzleClose   = document.getElementById('puzzleCloseBtn');

// State: which faces are solved
const solved = { front:false, back:false, left:false, right:false, top:false, bottom:false };

// Three.js globals
let scene, camera, renderer, cube, raycaster, mouse;
let isDragging = false, dragMoved = false;
let prev = { x:0, y:0 };
let initialRotation = { x:0, y:0 };

// ---------- Init Three.js ----------
function init() {
  const container = document.getElementById('three-container');
  scene  = new THREE.Scene();
  scene.background = new THREE.Color(0x222222);

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 5);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.domElement.style.touchAction = 'none';
  container.appendChild(renderer.domElement);

  // Materials (same texture for now; replace per-face later if you like)
  const loader = new THREE.TextureLoader();
  const tex = (p) => loader.load(p, undefined, undefined, () => console.warn('Texture failed:', p));
  const materials = [
    new THREE.MeshBasicMaterial({ map: tex('boxTexture.png'), color: 0xffffff }), // right
    new THREE.MeshBasicMaterial({ map: tex('boxTexture.png'), color: 0xffffff }), // left
    new THREE.MeshBasicMaterial({ map: tex('boxTexture.png'), color: 0xffffff }), // top
    new THREE.MeshBasicMaterial({ map: tex('boxTexture.png'), color: 0xffffff }), // bottom
    new THREE.MeshBasicMaterial({ map: tex('boxTexture.png'), color: 0xffffff }), // front
    new THREE.MeshBasicMaterial({ map: tex('boxTexture.png'), color: 0xffffff })  // back
  ];
  cube = new THREE.Mesh(new THREE.BoxGeometry(2,2,2), materials);
  scene.add(cube);

  initialRotation.x = cube.rotation.x; initialRotation.y = cube.rotation.y;
  raycaster = new THREE.Raycaster(); mouse = new THREE.Vector2();

  // Rotation (mouse)
  const c = renderer.domElement;
  c.addEventListener('mousedown', (e)=>{ isDragging=true; dragMoved=false; prev.x=e.clientX; prev.y=e.clientY; });
  c.addEventListener('mousemove', (e)=>{ if(!isDragging) return; const dx=e.clientX-prev.x, dy=e.clientY-prev.y; cube.rotation.y += dx*0.01; cube.rotation.x += dy*0.01; prev.x=e.clientX; prev.y=e.clientY; dragMoved=true; });
  c.addEventListener('mouseup',   ()=>{ isDragging=false; });
  c.addEventListener('mouseleave',()=>{ isDragging=false; });

  // Rotation (touch)
  c.addEventListener('touchstart', (e)=>{ if(!e.touches.length) return; isDragging=true; dragMoved=false; prev.x=e.touches[0].clientX; prev.y=e.touches[0].clientY; }, { passive:true });
  c.addEventListener('touchmove',  (e)=>{ if(!isDragging || !e.touches.length) return; const x=e.touches[0].clientX,y=e.touches[0].clientY; const dx=x-prev.x, dy=y-prev.y; cube.rotation.y += dx*0.01; cube.rotation.x += dy*0.01; prev.x=x; prev.y=y; dragMoved=true; }, { passive:true });
  c.addEventListener('touchend', ()=>{ isDragging=false; });

  // Click -> open puzzle
  c.addEventListener('click', (event)=>{
    if (dragMoved) { dragMoved=false; return; }
    const faceName = pickFace(event);
    if (faceName) openPuzzle(faceName);
  });

  window.addEventListener('resize', resizeCamera);
  resizeCamera();

  resetBtn.addEventListener('click', ()=> {
    cube.rotation.x = initialRotation.x; cube.rotation.y = initialRotation.y;
  });
  musicBtn.addEventListener('click', ()=>{
    if (bgMusic.paused) { bgMusic.play().catch(()=>{}); musicBtn.textContent='Pause Music'; }
    else { bgMusic.pause(); musicBtn.textContent='Play Music'; }
  });
  closeCertBtn.addEventListener('click', ()=> certificate.classList.remove('show'));
  puzzleClose.addEventListener('click', closePuzzle);

  animate();
}

function resizeCamera(){
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.position.z = (window.innerWidth < 600) ? 7 : 5; // mobile QoL
}

function animate(){ requestAnimationFrame(animate); renderer.render(scene, camera); }

// ----- Picking helpers -----
function faceLabelFromMaterialIndex(i){
  return (i===4?'front': i===5?'back': i===1?'left': i===0?'right': i===2?'top': i===3?'bottom':'');
}
function materialIndexFromFaceIndex(geom, faceIndex){
  const triStart = faceIndex * 3;
  for (let g of geom.groups) if (triStart >= g.start && triStart < g.start+g.count) return g.materialIndex;
  return 0;
}
function pickFace(event){
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObject(cube);
  if (!hits.length) return '';
  const matIdx = materialIndexFromFaceIndex(cube.geometry, hits[0].faceIndex);
  return faceLabelFromMaterialIndex(matIdx);
}

// ----- Modal helpers -----
function openPuzzle(face){
  if (solved[face]) { toast('That panel is already unlocked.'); return; }
  if (face==='front')       renderHemodynamics(face);        // <— THIS PUZZLE
  else if (face==='right')  renderStub(face, 'IV Routing (coming up)');
  else if (face==='back')   renderStub(face, 'Constellation');
  else if (face==='left')   renderStub(face, 'Arithmomania');
  else if (face==='top')    renderStub(face, 'Alchemy');
  else if (face==='bottom') renderStub(face, 'Mirror & Light');
  puzzleModal.classList.add('show');
}
function closePuzzle(){ puzzleModal.classList.remove('show'); puzzleContent.innerHTML=''; }
function solveFace(face, message){
  solved[face]=true; toast(message || `You unlocked the ${face} panel.`);
  const matIndex = (face==='front'?4: face==='back'?5: face==='left'?1: face==='right'?0: face==='top'?2: 3);
  cube.material[matIndex].color.set(0x333333); // dim as solved
  closePuzzle(); checkCompletion();
}
function checkCompletion(){
  if (Object.values(solved).every(Boolean)) {
    certificate.classList.add('show');
    if (!bgMusic.paused) bgMusic.pause();
  }
}
function toast(msg){
  const div = document.createElement('div');
  div.textContent = msg; div.style.marginTop='0.5rem'; div.style.opacity='0.92';
  puzzleContent.appendChild(div);
}
function renderStub(face, label){
  puzzleContent.innerHTML = `<h3 style="margin:0 0 0.5rem 0;color:var(--deep-red)">${label}</h3>
  <p>This panel will unlock later in development.</p>
  <div class="puzzle-actions"><button id="fakeSolve">Dev: Solve</button></div>`;
  document.getElementById('fakeSolve').addEventListener('click', ()=> solveFace(face, 'Unlocked (dev).'));
}

// ---------- PUZZLE: Hemodynamics (blood-pressure valves) ----------
function renderHemodynamics(face){
  // Model constants
  const S0=100, D0=70;
  const heartS=[0,10,20], heartD=[0,2,4];
  const resS=[0,6,12],    resD=[0,8,16];
  const compS=[10,0,-10], compD=[-5,0,5];
  const shS=[0,-4,-8],    shD=[0,-10,-20];

  // Phases & targets (unique solutions)
  const phases = [
    { name:'Stabilize', S:[118,122], D:[78,82] },    // solution: H=L, R=H, C=L, Sh=L
    { name:'Overpressure', S:[130,134], D:[88,92] }, // solution: H=H, R=H, C=M, Sh=L
    { name:'Torpor', S:[87,89], D:[62,64] }          // solution: H=L, R=M, C=H, Sh=H
  ];
  let phaseIndex = 0;

  // Current dial positions (0=L, 1=M, 2=H)
  const dials = { heart:0, resist:0, comp:0, shunt:0 };

  puzzleContent.innerHTML = `
    <h3 style="margin:0 0 0.25rem 0;color:var(--deep-red)">${phases[phaseIndex].name}: Blood Pressure Valves</h3>
    <p style="margin:0 0 0.5rem 0">Prick the finger to prime the pump. Route the flow by setting the valves.</p>

    <div class="tube" id="tube"></div>

    <div class="gauges">
      <div class="g"><h4>Systolic</h4><div class="read" id="readS">—</div><div class="zones" id="zoneS"></div></div>
      <div class="g"><h4>Diastolic</h4><div class="read" id="readD">—</div><div class="zones" id="zoneD"></div></div>
      <div class="g"><h4>MAP</h4><div class="read" id="readMAP">—</div><div class="zones" id="zoneMAP"></div></div>
    </div>

    <div class="dials">
      ${renderDial('Heart (stroke)', 'heart')}
      ${renderDial('Resistance', 'resist')}
      ${renderDial('Compliance', 'comp')}
      ${renderDial('Shunt', 'shunt')}
    </div>

    <div class="puzzle-actions">
      <button id="btnCheck">Apply</button>
      <button id="btnNext" style="display:none">Proceed</button>
    </div>
  `;

  function renderDial(label, key){
    return `
      <div class="dial">
        <h5>${label}</h5>
        <div class="row"><div>Pos.</div>
          <div class="pos" data-key="${key}">
            <button data-v="0" class="pbtn">L</button>
            <button data-v="1" class="pbtn">M</button>
            <button data-v="2" class="pbtn">H</button>
          </div>
        </div>
      </div>`;
  }

  // Wire dial buttons
  document.querySelectorAll('.pos').forEach(group=>{
    const key = group.dataset.key;
    group.querySelectorAll('.pbtn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        group.querySelectorAll('.pbtn').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        dials[key] = +btn.dataset.v;
        update();
      });
    });
    // default: set to Medium for nice start
    const mid = group.querySelector('[data-v="1"]'); mid.classList.add('active'); dials[key]=1;
  });

  const btnCheck = document.getElementById('btnCheck');
  const btnNext  = document.getElementById('btnNext');
  const tube     = document.getElementById('tube');

  btnCheck.addEventListener('click', tryApply);
  btnNext.addEventListener('click', ()=>{
    phaseIndex++;
    if (phaseIndex >= phases.length) {
      solveFace(face, 'Valves align; the next channel opens.');
      return;
    }
    // Reset UI for next phase
    puzzleContent.parentElement.classList.remove('shake');
    btnNext.style.display='none';
    document.querySelector('h3').textContent = `${phases[phaseIndex].name}: Blood Pressure Valves`;
    update(true);
  });

  // live gauges
  function compute(){
    const h=dials.heart, r=dials.resist, c=dials.comp, s=dials.shunt;
    const S = S0 + heartS[h] + resS[r] + compS[c] + shS[s];
    const D = D0 + heartD[h] + resD[r] + compD[c] + shD[s];
    const MAP = D + (S-D)/3;
    return {S, D, MAP};
  }
  function inRange(v, [min,max]){ return v>=min && v<=max; }

  function update(jump=false){
    const {S,D,MAP} = compute();
    const ph = phases[phaseIndex];
    setGauge('S', S, ph.S);
    setGauge('D', D, ph.D);
    // derive MAP target from S/D
    const tMAP = [ ph.D[0] + (ph.S[0]-ph.D[0])/3, ph.D[1] + (ph.S[1]-ph.D[1])/3 ];
    setGauge('MAP', MAP, tMAP);

    // pulse animation speed from Heart dial
    tube.classList.remove('slow','fast');
    if (dials.heart===0) tube.classList.add('slow');
    if (dials.heart===2) tube.classList.add('fast');
  }

  function setGauge(id, val, target){
    const el = document.getElementById('read'+id);
    const zone = document.getElementById('zone'+id);
    el.textContent = Math.round(val);
    zone.textContent = `target ${Math.round(target[0])}–${Math.round(target[1])}`;
    el.classList.remove('ok','warn','bad');
    if (inRange(val, target)) el.classList.add('ok');
    else if (Math.abs(val - (target[0]+target[1])/2) <= 6) el.classList.add('warn');
    else el.classList.add('bad');
  }

  function tryApply(){
    const {S,D,MAP} = compute();
    const ph = phases[phaseIndex];
    const tMAP = [ ph.D[0] + (ph.S[0]-ph.D[0])/3, ph.D[1] + (ph.S[1]-ph.D[1])/3 ];
    const ok = inRange(S, ph.S) && inRange(D, ph.D) && inRange(MAP, tMAP);
    if (ok) {
      toast('Valves hiss; needles settle in the green.');
      btnNext.style.display='inline-block';
    } else {
      puzzleContent.parentElement.classList.remove('shake'); void puzzleContent.parentElement.offsetWidth;
      puzzleContent.parentElement.classList.add('shake');
      toast('The flow resists you.');
    }
  }

  update(true);
}

// ---------- Start ----------
init();
