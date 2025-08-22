// script.js for Three.js puzzle box

// HTML buttons and elements
const resetBtn     = document.getElementById('resetBtn');
const musicBtn     = document.getElementById('musicBtn');
const certificate  = document.getElementById('certificate');
const closeCertBtn = document.getElementById('closeCertBtn');
const bgMusic      = document.getElementById('bgMusic');

// Track which faces are solved
const solved = { front: false, back: false, left: false, right: false, top: false, bottom: false };

// Three.js variables
let scene, camera, renderer, cube, controls, raycaster, mouse;

// Set up the scene
function init() {
  const container = document.getElementById('three-container');
  scene  = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 5);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  // Load textures for each face (replace filenames if needed)
  const loader = new THREE.TextureLoader();
  const materials = [
    new THREE.MeshBasicMaterial({ map: loader.load('boxTexture.png') }), // right
    new THREE.MeshBasicMaterial({ map: loader.load('boxTexture.png') }), // left
    new THREE.MeshBasicMaterial({ map: loader.load('boxTexture.png') }), // top
    new THREE.MeshBasicMaterial({ map: loader.load('boxTexture.png') }), // bottom
    new THREE.MeshBasicMaterial({ map: loader.load('boxTexture.png') }), // front
    new THREE.MeshBasicMaterial({ map: loader.load('boxTexture.png') })  // back
  ];

  cube = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), materials);
  scene.add(cube);

  // Allow mouse rotation with damping
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping    = true;
  controls.dampingFactor    = 0.05;
  controls.enablePan        = false;
  controls.rotateSpeed      = 0.5;
  controls.autoRotate       = false;

  // Raycaster for picking faces
  raycaster = new THREE.Raycaster();
  mouse     = new THREE.Vector2();
  renderer.domElement.addEventListener('click', onClick);

  // Handle window resize
  window.addEventListener('resize', onWindowResize);
  animate();
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Convert intersection face index to human‑readable label
function faceLabel(materialIndex) {
  // material indices correspond to right, left, top, bottom, front, back
  switch (materialIndex) {
    case 4: return 'front';
    case 5: return 'back';
    case 1: return 'left';
    case 0: return 'right';
    case 2: return 'top';
    case 3: return 'bottom';
    default: return '';
  }
}

// Handle cube clicks
function onClick(event) {
  // normalise mouse coords
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(cube);
  if (intersects.length > 0) {
    const faceName = faceLabel(intersects[0].face.materialIndex);
    if (!solved[faceName]) {
      solved[faceName] = true;
      alert(`You solved the ${faceName} face!`);
      // optionally dim the face to show it’s solved
      cube.material[intersects[0].face.materialIndex].color.set(0x333333);
      checkCompletion();
    } else {
      alert(`The ${faceName} face is already solved.`);
    }
  }
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
  controls.update();
  renderer.render(scene, camera);
}

// Button behaviour
resetBtn.addEventListener('click', () => {
  controls.reset(); // resets camera rotation
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

// Start everything
init();

