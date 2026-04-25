import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.161.0/examples/jsm/controls/OrbitControls.js';

const SIZE = 28;
const CELL_SCALE = 0.25;
const ALIVE_THRESHOLD = 0.22;

// SmoothLife-like parameters (adapted for 3D shell sampling)
const B1 = 0.26;
const B2 = 0.36;
const D1 = 0.29;
const D2 = 0.47;
const N_ALPHA = 0.06;
const M_ALPHA = 0.12;
const DT = 0.34;

const canvas = document.querySelector('#app');
const generationEl = document.querySelector('#generation');
const fillEl = document.querySelector('#fill');
const pauseBtn = document.querySelector('#pause');
const randomizeBtn = document.querySelector('#randomize');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x070b14, 0.055);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(10, 9, 10);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0);

scene.add(new THREE.AmbientLight(0xa9b5ff, 0.62));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.15);
keyLight.position.set(8, 10, 5);
scene.add(keyLight);

const geometry = new THREE.BoxGeometry(CELL_SCALE, CELL_SCALE, CELL_SCALE);
const material = new THREE.MeshStandardMaterial({
  color: 0x7fc3ff,
  transparent: true,
  opacity: 0.9,
  emissive: 0x2550ff,
  emissiveIntensity: 0.38,
  roughness: 0.65,
  metalness: 0.05,
});

const maxInstances = SIZE ** 3;
const mesh = new THREE.InstancedMesh(geometry, material, maxInstances);
mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(mesh);

const outerOffsets = [];
const innerOffsets = [];
(function buildKernel() {
  const innerRadius = 1.45;
  const outerRadius = 3.1;
  for (let z = -Math.ceil(outerRadius); z <= Math.ceil(outerRadius); z += 1) {
    for (let y = -Math.ceil(outerRadius); y <= Math.ceil(outerRadius); y += 1) {
      for (let x = -Math.ceil(outerRadius); x <= Math.ceil(outerRadius); x += 1) {
        const d = Math.sqrt(x * x + y * y + z * z);
        if (d <= innerRadius) {
          innerOffsets.push([x, y, z]);
        } else if (d <= outerRadius) {
          outerOffsets.push([x, y, z]);
        }
      }
    }
  }
})();

let current = new Float32Array(maxInstances);
let next = new Float32Array(maxInstances);
let generation = 0;
let paused = false;

function idx(x, y, z) {
  return x + y * SIZE + z * SIZE * SIZE;
}

function wrap(n) {
  return (n + SIZE) % SIZE;
}

function logisticThreshold(x, x0, alpha) {
  return 1 / (1 + Math.exp((-4 / alpha) * (x - x0)));
}

function logisticInterval(x, a, b, alpha) {
  return logisticThreshold(x, a, alpha) * (1 - logisticThreshold(x, b, alpha));
}

function mix(a, b, t) {
  return a * (1 - t) + b * t;
}

function randomizeField() {
  for (let i = 0; i < current.length; i += 1) {
    current[i] = Math.random() > 0.76 ? 1 : Math.random() * 0.05;
  }
  generation = 0;
}

function stepSimulation() {
  for (let z = 0; z < SIZE; z += 1) {
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        let m = 0;
        let n = 0;

        for (let i = 0; i < innerOffsets.length; i += 1) {
          const o = innerOffsets[i];
          m += current[idx(wrap(x + o[0]), wrap(y + o[1]), wrap(z + o[2]))];
        }

        for (let i = 0; i < outerOffsets.length; i += 1) {
          const o = outerOffsets[i];
          n += current[idx(wrap(x + o[0]), wrap(y + o[1]), wrap(z + o[2]))];
        }

        m /= innerOffsets.length;
        n /= outerOffsets.length;

        const aliveness = logisticThreshold(m, 0.5, M_ALPHA);
        const t1 = mix(B1, D1, aliveness);
        const t2 = mix(B2, D2, aliveness);
        const transition = logisticInterval(n, t1, t2, N_ALPHA);

        const iCell = idx(x, y, z);
        next[iCell] = Math.min(1, Math.max(0, current[iCell] + DT * (transition - current[iCell])));
      }
    }
  }

  [current, next] = [next, current];
  generation += 1;
}

const tempMatrix = new THREE.Matrix4();
const tempPosition = new THREE.Vector3();

function updateInstancedMesh() {
  let visibleCount = 0;
  for (let z = 0; z < SIZE; z += 1) {
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        const value = current[idx(x, y, z)];
        if (value <= ALIVE_THRESHOLD) continue;

        tempPosition.set(
          (x - SIZE / 2) * CELL_SCALE,
          (y - SIZE / 2) * CELL_SCALE,
          (z - SIZE / 2) * CELL_SCALE,
        );
        tempMatrix.makeTranslation(tempPosition.x, tempPosition.y, tempPosition.z);
        mesh.setMatrixAt(visibleCount, tempMatrix);
        visibleCount += 1;
      }
    }
  }

  mesh.count = visibleCount;
  mesh.instanceMatrix.needsUpdate = true;

  generationEl.textContent = `Generation: ${generation}`;
  fillEl.textContent = `Fill: ${((visibleCount / maxInstances) * 100).toFixed(1)}%`;
}

pauseBtn.addEventListener('click', () => {
  paused = !paused;
  pauseBtn.textContent = paused ? 'Resume' : 'Pause';
});

randomizeBtn.addEventListener('click', () => {
  randomizeField();
  updateInstancedMesh();
});

window.addEventListener('keydown', (ev) => {
  if (ev.code === 'Space') {
    ev.preventDefault();
    paused = !paused;
    pauseBtn.textContent = paused ? 'Resume' : 'Pause';
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

randomizeField();
updateInstancedMesh();

let accumulator = 0;
let lastTime = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = now - lastTime;
  lastTime = now;
  accumulator += dt;

  if (!paused) {
    while (accumulator >= 33) {
      stepSimulation();
      accumulator -= 33;
    }
    updateInstancedMesh();
  }

  controls.update();
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);
