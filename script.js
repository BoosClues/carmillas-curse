// === Carmilla's Curse - script.js (manual rotation, with puzzles) ===

// HTML buttons and elements
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

// === Init Three.js scene ===
function init() {
  const container = document.getElementById('three-container');
  scene  = new THREE.Scene();
  scene.background = new THREE.Color(0x222222); // contrast for dark texture

  camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 5);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.domElement.style.touchAction = 'none';
  container.appendChild(renderer.domElement);

  // Materials (same texture all sides for now)
  const loader = new THREE.TextureLoader();
  const tex = (p)=> loader.load(p, undefined, undefined, ()=>console.warn('Texture failed:', p));
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

  // Save initial rotation
  initialRotation.x = cube.rotation.x;
  initialRotation.y = cube.rotation.y;

  // Raycaster & mouse
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  // Rotation (mouse/touch)
  const c = renderer.domElement;
  c.addEventListener('mousedown', onPointerDown);
  c.addEventListener('mousemove', onPointerMove);
  c.addEventListener('mouseup',   onPointerUp);
  c.addEventListener('mouseleave',onPointerUp);

  c.addEventListener('touchstart', (e)=>{
    if (!e.touches.length) return;
    isDragging=true; dragMoved=false;
    prev.x = e.touches[0].clientX; prev.y = e.touches[0].clientY;
  }, { passive:true });

  c.addEventListener('touchmove', (e)=>{
    if (!isDragging || !e.touches.length) return;
    const x = e.touches[0].clientX, y = e.touches[0].clientY;
    const dx = x - prev.x, dy = y - prev.y;
    cube.rotation.y += dx * 0.01;
    cube.rotation.x += dy * 0.01;
    prev.x = x; prev.y = y; dragMoved = true;
  }, { passive:true });

  c.addEventListener('touchend', ()=>{ isDragging=false; });

  // Click → open puzzle (ignore if you were dragging)
  c.addEventListener('click', (event)=>{
    if (dragMoved) { dragMoved=false; return; }
    const faceName = pickFace(event);
    if (faceName) openPuzzle(faceName);
  });

  // Resize responsiveness
  window.addEventListener('resize', resizeCamera);
  resizeCamera();

  // Buttons
  resetBtn.addEventListener('click', ()=>{
    cube.rotation.x = initialRotation.x;
    cube.rotation.y = initialRotation.y;
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
  // Pull back on narrow screens so the cube isn't huge on mobile
  camera.position.z = (window.innerWidth < 600) ? 7 : 5;
}

function onPointerDown(e){ isDragging=true; dragMoved=false; prev.x=e.clientX; prev.y=e.clientY; }
function onPointerMove(e){ if(!isDragging) return; const dx=e.clientX-prev.x, dy=e.clientY-prev.y; cube.rotation.y += dx*0.01; cube.rotation.x += dy*0.01; prev.x=e.clientX; prev.y=e.clientY; dragMoved=true; }
function onPointerUp(){ isDragging=false; }

function animate(){ requestAnimationFrame(animate); renderer.render(scene, camera); }

// === Picking helpers ===
function faceLabelFromMaterialIndex(i){
  // Our materials order: [right, left, top, bottom, front, back]
  return (i===4?'front': i===5?'back': i===1?'left': i===0?'right': i===2?'top': i===3?'bottom':'');
}
function materialIndexFromFaceIndex(geom, faceIndex){
  const triStart = faceIndex * 3;
  for (let g of geom.groups) { if (triStart >= g.start && triStart < g.start+g.count) return g.materialIndex; }
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

// === Modal helpers ===
function openPuzzle(face){
  // Route each face to a puzzle
  if (solved[face]) { toast(`That panel is already unlocked.`); return; }
  if (face==='front') renderTikiPuzzle(face);
  else if (face==='right') renderDurianPuzzle(face);
  else if (face==='back') renderConstellationPuzzle(face);
  else if (face==='left') renderRicePuzzle(face);           // scaffold
  else if (face==='top') renderAlchemyPuzzle(face);         // scaffold
  else if (face==='bottom') renderMirrorLightPuzzle(face);  // scaffold
  puzzleModal.classList.add('show');
}
function closePuzzle(){
  puzzleModal.classList.remove('show');
  puzzleContent.innerHTML = '';
}
function solveFace(face, message){
  solved[face]=true;
  toast(message || `You unlocked the ${face} panel.`);
  // Dim that face's material colour a bit as a visual indicator
  const matIndex = (face==='front'?4: face==='back'?5: face==='left'?1: face==='right'?0: face==='top'?2: 3);
  cube.material[matIndex].color.set(0x333333);
  closePuzzle();
  checkCompletion();
}
function checkCompletion(){
  if (Object.values(solved).every(Boolean)) {
    certificate.classList.add('show');
    if (!bgMusic.paused) bgMusic.pause();
  }
}
function toast(msg){
  // Simple inline toast in puzzle card footer
  const div = document.createElement('div');
  div.textContent = msg;
  div.style.marginTop = '0.5rem';
  div.style.opacity = '0.92';
  puzzleContent.appendChild(div);
}

// === PUZZLE 1: Tiki Vampire & Day‑Sleep Key ===
function renderTikiPuzzle(face){
  puzzleContent.innerHTML = `
    <h3 style="margin:0 0 0.5rem 0;color:var(--deep-red)">The Wrought‑Iron Key</h3>
    <p style="margin:0 0 0.5rem 0">
      When does the tiki vampire sleep? <em>By day</em>, and <em>upside down</em>.
      Rotate this face so it points to the ground, and set the sun to midday.
    </p>
    <label for="sunSlider">Sun (hour):</label>
    <input id="sunSlider" type="range" min="0" max="24" step="0.1" value="9" style="width:100%;">
    <div id="sunReadout" style="margin:0.25rem 0 0.75rem 0;">Sun: 09:00</div>
    <div class="puzzle-actions">
      <button id="tryKeyBtn">Try the key</button>
    </div>
  `;

  const sunSlider  = document.getElementById('sunSlider');
  const sunReadout = document.getElementById('sunReadout');
  sunSlider.addEventListener('input', ()=>{
    const h = parseFloat(sunSlider.value);
    const hh = String(Math.floor(h)).padStart(2,'0');
    const mm = String(Math.round((h%1)*60)).padStart(2,'0');
    sunReadout.textContent = `Sun: ${hh}:${mm}`;
  });

  document.getElementById('tryKeyBtn').addEventListener('click', ()=>{
    // "Upside down": the face normal points toward world down (-Y).
    const frontNormal = new THREE.Vector3(0,0,1).applyQuaternion(cube.quaternion);
    const down = new THREE.Vector3(0,-1,0);
    const facingDown = frontNormal.dot(down) > 0.95;

    // "Midday": slider between 11:00 and 13:00
    const h = parseFloat(sunSlider.value);
    const midday = (h >= 11 && h <= 13);

    if (facingDown && midday) {
      solveFace(face, 'With a dull clink, the iron key slides free.');
    } else {
      // feedback: shake card
      puzzleContent.parentElement.classList.remove('shake');
      void puzzleContent.parentElement.offsetWidth; // reflow
      puzzleContent.parentElement.classList.add('shake');
      toast('The guardian still watches… (Upside down at midday.)');
    }
  });
}

// === PUZZLE 2: Durian Ward ===
function renderDurianPuzzle(face){
  puzzleContent.innerHTML = `
    <h3 style="margin:0 0 0.5rem 0;color:var(--deep-red)">The Warding Fruit</h3>
    <p style="margin:0 0 0.5rem 0">
      Choose the fruit that wards <em>tropical</em> vampires. (Choose carefully.)
    </p>
    <div id="fruitGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.5rem;margin:0.5rem 0;">
      ${['Garlic','Mango','Durian','Pineapple','Lychee','Starfruit'].map(name => `
        <button class="fruitBtn" data-name="${name}"
          style="padding:0.8rem 0.5rem;background:#111;border:1px solid #333;color:#eee;border-radius:4px;cursor:pointer;">
          ${name}
        </button>`).join('')}
    </div>
    <div class="puzzle-actions">
      <button id="wardBtn" disabled>Ward this panel</button>
    </div>
  `;

  let chosen = '';
  const buttons = [...document.querySelectorAll('.fruitBtn')];
  buttons.forEach(b=>{
    b.addEventListener('click', ()=>{
      buttons.forEach(x=> x.style.outline='none');
      b.style.outline = `2px solid var(--deep-red)`;
      chosen = b.dataset.name;
      document.getElementById('wardBtn').disabled = false;
    });
  });

  document.getElementById('wardBtn').addEventListener('click', ()=>{
    if (chosen === 'Durian') {
      solveFace(face, 'The stench is salvation—the ward holds.');
    } else {
      puzzleContent.parentElement.classList.remove('shake');
      void puzzleContent.parentElement.offsetWidth;
      puzzleContent.parentElement.classList.add('shake');
      toast('A sour choice. The ward fails.');
    }
  });
}

// === PUZZLE 3: Hibiscus Constellation (scaffold) ===
function renderConstellationPuzzle(face){
  // Five sliders; some locked until other faces solved
  const unlocked = {
    r: solved.front,   // radius unlocked by Tiki vampire
    rot: solved.right, // rotation unlocked by Durian
    spread: solved.left,   // by Rice
    inner: solved.top,     // by Alchemy
    offset: solved.bottom  // by Mirror & Light
  };
  const lockIcon = (ok)=> ok?'':'🔒';
  puzzleContent.innerHTML = `
    <h3 style="margin:0 0 0.5rem 0;color:var(--deep-red)">Starlit Prophecy</h3>
    <p style="margin:0 0 0.5rem 0">Gather the stars into the hibiscus.</p>
    <canvas id="starCanvas" width="360" height="240" style="width:100%;background:#0e0e0e;border:1px solid #222"></canvas>
    <div style="margin-top:0.5rem;display:grid;grid-template-columns:1fr 4fr;gap:0.5rem;align-items:center;">
      <label>Radius ${lockIcon(unlocked.r)}</label>      <input id="slR" type="range" min="10" max="100" value="40" ${unlocked.r?'':'disabled'}>
      <label>Rotation ${lockIcon(unlocked.rot)}</label>  <input id="slRot" type="range" min="0" max="360" value="15" ${unlocked.rot?'':'disabled'}>
      <label>Spread ${lockIcon(unlocked.spread)}</label> <input id="slSpread" type="range" min="0" max="80" value="35" ${unlocked.spread?'':'disabled'}>
      <label>Inner ${lockIcon(unlocked.inner)}</label>   <input id="slInner" type="range" min="0" max="50" value="18" ${unlocked.inner?'':'disabled'}>
      <label>Offset ${lockIcon(unlocked.offset)}</label> <input id="slOff" type="range" min="-40" max="40" value="0" ${unlocked.offset?'':'disabled'}>
    </div>
    <div class="puzzle-actions"><button id="bindStarsBtn">Bind the stars</button></div>
  `;

  const cvs = document.getElementById('starCanvas');
  const ctx = cvs.getContext('2d');
  const sliders = ['slR','slRot','slSpread','slInner','slOff'].map(id=>document.getElementById(id));

  function draw(){
    const [R,rot,spread,inner,off] = sliders.map(s=> parseFloat(s?.value || 0));
    ctx.clearRect(0,0,cvs.width,cvs.height);
    ctx.fillStyle = '#bbb';
    for(let i=0;i<5;i++){
      const a = (i*(Math.PI*2/5)) + (rot*Math.PI/180);
      const r = R + (i%2===0?spread:-inner);
      const x = cvs.width/2 + Math.cos(a)*r;
      const y = cvs.height/2 + Math.sin(a)*(r+off);
      ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fill();
    }
  }
  sliders.forEach(s=> s && s.addEventListener('input', draw));
  draw();

  // Target tolerances (you can tweak these later)
  const target = { R:50, rot:25, spread:42, inner:15, off:6 };
  document.getElementById('bindStarsBtn').addEventListener('click', ()=>{
    const vals = {
      R: parseFloat(sliders[0]?.value || 0),
      rot: parseFloat(sliders[1]?.value || 0),
      spread: parseFloat(sliders[2]?.value || 0),
      inner: parseFloat(sliders[3]?.value || 0),
      off: parseFloat(sliders[4]?.value || 0),
    };
    const tol = (a,b,t)=> Math.abs(a-b) <= t;
    const ok =
      tol(vals.R, target.R, 4) &&
      tol(vals.rot, target.rot, 4) &&
      tol(vals.spread, target.spread, 4) &&
      tol(vals.inner, target.inner, 3) &&
      tol(vals.off, target.off, 3);

    if (ok) solveFace(face, 'The flower blooms among the stars.');
    else { puzzleContent.parentElement.classList.remove('shake'); void puzzleContent.parentElement.offsetWidth; puzzleContent.parentElement.classList.add('shake'); toast('The stars resist your hand.'); }
  });
}

// === Scaffolds for the remaining panels (we’ll fill these next) ===
function renderRicePuzzle(face){
  puzzleContent.innerHTML = `
    <h3 style="margin:0 0 0.5rem 0;color:var(--deep-red)">Arithmomania</h3>
    <p>Enter the total grains spilled across all panels:</p>
    <input id="riceInput" type="number" inputmode="numeric" style="width:100%;padding:0.5rem;background:#111;border:1px solid #333;color:#eee;border-radius:4px" placeholder="Total grains">
    <div class="puzzle-actions">
      <button id="riceCheckBtn">Open</button>
    </div>
  `;
  document.getElementById('riceCheckBtn').addEventListener('click', ()=>{
    // Placeholder: adjust "correctTotal" when we wire real counts
    const correctTotal = 123; // TEMP
    const val = parseInt(document.getElementById('riceInput').value,10);
    if (val === correctTotal) solveFace(face, 'The panel slides with a soft sigh.');
    else { puzzleContent.parentElement.classList.remove('shake'); void puzzleContent.parentElement.offsetWidth; puzzleContent.parentElement.classList.add('shake'); toast('Grains scattered from your hand…'); }
  });
}

function renderAlchemyPuzzle(face){
  puzzleContent.innerHTML = `
    <h3 style="margin:0 0 0.5rem 0;color:var(--deep-red)">Blood Alchemy</h3>
    <p>Mix the draught (2:3:1): Garlic / Moonlight / Rose.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;align-items:center;margin-top:0.5rem">
      <label>Garlic</label>   <input id="a1" type="range" min="0" max="5" value="0">
      <label>Moonlight</label><input id="a2" type="range" min="0" max="5" value="0">
      <label>Rose</label>     <input id="a3" type="range" min="0" max="5" value="0">
    </div>
    <div id="brew" style="margin:0.75rem 0;height:22px;background:#111;border:1px solid #333;border-radius:3px;"></div>
    <div class="puzzle-actions"><button id="brewBtn">Brew</button></div>
  `;
  const bars = [document.getElementById('a1'),document.getElementById('a2'),document.getElementById('a3')];
  const brew = document.getElementById('brew');
  bars.forEach(b=> b.addEventListener('input', ()=>{
    const [g,m,r] = bars.map(x=>+x.value);
    // tint for fun
    const rr = Math.min(255, 80 + r*30 + m*10);
    const gg = Math.min(255, 10 + m*25);
    const bb = Math.min(255, 10 + g*10);
    brew.style.background = `rgb(${rr},${gg},${bb})`;
  }));
  document.getElementById('brewBtn').addEventListener('click', ()=>{
    const [g,m,r] = bars.map(x=>+x.value);
    const ok = (g===2 && m===3 && r===1);
    if (ok) solveFace(face, 'The draught turns crimson and smokes.');
    else { puzzleContent.parentElement.classList.remove('shake'); void puzzleContent.parentElement.offsetWidth; puzzleContent.parentElement.classList.add('shake'); toast('The mixture curdles.'); }
  });
}

function renderMirrorLightPuzzle(face){
  puzzleContent.innerHTML = `
    <h3 style="margin:0 0 0.5rem 0;color:var(--deep-red)">Mirror & Light</h3>
    <p>A beam must reach the sensor without touching a vampire. (Prototype to follow.)</p>
    <div class="puzzle-actions"><button id="fakeSolve">(Dev) Solve</button></div>
  `;
  document.getElementById('fakeSolve').addEventListener('click', ()=> solveFace(face,'Mirrors click; the beam finds its mark.'));
}

// Start
init();
