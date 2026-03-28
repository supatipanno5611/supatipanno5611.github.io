/* ── Constants ─────────────────────────────────────── */
const RECT_SIZE    = 72;
const STEP_MIN     = 0.20; // 너비의 최소 전진 비율
const STEP_MAX     = 0.70; // 너비의 최대 전진 비율
const HIGHLIGHT_MS = 800;  // 하이라이트 표시 시간

/* ── State ─────────────────────────────────────────── */
const state = {
  positions: [],        // 이동 이력 [x0, x1, ...]
  isAnimating: false,   // 슬라이드 애니메이션 중
  isHighlighting: false // 하이라이트 표시 중
};

/* ── DOM refs ──────────────────────────────────────── */
const stage          = document.getElementById('stage');
const rect           = document.getElementById('rect');
const overlay        = document.getElementById('highlight-overlay');
const btnMove        = document.getElementById('btn-move');
const btnUndo        = document.getElementById('btn-undo');
const btnOverlap     = document.getElementById('btn-highlight-overlap');
const btnNew         = document.getElementById('btn-highlight-new');
const stepCountEl    = document.getElementById('step-count');
const finishScreen   = document.getElementById('finish-screen');
const finishStepEl   = document.getElementById('finish-step-count');
const btnRestart     = document.getElementById('btn-restart');

/* ── Derived values ────────────────────────────────── */
function stageWidth() {
  return stage.getBoundingClientRect().width;
}

function finishX() {
  // 결승선: 오른쪽 끝에서 24px 안쪽
  return stageWidth() - RECT_SIZE - 24;
}

function startX() {
  return 24;
}

/* ── Ghost management ──────────────────────────────── */
function renderGhosts() {
  // 기존 ghost 모두 제거
  stage.querySelectorAll('.ghost').forEach(el => el.remove());

  const len = state.positions.length;
  if (len < 2) return;

  // positions[0 .. len-2] 까지가 잔상 (마지막은 현재 사각형)
  const ghostCount = len - 1;

  for (let i = 0; i < ghostCount; i++) {
    const ghost = document.createElement('div');
    ghost.className = 'ghost';
    ghost.style.left = state.positions[i] + 'px';

    // 오래된 것(i=0)은 흐리고, 최근(i=ghostCount-1)은 진하게
    const opacity = 0.15 + 0.65 * (i / (ghostCount - 1 || 1));
    ghost.style.opacity = opacity;

    stage.appendChild(ghost);
  }
}

/* ── Rect position ─────────────────────────────────── */
function setRectPosition(x, animate = true) {
  if (!animate) {
    // transition 일시 비활성화
    rect.style.transition = 'none';
    rect.style.left = x + 'px';
    // reflow 강제 후 transition 복원
    rect.getBoundingClientRect();
    rect.style.transition = '';
  } else {
    rect.style.left = x + 'px';
  }
}

/* ── Update UI ─────────────────────────────────────── */
function updateUI() {
  const len = state.positions.length;
  stepCountEl.textContent = len - 1; // 이동 횟수 = 위치 수 - 1

  const canInteract = !state.isAnimating && !state.isHighlighting;
  const hasMoved    = len >= 2;
  const isFinished  = len >= 1 && state.positions[len - 1] >= finishX();

  btnMove.disabled    = !canInteract || isFinished;
  btnUndo.disabled    = !canInteract || !hasMoved;
  btnOverlap.disabled = !canInteract || !hasMoved;
  btnNew.disabled     = !canInteract || !hasMoved;
}

/* ── Move ──────────────────────────────────────────── */
function move() {
  if (state.isAnimating || state.isHighlighting) return;

  const currentX = state.positions[state.positions.length - 1];
  const maxStep  = RECT_SIZE * STEP_MAX;
  const minStep  = RECT_SIZE * STEP_MIN;

  // 결승선을 넘지 않는 범위에서 랜덤 전진
  const fX      = finishX();
  const maxMove = fX - currentX;

  if (maxMove <= 0) return; // 이미 결승선

  const step    = Math.min(
    minStep + Math.random() * (maxStep - minStep),
    maxMove
  );
  const newX    = currentX + step;

  state.positions.push(newX);
  state.isAnimating = true;
  updateUI();

  // 이전 위치에 ghost 먼저 렌더 (transition 시작 전)
  renderGhosts();

  // 현재 사각형 이동
  setRectPosition(newX, true);

  // transition 종료 대기
  rect.addEventListener('transitionend', onMoveEnd, { once: true });
}

function onMoveEnd() {
  state.isAnimating = false;

  const len      = state.positions.length;
  const currentX = state.positions[len - 1];
  const fX       = finishX();

  if (currentX >= fX) {
    showFinish();
  } else {
    updateUI();
  }
}

/* ── Undo ──────────────────────────────────────────── */
function undo() {
  if (state.isAnimating || state.isHighlighting) return;
  if (state.positions.length < 2) return;

  state.positions.pop();
  const prevX = state.positions[state.positions.length - 1];

  state.isAnimating = true;
  updateUI();

  renderGhosts();
  setRectPosition(prevX, true);

  rect.addEventListener('transitionend', onUndoEnd, { once: true });
}

function onUndoEnd() {
  state.isAnimating = false;
  updateUI();
}

/* ── Highlight ─────────────────────────────────────── */
let highlightTimer = null;

function showHighlight(type) {
  if (state.isAnimating || state.isHighlighting) return;
  if (state.positions.length < 2) return;

  const len      = state.positions.length;
  const currentX = state.positions[len - 1];
  const prevX    = state.positions[len - 2];

  let left, width;

  if (type === 'overlap') {
    // 겹침: 현재 사각형 left ~ 직전 잔상 right
    left  = currentX;
    width = (prevX + RECT_SIZE) - currentX;
  } else {
    // 신규: 직전 잔상 right ~ 현재 사각형 right
    left  = prevX + RECT_SIZE;
    width = (currentX + RECT_SIZE) - (prevX + RECT_SIZE);
  }

  if (width <= 0) return;

  overlay.style.left  = left + 'px';
  overlay.style.width = width + 'px';
  overlay.className   = type === 'overlap' ? 'overlap' : 'new-area';

  state.isHighlighting = true;
  updateUI();

  highlightTimer = setTimeout(() => {
    overlay.classList.add('hidden');
    overlay.addEventListener('transitionend', () => {
      overlay.className = 'hidden';
      state.isHighlighting = false;
      updateUI();
    }, { once: true });
  }, HIGHLIGHT_MS);
}

/* ── Finish ────────────────────────────────────────── */
function showFinish() {
  const steps = state.positions.length - 1;
  finishStepEl.textContent = steps;
  finishScreen.classList.remove('hidden');
  updateUI();
}

function restart() {
  // 상태 초기화
  state.positions     = [];
  state.isAnimating   = false;
  state.isHighlighting = false;

  clearTimeout(highlightTimer);
  overlay.className = 'hidden';

  // ghost 제거
  stage.querySelectorAll('.ghost').forEach(el => el.remove());

  // 사각형 초기 위치
  setRectPosition(startX(), false);
  state.positions.push(startX());

  finishScreen.classList.add('hidden');
  updateUI();
}

/* ── Init ──────────────────────────────────────────── */
function init() {
  const x0 = startX();
  state.positions.push(x0);
  setRectPosition(x0, false);
  updateUI();
}

/* ── Events ────────────────────────────────────────── */
btnMove.addEventListener('click', move);
btnUndo.addEventListener('click', undo);
btnOverlap.addEventListener('click', () => showHighlight('overlap'));
btnNew.addEventListener('click', () => showHighlight('new'));
btnRestart.addEventListener('click', restart);

init();