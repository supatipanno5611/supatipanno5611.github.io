(() => {
  'use strict';

  // ── State ──
  const buttons = [];
  let nextId = 0;
  let pressTimer = null;
  let pressStartX = 0;
  let pressStartY = 0;
  let pressTargetId = null;
  let isDragging = false;
  let dragId = null;
  let dragSourceLocation = null;

  const LONG_PRESS_MS = 400;
  const MOVE_THRESHOLD = 10;
  const SCROLL_BATCH = 20;

  // ── DOM refs ──
  const viewport = document.getElementById('viewport');
  const scrollArea = document.getElementById('scroll-area');
  const ghost = document.getElementById('drag-ghost');
  const btnAllOn = document.getElementById('btn-all-on');
  const btnRandom = document.getElementById('btn-random');

  // ── Helpers ──
  function genHash() {
    const c = '0123456789abcdef';
    let h = '0x';
    for (let i = 0; i < 8; i++) h += c[(Math.random() * 16) | 0];
    return h;
  }

  function createButton(location) {
    const btn = { id: nextId++, isOn: false, hash: genHash(), location };
    buttons.push(btn);
    return btn;
  }

  function findBtn(id) {
    return buttons.find(b => b.id === id);
  }

  // ── Rendering ──
  function renderBlock(btn) {
    const el = document.createElement('div');
    el.className = 'btn-block' + (btn.isOn ? ' on' : '');
    el.dataset.id = btn.id;
    el.innerHTML =
      '<span class="btn-hash">' + btn.hash + '</span>' +
      '<div class="toggle"><div class="knob"></div></div>';
    bindBlock(el);
    return el;
  }

  function syncBlockState(el, btn) {
    el.classList.toggle('on', btn.isOn);
  }

  function getBlockEl(id) {
    return document.querySelector('.btn-block[data-id="' + id + '"]');
  }

  // ── Initial render ──
  function init() {
    for (let i = 0; i < 4; i++) {
      const btn = createButton('viewport');
      viewport.appendChild(renderBlock(btn));
    }
    appendScrollBatch();
    scrollArea.addEventListener('scroll', onScroll);
    btnAllOn.addEventListener('click', doAllOn);
    btnRandom.addEventListener('click', doRandom);
  }

  function appendScrollBatch() {
    for (let i = 0; i < SCROLL_BATCH; i++) {
      const btn = createButton('scroll');
      scrollArea.appendChild(renderBlock(btn));
    }
  }

  // ── Infinite scroll ──
  function onScroll() {
    const sa = scrollArea;
    if (sa.scrollTop + sa.clientHeight >= sa.scrollHeight - 200) {
      appendScrollBatch();
    }
  }

  // ── Realization check ──
  function checkRealized() {
    const yes = buttons.every(b => b.isOn);
    document.body.classList.toggle('realized', yes);
  }

  // ── Tap / Long-press / Drag ──
  function bindBlock(el) {
    el.addEventListener('touchstart', onPointerDown, { passive: false });
    el.addEventListener('touchmove', onPointerMove, { passive: false });
    el.addEventListener('touchend', onPointerUp);
    el.addEventListener('touchcancel', onPointerUp);
    el.addEventListener('mousedown', onPointerDown);
  }

  function getXY(e) {
    if (e.touches && e.touches.length > 0) {
      return [e.touches[0].clientX, e.touches[0].clientY];
    }
    if (e.changedTouches && e.changedTouches.length > 0) {
      return [e.changedTouches[0].clientX, e.changedTouches[0].clientY];
    }
    return [e.clientX, e.clientY];
  }

  function blockFromEvent(e) {
    const el = e.target.closest('.btn-block');
    if (!el) return [null, null];
    return [el, parseInt(el.dataset.id)];
  }

  function onPointerDown(e) {
    const [el, id] = blockFromEvent(e);
    if (el === null || isDragging) return;

    const [x, y] = getXY(e);
    pressStartX = x;
    pressStartY = y;
    pressTargetId = id;

    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => startDrag(el, id, x, y), LONG_PRESS_MS);

    if (e.type === 'mousedown') {
      document.addEventListener('mousemove', onPointerMove);
      document.addEventListener('mouseup', onPointerUp);
    }
  }

  function onPointerMove(e) {
    const [x, y] = getXY(e);

    if (!isDragging) {
      const dx = x - pressStartX;
      const dy = y - pressStartY;
      if (dx * dx + dy * dy > MOVE_THRESHOLD * MOVE_THRESHOLD) {
        clearTimeout(pressTimer);
        pressTimer = null;
        pressTargetId = null;
      }
      return; // let browser handle scroll
    }

    // Dragging — prevent scroll, move ghost
    e.preventDefault();
    ghost.style.left = x - ghost._offsetX + 'px';
    ghost.style.top = y - ghost._offsetY + 'px';

    // Highlight viewport if pointer is over it
    const vr = viewport.getBoundingClientRect();
    viewport.classList.toggle('drop-target',
      x >= vr.left && x <= vr.right && y >= vr.top && y <= vr.bottom
    );
  }

  function onPointerUp(e) {
    clearTimeout(pressTimer);

    if (e.type === 'mouseup') {
      document.removeEventListener('mousemove', onPointerMove);
      document.removeEventListener('mouseup', onPointerUp);
    }

    if (isDragging) {
      endDrag(e);
      return;
    }

    // Tap — toggle
    if (pressTargetId !== null) {
      const [x, y] = getXY(e);
      const dx = x - pressStartX;
      const dy = y - pressStartY;
      if (dx * dx + dy * dy <= MOVE_THRESHOLD * MOVE_THRESHOLD) {
        const btn = findBtn(pressTargetId);
        if (btn) {
          btn.isOn = !btn.isOn;
          const el = getBlockEl(btn.id);
          if (el) syncBlockState(el, btn);
          checkRealized();
        }
      }
    }
    pressTargetId = null;
  }

  // ── Drag logic ──
  function startDrag(el, id, x, y) {
    isDragging = true;
    dragId = id;
    const btn = findBtn(id);
    dragSourceLocation = btn.location;

    // Create ghost from element
    const rect = el.getBoundingClientRect();
    ghost._offsetX = x - rect.left;
    ghost._offsetY = y - rect.top;
    ghost.innerHTML = el.outerHTML;
    ghost.style.width = rect.width + 'px';
    ghost.style.left = rect.left + 'px';
    ghost.style.top = rect.top + 'px';
    ghost.classList.remove('hidden');

    // Dim source
    el.classList.add('dragging-source');
  }

  function endDrag(e) {
    const [x, y] = getXY(e);
    const vr = viewport.getBoundingClientRect();
    const overViewport = x >= vr.left && x <= vr.right && y >= vr.top && y <= vr.bottom;

    const btn = findBtn(dragId);
    const srcEl = getBlockEl(dragId);

    if (btn && srcEl) {
      if (overViewport && btn.location === 'scroll') {
        // Scroll → viewport
        btn.location = 'viewport';
        srcEl.remove();
        viewport.appendChild(renderBlock(btn));
      } else if (!overViewport && btn.location === 'viewport') {
        // Viewport → scroll (insert at top)
        btn.location = 'scroll';
        srcEl.remove();
        const newEl = renderBlock(btn);
        scrollArea.insertBefore(newEl, scrollArea.firstChild);
      } else {
        // No change — restore
        srcEl.classList.remove('dragging-source');
      }
    }

    // Cleanup
    ghost.classList.add('hidden');
    ghost.innerHTML = '';
    viewport.classList.remove('drop-target');
    isDragging = false;
    dragId = null;
    dragSourceLocation = null;
    pressTargetId = null;
    checkRealized();
  }

  // ── Bottom controls ──
  function doAllOn() {
    buttons.forEach(b => {
      if (b.location === 'scroll') {
        b.isOn = true;
        const el = getBlockEl(b.id);
        if (el) syncBlockState(el, b);
      }
    });
    checkRealized();
  }

  function doRandom() {
    buttons.forEach(b => {
      if (b.location === 'scroll') {
        b.isOn = Math.random() < 0.5;
        const el = getBlockEl(b.id);
        if (el) syncBlockState(el, b);
      }
    });
    checkRealized();
  }

  // ── Go ──
  init();
})();