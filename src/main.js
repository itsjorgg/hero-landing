import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/* ========= AJUSTES (cámbialos aquí) ========= */
const BLUE = '#58b1cf', BLUE_LIGHT = '#8dd0e4', RED = '#ee1822'; // rayas azules y rojo de la portada
const PAD = 1.25; // el plano del texto es más grande que la pantalla para que "Asoma" no deje bordes
const FONT = (px) => `italic 700 ${px}px "Futura Bold Oblique", Jost, Futura, sans-serif`;
const R = 7;    // distancia de la cámara al objeto
const D = 3;    // distancia del texto detrás del objeto
const FOV = 40;

const $ = (s) => document.querySelector(s);
const damp = (a, b, l, dt) => a + (b - a) * (1 - Math.exp(-l * dt));

/* ========= ESCENA ========= */
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.NeutralToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color(BLUE);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50);
camera.position.set(0, 0, R);

/* ========= TEXTO DETRÁS (plano con textura, así el vidrio lo refracta) ========= */
const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ toneMapped: false }));
plane.position.z = -D;
plane.visible = false;
scene.add(plane);

const tc = document.createElement('canvas');
const tx = tc.getContext('2d');

function drawText(w, h) {
  const k = Math.min(devicePixelRatio, 2, 4096 / (Math.max(w, h) * PAD));
  tc.width = w * PAD * k; tc.height = h * PAD * k;

  // rayas verticales azules y rayones, como la portada
  const sw = Math.max(14, Math.min(w / 28, 56)) * k;
  for (let x = 0, i = 0; x < tc.width; x += sw, i++) {
    tx.fillStyle = i % 2 ? BLUE_LIGHT : BLUE;
    tx.fillRect(x, 0, sw + 1, tc.height);
  }
  let s = 7;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 2500; i++) {
    tx.fillStyle = `rgba(255,255,255,${rnd() * 0.12})`;
    tx.fillRect(rnd() * tc.width, rnd() * tc.height, (1 + rnd() * 2) * k, (10 + rnd() * 70) * k);
  }

  const lines = w / h > 0.9 ? ['WOR$T GIRL', 'IN AMERICA'] : ['WOR$T', 'GIRL', 'IN AMERICA'];
  tx.font = FONT(100);
  const widest = Math.max(...lines.map((l) => tx.measureText(l).width));
  const size = Math.min((w * k * 0.88 / widest) * 100, h * k * 0.8 / lines.length / 0.9);

  tx.font = FONT(size);
  tx.fillStyle = RED; tx.textAlign = 'center'; tx.textBaseline = 'middle';
  lines.forEach((l, i) => tx.fillText(l, tc.width / 2, tc.height / 2 + (i - (lines.length - 1) / 2) * size * 0.9));

  plane.material.map?.dispose();
  const tex = new THREE.CanvasTexture(tc);
  tex.colorSpace = THREE.SRGBColorSpace;
  plane.material.map = tex;
  plane.material.needsUpdate = true;
  plane.visible = true;
}

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  const ph = 2 * (R + D) * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  plane.scale.set(ph * PAD * w / h, ph * PAD, 1);
  drawText(w, h);
}

/* ========= OBJETOS 3D (vidrio transparente) ========= */
function starGeo() {
  const s = new THREE.Shape(), n = 5;
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? 0.48 : 1, a = (Math.PI / n) * i + Math.PI / 2;
    s[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.35, bevelThickness: 0.14, bevelSize: 0.1, bevelSegments: 10 });
  g.center();
  return g;
}
const GEO = {
  star: starGeo(),
  cube: new RoundedBoxGeometry(1.5, 1.5, 1.5, 8, 0.2),
  sphere: new THREE.SphereGeometry(1, 64, 48),
};

const glass = new THREE.MeshPhysicalMaterial({
  transmission: 1, thickness: 1.4, roughness: 0.06, ior: 1.5, dispersion: 0.5,
  clearcoat: 1, attenuationColor: new THREE.Color('#e4f4ff'), attenuationDistance: 6,
});

// [x, y, z, escala, factor de seguimiento]: el primero es el héroe, el resto lo acompaña
const DEFS = [
  [0, 0, 0, 1.5, 0.5], [-3.3, 1.3, -0.5, 0.55, 1.2], [3.5, -1.2, 0.6, 0.75, 0.9],
  [-2.6, -1.7, 1, 0.4, 1.5], [2.6, 1.9, -1, 0.45, 1], [0.4, -2.1, -0.8, 0.35, 1.3], [-0.9, 2.2, 0, 0.3, 0.8],
];
const items = DEFS.map(([x, y, z, s, k], i) => {
  const mesh = new THREE.Mesh(GEO.star, glass);
  mesh.rotation.set(i * 1.7, i * 2.3, 0);
  scene.add(mesh);
  return { mesh, base: new THREE.Vector3(x, y, z), s, k, spin: (i % 2 ? -1 : 1) * (0.7 + (i % 3) * 0.25) };
});

/* ========= ESTADO Y MOUSE ========= */
let mode = 'look', shape = 'star', ready = false, intro = 0, energy = 0;
const sm = { v: 1, t: 1 };                       // escala al cambiar de forma
const t = { x: 0, y: 0 }, m = { x: 0, y: 0 }, prev = { x: 0, y: 0 };

addEventListener('pointermove', (e) => {
  t.x = (e.clientX / innerWidth) * 2 - 1;
  t.y = -((e.clientY / innerHeight) * 2 - 1);
});
document.addEventListener('mouseleave', () => { t.x = t.y = 0; if (mode === 'drift') mode = 'look'; });

function mark(attr, v) {
  document.querySelectorAll(`[data-${attr}]`).forEach((b) => b.classList.toggle('on', b.dataset[attr] === v));
}
function setShape(v) {
  if (v === shape) return;
  shape = v; mark('shape', v); sm.t = 0;
  setTimeout(() => { items.forEach((o) => (o.mesh.geometry = GEO[v])); sm.t = 1; }, 260);
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b?.dataset.shape) setShape(b.dataset.shape);
});

// Acciones del mouse: mover = Mira (por defecto), mantener clic = Desplaza, rueda = Asoma
let wheelTimer;
const toLook = () => { if (mode === 'drift') mode = 'look'; };
canvas.addEventListener('pointerdown', () => { mode = 'drift'; });
addEventListener('pointerup', toLook);
addEventListener('pointercancel', toLook);
addEventListener('wheel', () => {
  if (mode === 'drift') return;
  mode = 'peek';
  clearTimeout(wheelTimer);
  wheelTimer = setTimeout(() => { if (mode === 'peek') mode = 'look'; }, 900);
}, { passive: true });

/* ========= LOOP ========= */
const clock = new THREE.Clock();
const v3 = new THREE.Vector3(), tp = new THREE.Vector3(), tq = new THREE.Quaternion(), fwd = new THREE.Vector3();

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05), el = clock.elapsedTime;
  m.x = damp(m.x, t.x, 5, dt); m.y = damp(m.y, t.y, 5, dt);
  const speed = Math.hypot(t.x - prev.x, t.y - prev.y) / Math.max(dt, 1e-3);
  energy = damp(energy, Math.min(speed * 0.12, 2), 4, dt);
  prev.x = t.x; prev.y = t.y;
  intro = damp(intro, ready ? 1 : 0, 2.5, dt);
  sm.v = damp(sm.v, sm.t, 10, dt);

  // 1) MIRA: la cámara orbita y el objeto parece girar hacia el cursor
  // 2) ASOMA: la cámara se desplaza y el texto de atrás se mueve distinto (paralaje)
  // 3) DESPLAZA: la cámara queda fija y los objetos se separan de su posición original
  if (mode === 'look') {
    const a = -m.x * 0.7, p = -m.y * 0.4;
    tp.set(Math.sin(a) * Math.cos(p), Math.sin(p), Math.cos(a) * Math.cos(p)).multiplyScalar(R);
  } else if (mode === 'peek') tp.set(m.x * 1.8, m.y * 1.1, R);
  else tp.set(0, 0, R);
  camera.position.lerp(tp, 1 - Math.exp(-6 * dt));
  camera.lookAt(0, 0, 0);

  // el texto siempre queda detrás: en "mira" mira a la cámara, en los otros es fijo
  if (mode === 'look') {
    tp.copy(camera.position).addScaledVector(fwd.set(0, 0, -1).applyQuaternion(camera.quaternion), R + D);
    tq.copy(camera.quaternion);
  } else { tp.set(0, 0, -D); tq.identity(); }
  const f = 1 - Math.exp(-6 * dt);
  plane.position.lerp(tp, f); plane.quaternion.slerp(tq, f);

  const xs = Math.min(1, camera.aspect / 1.7), fit = Math.min(1, 0.45 + camera.aspect * 0.35);
  const drift = mode === 'drift' ? 1 : 0;
  for (const o of items) {
    v3.set(o.base.x * xs + m.x * 3.4 * o.k * drift, o.base.y + m.y * 2.2 * o.k * drift + Math.sin(el * o.k + o.s * 9) * 0.12, o.base.z);
    o.mesh.position.lerp(v3, 1 - Math.exp(-(2.5 + o.k * 1.5) * dt));
    o.mesh.scale.setScalar(Math.max(o.s * fit * intro * sm.v * (1 + energy * 0.12 * o.k), 1e-4));
    o.mesh.rotation.x += dt * o.spin * (0.25 + energy * 1.6);   // el movimiento del mouse acelera el giro
    o.mesh.rotation.y += dt * o.spin * (0.4 + energy * 2.2);
  }
  renderer.render(scene, camera);
});

/* ========= ARRANQUE: espera la fuente y entra directo ========= */
(async function boot() {
  try {
    await Promise.race([document.fonts.load(FONT(100), 'WOR$T GIRL IN AMERICA'), new Promise((r) => setTimeout(r, 1500))]);
  } catch { /* si falla la fuente, se usa el respaldo */ }
  resize();
  addEventListener('resize', resize);

  document.body.classList.add('ready');
  ready = true;
})();