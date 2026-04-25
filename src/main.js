const SIZE = 28;
const CELL_SCALE = 0.28;
const ALIVE_THRESHOLD = 0.2;

// SmoothLife-like parameters adapted to 3D shell neighborhoods.
const B1 = 0.26;
const B2 = 0.36;
const D1 = 0.29;
const D2 = 0.47;
const N_ALPHA = 0.06;
const M_ALPHA = 0.12;
const DT = 0.34;

const canvas = document.querySelector('#app');
const ctx = canvas.getContext('2d');
const generationEl = document.querySelector('#generation');
const fillEl = document.querySelector('#fill');
const pauseBtn = document.querySelector('#pause');
const randomizeBtn = document.querySelector('#randomize');

let width = window.innerWidth;
let height = window.innerHeight;
let centerX = width / 2;
let centerY = height / 2;

function resizeCanvas() {
  width = window.innerWidth;
  height = window.innerHeight;
  centerX = width / 2;
  centerY = height / 2;
  canvas.width = Math.floor(width * Math.min(window.devicePixelRatio, 2));
  canvas.height = Math.floor(height * Math.min(window.devicePixelRatio, 2));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
}
resizeCanvas();

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

const maxInstances = SIZE ** 3;
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
    current[i] = Math.random() > 0.76 ? 1 : Math.random() * 0.08;
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

        const cell = idx(x, y, z);
        next[cell] = Math.min(1, Math.max(0, current[cell] + DT * (transition - current[cell])));
      }
    }
  }
  [current, next] = [next, current];
  generation += 1;
}

const camera = {
  radius: 16,
  theta: 0.8,
  phi: 0.95,
};
let dragging = false;
let lastX = 0;
let lastY = 0;

canvas.addEventListener('pointerdown', (ev) => {
  dragging = true;
  lastX = ev.clientX;
  lastY = ev.clientY;
  canvas.setPointerCapture(ev.pointerId);
});

canvas.addEventListener('pointerup', (ev) => {
  dragging = false;
  canvas.releasePointerCapture(ev.pointerId);
});

canvas.addEventListener('pointermove', (ev) => {
  if (!dragging) return;
  const dx = ev.clientX - lastX;
  const dy = ev.clientY - lastY;
  lastX = ev.clientX;
  lastY = ev.clientY;
  camera.theta -= dx * 0.005;
  camera.phi = Math.min(Math.PI - 0.06, Math.max(0.06, camera.phi + dy * 0.005));
});

canvas.addEventListener('wheel', (ev) => {
  ev.preventDefault();
  camera.radius = Math.min(38, Math.max(8, camera.radius + ev.deltaY * 0.01));
}, { passive: false });

function getCameraBasis() {
  const sinPhi = Math.sin(camera.phi);
  const cosPhi = Math.cos(camera.phi);
  const sinTheta = Math.sin(camera.theta);
  const cosTheta = Math.cos(camera.theta);

  const camPos = {
    x: camera.radius * sinPhi * cosTheta,
    y: camera.radius * cosPhi,
    z: camera.radius * sinPhi * sinTheta,
  };

  const fwd = {
    x: -camPos.x / camera.radius,
    y: -camPos.y / camera.radius,
    z: -camPos.z / camera.radius,
  };

  const worldUp = { x: 0, y: 1, z: 0 };
  let right = {
    x: worldUp.y * fwd.z - worldUp.z * fwd.y,
    y: worldUp.z * fwd.x - worldUp.x * fwd.z,
    z: worldUp.x * fwd.y - worldUp.y * fwd.x,
  };

  const rightLen = Math.hypot(right.x, right.y, right.z) || 1;
  right = { x: right.x / rightLen, y: right.y / rightLen, z: right.z / rightLen };

  const up = {
    x: fwd.y * right.z - fwd.z * right.y,
    y: fwd.z * right.x - fwd.x * right.z,
    z: fwd.x * right.y - fwd.y * right.x,
  };

  return { camPos, right, up, fwd };
}

function drawFrame() {
  ctx.fillStyle = '#070c17';
  ctx.fillRect(0, 0, width, height);

  const { camPos, right, up, fwd } = getCameraBasis();
  const points = [];
  const f = Math.min(width, height) * 0.82;
  let visibleCount = 0;

  for (let z = 0; z < SIZE; z += 1) {
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        const value = current[idx(x, y, z)];
        if (value <= ALIVE_THRESHOLD) continue;

        const px = (x - SIZE / 2) * CELL_SCALE;
        const py = (y - SIZE / 2) * CELL_SCALE;
        const pz = (z - SIZE / 2) * CELL_SCALE;

        const vx = px - camPos.x;
        const vy = py - camPos.y;
        const vz = pz - camPos.z;

        const cx = vx * right.x + vy * right.y + vz * right.z;
        const cy = vx * up.x + vy * up.y + vz * up.z;
        const cz = vx * fwd.x + vy * fwd.y + vz * fwd.z;

        if (cz <= 0.05) continue;

        const sx = centerX + (cx / cz) * f;
        const sy = centerY - (cy / cz) * f;
        const radius = Math.max(0.6, (CELL_SCALE * f * 0.55) / cz);

        points.push({ sx, sy, cz, radius, value });
        visibleCount += 1;
      }
    }
  }

  points.sort((a, b) => b.cz - a.cz);

  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    const glow = Math.min(1, p.value + 0.2);
    const alpha = Math.min(0.95, 0.2 + p.value * 0.85);

    ctx.beginPath();
    ctx.fillStyle = `rgba(${Math.floor(70 + 120 * glow)}, ${Math.floor(140 + 95 * glow)}, 255, ${alpha})`;
    ctx.arc(p.sx, p.sy, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  generationEl.textContent = `Generation: ${generation}`;
  fillEl.textContent = `Fill: ${((visibleCount / maxInstances) * 100).toFixed(1)}%`;
}

pauseBtn.addEventListener('click', () => {
  paused = !paused;
  pauseBtn.textContent = paused ? 'Resume' : 'Pause';
});

randomizeBtn.addEventListener('click', () => {
  randomizeField();
  drawFrame();
});

window.addEventListener('keydown', (ev) => {
  if (ev.code === 'Space') {
    ev.preventDefault();
    paused = !paused;
    pauseBtn.textContent = paused ? 'Resume' : 'Pause';
  }
});

window.addEventListener('resize', () => {
  resizeCanvas();
  drawFrame();
});

randomizeField();
drawFrame();

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
  }

  drawFrame();
}
requestAnimationFrame(animate);
