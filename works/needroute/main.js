const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');
const hint   = document.getElementById('hint');

// ── 상수 ──────────────────────────────────────────────────────────────────────
const NODE_COUNT       = 22;
const CONNECT_K        = 3;
const MOVE_SPEED       = 190;   // px/s
const TRAVEL_SPEED     = 155;   // px/s
const DOT_R            = 6;
const GLOW_R           = 20;

// 충돌 사이클
const BOUNCE_DUR       = 260;   // ms
const BOUNCE_DIST      = 26;    // px
const FLASH_DUR        = 300;   // ms
const PULSE_DUR        = 750;   // ms
const PULSES_PER_CYCLE = 2;
const STUCK_DELAY      = 1200;  // ms

const REVEAL_DUR       = 600;   // ms
const ARRIVED_DUR      = 1400;  // ms

// 우회 경로 엣지 fade
const EDGE_FADE_DUR    = 420;   // ms — 엣지가 dim으로 돌아가는 시간

// ── 색 ────────────────────────────────────────────────────────────────────────
const BG          = '#090c12';
const EDGE_DIM    = 'rgba(100,120,165,0.28)';
const EDGE_BRIGHT = 'rgba(140,165,210,0.6)';
const NODE_DIM    = 'rgba(110,130,175,0.45)';
const DOT_CORE    = '#dde6f8';
const DOT_GLOW    = 'rgba(130,170,255,0.5)';
const DOT_TRAVEL  = '#9aefc8';
const DOT_GLOW_T  = 'rgba(90,210,150,0.45)';
const GOAL_A_COL  = 'rgba(150,175,220,0.65)';
const WALL_R = 255, WALL_G = 95, WALL_B_C = 70;

// ── 전역 상태 ─────────────────────────────────────────────────────────────────
let W, H, DPR;
let STATE = 'IDLE';
// IDLE | MOVING | STUCK | REVEAL | TRAVELING | EDGE_FADE | ARRIVED

let nodes    = [];
let adjList  = [];
let edgeSet  = new Set();

let startIdx = 0, goalAIdx = 0, goalBIdx = 0;
let wallFrom = -1, wallTo = -1;
let pathToA    = [];
let detourPath = [];

let dot = { x: 0, y: 0 };
let moveSegIdx = 0;

// STUCK
let stuckCycleT     = 0;
let stuckCyclePhase = 'bounce';
let stuckPulseCount = 0;
let bounceOrigin    = { x: 0, y: 0 };
let bounceDir       = { x: 0, y: 0 };
let flashT          = 0;
let flashOn         = false;
let canReveal       = false;
let stuckTotalT     = 0;

// 벽 너머 경로 fade
let pathFadeAlpha = 1.0;

// REVEAL
let revealT     = 0;
let wallAlpha   = 1.0;
let detourAlpha = 0.0;
let goalBAlpha  = 0.0;   // REVEAL 시 초기값 (희미하게)
const GOAL_B_INIT_ALPHA = 0.15;
const GOAL_B_MAX_ALPHA  = 1.0;
const GOAL_B_NEAR_DIST  = 180; // px — 이 거리 안에 들어오면 선명해지기 시작

// TRAVELING + EDGE_FADE
let travelSegIdx  = 0;
let activeEdge    = null;  // { from, to, alpha } — 현재 밝은 엣지
let edgeFadeT     = 0;
let edgeFadeFrom  = -1;
let edgeFadeTo    = -1;
let edgeFadeAlpha = 0;    // 1→0

// ARRIVED
let arrivedT    = 0;
let arrivedFade = 1.0;

let lastTs = 0;
let animId = null;

// ── 리사이즈 ──────────────────────────────────────────────────────────────────
function resize() {
  DPR = window.devicePixelRatio || 1;
  W = window.innerWidth; H = window.innerHeight;
  canvas.width  = W * DPR; canvas.height = H * DPR;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.scale(DPR, DPR);
}

// ── 그래프 생성 ───────────────────────────────────────────────────────────────
function buildGraph(attempt = 0) {
  if (attempt > 8) {
    // 너무 많이 실패하면 조건 완화 후 재시도
    NODE_COUNT_actual = Math.max(14, NODE_COUNT - 4);
  } else {
    NODE_COUNT_actual = NODE_COUNT;
  }

  const pad = Math.min(W, H) * 0.1;
  nodes = [];
  // minDist를 시도 횟수에 따라 점진적으로 완화
  let minD = Math.min(W, H) * (0.13 - attempt * 0.008);
  minD = Math.max(minD, Math.min(W, H) * 0.07);

  let tries = 0;
  while (nodes.length < NODE_COUNT_actual && tries < 3000) {
    tries++;
    const x = pad + Math.random() * (W - pad * 2);
    const y = pad + Math.random() * (H - pad * 2);
    if (nodes.every(n => Math.hypot(n.x - x, n.y - y) >= minD)) nodes.push({ x, y });
  }
  const N = nodes.length;

  adjList = Array.from({ length: N }, () => []);
  edgeSet = new Set();
  for (let i = 0; i < N; i++) {
    const sorted = nodes
      .map((n, j) => ({ j, d: Math.hypot(n.x - nodes[i].x, n.y - nodes[i].y) }))
      .filter(e => e.j !== i).sort((a, b) => a.d - b.d).slice(0, CONNECT_K);
    for (const { j } of sorted) {
      if (!adjList[i].includes(j)) adjList[i].push(j);
      if (!adjList[j].includes(i)) adjList[j].push(i);
      edgeSet.add(Math.min(i,j) + '_' + Math.max(i,j));
    }
  }

  startIdx = closestNode({ x: W * 0.12, y: H * 0.12 });
  goalAIdx = closestNode({ x: W * 0.88, y: H * 0.88 }, [startIdx]);

  pathToA = bfs(startIdx, goalAIdx, -1, -1);
  if (!pathToA || pathToA.length < 3) { buildGraph(attempt + 1); return; }

  // 벽: 경로 중 화면 중앙에 가장 가까운 엣지
  wallFrom = -1; wallTo = -1;
  let bestD = Infinity;
  for (let i = 1; i < pathToA.length - 1; i++) {
    const a = nodes[pathToA[i]], b = nodes[pathToA[i+1]];
    if (!a || !b) continue;
    const d = Math.hypot((a.x+b.x)/2 - W/2, (a.y+b.y)/2 - H/2);
    if (d < bestD) { bestD = d; wallFrom = pathToA[i]; wallTo = pathToA[i+1]; }
  }
  if (wallFrom < 0) { buildGraph(attempt + 1); return; }

  // 목적지B: goalA와 다른 분면, 출발에서 멀리
  // 조건 완화: 분면 조건 실패 시 단순히 goalA와 거리 먼 노드로 폴백
  const qaQ = quadrant(nodes[goalAIdx]);
  let bCands = nodes
    .map((n, i) => ({ i, q: quadrant(n) }))
    .filter(e => e.i !== startIdx && e.i !== goalAIdx && e.q !== qaQ)
    .map(e => ({ i: e.i, d: Math.hypot(nodes[e.i].x - nodes[goalAIdx].x, nodes[e.i].y - nodes[goalAIdx].y) }))
    .sort((a, b) => b.d - a.d);

  if (bCands.length === 0) {
    // 분면 조건 완화: goalA와 가장 먼 노드 선택
    bCands = nodes
      .map((n, i) => ({ i, d: Math.hypot(n.x - nodes[goalAIdx].x, n.y - nodes[goalAIdx].y) }))
      .filter(e => e.i !== startIdx && e.i !== goalAIdx)
      .sort((a, b) => b.d - a.d);
  }
  if (bCands.length === 0) { buildGraph(attempt + 1); return; }
  goalBIdx = bCands[0].i;

  detourPath = buildDetourPath(wallFrom, goalBIdx);
  if (!detourPath || detourPath.length < 2) { buildGraph(attempt + 1); return; }
}

let NODE_COUNT_actual = NODE_COUNT;

function quadrant(n) {
  return (n.x > W/2 ? 1 : 0) + (n.y > H/2 ? 2 : 0);
}

function closestNode(pos, exclude = []) {
  let best = -1, bestD = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    if (exclude.includes(i)) continue;
    const d = Math.hypot(nodes[i].x - pos.x, nodes[i].y - pos.y);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

function bfs(from, to, wFrom, wTo, extraVisited = new Set()) {
  const prev = new Array(nodes.length).fill(-1);
  const vis  = new Array(nodes.length).fill(false);
  // 이미 방문한 노드 미리 차단 (되돌아가기 방지용)
  for (const v of extraVisited) if (v !== from && v !== to) vis[v] = true;
  const q = [from]; vis[from] = true;
  while (q.length > 0) {
    const cur = q.shift();
    if (cur === to) {
      const path = []; let c = to;
      while (c !== -1) { path.unshift(c); c = prev[c]; }
      return path;
    }
    for (const nb of adjList[cur]) {
      if (vis[nb]) continue;
      if ((cur===wFrom&&nb===wTo)||(cur===wTo&&nb===wFrom)) continue;
      vis[nb] = true; prev[nb] = cur; q.push(nb);
    }
  }
  return null;
}

// ── 우회 경로 생성 ────────────────────────────────────────────────────────────
// 알고리즘:
// - 첫 스텝: wallFrom 인접 노드 중 goalB까지 거리 기준 두 번째로 가까운 노드 선택
// - 이후 스텝: 현재 노드 인접 노드 중 goalB까지 거리가 현재보다 멀어지지 않는 노드들 중 랜덤
// - 막힌 경우(조건 만족 노드 없음): 가장 덜 멀어지는 노드 선택 (폴백)
// - 방문한 노드 재방문 금지 (되돌아가기 방지)
// - goalAIdx, startIdx 경유 금지
function buildDetourPath(from, to) {
  const toNode = nodes[to];
  const forbidden = new Set([wallFrom, wallTo, goalAIdx, startIdx]);

  function distToGoal(i) {
    return Math.hypot(nodes[i].x - toNode.x, nodes[i].y - toNode.y);
  }

  const visited = new Set([from]);
  const path = [from];
  let cur = from;
  const MAX_STEPS = nodes.length * 2; // 무한루프 방지

  for (let step = 0; step < MAX_STEPS; step++) {
    if (cur === to) break;

    const curDist = distToGoal(cur);

    // 인접 노드 후보: 방문 안 했고, 금지 아니고, 벽 엣지 아님 (to는 항상 허용)
    const neighbors = adjList[cur].filter(nb => {
      if (nb !== to && visited.has(nb)) return false;
      if (nb !== to && forbidden.has(nb)) return false;
      if (isWall(cur, nb)) return false;
      return true;
    });

    if (neighbors.length === 0) return null; // 막힘, buildGraph에서 재시도

    if (step === 0) {
      // 첫 스텝: goalB까지 거리 기준 정렬 후 두 번째 선택
      const sorted = neighbors.slice().sort((a, b) => distToGoal(a) - distToGoal(b));
      const pick = sorted.length >= 2 ? sorted[1] : sorted[0];
      path.push(pick); visited.add(pick); cur = pick;
    } else {
      // 이후 스텝: goalB까지 거리가 현재보다 멀어지지 않는 후보
      const notFarther = neighbors.filter(nb => distToGoal(nb) <= curDist);

      let pick;
      if (notFarther.length > 0) {
        // 조건 만족 노드 중 랜덤
        pick = notFarther[Math.floor(Math.random() * notFarther.length)];
      } else {
        // 폴백: 가장 덜 멀어지는 노드
        pick = neighbors.slice().sort((a, b) => distToGoal(a) - distToGoal(b))[0];
      }
      path.push(pick); visited.add(pick); cur = pick;
    }
  }

  if (cur !== to) return null;
  return path;
}

// ── 리셋 ──────────────────────────────────────────────────────────────────────
function reset() {
  buildGraph();
  dot = { ...nodes[startIdx] };
  moveSegIdx      = 0;
  stuckCycleT     = 0;
  stuckCyclePhase = 'bounce';
  stuckPulseCount = 0;
  flashT = 0; flashOn = false;
  canReveal = false; stuckTotalT = 0;
  pathFadeAlpha   = 1.0;
  revealT         = 0;
  wallAlpha       = 1.0;
  detourAlpha     = 0.0;
  goalBAlpha      = 0.0;
  travelSegIdx    = 0;
  activeEdge      = null;
  edgeFadeT       = 0;
  edgeFadeFrom    = -1; edgeFadeTo = -1; edgeFadeAlpha = 0;
  currentEdgeAlpha = 0;
  arrivedT        = 0; arrivedFade = 1.0;
  hint.textContent = '터치해서 시작';
  hint.classList.remove('hidden');
  STATE = 'IDLE';
}

// ── 틱 ────────────────────────────────────────────────────────────────────────
function tick(dt) {
  switch (STATE) {
    case 'MOVING':    tickMoving(dt);    break;
    case 'STUCK':     tickStuck(dt);     break;
    case 'REVEAL':    tickReveal(dt);    break;
    case 'TRAVELING': tickTraveling(dt); break;
    case 'EDGE_FADE': tickEdgeFade(dt);  break;
    case 'ARRIVED':   tickArrived(dt);   break;
  }
}

// MOVING
function tickMoving(dt) {
  if (moveSegIdx >= pathToA.length - 1) { enterArrived(); return; }
  const target = nodes[pathToA[moveSegIdx + 1]];
  moveToward(dot, target, MOVE_SPEED, dt);
  if (dist(dot, target) < 2) {
    dot.x = target.x; dot.y = target.y;
    moveSegIdx++;
    if (moveSegIdx < pathToA.length - 1) {
      const a = pathToA[moveSegIdx], b = pathToA[moveSegIdx + 1];
      if (isWall(a, b)) enterStuck();
    }
  }
}

// STUCK
function tickStuck(dt) {
  stuckCycleT += dt; stuckTotalT += dt;
  if (flashOn) flashT += dt;

  if (pathFadeAlpha > 0) pathFadeAlpha = Math.max(0, pathFadeAlpha - dt / 800);

  if (!canReveal && stuckTotalT >= STUCK_DELAY) {
    canReveal = true;
    hint.textContent = '터치해서 보기';
    hint.classList.remove('hidden');
  }

  if (stuckCyclePhase === 'bounce') {
    const t = Math.min(stuckCycleT / BOUNCE_DUR, 1);
    const fwd = Math.sin(t * Math.PI);
    dot.x = bounceOrigin.x + bounceDir.x * BOUNCE_DIST * fwd;
    dot.y = bounceOrigin.y + bounceDir.y * BOUNCE_DIST * fwd;
    if (stuckCycleT >= BOUNCE_DUR) {
      dot.x = bounceOrigin.x; dot.y = bounceOrigin.y;
      stuckCycleT = 0; stuckPulseCount = 0;
      stuckCyclePhase = 'pulse';
    }
  } else {
    if (stuckCycleT >= PULSE_DUR) {
      stuckCycleT = 0; stuckPulseCount++;
      if (stuckPulseCount >= PULSES_PER_CYCLE) {
        stuckCyclePhase = 'bounce'; stuckCycleT = 0;
        triggerBounceFlash();
      }
    }
  }
}

function enterStuck() {
  STATE = 'STUCK';
  stuckCycleT = 0; stuckCyclePhase = 'bounce';
  stuckPulseCount = 0; stuckTotalT = 0;
  canReveal = false;
  hint.classList.add('hidden');
  bounceOrigin = { x: dot.x, y: dot.y };
  const wall = nodes[pathToA[moveSegIdx + 1]];
  const dx = wall.x - dot.x, dy = wall.y - dot.y;
  const d = Math.hypot(dx, dy) || 1;
  bounceDir = { x: dx/d, y: dy/d };
  triggerBounceFlash();
}

function triggerBounceFlash() { flashT = 0; flashOn = true; }

// REVEAL
function tickReveal(dt) {
  revealT += dt;
  const t = easeOut(Math.min(revealT / REVEAL_DUR, 1));
  wallAlpha   = 1 - t;
  detourAlpha = t;
  goalBAlpha  = GOAL_B_INIT_ALPHA + t * (GOAL_B_INIT_ALPHA * 0.5); // 희미하게만
  pathFadeAlpha = 0;
  if (revealT >= REVEAL_DUR) enterTraveling();
}

// TRAVELING
function tickTraveling(dt) {
  if (travelSegIdx >= detourPath.length - 1) { enterArrived(); return; }

  const target = nodes[detourPath[travelSegIdx + 1]];
  // 이동 중 엣지 점점 밝아짐
  currentEdgeAlpha = Math.min(1, currentEdgeAlpha + dt / 200);
  moveToward(dot, target, TRAVEL_SPEED, dt);

  // 목적지B alpha: 거리에 따라 GOAL_B_INIT_ALPHA → GOAL_B_MAX_ALPHA
  const dToB = dist(dot, nodes[goalBIdx]);
  const proximity = Math.max(0, 1 - dToB / GOAL_B_NEAR_DIST);
  goalBAlpha = GOAL_B_INIT_ALPHA + (GOAL_B_MAX_ALPHA - GOAL_B_INIT_ALPHA) * easeOut(proximity);

  if (dist(dot, target) < 2) {
    dot.x = target.x; dot.y = target.y;
    // 현재 엣지 fade 시작
    edgeFadeFrom  = detourPath[travelSegIdx];
    edgeFadeTo    = detourPath[travelSegIdx + 1];
    edgeFadeAlpha = 1.0;
    edgeFadeT     = 0;
    currentEdgeAlpha = 0;
    travelSegIdx++;
    if (travelSegIdx >= detourPath.length - 1) {
      enterArrived(); return;
    }
    STATE = 'EDGE_FADE';
  }
}

// EDGE_FADE: 방금 지나온 엣지가 dim으로 돌아가는 동안 대기
function tickEdgeFade(dt) {
  edgeFadeT += dt;
  edgeFadeAlpha = Math.max(0, 1 - edgeFadeT / EDGE_FADE_DUR);

  // 목적지B alpha도 계속 업데이트
  const dToB = dist(dot, nodes[goalBIdx]);
  const proximity = Math.max(0, 1 - dToB / GOAL_B_NEAR_DIST);
  goalBAlpha = GOAL_B_INIT_ALPHA + (GOAL_B_MAX_ALPHA - GOAL_B_INIT_ALPHA) * easeOut(proximity);

  if (edgeFadeT >= EDGE_FADE_DUR) {
    edgeFadeAlpha = 0;
    STATE = 'TRAVELING';
  }
}

// ARRIVED
function tickArrived(dt) {
  arrivedT += dt;
  const half = ARRIVED_DUR * 0.55;
  if (arrivedT > half) arrivedFade = Math.max(0, 1 - (arrivedT - half) / (ARRIVED_DUR - half));
  if (arrivedT >= ARRIVED_DUR) reset();
}

function enterTraveling() {
  STATE = 'TRAVELING';
  travelSegIdx = 0;
  dot = { ...nodes[detourPath[0]] };
  activeEdge = null;
  edgeFadeFrom = -1; edgeFadeTo = -1; edgeFadeAlpha = 0;
  currentEdgeAlpha = 0;
}

function enterArrived() { STATE = 'ARRIVED'; arrivedT = 0; arrivedFade = 1.0; }

// ── 드로잉 ────────────────────────────────────────────────────────────────────
function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  drawAllEdges();
  drawNodes();
  drawActivePath();
  drawDot();
}

function drawAllEdges() {
  ctx.lineCap = 'round';
  for (const key of edgeSet) {
    const [a, b] = key.split('_').map(Number);
    if (isWall(a, b)) { drawWallEdge(nodes[a], nodes[b]); continue; }
    ctx.beginPath(); ctx.moveTo(nodes[a].x, nodes[a].y); ctx.lineTo(nodes[b].x, nodes[b].y);
    ctx.strokeStyle = EDGE_DIM; ctx.lineWidth = 1; ctx.stroke();
  }

  // 현재 이동 중인 엣지 (초록, 이동하면서 밝아짐)
  if ((STATE === 'TRAVELING') && travelSegIdx < detourPath.length - 1) {
    const a = detourPath[travelSegIdx], b = detourPath[travelSegIdx + 1];
    const na = nodes[a], nb = nodes[b];
    const alpha = currentEdgeAlpha;
    ctx.beginPath(); ctx.moveTo(na.x, na.y); ctx.lineTo(nb.x, nb.y);
    ctx.strokeStyle = `rgba(90,215,150,${alpha * 0.25})`; ctx.lineWidth = 8; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(na.x, na.y); ctx.lineTo(nb.x, nb.y);
    ctx.strokeStyle = `rgba(90,215,150,${alpha * 0.85})`; ctx.lineWidth = 1.8; ctx.stroke();
  }

  // fade 중인 엣지 (지나온 엣지 dim으로 돌아감)
  if (edgeFadeFrom >= 0 && edgeFadeAlpha > 0.01) {
    const na = nodes[edgeFadeFrom], nb = nodes[edgeFadeTo];
    const alpha = edgeFadeAlpha;
    ctx.beginPath(); ctx.moveTo(na.x, na.y); ctx.lineTo(nb.x, nb.y);
    ctx.strokeStyle = `rgba(90,215,150,${alpha * 0.25})`; ctx.lineWidth = 8; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(na.x, na.y); ctx.lineTo(nb.x, nb.y);
    ctx.strokeStyle = `rgba(90,215,150,${alpha * 0.85})`; ctx.lineWidth = 1.8; ctx.stroke();
  }
}

function drawWallEdge(na, nb) {
  if (flashOn && flashT < FLASH_DUR) {
    const fa = (1 - flashT / FLASH_DUR) * 0.85;
    ctx.beginPath(); ctx.moveTo(na.x, na.y); ctx.lineTo(nb.x, nb.y);
    ctx.strokeStyle = `rgba(${WALL_R},${WALL_G},${WALL_B_C},${fa*0.3})`; ctx.lineWidth = 9; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(na.x, na.y); ctx.lineTo(nb.x, nb.y);
    ctx.strokeStyle = `rgba(${WALL_R},${WALL_G},${WALL_B_C},${fa})`; ctx.lineWidth = 2; ctx.stroke();
    if (flashT >= FLASH_DUR) flashOn = false;
    return;
  }
  if (STATE === 'REVEAL' || STATE === 'TRAVELING' || STATE === 'EDGE_FADE' || STATE === 'ARRIVED') {
    if (wallAlpha <= 0.01) return;
    ctx.beginPath(); ctx.moveTo(na.x, na.y); ctx.lineTo(nb.x, nb.y);
    ctx.strokeStyle = `rgba(100,120,165,${wallAlpha * 0.28})`; ctx.lineWidth = 1; ctx.stroke();
    return;
  }
  ctx.beginPath(); ctx.moveTo(na.x, na.y); ctx.lineTo(nb.x, nb.y);
  ctx.strokeStyle = EDGE_DIM; ctx.lineWidth = 1; ctx.stroke();
}

function drawActivePath() {
  if (STATE !== 'MOVING' && STATE !== 'STUCK') return;
  ctx.lineCap = 'round';
  let pastWall = false;
  for (let i = 0; i < pathToA.length - 1; i++) {
    const a = pathToA[i], b = pathToA[i+1];
    const wall = isWall(a, b);
    const alpha = pastWall ? pathFadeAlpha : 1.0;
    if (alpha <= 0.01 && pastWall) { if (wall) pastWall = true; continue; }
    ctx.beginPath(); ctx.moveTo(nodes[a].x, nodes[a].y); ctx.lineTo(nodes[b].x, nodes[b].y);
    ctx.strokeStyle = `rgba(140,165,210,${0.6 * alpha})`; ctx.lineWidth = 1.5; ctx.stroke();
    if (wall) pastWall = true;
  }
}

function drawNodes() {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (i === goalAIdx) {
      const fa = (STATE === 'TRAVELING' || STATE === 'EDGE_FADE' || STATE === 'ARRIVED')
        ? arrivedFade * 0.5 : 1;
      ctx.beginPath(); ctx.arc(n.x, n.y, 4, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(150,175,220,${0.65 * fa})`; ctx.lineWidth = 1.2; ctx.stroke();
    } else if (i === goalBIdx) {
      if (goalBAlpha <= 0.01) continue;
      const fa = STATE === 'ARRIVED' ? arrivedFade : 1;
      const a  = goalBAlpha * fa;
      const s  = 8;
      ctx.strokeStyle = `rgba(90,215,150,${a * 0.9})`;
      ctx.lineWidth = 1.8; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(n.x-s, n.y); ctx.lineTo(n.x+s, n.y);
      ctx.moveTo(n.x, n.y-s); ctx.lineTo(n.x, n.y+s);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(n.x, n.y, s * 1.4, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(90,215,150,${a * 0.25})`; ctx.lineWidth = 1; ctx.stroke();
    } else if (i === startIdx) {
      ctx.beginPath(); ctx.arc(n.x, n.y, 3, 0, Math.PI * 2);
      ctx.strokeStyle = NODE_DIM; ctx.lineWidth = 1; ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(n.x, n.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = NODE_DIM; ctx.fill();
    }
  }
}

function drawDot() {
  let extraR = 0;
  if (STATE === 'STUCK' && stuckCyclePhase === 'pulse') {
    extraR = Math.sin((stuckCycleT % PULSE_DUR) / PULSE_DUR * Math.PI * 2) * DOT_R * 0.5;
  }
  const isTraveling = STATE === 'TRAVELING' || STATE === 'EDGE_FADE' || STATE === 'ARRIVED';
  const glowCol = isTraveling ? DOT_GLOW_T : DOT_GLOW;
  const coreCol = isTraveling ? DOT_TRAVEL  : DOT_CORE;
  const r = DOT_R + extraR, gr = GLOW_R + Math.abs(extraR);
  const grad = ctx.createRadialGradient(dot.x, dot.y, 0, dot.x, dot.y, gr);
  grad.addColorStop(0, glowCol); grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.beginPath(); ctx.arc(dot.x, dot.y, gr, 0, Math.PI * 2);
  ctx.fillStyle = grad; ctx.fill();
  ctx.beginPath(); ctx.arc(dot.x, dot.y, r, 0, Math.PI * 2);
  ctx.fillStyle = coreCol; ctx.fill();
}

// ── 유틸 ──────────────────────────────────────────────────────────────────────
function moveToward(from, to, speed, dt) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.5) return;
  const step = Math.min(speed * dt / 1000, d);
  from.x += (dx/d) * step; from.y += (dy/d) * step;
}

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function isWall(a, b) { return (a===wallFrom&&b===wallTo)||(a===wallTo&&b===wallFrom); }
function easeOut(t) { return 1 - Math.pow(1 - t, 2.5); }

// ── 루프 ──────────────────────────────────────────────────────────────────────
function loop(ts) {
  const dt = Math.min(ts - lastTs, 50);
  lastTs = ts;
  tick(dt); draw();
  animId = requestAnimationFrame(loop);
}

// ── 입력 ──────────────────────────────────────────────────────────────────────
canvas.addEventListener('pointerdown', () => {
  if (STATE === 'IDLE') { STATE = 'MOVING'; hint.classList.add('hidden'); }
  else if (STATE === 'STUCK' && canReveal) enterReveal();
});

function enterReveal() {
  STATE = 'REVEAL'; canReveal = false; revealT = 0;
  hint.classList.add('hidden');
}

// ── 리사이즈 ──────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  cancelAnimationFrame(animId); resize(); reset();
  lastTs = performance.now(); animId = requestAnimationFrame(loop);
});

// ── 시작 ──────────────────────────────────────────────────────────────────────
resize(); reset();
lastTs = performance.now();
animId = requestAnimationFrame(loop);