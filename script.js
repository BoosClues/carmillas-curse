// === Carmilla's Curse - script.js ===
//
// This script drives the interactive puzzle box.  It loads carved textures for
// each side of the cube, applies rounded corners and small chips to make the
// geometry look aged and hand‑carved, adds lighting for depth, and wires up
// puzzles, a sun dial, and an inventory overlay.  The vampire’s face on the
// front face reacts to the sun dial and cube orientation: during the day her
// eyes stay closed, and her mouth only opens when the cube is upside down and
// the sun dial is set to midday (11–13).  At night her eyes open but the
// mouth remains shut.

// Grab references to DOM elements
const resetBtn       = document.getElementById('resetBtn');
const musicBtn       = document.getElementById('musicBtn');
const certificate    = document.getElementById('certificate');
const closeCertBtn   = document.getElementById('closeCertBtn');
const bgMusic        = document.getElementById('bgMusic');
const sunDialSlider  = document.getElementById('sunDialSlider');
const sunDialReadout = document.getElementById('sunDialReadout');
const puzzleModal    = document.getElementById('puzzleModal');
const puzzleContent  = document.getElementById('puzzleContent');
const puzzleClose    = document.getElementById('puzzleCloseBtn');
const inventoryList  = document.getElementById('inventoryList');

// Track which panels are solved and inventory items collected
const solved = { front:false, back:false, left:false, right:false, top:false, bottom:false };
const inventory = [];

// Three.js globals
let scene, camera, renderer, cube, raycaster, mouse;
let isDragging = false, dragMoved = false;
let prev        = { x:0, y:0 };
let initialRotation = { x:0, y:0 };

/**
 * Apply rounded corners to a box geometry.  This function collapses the
 * corners of the box inward based on a given radius, making the edges
 * gently curved rather than sharp.  Without this the box looks very
 * computer‑generated; the rounded corners give it a more hand‑carved feel.
 *
 * @param {THREE.BufferGeometry} geom The geometry to modify
 * @param {number} radius A value between 0 and 0.5 controlling how far
 *        the corners are pulled inward
 */
function applyRoundedCorners(geom, radius=0.2) {
  const pos = geom.attributes.position;
  const v   = new THREE.Vector3();
  for (let i=0; i<pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const maxCoord = Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z));
    const t = (maxCoord - 1 + radius) / radius;
    if (t > 0) {
      v.multiplyScalar(1 - 0.5 * Math.min(t, 1));
      pos.setXYZ(i, v.x, v.y, v.z);
    }
  }
  geom.computeVertexNormals();
}

/**
 * Randomly displace vertices near the edges of a box to simulate small chips
 * and wear in the wood or stone.  Without this the surface is perfectly
 * smooth; adding a little randomness makes the box look aged.
 *
 * @param {THREE.BufferGeometry} geom The geometry to modify
 * @param {number} magnitude How far to displace vertices (relative units)
 * @param {number} probability The chance each vertex near an edge will be moved
 */
function addChips(geom, magnitude=0.08, probability=0.3) {
  const pos = geom.attributes.position;
  const v   = new THREE.Vector3();
  for (let i=0; i<pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const nearEdge = (
      Math.abs(Math.abs(v.x) - 1) < 0.3 ||
      Math.abs(Math.abs(v.y) - 1) < 0.3 ||
      Math.abs(Math.abs(v.z) - 1) < 0.3
    );
    if (nearEdge && Math.random() < probability) {
      v.x += (Math.random() - 0.5) * magnitude;
      v.y += (Math.random() - 0.5) * magnitude;
      v.z += (Math.random() - 0.5) * magnitude;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
  }
  geom.computeVertexNormals();
}

/**
 * Set up the Three.js scene, camera, renderer, lights, cube, and input
 * handlers.  Loads textures for each face, applies geometry modifications,
 * attaches event listeners, and kicks off the render loop.
 */
function init() {
  const container = document.getElementById('three-container');
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x222222);

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 5);

  renderer = new THREE.WebGLRenderer({ antialias:true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.domElement.style.touchAction = 'none';
  // Smooth brightness transitions for the sun dial
  renderer.domElement.style.transition = 'filter 0.8s ease';
  container.appendChild(renderer.domElement);

  // Lighting gives depth to the carved borders and chips
  const ambient     = new THREE.AmbientLight(0xffffff, 0.7);
  const directional = new THREE.DirectionalLight(0xffffff, 0.6);
  directional.position.set(3, 3, 5);
  scene.add(ambient);
  scene.add(directional);

  // Load carved textures for each face.  These images combine the original
  // decorative border with a puzzle motif in the centre.  All are 1024×1024
  // PNGs.  We assume they exist in the same folder as this script.  If
  // `back_constellation_combined.png` or `bottom_mirror_combined.png` are
  // missing, replace their filenames below with `back_constellation.png` or
  // `bottom_mirror.png` respectively.
  const loader = new THREE.TextureLoader();
  const textures = {
    frontDay:       loader.load('front_day_combined.png'),
    frontDayClosed: loader.load('front_day_closed_combined.png'),
    frontNight:     loader.load('front_night_combined.png'),
    right:          loader.load('right_durian_combined.png'),
    left:           loader.load('left_rice_combined.png'),
    top:            loader.load('top_alchemy_combined.png'),
    bottom:         loader.load('bottom_mirror_combined.png'),
    back:           loader.load('back_constellation_combined.png'),
  };
  // Expose front textures globally for update logic
  window.__frontDayTexture       = textures.frontDay;
  window.__frontDayClosedTexture = textures.frontDayClosed;
  window.__frontNightTexture     = textures.frontNight;

  // Create a subdivided cube and apply rounding and chips
  const geom = new THREE.BoxGeometry(2, 2, 2, 8, 8, 8);
  applyRoundedCorners(geom, 0.2);
  addChips(geom, 0.08, 0.3);

  // Materials arranged as [right, left, top, bottom, front, back]
  const materials = [
    new THREE.MeshStandardMaterial({ map: textures.right }),
    new THREE.MeshStandardMaterial({ map: textures.left }),
    new THREE.MeshStandardMaterial({ map: textures.top }),
    new THREE.MeshStandardMaterial({ map: textures.bottom }),
    new THREE.MeshStandardMaterial({ map: textures.frontNight }),
    new THREE.MeshStandardMaterial({ map: textures.back }),
  ];
  cube = new THREE.Mesh(geom, materials);
  scene.add(cube);

  // Save the initial orientation so the reset button can restore it
  initialRotation.x = cube.rotation.x;
  initialRotation.y = cube.rotation.y;

  raycaster = new THREE.Raycaster();
  mouse     = new THREE.Vector2();

  // Setup drag and click handlers for rotation and puzzle activation
  const canvas = renderer.domElement;
  canvas.addEventListener('mousedown', (e) => {
    isDragging = true; dragMoved = false;
    prev.x = e.clientX; prev.y = e.clientY;
  });
  canvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    cube.rotation.y += (e.clientX - prev.x) * 0.01;
    cube.rotation.x += (e.clientY - prev.y) * 0.01;
    prev.x = e.clientX; prev.y = e.clientY;
    dragMoved = true;
  });
  canvas.addEventListener('mouseup',   () => { isDragging = false; });
  canvas.addEventListener('mouseleave',() => { isDragging = false; });
  canvas.addEventListener('touchstart', (e) => {
    if (!e.touches.length) return;
    isDragging = true; dragMoved = false;
    prev.x = e.touches[0].clientX; prev.y = e.touches[0].clientY;
  }, { passive:true });
  canvas.addEventListener('touchmove', (e) => {
    if (!isDragging || !e.touches.length) return;
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    cube.rotation.y += (x - prev.x) * 0.01;
    cube.rotation.x += (y - prev.y) * 0.01;
    prev.x = x; prev.y = y;
    dragMoved = true;
  }, { passive:true });
  canvas.addEventListener('touchend', () => { isDragging = false; });
  canvas.addEventListener('click', (event) => {
    if (dragMoved) { dragMoved = false; return; }
    // Raycast to determine which face was clicked
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObject(cube);
    if (!hits.length) return;
    const faceIndex = hits[0].faceIndex;
    const matIndex  = materialIndexFromFaceIndex(cube.geometry, faceIndex);
    const faceName  = faceLabelFromMaterialIndex(matIndex);
    openPuzzle(faceName);
  });

  // Window resize handler
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.position.z = (window.innerWidth < 600) ? 7 : 5;
  });

  // Button actions
  resetBtn.addEventListener('click', () => {
    cube.rotation.x = initialRotation.x;
    cube.rotation.y = initialRotation.y;
  });
  musicBtn.addEventListener('click', () => {
    if (bgMusic.paused) {
      bgMusic.play().catch(() => {});
      musicBtn.textContent = 'Pause Music';
    } else {
      bgMusic.pause();
      musicBtn.textContent = 'Play Music';
    }
  });
  closeCertBtn.addEventListener('click', () => certificate.classList.remove('show'));
  puzzleClose.addEventListener('click', closePuzzle);

  // Sun dial controls brightness and front face textures
  function updateSun() {
    const hVal = parseFloat(sunDialSlider.value);
    // Update the readout (HH:MM)
    const hh = String(Math.floor(hVal)).padStart(2,'0');
    const mm = String(Math.round((hVal % 1) * 60)).padStart(2,'0');
    sunDialReadout.textContent = `Sun: ${hh}:${mm}`;
    // Brightness is minimum 0.7 at midnight, maximum 1.3 at noon
    const brightness = 0.7 + 0.6 * Math.sin((hVal / 24) * Math.PI);
    renderer.domElement.style.filter = `brightness(${brightness.toFixed(2)})`;
    // Update the front face based on time and orientation
    updateFrontFaceTexture();
  }
  sunDialSlider.addEventListener('input', updateSun);
  updateSun();

  // Start animation loop
  (function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  })();
}

/**
 * Determine which face name corresponds to a material index.  The order of
 * materials is fixed: [right, left, top, bottom, front, back].
 *
 * @param {number} i Material index
 * @returns {string} A face name: 'front', 'back', 'left', 'right', 'top', or 'bottom'
 */
function faceLabelFromMaterialIndex(i) {
  return i === 4 ? 'front' : i === 5 ? 'back' : i === 1 ? 'left' : i === 0 ? 'right' : i === 2 ? 'top' : 'bottom';
}

/**
 * Convert a face index from the geometry to a material index.  Each face of
 * the cube has two triangles.  The geometry stores them in groups so we
 * map the face’s triangles back to the material index.
 *
 * @param {THREE.BufferGeometry} geom The geometry to inspect
 * @param {number} faceIndex The index of the intersected triangle
 * @returns {number} The corresponding material index
 */
function materialIndexFromFaceIndex(geom, faceIndex) {
  const triStart = faceIndex * 3;
  for (const g of geom.groups) {
    if (triStart >= g.start && triStart < g.start + g.count) return g.materialIndex;
  }
  return 0;
}

/**
 * Update the vampire texture on the front face depending on the sun dial and
 * whether the face is inverted.  During the day the eyes are closed; at
 * night they open.  The mouth only opens during midday (11–13) when the
 * cube is upside down.
 */
function updateFrontFaceTexture() {
  if (!cube || !sunDialSlider) return;
  if (solved.front) return; // no update after solving
  const hVal = parseFloat(sunDialSlider.value);
  const daytime = (hVal >= 6 && hVal <= 18);
  const midday  = (hVal >= 11 && hVal <= 13);
  // Determine if the front face is pointing downwards
  const frontNormal = new THREE.Vector3(0,0,1).applyQuaternion(cube.quaternion);
  const facingDown  = frontNormal.dot(new THREE.Vector3(0,-1,0)) > 0.95;
  let newMap;
  if (!daytime) {
    newMap = __frontNightTexture;
  } else {
    newMap = (midday && facingDown) ? __frontDayTexture : __frontDayClosedTexture;
  }
  if (cube.material[4].map !== newMap) {
    cube.material[4].map = newMap;
    cube.material[4].needsUpdate = true;
  }
}

/**
 * Open a puzzle modal for the specified face.  Each face has its own puzzle.
 * If the face is already solved, display a toast instead.
 *
 * @param {string} face The face name
 */
function openPuzzle(face) {
  if (solved[face]) {
    toast('That panel is already unlocked.');
    return;
  }
  if (face === 'front')      renderTikiPuzzle(face);
  else if (face === 'right') renderDurianPuzzle(face);
  else if (face === 'back')  renderConstellationPuzzle(face);
  else if (face === 'left')  renderRicePuzzle(face);
  else if (face === 'top')   renderAlchemyPuzzle(face);
  else if (face === 'bottom')renderMirrorLightPuzzle(face);
  puzzleModal.classList.add('show');
}

/** Close the puzzle modal and clear its content. */
function closePuzzle() {
  puzzleModal.classList.remove('show');
  puzzleContent.innerHTML = '';
}

/** Mark a face as solved, dim the panel, and check for overall completion.
 *
 * @param {string} face The face name
 * @param {string} message A congratulatory message
 */
function solveFace(face, message) {
  solved[face] = true;
  toast(message || `You unlocked the ${face} panel.`);
  // Dim the colour of the solved face
  const idx = (face==='front'?4 : face==='back'?5 : face==='left'?1 : face==='right'?0 : face==='top'?2 : 3);
  cube.material[idx].color.set(0x444444);
  closePuzzle();
  checkCompletion();
}

/** Check if all faces are solved and, if so, show the certificate and stop music. */
function checkCompletion() {
  if (Object.values(solved).every(Boolean)) {
    certificate.classList.add('show');
    if (!bgMusic.paused) bgMusic.pause();
  }
}

/** Display a temporary message within the puzzle modal. */
function toast(msg) {
  const div = document.createElement('div');
  div.textContent = msg;
  div.style.marginTop = '0.5rem';
  div.style.opacity   = '0.92';
  puzzleContent.appendChild(div);
}

// === Puzzle implementations ===

function renderTikiPuzzle(face) {
  puzzleContent.innerHTML = `
    <h3 style="margin:0 0 0.5rem;color:var(--deep-red)">The Wrought‑Iron Key</h3>
    <p style="margin:0 0 0.5rem">
      The tiki vampire sleeps by day and wakes by night.  To claim the key,
      rotate this panel until it points downward, then adjust the sun dial
      (upper right) to midday.
    </p>
    <div class="puzzle-actions"><button id="tryKeyBtn">Try the key</button></div>
  `;
  document.getElementById('tryKeyBtn').addEventListener('click', () => {
    const hVal = parseFloat(sunDialSlider.value);
    const midday = (hVal >= 11 && hVal <= 13);
    const frontNormal = new THREE.Vector3(0,0,1).applyQuaternion(cube.quaternion);
    const facingDown = frontNormal.dot(new THREE.Vector3(0,-1,0)) > 0.95;
    if (midday && facingDown) {
      // Show a key icon; clicking adds it to inventory
      puzzleContent.innerHTML = `
        <h3 style="margin:0 0 0.5rem;color:var(--deep-red)">The Wrought‑Iron Key</h3>
        <p style="margin:0 0 0.5rem">A small key glints within the vampire's mouth.</p>
        <div class="puzzle-actions" style="justify-content:center;">
          <svg id="collectKey" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48" style="cursor:pointer;fill:var(--deep-red)">
            <path d="M32 8a12 12 0 100 24 12 12 0 000-24zm0 4a8 8 0 110 16 8 8 0 010-16zm14.121 23.879l-5.657 5.657L44 43.071 49.071 38l-2.95-2.95zM14.05 50.536l5.657-5.657L22.414 44l-5.657-5.657-5.657 5.657zm9.899-9.9L40.243 24.343l-5.657-5.657L18.292 34.979l5.657 5.657z"/>
          </svg>
        </div>
        <p style="margin-top:0.5rem;font-size:0.9rem">Click the key to collect it.</p>
      `;
      document.getElementById('collectKey').addEventListener('click', () => {
        inventory.push('Iron Key');
        inventoryList.innerHTML = inventory.map(item => `<li>${item}</li>`).join('');
        solveFace(face, 'The iron key slides free and disappears into your pocket.');
      });
    } else {
      puzzleContent.parentElement.classList.remove('shake');
      void puzzleContent.parentElement.offsetWidth;
      puzzleContent.parentElement.classList.add('shake');
      toast('The guardian still watches… (Upside down at midday.)');
    }
  });
}

function renderDurianPuzzle(face) {
  puzzleContent.innerHTML = `
    <h3 style="margin:0 0 0.5rem;color:var(--deep-red)">The Warding Fruit</h3>
    <p style="margin:0 0 0.5rem">Choose the fruit that wards <em>tropical</em> vampires. (Choose carefully.)</p>
    <div id="fruitGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.5rem;margin:0.5rem 0;">
      ${['Garlic','Mango','Durian','Pineapple','Lychee','Starfruit'].map(name => `
        <button class="fruitBtn" data-name="${name}" style="padding:0.8rem 0.5rem;background:#111;border:1px solid #333;color:#eee;border-radius:4px;cursor:pointer;">
          ${name}
        </button>`).join('')}
    </div>
    <div class="puzzle-actions"><button id="wardBtn" disabled>Ward this panel</button></div>
  `;
  let chosen = '';
  const buttons = [...document.querySelectorAll('.fruitBtn')];
  buttons.forEach(b => {
    b.addEventListener('click', () => {
      buttons.forEach(x => x.style.outline = 'none');
      b.style.outline = `2px solid var(--deep-red)`;
      chosen = b.dataset.name;
      document.getElementById('wardBtn').disabled = false;
    });
  });
  document.getElementById('wardBtn').addEventListener('click', () => {
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

function renderConstellationPuzzle(face) {
  const unlocked = {
    r: solved.front,
    rot: solved.right,
    spread: solved.left,
    inner: solved.top,
    off: solved.bottom
  };
  const lockIcon = ok => ok ? '' : '🔒';
  puzzleContent.innerHTML = `
    <h3 style="margin:0 0 0.5rem;color:var(--deep-red)">Starlit Prophecy</h3>
    <p style="margin:0 0 0.5rem">Gather the stars into the hibiscus.</p>
    <canvas id="starCanvas" width="360" height="240" style="width:100%;background:#0e0e0e;border:1px solid #222"></canvas>
    <div style="margin-top:0.5rem;display:grid;grid-template-columns:1fr 4fr;gap:0.5rem;align-items:center;">
      <label>Radius ${lockIcon(unlocked.r)}</label>      <input id="slR" type="range" min="10" max="100" value="40" ${unlocked.r ? '' : 'disabled'}>
      <label>Rotation ${lockIcon(unlocked.rot)}</label>  <input id="slRot" type="range" min="0" max="360" value="15" ${unlocked.rot ? '' : 'disabled'}>
      <label>Spread ${lockIcon(unlocked.spread)}</label> <input id="slSpread" type="range" min="0" max="80" value="35" ${unlocked.spread ? '' : 'disabled'}>
      <label>Inner ${lockIcon(unlocked.inner)}</label>   <input id="slInner" type="range" min="0" max="50" value="18" ${unlocked.inner ? '' : 'disabled'}>
      <label>Offset ${lockIcon(unlocked.off)}</label>    <input id="slOff" type="range" min="-40" max="40" value="0" ${unlocked.off ? '' : 'disabled'}>
    </div>
    <div class="puzzle-actions"><button id="bindStarsBtn">Bind the stars</button></div>
  `;
  const cvs  = document.getElementById('starCanvas');
  const ctx  = cvs.getContext('2d');
  const sliders = ['slR','slRot','slSpread','slInner','slOff'].map(id => document.getElementById(id));
  function draw() {
    const [R, rot, spread, inner, off] = sliders.map(s => parseFloat(s?.value || 0));
    ctx.clearRect(0,0,cvs.width,cvs.height);
    ctx.fillStyle = '#bbb';
    for (let i=0;i<5;i++) {
      const a = (i * (Math.PI * 2 / 5)) + (rot * Math.PI / 180);
      const r = R + (i % 2 === 0 ? spread : -inner);
      const x = cvs.width/2 + Math.cos(a) * r;
      const y = cvs.height/2 + Math.sin(a) * (r + off);
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    }
  }
  sliders.forEach(s => s && s.addEventListener('input', draw));
  draw();
  const target = { R:50, rot:25, spread:42, inner:15, off:6 };
  document.getElementById('bindStarsBtn').addEventListener('click', () => {
    const vals = {
      R: parseFloat(sliders[0]?.value || 0),
      rot: parseFloat(sliders[1]?.value || 0),
      spread: parseFloat(sliders[2]?.value || 0),
      inner: parseFloat(sliders[3]?.value || 0),
      off: parseFloat(sliders[4]?.value || 0),
    };
    const tol = (a,b,t) => Math.abs(a - b) <= t;
    const ok =
      tol(vals.R,    target.R,    4) &&
      tol(vals.rot,  target.rot,  4) &&
      tol(vals.spread,target.spread,4) &&
      tol(vals.inner,target.inner,3) &&
      tol(vals.off,  target.off,  3);
    if (ok) {
      solveFace(face, 'The flower blooms among the stars.');
    } else {
      puzzleContent.parentElement.classList.remove('shake');
      void puzzleContent.parentElement.offsetWidth;
      puzzleContent.parentElement.classList.add('shake');
      toast('The stars resist your hand.');
    }
  });
}

function renderRicePuzzle(face) {
  puzzleContent.innerHTML = `
    <h3 style="margin:0 0 0.5rem;color:var(--deep-red)">Arithmomania</h3>
    <p>Enter the total grains spilled across all panels:</p>
    <input id="riceInput" type="number" inputmode="numeric" style="width:100%;padding:0.5rem;background:#111;border:1px solid #333;color:#eee;border-radius:4px" placeholder="Total grains">
    <div class="puzzle-actions"><button id="riceCheckBtn">Open</button></div>
  `;
  document.getElementById('riceCheckBtn').addEventListener('click', () => {
    const correctTotal = 123; // adjust when real counts are wired
    const val = parseInt(document.getElementById('riceInput').value, 10);
    if (val === correctTotal) {
      solveFace(face, 'The panel slides with a soft sigh.');
    } else {
      puzzleContent.parentElement.classList.remove('shake');
      void puzzleContent.parentElement.offsetWidth;
      puzzleContent.parentElement.classList.add('shake');
      toast('Grains scattered from your hand…');
    }
  });
}

function renderAlchemyPuzzle(face) {
  puzzleContent.innerHTML = `
    <h3 style="margin:0 0 0.5rem;color:var(--deep-red)">Blood Alchemy</h3>
    <p>Mix the draught (2:3:1): Garlic / Moonlight / Rose.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;align-items:center;margin-top:0.5rem">
      <label>Garlic</label>    <input id="a1" type="range" min="0" max="5" value="0">
      <label>Moonlight</label> <input id="a2" type="range" min="0" max="5" value="0">
      <label>Rose</label>      <input id="a3" type="range" min="0" max="5" value="0">
    </div>
    <div id="brew" style="margin:0.75rem 0;height:22px;background:#111;border:1px solid #333;border-radius:3px;"></div>
    <div class="puzzle-actions"><button id="brewBtn">Brew</button></div>
  `;
  const bars = [document.getElementById('a1'), document.getElementById('a2'), document.getElementById('a3')];
  const brew = document.getElementById('brew');
  bars.forEach(b => b.addEventListener('input', () => {
    const [g,m,r] = bars.map(x => +x.value);
    const rr = Math.min(255, 80 + r*30 + m*10);
    const gg = Math.min(255, 10 + m*25);
    const bb = Math.min(255, 10 + g*10);
    brew.style.background = `rgb(${rr},${gg},${bb})`;
  }));
  document.getElementById('brewBtn').addEventListener('click', () => {
    const [g,m,r] = bars.map(x => +x.value);
    if (g === 2 && m === 3 && r === 1) {
      solveFace(face, 'The draught turns crimson and smokes.');
    } else {
      puzzleContent.parentElement.classList.remove('shake');
      void puzzleContent.parentElement.offsetWidth;
      puzzleContent.parentElement.classList.add('shake');
      toast('The mixture curdles.');
    }
  });
}

function renderMirrorLightPuzzle(face) {
  puzzleContent.innerHTML = `
    <h3 style="margin:0 0 0.5rem;color:var(--deep-red)">Mirror & Light</h3>
    <p>A beam must reach the sensor without touching a vampire. (Prototype to follow.)</p>
    <div class="puzzle-actions"><button id="fakeSolve">(Dev) Solve</button></div>
  `;
  document.getElementById('fakeSolve').addEventListener('click', () => {
    solveFace(face, 'Mirrors click; the beam finds its mark.');
  });
}

// Kick off the experience once the page loads
init();
