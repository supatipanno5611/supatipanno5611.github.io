(function () {
  /* ========================================
     DOM References
     ======================================== */
  const viewport = document.getElementById('viewport');
  const grid = document.getElementById('viewport-grid');
  const outsideBtns = document.getElementById('outside-buttons');
  const sentinel = document.getElementById('scroll-sentinel');
  const ghost = document.getElementById('drag-ghost');
  const btnAllOn = document.getElementById('btn-all-on');
  const btnRandom = document.getElementById('btn-random');

  /* ========================================
     State
     ======================================== */
  const buttons = [];
  let nextId = 0;
  let textCleared = false;

  // Drag
  let drag = null;
  let longPressTimer = null;
  const LONG_PRESS_MS = 400;
  const MOVE_THRESHOLD = 10;
  const GHOST_HALF = 28; // half of 56px button

  /* ========================================
     Button Creation
     ======================================== */
  function makeButton(label, inViewport) {
    const id = nextId++;
    const el = document.createElement('button');
    el.className = 'toggle-btn';
    el.type = 'button';
    if (label) el.textContent = label;

    const rec = { id: id, el: el, on: false, inViewport: inViewport, label: label || null };
    buttons.push(rec);
    bindEvents(rec);
    return rec;
  }

  function findRecord(el) {
    return buttons.find(function (b) { return b.el === el; });
  }

  /* ========================================
     Toggle & Realization
     ======================================== */
  function toggle(rec) {
    rec.on = !rec.on;
    rec.el.classList.toggle('on', rec.on);
    checkRealized();
  }

  function checkRealized() {
    var allOn = buttons.length > 0 && buttons.every(function (b) { return b.on; });
    document.body.classList.toggle('realized', allOn);
  }

  /* ========================================
     Label Clearing
     ======================================== */
  function clearLabels() {
    if (textCleared) return;
    textCleared = true;
    buttons.forEach(function (b) {
      if (b.label) b.el.textContent = '';
    });
  }

  /* ========================================
     Drag & Drop
     ======================================== */
  function bindEvents(rec) {
    var el = rec.el;

    // Prevent native context menu on long press
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    // Touch
    el.addEventListener('touchstart', function (e) {
      var t = e.touches[0];
      beginPointerDown(rec, t.clientX, t.clientY);
    }, { passive: true });

    // Mouse
    el.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      e.preventDefault();
      beginPointerDown(rec, e.clientX, e.clientY);
    });
  }

  function beginPointerDown(rec, x, y) {
    clearTimeout(longPressTimer);

    drag = {
      record: rec,
      startX: x,
      startY: y,
      active: false
    };

    longPressTimer = setTimeout(function () {
      if (drag && drag.record === rec) {
        activateDrag(x, y);
      }
    }, LONG_PRESS_MS);
  }

  function activateDrag(x, y) {
    if (!drag) return;
    drag.active = true;
    drag.record.el.classList.add('dragging');

    // Show ghost
    ghost.hidden = false;
    ghost.className = drag.record.on ? 'on' : '';
    ghost.textContent = '';
    moveGhost(x, y);
  }

  function moveGhost(x, y) {
    ghost.style.left = (x - GHOST_HALF) + 'px';
    ghost.style.top = (y - GHOST_HALF) + 'px';
  }

  function isOverViewport(x, y) {
    var r = viewport.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  function endDrag(x, y) {
    clearTimeout(longPressTimer);
    if (!drag) return;

    var rec = drag.record;

    // Tap (no drag activated)
    if (!drag.active) {
      drag = null;
      toggle(rec);
      return;
    }

    // Finish drag
    rec.el.classList.remove('dragging');
    ghost.hidden = true;
    viewport.classList.remove('dragover');

    var over = isOverViewport(x, y);

    if (over && !rec.inViewport) {
      // Outside → viewport
      grid.appendChild(rec.el);
      rec.inViewport = true;
      clearLabels();
    } else if (!over && rec.inViewport) {
      // Viewport → outside
      outsideBtns.prepend(rec.el);
      rec.inViewport = false;
    }

    drag = null;
    checkRealized();
  }

  function cancelDrag() {
    clearTimeout(longPressTimer);
    if (drag && drag.active) {
      drag.record.el.classList.remove('dragging');
      ghost.hidden = true;
      viewport.classList.remove('dragover');
    }
    drag = null;
  }

  /* ========================================
     Global Pointer Listeners
     ======================================== */

  // --- Touch ---
  document.addEventListener('touchmove', function (e) {
    if (!drag) return;

    var t = e.touches[0];
    var x = t.clientX;
    var y = t.clientY;

    if (!drag.active) {
      // Check if user is scrolling
      var dx = x - drag.startX;
      var dy = y - drag.startY;
      if (Math.abs(dx) > MOVE_THRESHOLD || Math.abs(dy) > MOVE_THRESHOLD) {
        clearTimeout(longPressTimer);
        drag = null;
      }
      return;
    }

    // Active drag — prevent scroll, move ghost
    e.preventDefault();
    moveGhost(x, y);
    viewport.classList.toggle('dragover', isOverViewport(x, y));
  }, { passive: false });

  document.addEventListener('touchend', function (e) {
    if (!drag) return;
    var t = e.changedTouches[0];
    endDrag(t.clientX, t.clientY);
  });

  document.addEventListener('touchcancel', cancelDrag);

  // --- Mouse ---
  document.addEventListener('mousemove', function (e) {
    if (!drag) return;

    var x = e.clientX;
    var y = e.clientY;

    if (!drag.active) {
      var dx = x - drag.startX;
      var dy = y - drag.startY;
      if (Math.abs(dx) > MOVE_THRESHOLD || Math.abs(dy) > MOVE_THRESHOLD) {
        clearTimeout(longPressTimer);
        drag = null;
      }
      return;
    }

    e.preventDefault();
    moveGhost(x, y);
    viewport.classList.toggle('dragover', isOverViewport(x, y));
  });

  document.addEventListener('mouseup', function (e) {
    if (!drag) return;
    endDrag(e.clientX, e.clientY);
  });

  /* ========================================
     Infinite Scroll
     ======================================== */
  function spawnBatch(count) {
    for (var i = 0; i < count; i++) {
      var rec = makeButton(null, false);
      // Slight random margin for scattered look
      rec.el.style.marginTop = (Math.random() * 10) + 'px';
      rec.el.style.marginLeft = (Math.random() * 6) + 'px';
      outsideBtns.appendChild(rec.el);
    }
  }

  var scrollObserver = new IntersectionObserver(function (entries) {
    if (entries[0].isIntersecting) {
      spawnBatch(10);
    }
  }, { rootMargin: '400px' });

  scrollObserver.observe(sentinel);

  /* ========================================
     Floating Controls
     ======================================== */
  btnAllOn.addEventListener('click', function () {
    buttons.forEach(function (b) {
      if (!b.inViewport) {
        b.on = true;
        b.el.classList.add('on');
      }
    });
    checkRealized();
  });

  btnRandom.addEventListener('click', function () {
    buttons.forEach(function (b) {
      if (!b.inViewport) {
        b.on = Math.random() > 0.5;
        b.el.classList.toggle('on', b.on);
      }
    });
    checkRealized();
  });

  /* ========================================
     Initialization
     ======================================== */
  var initialLabels = ['용기', '시간', '노력', '사랑'];
  initialLabels.forEach(function (label) {
    var rec = makeButton(label, true);
    grid.appendChild(rec.el);
  });

  // Initial outside buttons
  spawnBatch(12);
})();