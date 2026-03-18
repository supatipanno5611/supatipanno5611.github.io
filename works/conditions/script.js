(() => {
  'use strict';

  // ── State ──
  const buttons = [];
  let nextId = 0;
  let isDragging = false;
  let dragId = null;

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

  function getBlockEl(id) {
    return document.querySelector('.btn-block[data-id="' + id + '"]');
  }

  function syncBlockState(el, btn) {
    el.classList.toggle('on', btn.isOn);
  }

  // ── Rendering ──
  function renderBlock(btn) {
    const el = document.createElement('div');
    el.className = 'btn-block' + (btn.isOn ? ' on' : '');
    el.dataset.id = btn.id;
    el.innerHTML =
      '<div class="drag-handle">︙</div>' +
      '<span class="btn-hash">' + btn.hash + '</span>' +
      '<div class="toggle"><div class="knob"></div></div>';

    // Toggle: tap on toggle area
    el.querySelector('.toggle').addEventListener('click', () => {
      btn.isOn = !btn.isOn;
      syncBlockState(el, btn);
      checkRealized();
    });

    // Drag: handle only
    const handle = el.querySelector('.drag-handle');
    handle.addEventListener('touchstart', onDragStart, { passive: false });
    handle.addEventListener('mousedown', onDragStart);

    return el;
  }

  // ── Init ──
  function init() {
    for (let i = 0; i < 4; i++) {
      viewport.appendChild(renderBlock(createButton('viewport')));
    }
    appendScrollBatch();
    scrollArea.addEventListener('scroll', onScroll);
    btnAllOn.addEventListener('click', doAllOn);
    btnRandom.addEventListener('click', doRandom);
  }

  function appendScrollBatch() {
    for (let i = 0; i < SCROLL_BATCH; i++) {
      scrollArea.appendChild(renderBlock(createButton('scroll')));
    }
  }

  // ── Infinite scroll ──
  function onScroll() {
    if (scrollArea.scrollTop + scrollArea.clientHeight >= scrollArea.scrollHeight - 200) {
      appendScrollBatch();
    }
  }

  // ── Realization ──
  function checkRealized() {
    document.body.classList.toggle('realized', buttons.every(b => b.isOn));
  }

  // ── Drag ──
  function getXY(e) {
    if (e.touches && e.touches.length > 0) return [e.touches[0].clientX, e.touches[0].clientY];
    if (e.changedTouches && e.changedTouches.length > 0) return [e.changedTouches[0].clientX, e.changedTouches[0].clientY];
    return [e.clientX, e.clientY];
  }

  function onDragStart(e) {
    e.preventDefault();
    if (isDragging) return;

    const el = e.target.closest('.btn-block');
    if (!el) return;
    const id = parseInt(el.dataset.id);
    const [x, y] = getXY(e);

    isDragging = true;
    dragId = id;

    const rect = el.getBoundingClientRect();
    ghost._offsetX = x - rect.left;
    ghost._offsetY = y - rect.top;
    ghost.innerHTML = el.outerHTML;
    ghost.style.width = rect.width + 'px';
    ghost.style.left = rect.left + 'px';
    ghost.style.top = rect.top + 'px';
    ghost.classList.remove('hidden');

    el.classList.add('dragging-source');

    if (e.type === 'touchstart') {
      document.addEventListener('touchmove', onDragMove, { passive: false });
      document.addEventListener('touchend', onDragEnd);
      document.addEventListener('touchcancel', onDragEnd);
    } else {
      document.addEventListener('mousemove', onDragMove);
      document.addEventListener('mouseup', onDragEnd);
    }
  }

  function onDragMove(e) {
    e.preventDefault();
    const [x, y] = getXY(e);
    ghost.style.left = x - ghost._offsetX + 'px';
    ghost.style.top = y - ghost._offsetY + 'px';

    const vr = viewport.getBoundingClientRect();
    viewport.classList.toggle('drop-target',
      x >= vr.left && x <= vr.right && y >= vr.top && y <= vr.bottom
    );
  }

  function onDragEnd(e) {
    if (e.type === 'touchend' || e.type === 'touchcancel') {
      document.removeEventListener('touchmove', onDragMove);
      document.removeEventListener('touchend', onDragEnd);
      document.removeEventListener('touchcancel', onDragEnd);
    } else {
      document.removeEventListener('mousemove', onDragMove);
      document.removeEventListener('mouseup', onDragEnd);
    }

    const [x, y] = getXY(e);
    const vr = viewport.getBoundingClientRect();
    const overViewport = x >= vr.left && x <= vr.right && y >= vr.top && y <= vr.bottom;

    const btn = findBtn(dragId);
    const srcEl = getBlockEl(dragId);

    if (btn && srcEl) {
      if (overViewport && btn.location === 'scroll') {
        btn.location = 'viewport';
        srcEl.remove();
        viewport.appendChild(renderBlock(btn));
      } else if (!overViewport && btn.location === 'viewport') {
        btn.location = 'scroll';
        srcEl.remove();
        scrollArea.insertBefore(renderBlock(btn), scrollArea.firstChild);
      } else {
        srcEl.classList.remove('dragging-source');
      }
    }

    ghost.classList.add('hidden');
    ghost.innerHTML = '';
    viewport.classList.remove('drop-target');
    isDragging = false;
    dragId = null;
    checkRealized();
  }

  // ── Bottom controls ──
  function doAllOn() {
    const scrollBtns = buttons.filter(b => b.location === 'scroll');
    const allOn = scrollBtns.every(b => b.isOn);
    const target = !allOn;
    scrollBtns.forEach(b => {
      b.isOn = target;
      const el = getBlockEl(b.id);
      if (el) syncBlockState(el, b);
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

  init();
})();