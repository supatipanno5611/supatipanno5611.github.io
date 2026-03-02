// ─────────────────────────────────────────
// Complex number helpers
// ─────────────────────────────────────────
function cadd(a, b)  { return { x: a.x + b.x, y: a.y + b.y }; }
function csub(a, b)  { return { x: a.x - b.x, y: a.y - b.y }; }
function cmul(a, b)  { return { x: a.x*b.x - a.y*b.y, y: a.x*b.y + a.y*b.x }; }
function cconj(a)    { return { x: a.x, y: -a.y }; }
function cabs(a)     { return Math.sqrt(a.x*a.x + a.y*a.y); }
function cdiv(a, b)  {
  const d = b.x*b.x + b.y*b.y;
  return { x: (a.x*b.x + a.y*b.y) / d, y: (a.y*b.x - a.x*b.y) / d };
}

// ─────────────────────────────────────────
// Möbius transforms
//
// T_p(z)    = (z - p) / (1 - conj(p)*z)  →  p 를 원점으로
// T_p⁻¹(z) = (z + p) / (1 + conj(p)*z)  →  원점을 p 로
//
// 렌더링: 정규 좌표 z → 화면 = mobiusInv(z, p)
// 이동:   드래그 delta d → p_new = mobius(p, d)
// ─────────────────────────────────────────
function mobius(z, p) {
  return cdiv(csub(z, p), csub({ x: 1, y: 0 }, cmul(cconj(p), z)));
}
function mobiusInv(z, p) {
  return cdiv(cadd(z, p), cadd({ x: 1, y: 0 }, cmul(cconj(p), z)));
}

// ─────────────────────────────────────────
// State
// ─────────────────────────────────────────
let p        = { x: 0, y: 0 };  // 현재 쌍곡 시점 (|p| < 1)
let gridMode = 0;                // 0=없음, 1=구면, 2=쌍곡

const canvas = document.getElementById('disk');
const ctx    = canvas.getContext('2d');
let R        = 0;

// ─────────────────────────────────────────
// 색상 팔레트
// ─────────────────────────────────────────
const SPHERE_COLORS = [
  '#D4622A', '#E8943A', '#C0853E', '#A05C2C', '#E07A5F', '#C04A2A'
];
const HYPER_COLORS = [
  '#B83A1E', '#D96B2D', '#C45A1A', '#A03010', '#E08040'
];

// ─────────────────────────────────────────
// 캔버스 크기
// ─────────────────────────────────────────
function resize() {
  const size = Math.min(window.innerWidth, window.innerHeight) * 0.88;
  R = size / 2;
  canvas.width  = size;
  canvas.height = size;
  draw();
}

// ─────────────────────────────────────────
// 좌표 변환
// ─────────────────────────────────────────
function toScreen(z) {
  return { x: R + z.x * R, y: R + z.y * R };
}

// ─────────────────────────────────────────
// 곡선 그리기 (경계 근처 수치 오류 방지: |z|>=0.999 에서 끊음)
// ─────────────────────────────────────────
function drawCurve(points) {
  let penDown = false;
  ctx.beginPath();
  for (const z of points) {
    if (cabs(z) >= 0.999) { penDown = false; continue; }
    const s = toScreen(z);
    if (!penDown) { ctx.moveTo(s.x, s.y); penDown = true; }
    else          { ctx.lineTo(s.x, s.y); }
  }
  ctx.stroke();
}

function transform(pts) {
  return pts.map(z => mobiusInv(z, p));
}

// ─────────────────────────────────────────
// 기본 도형 샘플링
// ─────────────────────────────────────────
function makeDiameter(angle, N = 80) {
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const t = -0.98 + 1.96 * (i / N);
    pts.push({ x: t * Math.cos(angle), y: t * Math.sin(angle) });
  }
  return pts;
}

function makeCircle(r, N = 120) {
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const a = 2 * Math.PI * i / N;
    pts.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
  }
  return pts;
}

// ─────────────────────────────────────────
// 구면 격자 (등간격 위도/경도)
// ─────────────────────────────────────────
function drawSphereGrid() {
  ctx.lineWidth = 1.3;
  ctx.globalAlpha = 0.72;

  for (let i = 0; i < 6; i++) {
    ctx.strokeStyle = SPHERE_COLORS[i % SPHERE_COLORS.length];
    drawCurve(transform(makeDiameter(Math.PI * i / 6)));
  }

  const latRadii = [0.25, 0.5, 0.7, 0.85];
  for (let i = 0; i < latRadii.length; i++) {
    ctx.strokeStyle = SPHERE_COLORS[i % SPHERE_COLORS.length];
    drawCurve(transform(makeCircle(latRadii[i])));
  }

  ctx.globalAlpha = 1;
}

// ─────────────────────────────────────────
// 쌍곡 격자 (등쌍곡거리 원 + 측지선)
// ─────────────────────────────────────────
function drawHyperbolicGrid() {
  ctx.lineWidth = 1.3;
  ctx.globalAlpha = 0.72;

  // 측지선 5개 (양방향 = 10개 반직선)
  for (let i = 0; i < 5; i++) {
    ctx.strokeStyle = HYPER_COLORS[i % HYPER_COLORS.length];
    drawCurve(transform(makeDiameter(Math.PI * i / 5)));
  }

  // 쌍곡 등거리 원 5개 (r = tanh(d/2))
  const hypDists = [0.6, 1.2, 1.8, 2.5, 3.3];
  for (let i = 0; i < hypDists.length; i++) {
    const r = Math.tanh(hypDists[i] / 2);
    ctx.strokeStyle = HYPER_COLORS[i % HYPER_COLORS.length];
    drawCurve(transform(makeCircle(r)));
  }

  ctx.globalAlpha = 1;
}

// ─────────────────────────────────────────
// 메인 렌더
// ─────────────────────────────────────────
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.beginPath();
  ctx.arc(R, R, R - 1, 0, Math.PI * 2);
  ctx.clip();

  ctx.fillStyle = '#F5F0E8';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (gridMode === 1) drawSphereGrid();
  if (gridMode === 2) drawHyperbolicGrid();

  ctx.restore();

  ctx.beginPath();
  ctx.arc(R, R, R - 1, 0, Math.PI * 2);
  ctx.strokeStyle = '#C8B89A';
  ctx.lineWidth = 2;
  ctx.stroke();
}

// ─────────────────────────────────────────
// 인터랙션
// ─────────────────────────────────────────
const DRAG_SPEED = 0.55;
let isDragging  = false;
let lastPointer = null;

function getPointerDisk(e) {
  const rect = canvas.getBoundingClientRect();
  const src  = e.touches ? e.touches[0] : e;
  return {
    x: (src.clientX - rect.left - R) / R,
    y: (src.clientY - rect.top  - R) / R,
  };
}

function onPointerDown(e) {
  e.preventDefault();
  isDragging  = true;
  lastPointer = getPointerDisk(e);
  dismissHint();
}

function onPointerMove(e) {
  e.preventDefault();
  if (!isDragging) return;

  const cur = getPointerDisk(e);
  const d   = {
    x: (cur.x - lastPointer.x) * DRAG_SPEED,
    y: (cur.y - lastPointer.y) * DRAG_SPEED,
  };
  lastPointer = cur;

  // 내용이 손가락을 따라오도록: p_new = T_d(p)
  p = mobius(p, d);

  const len = cabs(p);
  if (len >= 0.999) {
    p = { x: p.x * 0.999 / len, y: p.y * 0.999 / len };
  }

  draw();
}

function onPointerUp() { isDragging = false; }

canvas.addEventListener('pointerdown',   onPointerDown,  { passive: false });
canvas.addEventListener('pointermove',   onPointerMove,  { passive: false });
canvas.addEventListener('pointerup',     onPointerUp);
canvas.addEventListener('pointercancel', onPointerUp);

// ─────────────────────────────────────────
// 힌트 오버레이
// ─────────────────────────────────────────
let hintDismissed = false;
const hint = document.getElementById('hint');

function dismissHint() {
  if (hintDismissed) return;
  hintDismissed = true;
  hint.classList.add('hidden');
}

// ─────────────────────────────────────────
// 그리드 토글
// ─────────────────────────────────────────
const ICON_IDS = ['icon-none', 'icon-sphere', 'icon-hyperbolic'];

document.getElementById('grid-toggle').addEventListener('click', () => {
  document.getElementById(ICON_IDS[gridMode]).classList.remove('active');
  gridMode = (gridMode + 1) % 3;
  document.getElementById(ICON_IDS[gridMode]).classList.add('active');
  draw();
});

// ─────────────────────────────────────────
// Init
// ─────────────────────────────────────────
window.addEventListener('resize', resize);
resize();