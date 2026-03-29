// ── DATA ──────────────────────────────────────────────────────────────
const PARTS = [
  { id: 'head',     label: '머리',     sub: 'head',        interp: '물항아리',       interpSub: 'water jar'   },
  { id: 'ear',      label: '귀',       sub: 'ear',         interp: '키질하는 바구니', interpSub: 'winnow'      },
  { id: 'tusk',     label: '상아',     sub: 'tusk',        interp: '쟁기',           interpSub: 'plough'      },
  { id: 'trunk',    label: '코',       sub: 'trunk',       interp: '쟁기막대',       interpSub: 'plough beam' },
  { id: 'body',     label: '몸통',     sub: 'body',        interp: '창고',           interpSub: 'storehouse'  },
  { id: 'leg',      label: '다리',     sub: 'leg',         interp: '기둥',           interpSub: 'pillar'      },
  { id: 'thigh',    label: '허벅지',   sub: 'thigh',       interp: '절구',           interpSub: 'mortar'      },
  { id: 'tail',     label: '꼬리',     sub: 'tail',        interp: '곤봉',           interpSub: 'club'        },
  { id: 'tailtuft', label: '꼬리의 술', sub: 'tail tuft',  interp: '빗자루',         interpSub: 'broom'       },
];

// ── STATE ─────────────────────────────────────────────────────────────
const unlocked = new Set();   // part ids that have been tapped
const percState = {};         // id → bool (perception layer visible)
const interpState = {};       // id → bool (interpretation layer visible)

// ── DOM REFS ──────────────────────────────────────────────────────────
const stage       = document.getElementById('stage');
const stageHint   = document.getElementById('stage-hint');
const panelEmpty  = document.getElementById('panel-empty');
const globalToggles = document.getElementById('global-toggles');
const colHeaders  = document.getElementById('col-headers');
const panelRows   = document.getElementById('panel-rows');
const btnAllPerc  = document.getElementById('btn-all-perception');
const btnAllInterp= document.getElementById('btn-all-interp');

// ── LOAD SVG INLINE ───────────────────────────────────────────────────
fetch('elephant.svg')
  .then(r => r.text())
  .then(svgText => {
    stage.insertAdjacentHTML('afterbegin', svgText);
    initHitAreas();
  });

// ── INIT HIT AREAS ────────────────────────────────────────────────────
function initHitAreas() {
  PARTS.forEach(part => {
    const hit = document.getElementById('hit-' + part.id);
    if (!hit) return;
    hit.addEventListener('click', () => unlock(part.id));
    hit.addEventListener('touchend', e => { e.preventDefault(); unlock(part.id); });
  });
}

// ── UNLOCK ────────────────────────────────────────────────────────────
function unlock(id) {
  if (unlocked.has(id)) return;
  unlocked.add(id);

  // show perception layer, hide outline
  percState[id] = true;
  interpState[id] = false;
  applyLayerVisibility(id);

  const hit = document.getElementById('hit-' + id);
  if (hit) hit.classList.add('unlocked');

  const outline = document.getElementById('outline-' + id);
  if (outline) outline.style.opacity = '0';

  // update panel
  panelEmpty.style.display = 'none';
  colHeaders.classList.add('visible');
  addPanelRow(id);
  checkScrollThreshold();

  // hide hint after first unlock
  if (unlocked.size === 1) stageHint.style.opacity = '0';
}

// ── LAYER VISIBILITY ──────────────────────────────────────────────────
function applyLayerVisibility(id) {
  const layerEl  = document.getElementById('layer-'  + id);
  const interpEl = document.getElementById('interp-' + id);
  if (layerEl)  layerEl.style.opacity  = percState[id]   ? '1' : '0';
  if (interpEl) interpEl.style.opacity = interpState[id] ? '0.85' : '0';
}

// ── ADD PANEL ROW ─────────────────────────────────────────────────────
function addPanelRow(id) {
  const part = PARTS.find(p => p.id === id);
  const row = document.createElement('div');
  row.className = 'panel-row';
  row.dataset.id = id;

  row.innerHTML = `
    <div class="cell">
      <label class="cb-wrap perception">
        <input type="checkbox" checked data-id="${id}" data-type="perc"/>
        <span class="cb-box"></span>
        <span class="cb-label">
          <span class="part-name">${part.label}</span>
          <span class="part-sub">${part.sub}</span>
        </span>
      </label>
    </div>
    <div class="cell">
      <label class="cb-wrap interpretation">
        <input type="checkbox" data-id="${id}" data-type="interp"/>
        <span class="cb-box"></span>
        <span class="cb-label">
          <span class="part-name">${part.interp}</span>
          <span class="part-sub">${part.interpSub}</span>
        </span>
      </label>
    </div>
  `;

  panelRows.appendChild(row);

  row.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const pid = cb.dataset.id;
      const type = cb.dataset.type;
      if (type === 'perc') {
        percState[pid] = cb.checked;
      } else {
        interpState[pid] = cb.checked;
      }
      applyLayerVisibility(pid);
    });
  });
}

// ── SCROLL THRESHOLD ──────────────────────────────────────────────────
// Show global toggles once panel content is taller than panel-rows container
function checkScrollThreshold() {
  const rowsEl = panelRows;
  const needsScroll = rowsEl.scrollHeight > rowsEl.clientHeight;
  globalToggles.classList.toggle('visible', needsScroll);
}

// recalculate on resize
window.addEventListener('resize', checkScrollThreshold);

// ── GLOBAL TOGGLES ────────────────────────────────────────────────────
btnAllPerc.addEventListener('click', () => {
  // if any are on, turn all off; if all off, turn all on
  const anyOn = [...unlocked].some(id => percState[id]);
  unlocked.forEach(id => {
    percState[id] = !anyOn;
    applyLayerVisibility(id);
  });
  syncCheckboxes('perc');
});

btnAllInterp.addEventListener('click', () => {
  const anyOn = [...unlocked].some(id => interpState[id]);
  unlocked.forEach(id => {
    interpState[id] = !anyOn;
    applyLayerVisibility(id);
  });
  syncCheckboxes('interp');
});

function syncCheckboxes(type) {
  document.querySelectorAll(`input[data-type="${type}"]`).forEach(cb => {
    const id = cb.dataset.id;
    cb.checked = type === 'perc' ? percState[id] : interpState[id];
  });
}