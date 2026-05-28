import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------
const sceneIdEl = document.getElementById('sceneId');
const latEl = document.getElementById('lat');
const lngEl = document.getElementById('lng');
const radiusEl = document.getElementById('radius');
const buildBtn = document.getElementById('buildBtn');
const downloadBtn = document.getElementById('downloadBtn');
const outEl = document.getElementById('out');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const progressPct = document.getElementById('progressPct');
const viewerOverlay = document.getElementById('viewer-overlay');
const viewerEl = document.getElementById('viewer');

// ---------------------------------------------------------------------------
// Three.js viewer
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
viewerEl.appendChild(renderer.domElement);

const threeScene = new THREE.Scene();
threeScene.background = new THREE.Color(0x0a0a10);
threeScene.fog = new THREE.Fog(0x0a0a10, 400, 900);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
camera.position.set(0, 120, 200);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 10;
controls.maxDistance = 800;

// Lights
threeScene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sun = new THREE.DirectionalLight(0xfff4e0, 1.8);
sun.position.set(60, 120, 40);
sun.castShadow = true;
threeScene.add(sun);
const fill = new THREE.DirectionalLight(0x8ab4f8, 0.4);
fill.position.set(-60, 40, -60);
threeScene.add(fill);

threeScene.add(new THREE.GridHelper(600, 60, 0x1a1a2e, 0x1a1a2e));

function onResize() {
  const w = viewerEl.clientWidth;
  const h = viewerEl.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
new ResizeObserver(onResize).observe(viewerEl);
onResize();

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(threeScene, camera);
});

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------
const STAGE_ORDER = ['queued', 'fetching', 'building', 'compiling', 'completed'];

function setStage(stageName, pct, label) {
  progressBar.style.width = `${pct}%`;
  progressText.textContent = label;
  progressPct.textContent = pct > 0 ? `${pct}%` : '';
  const activeIdx = STAGE_ORDER.indexOf(stageName);
  document.querySelectorAll('.stage').forEach((el, i) => {
    el.classList.remove('active', 'done');
    if (i < activeIdx) el.classList.add('done');
    else if (i === activeIdx) el.classList.add('active');
  });
}

let _fakeTimer = null;
function startFakeProgress() {
  const steps = [
    { pct: 45, stage: 'fetching', label: 'Fetching OSM & V-World…' },
    { pct: 65, stage: 'building', label: 'Building mesh plan…' },
    { pct: 82, stage: 'compiling', label: 'Compiling GLB…' },
    { pct: 93, stage: 'compiling', label: 'Validating geometry…' },
  ];
  let idx = 0;
  _fakeTimer = setInterval(() => {
    if (idx >= steps.length) { clearInterval(_fakeTimer); return; }
    const s = steps[idx++];
    setStage(s.stage, s.pct, s.label);
  }, 2000);
}

function stopFakeProgress() {
  clearInterval(_fakeTimer);
  _fakeTimer = null;
}

// ---------------------------------------------------------------------------
// Log
// ---------------------------------------------------------------------------
function log(val) {
  outEl.textContent = typeof val === 'string' ? val : JSON.stringify(val, null, 2);
}

// ---------------------------------------------------------------------------
// GLB loader
// ---------------------------------------------------------------------------
let _currentModel = null;
const loader = new GLTFLoader();

function loadGlb(url) {
  viewerOverlay.textContent = 'Loading 3D model…';
  viewerOverlay.style.display = 'flex';

  if (_currentModel) {
    threeScene.remove(_currentModel);
    _currentModel = null;
  }

  loader.load(
    url,
    (gltf) => {
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      model.position.sub(center);
      model.position.y += size.y / 2;
      threeScene.add(model);
      _currentModel = model;

      const maxDim = Math.max(size.x, size.y, size.z);
      camera.position.set(maxDim * 0.8, maxDim * 0.6, maxDim * 0.8);
      controls.target.set(0, size.y / 4, 0);
      controls.update();

      viewerOverlay.style.display = 'none';
      log(`GLB loaded — scene ${Math.round(size.x)}×${Math.round(size.z)} m`);
    },
    (xhr) => {
      if (xhr.total) {
        viewerOverlay.textContent = `Loading… ${Math.round((xhr.loaded / xhr.total) * 100)}%`;
      }
    },
    (err) => {
      viewerOverlay.textContent = 'Failed to load GLB';
      log(`GLB load error: ${err.message ?? err}`);
    }
  );
}

// ---------------------------------------------------------------------------
// Build + poll
// ---------------------------------------------------------------------------
let _currentJobId = null;
let _pollTimer = null;

async function build() {
  const payload = {
    sceneId: sceneIdEl.value.trim(),
    lat: Number(latEl.value),
    lng: Number(lngEl.value),
    radius: Number(radiusEl.value),
    force: true,
  };

  buildBtn.disabled = true;
  stopFakeProgress();
  clearInterval(_pollTimer);
  setStage('queued', 8, 'Queuing build…');
  log({ status: 'submitting', payload });

  try {
    const res = await fetch('/api/build', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();

    if (!res.ok || !json.jobId) {
      setStage('queued', 0, `Error: ${json.error ?? 'unknown'}`);
      buildBtn.disabled = false;
      log(json);
      return;
    }

    _currentJobId = json.jobId;
    log(json);
    setStage('fetching', 35, 'Build running…');
    startFakeProgress();
    pollJob(json.jobId);
  } catch (err) {
    setStage('queued', 0, 'Network error');
    buildBtn.disabled = false;
    log(`Fetch error: ${err.message}`);
  }
}

function pollJob(jobId) {
  _pollTimer = setInterval(async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) return;
      const job = await res.json();

      if (job.status === 'completed') {
        clearInterval(_pollTimer);
        stopFakeProgress();
        setStage('completed', 100, '✓ Build complete');
        buildBtn.disabled = false;
        log(job);
        loadGlb(`/api/jobs/${jobId}/download`);
      } else if (job.status === 'failed') {
        clearInterval(_pollTimer);
        stopFakeProgress();
        setStage('queued', 0, `✗ ${job.error ?? 'Build failed'}`);
        buildBtn.disabled = false;
        log(job);
      }
    } catch {
      // transient network error — keep polling
    }
  }, 800);
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
buildBtn.addEventListener('click', () => void build());

downloadBtn.addEventListener('click', () => {
  if (_currentJobId) {
    window.location.href = `/api/jobs/${_currentJobId}/download`;
  } else {
    window.location.href = '/api/build/download';
  }
});
