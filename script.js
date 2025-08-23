// === Carmilla's Curse - script.js (improved day/night logic) ===

// HTML buttons and elements
const resetBtn     = document.getElementById('resetBtn');
const musicBtn     = document.getElementById('musicBtn');
const certificate  = document.getElementById('certificate');
const closeCertBtn = document.getElementById('closeCertBtn');
const bgMusic      = document.getElementById('bgMusic');

// Global sun dial widget
const sunDialSlider  = document.getElementById('sunDialSlider');
const sunDialReadout = document.getElementById('sunDialReadout');

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
  // Add a CSS transition to the filter property so brightness changes smoothly
  renderer.domElement.style.transition = 'filter 0.8s ease';
  container.appendChild(renderer.domElement);

  // Load textures for each face. A separate closed-mouth texture for daytime ensures
  // the mouth doesn’t open until the correct conditions are met.
  const loader = new THREE.TextureLoader();
  const frontDayTexture         = loader.load('front_day.png');
  const frontDayClosedTexture   = loader.load('front_day_closed.png');
  const frontNightTexture       = loader.load('front_night.png');
  const rightTexture            = loader.load('right_durian.png');
  const leftTexture             = loader.load('left_rice.png');
  const topTexture              = loader.load('top_alchemy.png');
  const bottomTexture           = loader.load('bottom_mirror.png');
  const backTexture             = loader.load('back_constellation.png');

  // Create a materials array in the order [right, left, top, bottom, front, back].
  // We start with the night texture on the front face; this will be swapped
  // based on time of day and cube orientation.
  const materials = [
    new THREE.MeshBasicMaterial({ map: rightTexture, color: 0xffffff }), // right
    new THREE.MeshBasicMaterial({ map: leftTexture,  color: 0xffffff }), // left
    new THREE.MeshBasicMaterial({ map: topTexture,   color: 0xffffff }), // top
    new THREE.MeshBasicMaterial({ map: bottomTexture,color: 0xffffff }), // bottom
    new THREE.MeshBasicMaterial({ map: frontNightTexture, color: 0xffffff }), // front (night)
    new THREE.MeshBasicMaterial({ map: backTexture,  color: 0xffffff })  // back
  ];

  // Expose the front textures globally so the puzzle logic can swap them.
  window.__frontDayTexture        = frontDayTexture;
  window.__frontDayClosedTexture  = frontDayClosedTexture;
  window.__frontNightTexture      = frontNightTexture;

  cube = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), materials);
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

  // Sun dial: update brightness and trigger front texture selection based on the hour.
  function updateDayNightGlobal(){
    if (!sunDialSlider) return;
    const hVal = parseFloat(sunDialSlider.value);
    // Update readout (HH:MM)
    const hh = String(Math.floor(hVal)).padStart(2,'0');
    const mm = String(Math.round((hVal % 1) * 60)).padStart(2,'0');
    if (sunDialReadout) sunDialReadout.textContent = `Sun: ${hh}:${mm}`;
    // Compute brightness: dark at midnight, bright at noon (peak around midday). Use sine curve.
    // This will vary between 0.5 and 1.5 across 24h.
    const brightness = 0.5 + 0.5 * Math.sin((hVal / 24) * Math.PI);
    renderer.domElement.style.filter = `brightness(${brightness.toFixed(2)})`;
    // Update the front face texture based on time and orientation
    updateFrontFaceTexture();
  }

  // Attach the update function to slider input and call once
  if (sunDialSlider) {
    sunDialSlider.addEventListener('input', updateDayNightGlobal);
    updateDayNightGlobal();
  }

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

function animate(){
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
  // Update the front texture based on current time and orientation
  updateFrontFaceTexture();
}

// Update the front face texture based on the sun dial hour and cube orientation.
// The vampire's eyes remain closed during the day and open at night.  Her mouth
// opens only when it is midday (11–13) and the front face is rotated upside down.
function updateFrontFaceTexture(){
  // Ensure required objects exist
  if (!cube || !sunDialSlider) return;
  // Do not update the front face if it's already solved
  if (solved && solved.front) return;
  const hVal = parseFloat(sunDialSlider.value);
  // Define day as morning through late afternoon (roughly 6–18), and midday as 11–13 for puzzle logic
  const daytime = (hVal >= 6 && hVal <= 18);
  const midday  = (hVal >= 11 && hVal <= 13);
  // Compute orientation: front normal and world down vector
  const frontNormal = new THREE.Vector3(0,0,1).applyQuaternion(cube.quaternion);
  const facingDown = frontNormal.dot(new THREE.Vector3(0,-1,0)) > 0.95;
  let newMap;
  if (!daytime) {
    // Night: eyes open, mouth closed
    newMap = window.__frontNightTexture;
  } else {
    // Day: eyes closed. Mouth opens only during the midday window and when the face is rotated upside down.
    newMap = (midday && facingDown) ? window.__frontDayTexture : window.__frontDayClosedTexture;
  }
  if (cube.material[4].map !== newMap) {
    cube.material[4].map = newMap;
    cube.material[4].needsUpdate = true;
  }
}

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
      Rotate this face so it points to the ground, then adjust the sun dial (upper right) to midday.
    </p>
    <div class="puzzle-actions">
      <button id="tryKeyBtn">Try the key</button>
    </div>
  `;

  // When the player attempts to take the key, check orientation and time using the global sunDialSlider
  document.getElementById('tryKeyBtn').addEventListener('click', ()=>{
    // Determine if the front face is pointing downwards
    const frontNormal = new THREE.Vector3(0,0,1).applyQuaternion(cube.quaternion);
    const down = new THREE.Vector3(0,-1,0);
    const facingDown = frontNormal.dot(down) > 0.95;
    // Use the global sun dial value to check midday
    const hVal = sunDialSlider ? parseFloat(sunDialSlider.value) : 0;
    const midday = (hVal >= 11 && hVal <= 13);
    if (facingDown && midday) {
      if (confirm('Do you dare to take the key?')) {
        solveFace(face, 'With a dull clink, you grasp the iron key.');
      } else {
        toast('You hesitate, feeling the vampire’s gaze linger…');
      }
    } else {
      puzzleContent.parentElement.classList.remove('shake');
      void puzzleContent.parentElement.offsetWidth;
      puzzleContent.parentElement.classList.add('shake');
      toast('The guardian still watches… (Upside down at midday.)');
    }
  });
}

// The other puzzle functions (Durian, Constellation, Rice, Alchemy, Mirror & Light) remain unchanged.
// … (keep the rest of your puzzle code here)

// Start
init();
