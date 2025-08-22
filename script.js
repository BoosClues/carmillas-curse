// script.js for Three.js puzzle box (no OrbitControls)

// HTML buttons and elements
const resetBtn     = document.getElementById('resetBtn');
const musicBtn     = document.getElementById('musicBtn');
const certificate  = document.getElementById('certificate');
const closeCertBtn = document.getElementById('closeCertBtn');
const bgMusic      = document.getElementById('bgMusic');

// Track which faces are solved
const solved = { front: false, back: false, left: false, right: false, top: false, bottom: false };

// Three.js variables
let scene, camera, renderer, cube, raycaster, mouse;
let isDragging = false;
let dragMoved = false;
let prev = { x: 0, y: 0 };
let initialRotation = { x: 0, y: 0 };

// Helpers for face mapping
function faceLabelFromMaterialIndex(i) {
  // order of materials we assign below: [right, left, top, bottom, front, back]
  switch (i) {
    case 4: return 'front';
    case 5: return 'back';
    case 1: return 'left';
    case 0: return 'right';
    case 2: return 'top';
    case 3: return 'bottom';
    default: return '';
  }
}
function materialIndexFromFaceIndex(geom, faceIndex) {
  // BufferGeometry uses index buffer; groups are in triangle indices (not faces), so multiply faceIndex by 3
  const triStart = faceIndex * 3;
  const groups = geom.groups;
  for (let g of groups) {
    if (triStart >= g.start && triStart < g.start + g.count) return g.materialIndex;
  }
  return 0; // fallback
}

// Set up the scene
function init() {
  const container = document.getElementById('three-container');
  if (!container) {
    console.error('No #three-container element found.');
    return;
  }

  scene  = new THREE.Scene();
  scene.background = new THREE.Color(0x222222); // dark grey for contrast

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 5);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.domElement.style.touchAction = 'none'; // prevent page scrolling on touch drag
  container.appendChild(renderer.domElement);

  // Load textures for each face (use white tint so the dark texture remains visible)
  const loader = new THREE.TextureLoader();
  const tex = (path) => loader.load(path, undefined, undefined, () => {
    console.warn('Texture failed to load:', path);
  });

  const materials = [
    new THREE.MeshBasicMaterial({ map: tex('boxTexture.png'), color: 0xffffff }), // right
    new THREE.MeshBasicMaterial({ map: tex('boxTexture.png'), color: 0xffffff }), // left
    new THREE.MeshBasicMaterial({ map: tex('boxTexture.png'), color: 0xffffff }), // top
    new THREE.MeshBasicMaterial({ map: tex('boxTexture.png'), color: 0xffffff }), // bottom
    new THREE.MeshBasicMaterial({ map: tex('boxTexture.png'), color: 0xffffff }), // front
    new THREE.MeshBasicMaterial({ map: tex('boxTexture.png'), color: 0xffffff })  // back
  ];

  const geom = new THREE.BoxGeometry(2, 2, 2);
  cube = new THREE.Mesh(geom, materials);
  scene.add(cube);

  // Save initial rotation for reset
  initialRotation.x = cube.rotation.x;
  initialRotation.y = cube.rotation.y;

  // Raycaster for picking faces
  raycaster = new THREE.Raycaster();
  mouse     = new THREE.Vector2();

  // Pointer events for rotation
  renderer.domElement.addEventListener('mousedown', onPointerDown);
  renderer.domElement.addEventListener('mousemove', onPointerMove);
  renderer.domElement.addEventListener('mouseup', onPointerUp);
  renderer.domElement.addEventListener('mouseleave', onPointerUp);

  // Touch support
  renderer.domElement.addEventListener('touchstart', (e) => {
    if (!e.touches.length) return;
    isDragging = true; dragMoved = false;
    prev.x = e.touches[0].clientX;
    prev.y = e.touches[0].clientY;
  }, { passive: true });

  renderer.domElement.addEventListener('touchmove', (e) => {
    if (!isDragging || !e.touches.length) return;
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    const dx = x - prev.x;
    const dy = y - prev.y;
    cube.rotation.y += dx * 0.01;
    cube.rotation.x += dy * 0.01;
    prev.x = x; prev.y = y; dragMoved = true;
  }, { passive: true });

  renderer.domElement.addEventListener('touchend', () => { isDragging = false; });

  // Click to solve face (only when not dragging)
  renderer.domElement.addEventListener('click', onClick);

  // Handle window resize
  window.addEventListener('resize', onWindowResize);

  animate();
}

function onPointerDown(e) {
  isDragging = true; dragMoved = false;
  prev.x = e.clientX; prev.y = e.clientY;
}
function onPointerMove(e) {
  if (!isDragging) return;
  const dx = e.clientX - prev.x;
  const dy = e.clientY - prev.y;
  cube.rotation.y += dx * 0.01;
  cube.rotation.x += dy * 0.01;
  prev.x = e.clientX; prev.y = e.clientY; dragMoved = true;
}
function onPointerUp() {
  isDragging = false;
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Convert intersection to face name + dim the face
function handleIntersection(intersect) {
  const faceIdx = intersect.faceIndex;
  const matIdx = materialIndexFromFaceIndex(cube.geometry, faceIdx);
  const faceName = faceLabelFromMaterialIndex(matIdx);
  if (!faceName) return;

  if (!solved[faceName]) {
    solved[faceName] = true;
    alert(`You solved the ${faceName} face!`);
    cube.material[matIdx].color.set(0x333333); // dim that face
    checkCompletion();
  } else {
    alert(`The ${faceName} face is already solved.`);
  }
}

function onClick(event) {
  if (dragMoved) return; // don't treat drags as clicks

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObject(cube);
  if (hits.length) handleIntersection(hits[0]);
}

function checkCompletion() {
  if (Object.values(solved).every(Boolean)) {
    certificate.classList.add('show');
    if (!bgMusic.paused) bgMusic.pause();
  }
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

// Buttons
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
closeCertBtn.addEventListener('click', () => {
  certificate.classList.remove('show');
});

// Start
init();

