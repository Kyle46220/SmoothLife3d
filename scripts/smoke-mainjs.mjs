import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

const eventHandlers = {};
const hud = {
  generation: { textContent: '' },
  fill: { textContent: '' },
  pause: { textContent: '', addEventListener: (name, fn) => (eventHandlers[`pause:${name}`] = fn) },
  randomize: { textContent: '', addEventListener: (name, fn) => (eventHandlers[`randomize:${name}`] = fn) },
};

const ctx = {
  setTransform() {},
  fillRect() {},
  beginPath() {},
  arc() {},
  fill() {},
  set fillStyle(v) {},
};

const canvasHandlers = {};
const capturedPointers = new Set();
const canvas = {
  width: 0,
  height: 0,
  style: {},
  getContext: () => ctx,
  addEventListener: (name, fn) => (canvasHandlers[name] = fn),
  setPointerCapture: (id) => capturedPointers.add(id),
  hasPointerCapture: (id) => capturedPointers.has(id),
  releasePointerCapture: (id) => capturedPointers.delete(id),
};

const winHandlers = {};
const rafQueue = [];

const sandbox = {
  Math,
  Float32Array,
  performance: { now: () => 0 },
  document: {
    querySelector: (sel) => {
      if (sel === '#app') return canvas;
      if (sel === '#generation') return hud.generation;
      if (sel === '#fill') return hud.fill;
      if (sel === '#pause') return hud.pause;
      if (sel === '#randomize') return hud.randomize;
      return null;
    },
  },
  window: {
    innerWidth: 1200,
    innerHeight: 800,
    devicePixelRatio: 1,
    addEventListener: (name, fn) => (winHandlers[name] = fn),
  },
  requestAnimationFrame: (fn) => {
    rafQueue.push(fn);
    return rafQueue.length;
  },
  console,
};

vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'src/main.js' });

for (let i = 0; i < 5; i += 1) {
  const fn = rafQueue.shift();
  if (!fn) break;
  fn(33 * (i + 1));
}

canvasHandlers.pointerdown?.({ clientX: 100, clientY: 100, pointerId: 1 });
canvasHandlers.pointermove?.({ clientX: 120, clientY: 110, pointerId: 1 });
canvasHandlers.pointerup?.({ pointerId: 1 });
canvasHandlers.wheel?.({ deltaY: -40, preventDefault() {} });
winHandlers.keydown?.({ code: 'Space', preventDefault() {} });

console.log('Smoke run complete: no runtime exceptions');
