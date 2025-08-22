/*
 * script.js
 *
 * Handles user interaction for the Carmilla's Curse puzzle box.
 * Rotates a CSS 3D cube via mouse or touch, tracks solved state for each
 * face, and reveals a certificate overlay when all puzzles are solved.
 */

// Elements
const resetBtn      = document.getElementById('resetBtn');
const musicBtn      = document.getElementById('musicBtn');
const cube          = document.getElementById('cube');
const viewport      = document.getElementById('viewport');
const certificate   = document.getElementById('certificate');
const bgMusic       = document.getElementById('bgMusic');
const closeCertBtn  = document.getElementById('closeCertBtn');

// Rotation state
let rotX = -15;
let rotY = -25;
let dragging = false;
let startX  = 0;
let startY  = 0;

function applyRotation() {
  cube.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
}

// Drag handlers
function pointerDown(e) {
  dragging = true;
  startX = e.clientX || e.touches[0].clientX;
  startY = e.clientY || e.touches[0].clientY;
}

function pointerMove(e) {
  if (!dragging) return;
  const x = e.clientX || e.touches[0].clientX;
  const y = e.clientY || e.touches[0].clientY;
  const dx = x - startX;
  const dy = y - startY;
  rotY += dx * 0.3;
  rotX -= dy * 0.3;
  applyRotation();
  startX = x;
  startY = y;
}

function pointerUp() {
  dragging = false;
}

// Register pointer events for dragging
viewport.addEventListener('mousedown', pointerDown);
viewport.addEventListener('touchstart', pointerDown, { passive: true });
window.addEventListener('mousemove', pointerMove);
window.addEventListener('touchmove', pointerMove, { passive: true });
window.addEventListener('mouseup', pointerUp);
window.addEventListener('touchend', pointerUp);

// Track solved faces
const solved = {
  front: false,
  back:  false,
  left:  false,
  right: false,
  top:   false,
  bottom:false
};

function checkCompletion() {
  const allSolved = Object.values(solved).every(v => v);
  if (allSolved) {
    certificate.classList.add('show');
    // Pause music when the certificate appears
    if (!bgMusic.paused) {
      bgMusic.pause();
    }
  }
}

// Face click handler: marks a face as solved
function onFaceClick(e) {
  const face = e.currentTarget.dataset.face;
  if (solved[face]) {
    alert(`You've already solved the ${face} puzzle!`);
    return;
  }
  alert(`${face.charAt(0).toUpperCase() + face.slice(1)} face puzzle solved!`);
  solved[face] = true;
  // Visually indicate completion (grayed out)
  e.currentTarget.style.filter = 'grayscale(100%) brightness(0.6)';
  checkCompletion();
  e.stopPropagation();
}

// Attach click handlers to faces
document.querySelectorAll('.face').forEach(face => {
  face.addEventListener('click', onFaceClick);
});

// Reset rotation button
resetBtn.addEventListener('click', () => {
  rotX = -15;
  rotY = -25;
  applyRotation();
});

// Toggle background music playback
musicBtn.addEventListener('click', () => {
  if (bgMusic.paused) {
    bgMusic.play().catch(() => {});
    musicBtn.textContent = 'Pause Music';
  } else {
    bgMusic.pause();
    musicBtn.textContent = 'Play Music';
  }
});

// Close certificate overlay
if (closeCertBtn) {
  closeCertBtn.addEventListener('click', () => {
    certificate.classList.remove('show');
  });
}

// Initial setup on page load
window.addEventListener('load', () => {
  applyRotation();
  // Attempt to auto‑play music; if blocked, default the button to Play Music
  bgMusic.play().catch(() => {
    musicBtn.textContent = 'Play Music';
  });
  if (!bgMusic.paused) {
    musicBtn.textContent = 'Pause Music';
  }
});
