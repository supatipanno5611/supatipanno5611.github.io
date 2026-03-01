'use strict';

/* ═══════════════════════════════════════════════
   FOCUS — 카메라 초점 시뮬레이터  ·  script.js
═══════════════════════════════════════════════ */

/* ─── 레이어 설정 ───────────────────────────── */
const LAYERS = {
  bg:  { focusDist: 8.5, barPos: 0.87 },
  mid: { focusDist: 5.0, barPos: 0.46 },
  fg:  { focusDist: 1.5, barPos: 0.10 },
};

/* ─── 조리개 스탑 ───────────────────────────── */
const APERTURE_STOPS = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16];
const APERTURE_COUNT = APERTURE_STOPS.length;

/* ─── blur 계수 ─────────────────────────────── */
const BLUR_SCALE    = 2.8;
const BLUR_MULT_MAX = 3.0;
const BLUR_MULT_MIN = 0.25;

/* ─── AF 히스테리시스 임계값 ──────────────────── */
const AF_ENTER = 0.7;
const AF_EXIT  = 1.4;

/* ─── 포커스 슬라이더 raw 범위 ────────────────── */
const FOCUS_RAW_MAX = 1000;


/* ═══════════════════════════════════════════════
   앱 상태
═══════════════════════════════════════════════ */
const S = {
  focusValue:      8.5,
  apertureIdx:     0,
  afActive:        { bg: false, mid: false, fg: false },
  prevApertureIdx: -1,
  focusRafId:      null,
};


/* ═══════════════════════════════════════════════
   DOM 참조
═══════════════════════════════════════════════ */
const D = {};

function initDOM() {
  D.lBg  = document.getElementById('layer-bg');
  D.lMid = document.getElementById('layer-mid');
  D.lFg  = document.getElementById('layer-fg');

  D.bokeh = document.querySelectorAll('.bokeh');

  D.afBg  = document.getElementById('af-bg');
  D.afMid = document.getElementById('af-mid');
  D.afFg  = document.getElementById('af-fg');

  D.hudApt    = document.getElementById('hud-aperture');
  D.hudDist   = document.getElementById('hud-distance');
  D.hudAfText = document.getElementById('hud-af-text');
  D.hudAfWrap = D.hudAfText.parentElement;

  D.dofRange  = document.getElementById('dof-range');
  D.dofMarker = document.getElementById('dof-focus-marker');
  D.dofFgDot  = document.getElementById('dof-fg-dot');
  D.dofMidDot = document.getElementById('dof-mid-dot');
  D.dofBgDot  = document.getElementById('dof-bg-dot');

  D.sliderFocus    = document.getElementById('slider-focus');
  D.sliderAperture = document.getElementById('slider-aperture');

  D.labelDistance = document.getElementById('label-distance');
  D.labelAperture = document.getElementById('label-aperture');

  D.aptStopSpans = document.querySelectorAll('.aperture-stops span');

  D.vf = document.getElementById('viewfinder');
}


/* ═══════════════════════════════════════════════
   수학 유틸리티
═══════════════════════════════════════════════ */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp  = (a, b, t) => a + (b - a) * t;

function rawToFocusValue(raw) {
  return (raw / FOCUS_RAW_MAX) * 10;
}

function focusValueToRaw(val) {
  return Math.round((val / 10) * FOCUS_RAW_MAX);
}

function valueToDistance(val) {
  if (val >= 9.5) return '∞';
  if (val >= 8.0) return Math.round(lerp(5, 30, (val - 8) / 1.5)) + 'm';
  if (val >= 6.0) return lerp(2,   5,   (val - 6) / 2).toFixed(1) + 'm';
  if (val >= 4.0) return lerp(1,   2,   (val - 4) / 2).toFixed(1) + 'm';
  if (val >= 2.0) return lerp(0.5, 1,   (val - 2) / 2).toFixed(1) + 'm';
  if (val >= 0.5) return lerp(0.3, 0.5, (val - 0.5) / 1.5).toFixed(2) + 'm';
  return '0.3m';
}

function aptToMult(idx) {
  const t = idx / (APERTURE_COUNT - 1);
  return lerp(BLUR_MULT_MAX, BLUR_MULT_MIN, t);
}

function computeBlur(fv, ai, dist) {
  return Math.abs(fv - dist) * aptToMult(ai) * BLUR_SCALE;
}

function blurFilter(px) {
  const b   = Math.max(0, px);
  const sat = Math.max(0.4, 1 - b * 0.03);
  const bri = Math.min(1.3, 1 + b * 0.015);
  return `blur(${b.toFixed(2)}px) saturate(${sat.toFixed(2)}) brightness(${bri.toFixed(2)})`;
}

function aptToDofWidth(idx) {
  return lerp(0.04, 0.58, idx / (APERTURE_COUNT - 1));
}

function updateFocusTrackPct(raw) {
  const pct = (raw / FOCUS_RAW_MAX * 100).toFixed(1) + '%';
  D.sliderFocus.style.setProperty('--pct', pct);
}

function updateApertureTrackPct(idx) {
  const pct = (idx / (APERTURE_COUNT - 1) * 100).toFixed(1) + '%';
  D.sliderAperture.style.setProperty('--pct', pct);
}


/* ═══════════════════════════════════════════════
   슬라이더 이벤트
═══════════════════════════════════════════════ */

function setupSliderEvents() {

  D.sliderFocus.addEventListener('input', () => {
    if (S.focusRafId) {
      cancelAnimationFrame(S.focusRafId);
      S.focusRafId = null;
    }
    const raw = parseInt(D.sliderFocus.value, 10);
    S.focusValue = rawToFocusValue(raw);
    updateFocusTrackPct(raw);
    haptic([5]);
    render();
  });

  D.sliderAperture.addEventListener('input', () => {
    const idx = parseInt(D.sliderAperture.value, 10);
    if (idx !== S.prevApertureIdx) {
      S.apertureIdx     = idx;
      S.prevApertureIdx = idx;
      updateApertureTrackPct(idx);
      haptic([10, 20, 10]);
      render();
    }
  });
}


/* ═══════════════════════════════════════════════
   AF 포인트 탭 → 자동 초점 이동 (easeOut 애니메이션)
═══════════════════════════════════════════════ */

function autoFocus(layerKey) {
  const targetVal = LAYERS[layerKey].focusDist;

  if (S.focusRafId) {
    cancelAnimationFrame(S.focusRafId);
    S.focusRafId = null;
  }

  const startVal  = S.focusValue;
  const startTime = performance.now();
  const DURATION  = 400;

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function step(now) {
    const t       = clamp((now - startTime) / DURATION, 0, 1);
    S.focusValue  = lerp(startVal, targetVal, easeOut(t));

    const raw = focusValueToRaw(S.focusValue);
    D.sliderFocus.value = raw;
    updateFocusTrackPct(raw);

    render();

    if (t < 1) {
      S.focusRafId = requestAnimationFrame(step);
    } else {
      S.focusValue = targetVal;
      S.focusRafId = null;
      haptic([15, 40, 15]);
    }
  }

  S.focusRafId = requestAnimationFrame(step);
}

function setupAFEvents() {
  [
    [D.afBg,  'bg'],
    [D.afMid, 'mid'],
    [D.afFg,  'fg'],
  ].forEach(([el, key]) => {
    el.addEventListener('click', () => autoFocus(key));
    el.addEventListener('touchstart', e => {
      e.preventDefault();
      autoFocus(key);
    }, { passive: false });
  });
}


/* ═══════════════════════════════════════════════
   햅틱
═══════════════════════════════════════════════ */

function haptic(pattern = [8]) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}


/* ═══════════════════════════════════════════════
   메인 렌더
═══════════════════════════════════════════════ */

function render() {
  const fv = S.focusValue;
  const ai = S.apertureIdx;

  // 1. 레이어별 blur
  const blurs = {
    bg:  computeBlur(fv, ai, LAYERS.bg.focusDist),
    mid: computeBlur(fv, ai, LAYERS.mid.focusDist),
    fg:  computeBlur(fv, ai, LAYERS.fg.focusDist),
  };

  D.lBg.style.filter  = blurFilter(blurs.bg);
  D.lMid.style.filter = blurFilter(blurs.mid);
  D.lFg.style.filter  = blurFilter(blurs.fg);

  // 2. 보케 빛망울
  const apertureOpenness = 1 - ai / (APERTURE_COUNT - 1);
  const bokehStr = (blurs.bg / 20) * apertureOpenness;
  D.bokeh.forEach(circle => {
    const baseR  = parseFloat(circle.getAttribute('data-base-r')) || 6;
    const newR   = baseR + bokehStr * 22;
    const newOpa = clamp(0.12 + bokehStr * 0.78, 0, 0.92);
    circle.setAttribute('r', newR.toFixed(1));
    circle.style.opacity = newOpa.toFixed(2);
  });

  // 3. AF 포인트
  checkAF(D.afBg,  'bg',  blurs.bg);
  checkAF(D.afMid, 'mid', blurs.mid);
  checkAF(D.afFg,  'fg',  blurs.fg);

  // 4. AF 상태 텍스트 (하단 HUD)
  const locked    = Object.values(S.afActive).some(Boolean);
  const lockedKey = Object.entries(S.afActive).find(([, v]) => v)?.[0];
  const nameMap   = { bg: '배경', mid: '중경', fg: '전경' };

  D.hudAfText.textContent = locked
    ? `${nameMap[lockedKey]} 초점 맞음`
    : '초점 탐색 중';
  D.hudAfWrap.classList.toggle('is-locked', locked);

  // 5. HUD & 슬라이더 값 레이블
  const distStr = valueToDistance(fv);
  const aptStr  = String(APERTURE_STOPS[ai]);

  D.hudApt.textContent        = aptStr;
  D.hudDist.textContent       = distStr;
  D.labelDistance.textContent = distStr;
  D.labelAperture.textContent = `f / ${aptStr}`;

  // 6. 조리개 스탑 라벨 강조
  D.aptStopSpans.forEach((span, i) => {
    span.classList.toggle('is-active', i === ai);
  });

  // 7. DOF 인디케이터
  updateDOF(fv, ai, blurs);
}


/* ─── AF 히스테리시스 체크 ──────────────────── */

function checkAF(el, key, blurPx) {
  const was = S.afActive[key];

  if (!was && blurPx < AF_ENTER) {
    S.afActive[key] = true;
    el.classList.add('is-active');
    el.classList.remove('is-locking');
    void el.offsetWidth;
    el.classList.add('is-locking');
    setTimeout(() => el.classList.remove('is-locking'), 400);
    haptic([8, 40, 8]);

  } else if (was && blurPx > AF_EXIT) {
    S.afActive[key] = false;
    el.classList.remove('is-active', 'is-locking');
  }
}


/* ─── DOF 인디케이터 ────────────────────────── */

function updateDOF(fv, ai, blurs) {
  const markerPos = fv / 10;
  D.dofMarker.style.left = (markerPos * 100).toFixed(1) + '%';

  const rw    = aptToDofWidth(ai);
  const rLeft = clamp(markerPos - rw / 2, 0, 1);
  const rW    = clamp(markerPos + rw / 2, 0, 1) - rLeft;
  D.dofRange.style.left  = (rLeft * 100).toFixed(1) + '%';
  D.dofRange.style.width = (rW    * 100).toFixed(1) + '%';

  [[D.dofFgDot, 'fg'], [D.dofMidDot, 'mid'], [D.dofBgDot, 'bg']].forEach(([el, k]) => {
    el.classList.toggle('in-range', blurs[k] < AF_EXIT);
  });
}


/* ═══════════════════════════════════════════════
   온보딩 힌트
═══════════════════════════════════════════════ */

function showHint() {
  const h = document.createElement('div');
  h.className = 'onboarding-hint';
  h.textContent = '슬라이더를 움직이거나 피사체를 탭해보세요';
  D.vf.appendChild(h);
  setTimeout(() => h.parentNode && h.parentNode.removeChild(h), 3800);
}


/* ═══════════════════════════════════════════════
   초기화
═══════════════════════════════════════════════ */

function init() {
  initDOM();
  setupSliderEvents();
  setupAFEvents();

  D.sliderFocus.value    = focusValueToRaw(S.focusValue);
  D.sliderAperture.value = S.apertureIdx;

  updateFocusTrackPct(parseInt(D.sliderFocus.value, 10));
  updateApertureTrackPct(S.apertureIdx);

  render();
  showHint();
}

document.addEventListener('DOMContentLoaded', init);
