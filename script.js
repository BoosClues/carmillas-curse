/* eslint-disable */
(() => {
  // ---------- Core setup ----------
  const canvas = document.getElementById('stage');
  const statusEl = document.getElementById('status');
  const stanzaStrip = document.getElementById('stanzaStrip');
  const resetBtn = document.getElementById('resetBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const muteBtn = document.getElementById('muteBtn');

  const isMobile = matchMedia('(pointer: coarse)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 200);
  camera.position.set(0.8, 0.7, 2.8);

  // Subtle pedestal spotlight feel
  const hemi = new THREE.HemisphereLight(0xffffff, 0x333333, 0.45);
  scene.add(hemi);
  const spot = new THREE.SpotLight(0xffe8c4, 3, 8, Math.PI / 6, 0.25, 1.5);
  spot.position.set(1.8, 3.0, 2.0);
  spot.target.position.set(0, 0, 0);
  scene.add(spot, spot.target);

  // Obsidian-ish env (placeholder tone)
  scene.background = null;

  // Orbit only for zoom out; we’ll program custom close-ups for “The Room” feel
  const orbit = new THREE.OrbitControls(camera, renderer.domElement);
  orbit.enablePan = false;
  orbit.enableDamping = true;
  orbit.minDistance = 1.0;
  orbit.maxDistance = 4.0;
  orbit.enabled = false;

  // ---------- Audio ----------
  let audioEnabled = true;
  const listener = new THREE.AudioListener();
  camera.add(listener);
  const sfx = {};
  function loadSfx(name, url) {
    const a = new THREE.Audio(listener);
    const loader = new THREE.AudioLoader();
    loader.load(url, (buffer) => { a.setBuffer(buffer); a.setVolume(0.6); });
    sfx[name] = a;
  }
  // You can add real files later; these are optional
  loadSfx('tick', 'assets/audio/sfx_wheel_tick.ogg');
  loadSfx('hiss', 'assets/audio/sfx_valve_hiss.ogg');
  loadSfx('latch', 'assets/audio/sfx_latch.ogg');
  loadSfx('scope', 'assets/audio/sfx_scope_click.ogg');
  loadSfx('key', 'assets/audio/sfx_key_in.ogg');

  muteBtn.addEventListener('click', () => {
    audioEnabled = !audioEnabled;
    muteBtn.textContent = audioEnabled ? 'Audio' : 'Muted';
  });
  function play(name, vol=1.0, rate=1.0) {
    if (!audioEnabled || !sfx[name] || !sfx[name].buffer) return;
    sfx[name].setVolume(0.5 * vol);
    sfx[name].playbackRate = rate;
    sfx[name].stop(); sfx[name].play();
  }

  // ---------- Helpers ----------
  const tmpV = new THREE.Vector3();
  function setStatus(text) { statusEl.textContent = text; }

  function easeCamTo(pos, look, dur=0.7, ease='power2.out') {
    gsap.to(camera.position, { x: pos.x, y: pos.y, z: pos.z, duration: dur, ease });
    gsap.to(orbit.target, { x: look.x, y: look.y, z: look.z, duration: dur, ease, onUpdate: ()=>orbit.update() });
  }

  // ---------- Box & Pedestal ----------
  const root = new THREE.Group(); scene.add(root);

  // Pedestal (simple)
  const ped = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.45, 0.4, 24),
    new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.9, metalness: 0.05 })
  );
  ped.position.y = -0.55; root.add(ped);

  // Box base (obsidian slab)
  const box = new THREE.Group(); root.add(box);
  const matObsidian = new THREE.MeshStandardMaterial({
    color: 0x0b0b0b, metalness: 0.4, roughness: 0.25,
    envMapIntensity: 0.8
  });
  const matBrass = new THREE.MeshStandardMaterial({ color: 0xa98a4a, metalness: 0.85, roughness: 0.35 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1, 0.6, 1, 1, 1, 1), matObsidian);
  body.position.y = -0.05;
  box.add(body);

  // Carved bezel hint (just a frame for now)
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.62, 1.02), new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true, opacity: 0.08, transparent: true }));
  bezel.position.copy(body.position);
  box.add(bezel);

  // ---------- Camera “shots” ----------
  const shots = {
    overview:  { pos: new THREE.Vector3(0.8, 0.7, 2.8), look: new THREE.Vector3(0,0,0) },
    prick:     { pos: new THREE.Vector3(0.15, 0.35, 1.2), look: new THREE.Vector3(0.0, 0.15, 0.1) },
    pressure:  { pos: new THREE.Vector3(-0.35, 0.32, 1.15), look: new THREE.Vector3(-0.28, 0.18, 0.15) },
    plugboard: { pos: new THREE.Vector3(0.45, 0.15, 1.1), look: new THREE.Vector3(0.35, 0.05, 0.05) },
    glyphs:    { pos: new THREE.Vector3(0.0, 0.45, 1.15),  look: new THREE.Vector3(0.0, 0.15, 0.0) },
    vampire:   { pos: new THREE.Vector3(0.0, 0.25, 1.1),   look: new THREE.Vector3(0.0, 0.1, 0.2) },
    rings:     { pos: new THREE.Vector3(-0.25, 0.2, 1.05), look: new THREE.Vector3(-0.2, 0.05, 0.0) }
  };

  function go(name) {
    const s = shots[name] || shots.overview;
    orbit.enabled = (name === 'overview');
    easeCamTo(s.pos, s.look);
  }

  // ---------- FSM State ----------
  const state = {
    step: 0,              // 0..7
    bloodStarted: false,  // step 1
    pressureOK: false,    // step 2
    plugsCorrect: 0,      // step 3
    stanzas: [],          // step 4
    glyphSolved: false,   // step 4
    vampireKeyReady: false, // step 5
    ringsSolved: false,   // step 6
    hardenedKey: false    // step 7
  };

  function nextStep() {
    state.step++;
    const names = [
      '0 — “Prick to begin”',
      '1 — Blood started',
      '2 — Pressure correct',
      '3 — IV routing done',
      '4 — Glyph order entered',
      '5 — Vampire key revealed',
      '6 — Rings aligned',
      '7 — Obsidian key forged'
    ];
    setStatus('Step: ' + (state.step) + ' — ' + names[state.step]);
  }

  // ---------- Input (raycast drag) ----------
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let grabbed = null;

  function onPointerDown(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    pointer.x = (cx / rect.width) * 2 - 1;
    pointer.y = -(cy / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(interactives, true);
    if (hits.length) {
      const top = hits[0].object.userData.handle || hits[0].object;
      if (top.onDown) { grabbed = top; top.onDown(hits[0], e); }
    }
  }
  function onPointerMove(e) {
    if (!grabbed || !grabbed.onMove) return;
    grabbed.onMove(e);
  }
  function onPointerUp(e) {
    if (!grabbed) return;
    if (grabbed.onUp) grabbed.onUp(e);
    grabbed = null;
  }

  renderer.domElement.addEventListener('pointerdown', onPointerDown, { passive: true });
  renderer.domElement.addEventListener('pointermove', onPointerMove,  { passive: true });
  renderer.domElement.addEventListener('pointerup',   onPointerUp,    { passive: true });
  renderer.domElement.addEventListener('touchstart', onPointerDown, { passive: true });
  renderer.domElement.addEventListener('touchmove',  onPointerMove,  { passive: true });
  renderer.domElement.addEventListener('touchend',   onPointerUp,    { passive: true });

  // ---------- Interactives registry ----------
  const interactives = [];

  // Utility: create a “hinge” handle (for knobs/valves)
  function makeHinge(mesh, axis='y', min=-Math.PI, max=Math.PI, detents=0, onChange=()=>{}) {
    let angle = 0;
    const handle = {
      mesh, axis, min, max, detents, onChange,
      onDown(hit) { this._start = { x: hit.uv ? hit.uv.x : 0, y: hit.uv ? hit.uv.y : 0 }; this._lastX = null; play('tick', .6); },
      onMove(e) {
        const dx = (e.movementX || (e.touches ? e.touches[0].movementX : 0)) || 0;
        const scale = isMobile ? 0.01 : 0.005;
        angle = THREE.MathUtils.clamp(angle + dx * scale, min, max);
        mesh.rotation[axis] = angle;
        if (detents > 0) {
          const step = (max - min) / detents;
          const snapped = Math.round((angle - min) / step) * step + min;
          if (Math.abs(snapped - angle) < step * 0.2) angle = mesh.rotation[axis] = snapped;
        }
        onChange(angle);
      },
      onUp() { play('tick', .4); }
    };
    mesh.userData.handle = handle;
    interactives.push(mesh);
    return handle;
  }

  // Utility: a draggable “plug” that snaps into a “port”
  function makePlug(mesh, ports, id, onConnect=()=>{}) {
    let dragging = false;
    let start = new THREE.Vector3();
    mesh.userData.handle = {
      onDown(hit) { dragging = true; start.copy(mesh.position); play('tick'); },
      onMove(e) {
        if (!dragging) return;
        // Move in camera plane
        const rect = renderer.domElement.getBoundingClientRect();
        const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
        const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
        pointer.x = (cx / rect.width) * 2 - 1;
        pointer.y = -(cy / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -mesh.position.z);
        const p = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, p);
        mesh.position.x = THREE.MathUtils.clamp(p.x, -0.45, 0.45);
        mesh.position.y = THREE.MathUtils.clamp(p.y, -0.15, 0.35);
      },
      onUp() {
        dragging = false;
        // Snap to matching port if close enough
        let snapped = false;
        for (const port of ports) {
          if (port.id !== id || port.occupied) continue;
          const d = mesh.position.distanceTo(port.mesh.position);
          if (d < 0.08) {
            mesh.position.copy(port.mesh.position);
            port.occupied = true; snapped = true; play('latch');
            onConnect(port);
            break;
          }
        }
        if (!snapped) gsap.to(mesh.position, { x: start.x, y: start.y, z: start.z, duration: .25, ease: 'power2.out' });
      }
    };
    interactives.push(mesh);
    return mesh.userData.handle;
  }

  // ---------- Mechanisms ----------
  // Step 1: Prick your finger (simple pin you tap to “arm” the box)
  const prickPad = new THREE.Group();
  prickPad.position.set(0.0, 0.12, 0.22);
  box.add(prickPad);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 32), matBrass);
  pad.rotation.x = Math.PI/2;
  prickPad.add(pad);
  const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.06, 12), new THREE.MeshStandardMaterial({ color: 0x992222, metalness: .8, roughness: .4 }));
  needle.position.set(0, 0.04, 0); prickPad.add(needle);
  needle.userData.handle = {
    onDown() {
      if (state.step !== 0) return;
      play('latch', .6);
      gsap.to(needle.scale, { y: 0.5, duration: 0.2, yoyo: true, repeat: 1 });
      state.bloodStarted = true;
      nextStep();              // step -> 1
      go('pressure');          // guide to next station
      stanzaStrip.style.display = 'block';
      stanzaStrip.textContent = 'Stanza I glows faintly…';
    }
  };
  interactives.push(needle);

  // Step 2: Pressure deck — two valves + a gauge
  const pressureDeck = new THREE.Group();
  pressureDeck.position.set(-0.28, 0.1, 0.18);
  box.add(pressureDeck);

  const gauge = new THREE.Group(); pressureDeck.add(gauge);
  const dial = new THREE.Mesh(new THREE.CircleGeometry(0.07, 32), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: .4, roughness: .6 }));
  dial.position.set(0, 0.11, 0); gauge.add(dial);
  const needleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.004, 0.004), new THREE.MeshStandardMaterial({ color: 0xdd4444, metalness: .2, roughness: .4 }));
  needleMesh.position.set(0, 0.11, 0.002); gauge.add(needleMesh);

  const valveLeft = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.01, 12, 32), matBrass);
  valveLeft.position.set(-0.08, 0.02, 0); pressureDeck.add(valveLeft);

  const valveRight = valveLeft.clone(); valveRight.position.x = 0.08; pressureDeck.add(valveRight);

  let psi = 0;
  const leftH = makeHinge(valveLeft, 'z', -Math.PI/2, Math.PI/2, 10, onValve);
  const rightH = makeHinge(valveRight, 'z', -Math.PI/2, Math.PI/2, 10, onValve);

  function onValve() {
    // simple function: angle sum centered sets "pressure"
    const t = (valveLeft.rotation.z + valveRight.rotation.z + Math.PI) / (2*Math.PI);
    psi = THREE.MathUtils.clamp(t, 0, 1);
    const angle = THREE.MathUtils.lerp(-Math.PI*0.6, Math.PI*0.6, psi);
    needleMesh.rotation.z = angle;
    if (Math.abs(psi - 0.62) < 0.05 && state.step === 1) {
      state.pressureOK = true;
      play('hiss', 0.7);
      nextStep();           // step -> 2
      go('plugboard');
      stanzaStrip.textContent = 'Stanza II flickers to life…';
    }
  }

  // Step 3: Plugboard — one cable to correct port (expand to 5 later)
  const plugboard = new THREE.Group();
  plugboard.position.set(0.32, -0.02, 0.1);
  box.add(plugboard);

  // Ports
  const ports = [];
  for (let i=0;i<3;i++){
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.02, 24), new THREE.MeshStandardMaterial({ color: 0x222222, metalness: .7, roughness: .4 }));
    p.rotation.x = Math.PI/2;
    p.position.set(-0.06 + i*0.06, 0.08, 0.0);
    plugboard.add(p);
    p.userData = { id: i, occupied: false }; ports.push({ id: i, mesh: p, occupied: false });
  }
  // Correct port is id=2 (rightmost) for demo
  const plug = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.05, 24), new THREE.MeshStandardMaterial({ color: 0x343434, metalness: .8, roughness: .35 }));
  plug.position.set(-0.06, -0.02, 0.0);
  plugboard.add(plug);

  makePlug(plug, ports, 2, () => {
    if (state.step === 2) {
      state.plugsCorrect = 1;
      nextStep(); // step -> 3
      stanzaStrip.textContent = 'Stanza III kindles across the bezel…';
      go('glyphs');
      // TODO: reveal a stanza + glyph grid overlay here (Step 4)
    }
  });

  // ---------- Step 4–7: scaffolds (we’ll fill these next) ----------
  // Step 4: Glyph entry (show a translucent grid over a face; accept taps in order)
  // TODO: build glyph plane + click order; when correct -> state.glyphSolved = true; nextStep(); go('vampire');

  // Step 5: Vampire panel (day/night + upside-down => reveal key)
  // TODO: front face sub-panel with rotate handle; if cube rotated (or handle sim) + "day" state -> show key; nextStep(); go('rings');

  // Step 6: Multi-tier ring maze (linked rings)
  // TODO: three concentric rings with coupling ratios; align engraved channels to carry “blood”; when aligned -> nextStep();

  // Step 7: Obsidian key forge + final keyhole with bat pivot
  // TODO: animate “hardening” (shader/emissive), show bat cover hinge; insert key (play('key')); open lid -> artefact

  // ---------- UI ----------
  resetBtn.addEventListener('click', () => {
    orbit.reset(); orbit.update();
    camera.position.copy(shots.overview.pos);
    orbit.target.copy(shots.overview.look);
    state.step = 0; setStatus('Step: 0 — “Prick to begin”');
    stanzaStrip.style.display = 'none';
    // Reset interactions roughly
    valveLeft.rotation.z = 0;
    valveRight.rotation.z = 0;
    needleMesh.rotation.z = 0;
    plug.position.set(-0.06, -0.02, 0.0);
    ports.forEach(p => p.occupied = false);
    state.bloodStarted = false; state.pressureOK=false; state.plugsCorrect=0;
  });

  zoomOutBtn.addEventListener('click', () => { go('overview'); });

  // ---------- Start ----------
  go('prick');

  // ---------- Render loop ----------
  function loop() {
    orbit.update();
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  loop();

  // Responsive
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
})();
