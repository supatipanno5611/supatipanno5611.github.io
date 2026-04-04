const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const hint = document.getElementById('hint');

// ── 상수 ──────────────────────────────────────────────────────────────────────
const MOVE_SPEED   = 200;   // px/s
const DOT_R        = 7;
const GLOW_R       = 22;
const BOUNCE_DUR   = 280;   // ms — 튕김 애니메이션
const BOUNCE_DIST  = 28;    // px — 튕김 거리
const FLASH_DUR    = 340;   // ms — 엣지 flash
const PULSE_PERIOD = 820;   // ms — pulse 한 사이클
const REVEAL_DUR   = 520;   // ms — 엣지 교체 애니메이션
const STUCK_DELAY  = 900;   // ms — 터치 활성화 딜레이
const ARRIVED_DUR  = 1200;  // ms

// ── 색 ────────────────────────────────────────────────────────────────────────
const BG          = '#0a0e14';
const EDGE_COLOR  = 'rgba(140,165,210,0.55)';
const NODE_COLOR  = 'rgba(140,165,210,0.5)';
const DOT_CORE    = '#e8eef8';
const DOT_GLOW    = 'rgba(140,180,255,0.5)';
const DOT_TRAVEL  = '#a0f0c8';
const DOT_GLOW_T  = 'rgba(100,220,160,0.45)';
const WALL_COLOR  = 'rgba(255,100,75,';   // + alpha + ')'
const PATH2_COLOR = 'rgba(100,215,155,0.8)';
const PATH2_GLOW  = 'rgba(100,215,155,0.25)';
const GOAL_COLOR  = 'rgba(160,190,230,0.7)';

// ── 상태 ──────────────────────────────────────────────────────────────────────
let W, H, DPR;
let STATE = 'IDLE';
// IDLE | MOVING | BOUNCE | STUCK | REVEAL | TRAVELING | ARRIVED

let nodes  = [];   // [{x,y}]
let path1  = [];   // 노드 인덱스 배열 — 1층 경로 (벽 포함)
let path2  = [];   // 노드 인덱스 배열 — 우회 경로
let wallSeg = null; // { from, to } 인덱스 — 충돌 엣지
let bypassSegs = []; // [{from,to}] — 새로 생기는 엣지들

let dot = { x: 0, y: 0 };
let segIdx = 0;    // 현재 이동 중인 path1 세그먼트 인덱스

// BOUNCE
let bounceT      = 0;
let bounceOrigin = { x: 0, y: 0 };  // 충돌 직전 노드 위치
let bounceDir    = { x: 0, y: 0 };  // 벽 방향 단위벡터

// STUCK
let stuckT        = 0;
let pulseT        = 0;
let canReveal     = false;
let flashT        = 0;   // 0이면 flash 없음, 양수면 진행 중
let flashActive   = false;

// REVEAL
let revealT       = 0;
let wallFadeAlpha = 1.0;  // 1→0
let bypassAlpha   = 0.0;  // 0→1

// TRAVELING (path2 기반)
let travelSegIdx  = 0;
let travelStart   = { x: 0, y: 0 };  // REVEAL 후 dot 위치 (멈춘 지점)
let travelPath    = [];  // 실제 이동할 노드 인덱스 목록

// ARRIVED
let arrivedT = 0;

let lastTs = 0;
let animId = null;

// ── 리사이즈 ──────────────────────────────────────────────────────────────────
function resize() {
  DPR = window.devicePixelRatio || 1;
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width  = W * DPR;
  canvas.height = H * DPR;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';
  ctx.scale(DPR, DPR);
}

// ── 그래프 생성 ───────────────────────────────────────────────────────────────
// 구조: 출발(0) → mid1 → wall_a → [벽] → wall_b → mid2 → 목적지(N-1)
// 우회: wall_a → bypass → wall_b
// 화면에는 path1 엣지만 보임 (wall_a→wall_b 포함). bypass 엣지는 숨겨져 있다가 REVEAL 시 등장.

function buildGraph() {
  const mx = W * 0.13;
  const my = H * 0.13;

  // 핵심 노드 배치
  const start  = { x: mx + rand(W * 0.08),          y: my + rand(H * 0.1) };
  const mid1   = { x: W * 0.28 + rand(W * 0.1),     y: H * 0.3 + rand(H * 0.12) };
  const wallA  = { x: W * 0.42 + rand(W * 0.08),    y: H * 0.42 + rand(H * 0.08) };
  const wallB  = { x: W * 0.55 + rand(W * 0.08),    y: H * 0.52 + rand(H * 0.08) };
  const mid2   = { x: W * 0.68 + rand(W * 0.1),     y: H * 0.62 + rand(H * 0.1) };
  const goal   = { x: W - mx - rand(W * 0.08),       y: H - my - rand(H * 0.1) };

  // bypass 노드: wallA와 wallB를 잇는 우회 (아래쪽으로 돌아감)
  const bypass = {
    x: (wallA.x + wallB.x) / 2 + rand(W * 0.06),
    y: Math.max(wallA.y, wallB.y) + H * 0.14 + rand(H * 0.06)
  };

  nodes = [start, mid1, wallA, wallB, mid2, goal, bypass];
  // 인덱스:   0      1     2      3      4     5     6

  // 1층 경로: 0→1→2→3→4→5  (2→3 이 벽)
  path1   = [0, 1, 2, 3, 4, 5];
  wallSeg = { from: 2, to: 3 };

  // 우회: 2→6→3
  bypassSegs = [{ from: 2, to: 6 }, { from: 6, to: 3 }];

  // 전체 우회 경로: 0→1→2→6→3→4→5
  path2 = [0, 1, 2, 6, 3, 4, 5];
}

function rand(range) {
  return (Math.random() - 0.5) * range;
}

function ndist(a, b) {
  return Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y);
}

// ── 리셋 ──────────────────────────────────────────────────────────────────────
function reset() {
  buildGraph();
  dot = { ...nodes[0] };
  segIdx = 0;
  bounceT = 0;
  stuckT = 0;
  pulseT = 0;
  flashT = 0;
  flashActive = false;
  canReveal = false;
  revealT = 0;
  wallFadeAlpha = 1;
  bypassAlpha = 0;
  travelSegIdx = 0;
  arrivedT = 0;
  hint.textContent = '터치해서 시작';
  hint.classList.remove('hidden');
  STATE = 'IDLE';
}

// ── 틱 ────────────────────────────────────────────────────────────────────────
function tick(dt) {
  switch (STATE) {
    case 'MOVING':    tickMoving(dt);   break;
    case 'BOUNCE':    tickBounce(dt);   break;
    case 'STUCK':     tickStuck(dt);    break;
    case 'REVEAL':    tickReveal(dt);   break;
    case 'TRAVELING': tickTravel(dt);   break;
    case 'ARRIVED':   tickArrived(dt);  break;
  }
}

// MOVING
function tickMoving(dt) {
  if (segIdx >= path1.length - 1) { enterArrived(); return; }
  const target = nodes[path1[segIdx + 1]];
  moveToward(dot, target, MOVE_SPEED, dt);
  if (dist2(dot, target) < 2) {
    dot.x = target.x; dot.y = target.y;
    segIdx++;
    // 다음 구간이 벽인지 확인
    if (segIdx < path1.length - 1) {
      const a = path1[segIdx], b = path1[segIdx + 1];
      if (isWall(a, b)) enterBounce();
    }
  }
}

function isWall(a, b) {
  return (a === wallSeg.from && b === wallSeg.to) ||
         (a === wallSeg.to   && b === wallSeg.from);
}

// BOUNCE
function tickBounce(dt) {
  bounceT += dt;
  const t = Math.min(bounceT / BOUNCE_DUR, 1);

  // easing: 앞으로 갔다가 돌아옴 — sin 반주기
  const forward = Math.sin(t * Math.PI);
  dot.x = bounceOrigin.x + bounceDir.x * BOUNCE_DIST * forward;
  dot.y = bounceOrigin.y + bounceDir.y * BOUNCE_DIST * forward;

  // flash 진행
  if (flashActive) flashT += dt;

  if (bounceT >= BOUNCE_DUR) {
    dot.x = bounceOrigin.x;
    dot.y = bounceOrigin.y;
    enterStuck();
  }
}

// STUCK
function tickStuck(dt) {
  stuckT += dt;
  pulseT += dt;
  if (flashActive) flashT += dt;
}

// REVEAL
function tickReveal(dt) {
  revealT += dt;
  const t = Math.min(revealT / REVEAL_DUR, 1);
  wallFadeAlpha = 1 - t;
  bypassAlpha   = t;
  if (t >= 1) enterTraveling();
}

// TRAVELING
function tickTravel(dt) {
  if (travelSegIdx >= travelPath.length - 1) { enterArrived(); return; }
  const target = nodes[travelPath[travelSegIdx + 1]];
  moveToward(dot, target, MOVE_SPEED * 0.85, dt);
  if (dist2(dot, target) < 2) {
    dot.x = target.x; dot.y = target.y;
    travelSegIdx++;
  }
}

// ARRIVED
function tickArrived(dt) {
  arrivedT += dt;
  if (arrivedT >= ARRIVED_DUR) reset();
}

// ── 상태 전환 ─────────────────────────────────────────────────────────────────
function enterBounce() {
  STATE = 'BOUNCE';
  bounceT = 0;
  bounceOrigin = { x: dot.x, y: dot.y };
  // 벽 방향 단위벡터
  const wall = nodes[path1[segIdx + 1]];
  const dx = wall.x - dot.x, dy = wall.y - dot.y;
  const d = Math.hypot(dx, dy) || 1;
  bounceDir = { x: dx / d, y: dy / d };
  // flash 시작
  flashT = 0;
  flashActive = true;
}

function enterStuck() {
  STATE = 'STUCK';
  stuckT = 0;
  pulseT = 0;
  // flash 이어서 (이미 진행 중)
  setTimeout(() => {
    if (STATE === 'STUCK') {
      canReveal = true;
      hint.textContent = '터치해서 보기';
      hint.classList.remove('hidden');
    }
  }, STUCK_DELAY);
}

function enterReveal() {
  STATE = 'REVEAL';
  canReveal = false;
  revealT = 0;
  wallFadeAlpha = 1;
  bypassAlpha = 0;
  hint.classList.add('hidden');
}

function enterTraveling() {
  STATE = 'TRAVELING';
  // 멈춘 노드 인덱스: path2에서 현재 dot 위치와 일치하는 지점부터
  // dot은 wallA(인덱스 2)에 있음
  const stuckNodeIdx = wallSeg.from; // 2
  const startInPath2 = path2.indexOf(stuckNodeIdx);
  travelPath = path2.slice(startInPath2 >= 0 ? startInPath2 : 0);
  travelSegIdx = 0;
  dot = { ...nodes[travelPath[0]] };
}

function enterArrived() {
  STATE = 'ARRIVED';
  arrivedT = 0;
}

// ── 드로잉 ────────────────────────────────────────────────────────────────────
function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  drawEdges();
  drawNodes();
  drawDot();
}

function drawEdges() {
  ctx.lineCap = 'round';

  // path1 엣지 (벽 제외 나머지)
  for (let i = 0; i < path1.length - 1; i++) {
    const a = path1[i], b = path1[i + 1];
    if (isWall(a, b)) continue; // 벽 엣지는 별도 처리
    drawEdgeLine(nodes[a], nodes[b], EDGE_COLOR, 1.5);
  }

  // 벽 엣지
  drawWallEdge();

  // bypass 엣지
  if (bypassAlpha > 0) {
    for (const seg of bypassSegs) {
      const alpha = bypassAlpha;
      // glow
      drawEdgeLine(nodes[seg.from], nodes[seg.to],
        `rgba(100,215,155,${alpha * 0.25})`, 8);
      // 선
      drawEdgeLine(nodes[seg.from], nodes[seg.to],
        `rgba(100,215,155,${alpha * 0.85})`, 1.8);
    }
    // bypass 노드
    const bn = nodes[6];
    ctx.beginPath();
    ctx.arc(bn.x, bn.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(100,215,155,${bypassAlpha * 0.8})`;
    ctx.fill();
  }
}

function drawWallEdge() {
  const na = nodes[wallSeg.from];
  const nb = nodes[wallSeg.to];

  // flash: BOUNCE 또는 STUCK 초반
  if (flashActive && flashT < FLASH_DUR) {
    const fp = flashT / FLASH_DUR;
    const flashAlpha = (1 - fp) * 0.9;
    // glow
    drawEdgeLine(na, nb, `rgba(255,100,75,${flashAlpha * 0.35})`, 10);
    // 선
    drawEdgeLine(na, nb, `rgba(255,100,75,${flashAlpha})`, 2.5);
    if (flashT >= FLASH_DUR) flashActive = false;
    return;
  }

  // REVEAL 애니메이션 중: 벽 엣지 fade out
  if (STATE === 'REVEAL' || STATE === 'TRAVELING' || STATE === 'ARRIVED') {
    if (wallFadeAlpha <= 0) return;
    drawEdgeLine(na, nb, `rgba(140,165,210,${wallFadeAlpha * 0.55})`, 1.5);
    return;
  }

  // 평소: 일반 엣지처럼 보임
  drawEdgeLine(na, nb, EDGE_COLOR, 1.5);
}

function drawEdgeLine(a, b, color, width) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function drawNodes() {
  for (let i = 0; i < nodes.length; i++) {
    if (i === 6 && bypassAlpha <= 0) continue; // bypass 노드 숨김
    const n = nodes[i];
    if (i === 5) {
      // 목적지: 십자
      const s = 7;
      ctx.strokeStyle = GOAL_COLOR;
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(n.x - s, n.y); ctx.lineTo(n.x + s, n.y);
      ctx.moveTo(n.x, n.y - s); ctx.lineTo(n.x, n.y + s);
      ctx.stroke();
    } else if (i === 0) {
      // 출발: 작은 빈 원
      ctx.beginPath();
      ctx.arc(n.x, n.y, 3.5, 0, Math.PI * 2);
      ctx.strokeStyle = NODE_COLOR;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    } else if (i === 6) {
      // bypass 노드는 drawEdges에서 처리
    } else {
      ctx.beginPath();
      ctx.arc(n.x, n.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = NODE_COLOR;
      ctx.fill();
    }
  }
}

function drawDot() {
  // pulse 계산
  let extraR = 0;
  if (STATE === 'STUCK') {
    const pt = (pulseT % PULSE_PERIOD) / PULSE_PERIOD;
    extraR = Math.sin(pt * Math.PI * 2) * DOT_R * 0.45;
  }

  const isTraveling = STATE === 'TRAVELING' || STATE === 'ARRIVED';
  const glowColor = isTraveling ? DOT_GLOW_T : DOT_GLOW;
  const coreColor = isTraveling ? DOT_TRAVEL  : DOT_CORE;
  const r = DOT_R + extraR;

  // glow
  const grad = ctx.createRadialGradient(dot.x, dot.y, 0, dot.x, dot.y, GLOW_R + extraR);
  grad.addColorStop(0, glowColor);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.beginPath();
  ctx.arc(dot.x, dot.y, GLOW_R + extraR, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // 코어
  ctx.beginPath();
  ctx.arc(dot.x, dot.y, r, 0, Math.PI * 2);
  ctx.fillStyle = coreColor;
  ctx.fill();
}

// ── 유틸 ──────────────────────────────────────────────────────────────────────
function moveToward(from, to, speed, dt) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.5) return;
  const step = Math.min(speed * dt / 1000, d);
  from.x += (dx / d) * step;
  from.y += (dy / d) * step;
}

function dist2(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

// ── 루프 ──────────────────────────────────────────────────────────────────────
function loop(ts) {
  const dt = Math.min(ts - lastTs, 50);
  lastTs = ts;
  tick(dt);
  draw();
  animId = requestAnimationFrame(loop);
}

// ── 입력 ──────────────────────────────────────────────────────────────────────
canvas.addEventListener('pointerdown', () => {
  if (STATE === 'IDLE') {
    STATE = 'MOVING';
    hint.classList.add('hidden');
  } else if (STATE === 'STUCK' && canReveal) {
    enterReveal();
  }
});

// ── 리사이즈 ──────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  cancelAnimationFrame(animId);
  resize();
  reset();
  lastTs = performance.now();
  animId = requestAnimationFrame(loop);
});

// ── 시작 ──────────────────────────────────────────────────────────────────────
resize();
reset();
lastTs = performance.now();
animId = requestAnimationFrame(loop);