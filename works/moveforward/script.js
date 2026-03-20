// ─── Constants ────────────────────────────────────────────────────────────────

const ANIM_DURATION      = 300;   // ms — move/undo slide animation
const HIGHLIGHT_DURATION = 1500;  // ms — total highlight flash duration
const HIGHLIGHT_FADE_IN  = 200;   // ms — fade in period
const HIGHLIGHT_HOLD_END = 1000;  // ms — fade out starts here

// ─── State ────────────────────────────────────────────────────────────────────

const state = {
  moves: [],            // Array<{ fraction: number }> — history of each move
  currentFraction: 0.4, // slider value applied to next move
  activeHighlight: null, // { type: 'overlap' | 'new', startTime: number } | null
  animation: null,       // { fromX, toX, startTime } | null
  isFinished: false
};

// ─── Canvas ───────────────────────────────────────────────────────────────────

const canvas = document.getElementById('game-canvas');
const ctx    = canvas.getContext('2d');

// Returns layout constants derived from canvas size.
// Called every frame so resize is automatically handled.
function getLayout() {
  const W = canvas.width;
  const H = canvas.height;
  const squareW = Math.min(W * 0.14, 80);
  const squareH = squareW;
  const trackY  = (H - squareH) / 2;
  const startX  = squareW * 0.7;
  const finishX = W - squareW * 1.9;
  return { W, H, squareW, squareH, trackY, startX, finishX };
}

// Returns the pixel x position of the left edge of the square after `stepIndex` moves.
function getX(stepIndex, layout) {
  let x = layout.startX;
  for (let i = 0; i < stepIndex; i++) {
    x += state.moves[i].fraction * layout.squareW;
  }
  return x;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// Returns opacity (0–1) for the highlight flash at `elapsed` ms into the animation.
function highlightOpacity(elapsed) {
  if (elapsed < HIGHLIGHT_FADE_IN)  return elapsed / HIGHLIGHT_FADE_IN;
  if (elapsed < HIGHLIGHT_HOLD_END) return 1;
  if (elapsed < HIGHLIGHT_DURATION) return 1 - (elapsed - HIGHLIGHT_HOLD_END) / (HIGHLIGHT_DURATION - HIGHLIGHT_HOLD_END);
  return 0;
}

// ─── Button state ─────────────────────────────────────────────────────────────

function updateButtons() {
  const anim  = state.animation !== null;
  const empty = state.moves.length === 0;
  document.getElementById('btn-move').disabled    = anim || state.isFinished;
  document.getElementById('btn-undo').disabled    = anim || empty;
  document.getElementById('btn-overlap').disabled = anim || empty;
  document.getElementById('btn-new').disabled     = anim || empty;
}

// ─── Action handlers ──────────────────────────────────────────────────────────

function handleMove() {
  if (state.animation || state.isFinished) return;

  const layout   = getLayout();
  const fromX    = getX(state.moves.length, layout);
  let fraction   = state.currentFraction;
  let finished   = false;

  // Clamp if the move would overshoot the finish line.
  if (fromX + fraction * layout.squareW >= layout.finishX) {
    fraction = (layout.finishX - fromX) / layout.squareW;
    finished = true;
  }

  state.moves.push({ fraction });
  state.activeHighlight = null;
  state.animation = {
    fromX,
    toX: fromX + fraction * layout.squareW,
    startTime: performance.now()
  };
  if (finished) state.isFinished = true;
  updateButtons();
}

function handleUndo() {
  if (state.animation || state.moves.length === 0) return;

  const layout = getLayout();
  const fromX  = getX(state.moves.length, layout);
  state.moves.pop();
  const toX = getX(state.moves.length, layout);

  state.activeHighlight = null;
  state.isFinished      = false;
  state.animation = { fromX, toX, startTime: performance.now() };
  updateButtons();
}

function handleOverlap() {
  if (state.animation || state.moves.length === 0) return;
  state.activeHighlight = { type: 'overlap', startTime: performance.now() };
}

function handleNew() {
  if (state.animation || state.moves.length === 0) return;
  state.activeHighlight = { type: 'new', startTime: performance.now() };
}

// ─── Render loop ──────────────────────────────────────────────────────────────

function render(now) {
  requestAnimationFrame(render);

  const layout = getLayout();
  const { W, H, squareW, squareH, trackY, startX, finishX } = layout;

  // ── 1. Resolve current square x (lerped if animating) ──
  let currentX;
  if (state.animation) {
    const elapsed = now - state.animation.startTime;
    const t = Math.min(elapsed / ANIM_DURATION, 1);
    currentX = lerp(state.animation.fromX, state.animation.toX, easeInOut(t));
    if (t >= 1) {
      currentX        = state.animation.toX;
      state.animation = null;
      updateButtons();
    }
  } else {
    currentX = getX(state.moves.length, layout);
  }

  // ── 2. Clear ──
  ctx.clearRect(0, 0, W, H);

  // ── 3. Track background ──
  ctx.fillStyle = '#d8d4cc';
  ctx.fillRect(startX - 4, trackY - 4, finishX + squareW - startX + 8, squareH + 8);

  // ── 4. Start marker (dashed vertical line) ──
  ctx.strokeStyle = '#999';
  ctx.lineWidth   = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(startX, trackY - 12);
  ctx.lineTo(startX, trackY + squareH + 12);
  ctx.stroke();
  ctx.setLineDash([]);

  // ── 5. Finish line + checkered flag ──
  const lineX = finishX + squareW;

  ctx.strokeStyle = '#111';
  ctx.lineWidth   = 4;
  ctx.beginPath();
  ctx.moveTo(lineX, trackY - 20);
  ctx.lineTo(lineX, trackY + squareH + 20);
  ctx.stroke();

  const fs   = Math.max(6, Math.round(squareW * 0.13));
  const cols = 3;
  const rows = 3;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#111' : '#fff';
      ctx.fillRect(lineX + 4 + c * fs, trackY - 20 + r * fs, fs, fs);
    }
  }

  // ── 6. Ghosts (all previous positions) ──
  if (state.moves.length > 0) {
    ctx.strokeStyle = '#111';
    ctx.lineWidth   = 2;
    const ghostX = getX(state.moves.length - 1, layout);
    ctx.strokeRect(ghostX + 1, trackY + 1, squareW - 2, squareH - 2);
  }

  // ── 7. Current square ──
  ctx.strokeStyle = '#111';
  ctx.lineWidth   = 2;
  ctx.strokeRect(currentX + 1, trackY + 1, squareW - 2, squareH - 2);

  // ── 8. Highlight flash (drawn on top of current square) ──
  if (state.activeHighlight && state.moves.length > 0) {
    const elapsed = now - state.activeHighlight.startTime;

    if (elapsed >= HIGHLIGHT_DURATION) {
      state.activeHighlight = null;
    } else {
      const opacity     = highlightOpacity(elapsed);
      const lastGhostX  = getX(state.moves.length - 1, layout);

      ctx.globalAlpha = opacity;

      if (state.activeHighlight.type === 'overlap') {
        // Overlap region: left part of current square that shares space with the last ghost.
        // x range: [currentX  …  lastGhostX + squareW]
        const ox = currentX;
        const ow = lastGhostX + squareW - currentX;
        if (ow > 0) {
          ctx.fillStyle   = '#111';
          ctx.fillRect(ox, trackY, ow, squareH);
          ctx.strokeStyle = '#d92020';
          ctx.lineWidth   = 3;
          ctx.strokeRect(ox + 1.5, trackY + 1.5, ow - 3, squareH - 3);
        }
      } else {
        // New region: right part of current square that goes beyond the last ghost.
        // x range: [lastGhostX + squareW  …  currentX + squareW]
        const nx = lastGhostX + squareW;
        const nw = currentX + squareW - nx;
        if (nw > 0) {
          ctx.fillStyle   = '#fff';
          ctx.fillRect(nx, trackY, nw, squareH);
          ctx.strokeStyle = '#1a9e3f';
          ctx.lineWidth   = 3;
          ctx.strokeRect(nx + 1.5, trackY + 1.5, nw - 3, squareH - 3);
        }
      }

      ctx.globalAlpha = 1;
    }
  }

  // ── 9. Finish overlay ──
  if (state.isFinished && !state.animation) {
    ctx.fillStyle = 'rgba(240, 237, 232, 0.88)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle    = '#111';
    ctx.font         = `bold ${Math.round(squareW * 0.85)}px "IBM Plex Mono", monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FINISH!', W / 2, H / 2);
  }
}

// ─── Canvas resize ────────────────────────────────────────────────────────────

function resizeCanvas() {
  const w = canvas.parentElement.clientWidth;
  const h = Math.round(w * 0.38);
  canvas.width  = w;
  canvas.height = h;
  // Stale pixel positions in animation: snap to end.
  if (state.animation) {
    state.animation = null;
    updateButtons();
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.getElementById('btn-move').addEventListener('click', handleMove);
document.getElementById('btn-undo').addEventListener('click', handleUndo);
document.getElementById('btn-overlap').addEventListener('click', handleOverlap);
document.getElementById('btn-new').addEventListener('click', handleNew);

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
requestAnimationFrame(render);