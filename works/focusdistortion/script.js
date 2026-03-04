// ═══════════════════════════════════════════
// Complex number helpers
// ═══════════════════════════════════════════
function cadd(a, b) { return { x: a.x+b.x, y: a.y+b.y }; }
function csub(a, b) { return { x: a.x-b.x, y: a.y-b.y }; }
function cmul(a, b) { return { x: a.x*b.x-a.y*b.y, y: a.x*b.y+a.y*b.x }; }
function cconj(a)   { return { x: a.x, y: -a.y }; }
function cabs(a)    { return Math.sqrt(a.x*a.x+a.y*a.y); }
function cdiv(a, b) {
  const d = b.x*b.x+b.y*b.y;
  return { x:(a.x*b.x+a.y*b.y)/d, y:(a.y*b.x-a.x*b.y)/d };
}

// T_p(z)   = (z - p) / (1 - conj(p)*z)  →  화면 → 정규
// T_p⁻¹(z) = (z + p) / (1 + conj(p)*z)  →  정규 → 화면
function mobius(z, p) {
  return cdiv(csub(z, p), csub({x:1,y:0}, cmul(cconj(p), z)));
}
function mobiusInv(z, p) {
  return cdiv(cadd(z, p), cadd({x:1,y:0}, cmul(cconj(p), z)));
}

// ═══════════════════════════════════════════
// 상수
// ═══════════════════════════════════════════
const MAX_P        = 0.90;
const RENDER_SCALE = 0.5;
const HYPER_DISTS  = [0.5, 1.0, 1.5, 2.2, 3.0]; // 쌍곡 등거리 (tanh(d/2))
const RADIAL_N     = 10;
const CURVE_PTS    = 80;

// ═══════════════════════════════════════════
// 상태
// ═══════════════════════════════════════════
let p        = { x: 0, y: 0 };
let rotMat   = mat3Id();
let mode     = 1;

// ═══════════════════════════════════════════
// 캔버스
// ═══════════════════════════════════════════
const canvas    = document.getElementById('disk');
const ctx       = canvas.getContext('2d');
let R           = 0;
const offCanvas = document.createElement('canvas');
const offCtx    = offCanvas.getContext('2d');

function resize() {
  const size = Math.min(
    Math.min(window.innerWidth, window.innerHeight) * 0.88, 560
  );
  R = size / 2;
  canvas.width  = size;
  canvas.height = size;
  offCanvas.width  = Math.floor(size * RENDER_SCALE);
  offCanvas.height = Math.floor(size * RENDER_SCALE);
  draw();
}

// ═══════════════════════════════════════════
// 세계지도
// ═══════════════════════════════════════════
let mapPixels = null, mapW = 0, mapH = 0, mapLoaded = false;

function loadMap() {
  const img = new Image();
  img.src = './worldmap.png';
  img.onload = () => {
    const tmp = document.createElement('canvas');
    tmp.width  = img.naturalWidth;
    tmp.height = img.naturalHeight;
    const tc   = tmp.getContext('2d');
    tc.drawImage(img, 0, 0);
    const id   = tc.getImageData(0, 0, tmp.width, tmp.height);
    mapPixels  = id.data;
    mapW       = tmp.width;
    mapH       = tmp.height;
    mapLoaded  = true;
    draw();
  };
  img.onerror = () => { mapLoaded = true; draw(); };
}

function sampleMap(lat, lon) {
  if (!mapPixels) return [200, 210, 220];
  const u  = ((lon / (2*Math.PI)) + 0.5) * mapW;
  const v  = (0.5 - lat / Math.PI) * mapH;
  const ix = ((Math.floor(u) % mapW) + mapW) % mapW;
  const iy = Math.max(0, Math.min(mapH-1, Math.floor(v)));
  const i  = (iy * mapW + ix) * 4;
  return [mapPixels[i], mapPixels[i+1], mapPixels[i+2]];
}

// ═══════════════════════════════════════════
// 행렬
// ═══════════════════════════════════════════
function mat3Id() { return [1,0,0, 0,1,0, 0,0,1]; }

function mat3Mul(A, B) {
  const C = new Array(9).fill(0);
  for (let i=0;i<3;i++) for (let j=0;j<3;j++) for (let k=0;k<3;k++)
    C[i*3+j] += A[i*3+k] * B[k*3+j];
  return C;
}
function mat3Vec(M, x, y, z) {
  return [M[0]*x+M[1]*y+M[2]*z, M[3]*x+M[4]*y+M[5]*z, M[6]*x+M[7]*y+M[8]*z];
}
function rotX(a) { const c=Math.cos(a),s=Math.sin(a); return [1,0,0, 0,c,-s, 0,s,c]; }
function rotY(a) { const c=Math.cos(a),s=Math.sin(a); return [c,0,s, 0,1,0, -s,0,c]; }

// ═══════════════════════════════════════════
// 텍스처 렌더링
//
// 파이프라인:
// 화면 픽셀 q
//   → mobius(q, p)  (화면 → 정규 샘플 위치)
//   → 역정사영 투영 → 3D 점
//   → rotMat 적용
//   → 위도경도 → 지도 샘플링
//
// inverted: mobius 대신 mobiusInv 사용
//   → 가장자리가 확대, 중앙이 압축
// ═══════════════════════════════════════════
function renderSphere() {
  const sw = offCanvas.width;
  const sh = offCanvas.height;
  const sR = sw / 2;

  const imgData = offCtx.createImageData(sw, sh);
  const data    = imgData.data;

  for (let py = 0; py < sh; py++) {
    for (let px = 0; px < sw; px++) {
      const qx = (px - sR) / sR;
      const qy = (py - sR) / sR;
      if (qx*qx + qy*qy >= 1) continue;

      // 화면 → 정규 샘플 위치
      const q  = { x: qx, y: qy };
      const s  = mobius(q, p);

      // 역정사영 (stereographic)
      // s = (X, Y) on disk → 구 위의 점
      // 정사영(orthographic) 사용: z = sqrt(1 - r²)
      const r2 = s.x*s.x + s.y*s.y;
      if (r2 >= 1) continue;
      const sz = Math.sqrt(1 - r2);

      // 회전
      const [X, Y, Z] = mat3Vec(rotMat, s.x, s.y, sz);

      const lat = Math.asin(Math.max(-1, Math.min(1, Z)));
      const lon = Math.atan2(Y, X);
      const [r, g, b] = sampleMap(lat, lon);

      const i = (py * sw + px) * 4;
      data[i]=r; data[i+1]=g; data[i+2]=b; data[i+3]=255;
    }
  }

  offCtx.putImageData(imgData, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'medium';
  ctx.drawImage(offCanvas, 0, 0, canvas.width, canvas.height);
  ctx.restore();
}

// ═══════════════════════════════════════════
// 그리드 (Möbius 변환 기반)
//
// 정규 공간의 선들을 mobiusInv(z, p)로 변환해서 그림
// p가 중앙: 균등하게 퍼진 패턴
// p가 가장자리: 한쪽 압축, 반대쪽 확대 (에셔 스타일)
// ═══════════════════════════════════════════
function gridColor() {
  const t = cabs(p) / MAX_P;
  const r = Math.round(170 + t*80);
  const g = Math.round(108 - t*68);
  const b = Math.round(62  - t*48);
  return `rgba(${r},${g},${b},0.68)`;
}

function drawCurve(pts) {
  let penDown = false;
  ctx.beginPath();
  for (const z of pts) {
    if (cabs(z) >= 0.999) { penDown = false; continue; }
    const sx = R + z.x*R, sy = R + z.y*R;
    if (!penDown) { ctx.moveTo(sx, sy); penDown = true; }
    else ctx.lineTo(sx, sy);
  }
  ctx.stroke();
}

function makeDiameter(angle) {
  const pts = [];
  for (let i = 0; i <= CURVE_PTS; i++) {
    const t = -0.98 + 1.96*(i/CURVE_PTS);
    pts.push({ x: t*Math.cos(angle), y: t*Math.sin(angle) });
  }
  return pts;
}

function makeCircle(r) {
  const pts = [];
  for (let i = 0; i <= 120; i++) {
    const a = 2*Math.PI*i/120;
    pts.push({ x: r*Math.cos(a), y: r*Math.sin(a) });
  }
  return pts;
}

function drawGrid() {
  ctx.strokeStyle = gridColor();
  ctx.lineWidth   = 1.3;
  ctx.globalAlpha = 0.68;

  // 측지선 (정규 공간의 지름선 → mobiusInv → 화면)
  for (let i = 0; i < RADIAL_N; i++) {
    const angle = Math.PI * i / RADIAL_N;
    drawCurve(makeDiameter(angle).map(z => mobiusInv(z, p)));
  }

  // 쌍곡 등거리 원 (r = tanh(d/2))
  for (const d of HYPER_DISTS) {
    const r = Math.tanh(d / 2);
    drawCurve(makeCircle(r).map(z => mobiusInv(z, p)));
  }

  ctx.globalAlpha = 1;
}

// ═══════════════════════════════════════════
// 초점 마커
// ═══════════════════════════════════════════
function drawFocusMarker() {
  // p는 정규 공간에서 (0,0)에 해당 → 화면에서 mobiusInv({0,0}, p) = p
  const fx = R + p.x*R;
  const fy = R + p.y*R;

  ctx.beginPath();
  ctx.arc(fx, fy, 11, 0, Math.PI*2);
  ctx.strokeStyle = 'rgba(195,58,18,0.28)';
  ctx.lineWidth   = 1.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(fx, fy, 5, 0, Math.PI*2);
  ctx.fillStyle   = 'rgba(195,58,18,0.90)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(245,240,232,0.92)';
  ctx.lineWidth   = 1.8;
  ctx.stroke();
}

// ═══════════════════════════════════════════
// 메인 렌더
// ═══════════════════════════════════════════
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#F5F0E8';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.beginPath();
  ctx.arc(R, R, R-1, 0, Math.PI*2);
  ctx.clip();

  if (!mapLoaded) {
    ctx.fillStyle = '#EDE7DA';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#A99880';
    ctx.font = '14px "DM Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('지도 불러오는 중...', R, R);
  } else {
    renderSphere();
  }

  drawGrid();
  drawFocusMarker();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(R, R, R-1, 0, Math.PI*2);
  ctx.strokeStyle = '#C8B89A';
  ctx.lineWidth   = 2.5;
  ctx.stroke();
}

// ═══════════════════════════════════════════
// 인터랙션
// ═══════════════════════════════════════════
let isDragging = false;
let lastPtr    = null;

function ptrDisk(e) {
  const rect = canvas.getBoundingClientRect();
  const src  = e.touches ? e.touches[0] : e;
  return {
    x: (src.clientX - rect.left - R) / R,
    y: (src.clientY - rect.top  - R) / R,
  };
}

function clampP(x, y) {
  const len = Math.sqrt(x*x + y*y);
  if (len > MAX_P) { x = x*MAX_P/len; y = y*MAX_P/len; }
  return { x, y };
}

canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  isDragging = true;
  lastPtr    = ptrDisk(e);
  dismissHint();
  if (mode === 1) { p = clampP(lastPtr.x, lastPtr.y); draw(); }
}, { passive: false });

canvas.addEventListener('pointermove', e => {
  e.preventDefault();
  if (!isDragging) return;
  const cur = ptrDisk(e);

  if (mode === 1) {
    p = clampP(cur.x, cur.y);
  } else {
    const dx = cur.x - lastPtr.x;
    const dy = cur.y - lastPtr.y;
    rotMat = mat3Mul(rotY(-dx * 1.8), rotMat);  // 월드 Y: 항상 좌우
    rotMat = mat3Mul(rotMat, rotX(-dy * 1.8));  // 로컬 X: 구 기준 상하
  }

  lastPtr = cur;
  draw();
}, { passive: false });

canvas.addEventListener('pointerup',     () => isDragging = false);
canvas.addEventListener('pointercancel', () => isDragging = false);

// ═══════════════════════════════════════════
// UI
// ═══════════════════════════════════════════
let hintGone = false;
function dismissHint() {
  if (hintGone) return;
  hintGone = true;
  document.getElementById('hint').classList.add('hidden');
}

document.getElementById('btn-mode').addEventListener('click', () => {
  mode = mode === 1 ? 2 : 1;
  const m2 = mode === 2;
  document.getElementById('icon-mode-1').classList.toggle('active', !m2);
  document.getElementById('icon-mode-2').classList.toggle('active',  m2);
  document.getElementById('btn-mode').classList.toggle('mode2',      m2);
});

document.getElementById('btn-reset').addEventListener('click', () => {
  p = { x: 0, y: 0 };
  draw();
});

// ═══════════════════════════════════════════
// 초기화
// ═══════════════════════════════════════════
window.addEventListener('resize', resize);
resize();
loadMap();