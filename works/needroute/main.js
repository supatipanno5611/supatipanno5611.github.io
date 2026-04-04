const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');
const hint   = document.getElementById('hint');

// ── 상수 ──────────────────────────────────────────────────────────────────────
const NODE_COUNT       = 15;
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
const EDGE_FADE_DUR    = 220;   // ms — 엣지가 dim으로 돌아가는 시간

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
function buildGraph() {
  const pad = Math.min(W, H) * 0.1;
  nodes = [];
  const minD = Math.min(W, H) * 0.13;
  let tries = 0;
  while (nodes.length < NODE_COUNT && tries < 2000) {
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
  if (!pathToA || pathToA.length < 3) { buildGraph(); return; }

  // 벽: 경로 중 화면 중앙에 가장 가까운 엣지
  wallFrom = -1; wallTo = -1;
  let bestD = Infinity;
  for (let i = 1; i < pathToA.length - 1; i++) {
    const a = nodes[pathToA[i]], b = nodes[pathToA[i+1]];
    if (!a || !b) continue;
    const d = Math.hypot((a.x+b.x)/2 - W/2, (a.y+b.y)/2 - H/2);
    if (d < bestD) { bestD = d; wallFrom = pathToA[i]; wallTo = pathToA[i+1]; }
  }
  if (wallFrom < 0) { buildGraph(); return; }

  // 목적지B: goalA와 다른 분면, 출발에서 멀리
  const qaQ = quadrant(nodes[goalAIdx]);
  const bCands = nodes
    .map((n, i) => ({ i, q: quadrant(n) }))
    .filter(e => e.i !== startIdx && e.i !== goalAIdx && e.q !== qaQ)
    .map(e => ({ i: e.i, d: Math.hypot(nodes[e.i].x - nodes[startIdx].x, nodes[e.i].y - nodes[startIdx].y) }))
    .sort((a, b) => b.d - a.d);
  goalBIdx = bCands.length > 0 ? bCands[0].i : goalAIdx;

  detourPath = buildDetourPath(wallFrom, goalBIdx);
  if (!detourPath || detourPath.length < 2) { buildGraph(); return; }
}

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

function bfs(from, to, wFrom, wTo) {
  const prev = new Array(nodes.length).fill(-1);
  const vis  = new Array(nodes.length).fill(false);
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
// 구역 순회 + 가중치 탐색 조합
// 목적지B 방향의 반대 구역은 제외하고, 나머지 구역을 순회하며 경유
function buildDetourPath(from, to) {
  const toNode = nodes[to];
  const goalDir = { x: toNode.x - W/2, y: toNode.y - H/2 };

  // 화면을 4구역으로 나눠 각 구역의 대표 좌표 정의
  const zones = [
    { x: W * 0.25, y: H * 0.25 },
    { x: W * 0.75, y: H * 0.25 },
    { x: W * 0.25, y: H * 0.75 },
    { x: W * 0.75, y: H * 0.75 },
  ];

  // 목적지B 방향과 반대인 구역 제외
  // 반대: goalDir와 내적이 가장 음수인 구역
  const filteredZones = zones.filter(z => {
    const zd = { x: z.x - W/2, y: z.y - H/2 };
    const dot = goalDir.x * zd.x + goalDir.y * zd.y;
    // 내적이 너무 음수면 반대 방향 → 제외
    return dot > -0.3 * (Math.hypot(goalDir.x, goalDir.y) * Math.hypot(zd.x, zd.y));
  });

  // 각 구역에서 경유 노드 선택
  const excluded = new Set([from, to, wallFrom, wallTo, startIdx, goalAIdx]);
  const waypoints = [];
  for (const z of filteredZones) {
    // 구역 중심에 가깝고, 목적지B까지 거리가 너무 멀지 않은 노드
    const cands = nodes
      .map((n, i) => ({
        i,
        zoneDist: Math.hypot(n.x - z.x, n.y - z.y),
        goalDist: Math.hypot(n.x - toNode.x, n.y - toNode.y),
      }))
      .filter(e => !excluded.has(e.i))
      // 반대 방향 구역 노드 배제: goalDir와 내적이 너무 음수인 노드
      .filter(e => {
        const nd = { x: nodes[e.i].x - W/2, y: nodes[e.i].y - H/2 };
        const dp = goalDir.x * nd.x + goalDir.y * nd.y;
        return dp > -0.4 * (Math.hypot(goalDir.x, goalDir.y) * Math.hypot(nd.x, nd.y));
      })
      .sort((a, b) => a.zoneDist - b.zoneDist);

    if (cands.length > 0) {
      // 구역 내 최적 노드 중 가중치 탐색으로 1~2개 선택
      // 가중치: 구역 거리 낮을수록 좋고, goal 거리 너무 가깝지 않도록 살짝 페널티
      const pick = cands.slice(0, 4).sort((a, b) => {
        const scoreA = a.zoneDist + Math.max(0, 200 - a.goalDist) * 0.3;
        const scoreB = b.zoneDist + Math.max(0, 200 - b.goalDist) * 0.3;
        return scoreA - scoreB;
      })[0];
      if (pick && !waypoints.includes(pick.i)) {
        waypoints.push(pick.i);
        excluded.add(pick.i);
      }
    }
  }

  // from → wp → wp → ... → to 순서로 BFS 연결 (벽 차단)
  // 각 구간 사이에 가중치 탐색: 최단 대신 차선 경유 추가
  const sequence = [from, ...waypoints, to];
  const fullPath = [from];

  for (let i = 0; i < sequence.length - 1; i++) {
    const seg = buildWeightedSegment(sequence[i], sequence[i+1]);
    if (!seg || seg.length < 2) {
      // 폴백: 일반 BFS
      const fallback = bfs(sequence[i], sequence[i+1], wallFrom, wallTo);
      if (!fallback) return null;
      fullPath.push(...fallback.slice(1));
    } else {
      fullPath.push(...seg.slice(1));
    }
  }

  return fullPath;
}

// 구간 내 가중치 탐색: 최단 경로보다 1~2개 더 경유하도록
// 방법: BFS 최단 구하고, 중간에 "옆 노드" 하나를 끼워넣음
function buildWeightedSegment(from, to) {
  const shortest = bfs(from, to, wallFrom, wallTo);
  if (!shortest || shortest.length < 3) return shortest;

  // 중간 구간에서 인접 노드 하나를 우회로 삽입
  const midIdx = Math.floor(shortest.length / 2);
  const midNode = shortest[midIdx];
  const prevNode = shortest[midIdx - 1];

  // midNode의 이웃 중 경로에 없고 벽 아닌 노드
  const detourNeighbor = adjList[midNode].find(nb => {
    if (shortest.includes(nb)) return false;
    if ((midNode===wallFrom&&nb===wallTo)||(midNode===wallTo&&nb===wallFrom)) return false;
    return true;
  });

  if (!detourNeighbor) return shortest;

  // from→...→midNode→detourNeighbor→midNode→...→to
  // 단순하게: from→...→prevNode→detourNeighbor→midNode→...→to
  const seg1 = bfs(from, detourNeighbor, wallFrom, wallTo);
  const seg2 = bfs(detourNeighbor, to, wallFrom, wallTo);
  if (!seg1 || !seg2) return shortest;

  return [...seg1, ...seg2.slice(1)];
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