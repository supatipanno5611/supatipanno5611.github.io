let QUOTES = [];

async function loadQuotes() {
  const r = await fetch('./quotes.json');
  QUOTES = await r.json();
}

let currentQuote = null;
let words = [];
let highlighted = null;
let hoverCache = {};
let history = [];
let busy = false;

const quoteWrap = document.getElementById('quote-wrap');
const authorEl  = document.getElementById('author');
const trail     = document.getElementById('trail');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function wordKey(w) {
  return w.replace(/[^a-zA-Z'-]/g, '').toLowerCase();
}

function fetchRandom() {
  const pool = QUOTES.filter(q => q.content.length >= 40 && q.content.length <= 120);
  return pool[Math.floor(Math.random() * pool.length)];
}

function fetchByWord(word) {
  const key = wordKey(word);
  if (!key || key.length < 3) return null;
  const re = new RegExp(`\\b${key}\\b`, 'i');
  const matches = QUOTES.filter(q => re.test(q.content) && q._id !== currentQuote?._id);
  if (matches.length === 0) return null;
  return matches[Math.floor(Math.random() * matches.length)];
}

const cursor = document.getElementById('cursor');

async function typeQuote(quote, highlightWord) {
  const text = quote.content;
  const rawWords = text.split(' ');

  [...quoteWrap.querySelectorAll('.word')].forEach(n => n.remove());
  cursor.className = 'typing';
  quoteWrap.appendChild(cursor);

  const spanMap = [];

  for (let wi = 0; wi < rawWords.length; wi++) {
    const w = rawWords[wi];
    const span = document.createElement('span');
    span.className = 'word';
    span.dataset.index = wi;
    span.dataset.word = w;
    spanMap.push({ span, full: w });

    quoteWrap.insertBefore(span, cursor);

    for (let ci = 0; ci < w.length; ci++) {
      span.textContent = w.slice(0, ci + 1);
      await sleep(28 + Math.random() * 22);
    }

    if (wi < rawWords.length - 1) await sleep(18);
  }

  cursor.className = '';

  spanMap.forEach(({ span, full }, i) => {
    attachWordEvents(span, full, i);
  });

  if (highlightWord) {
    const re = new RegExp(`^${wordKey(highlightWord)}`, 'i');
    spanMap.forEach(({ span, full }) => {
      if (re.test(wordKey(full))) {
        span.classList.add('highlighted');
        highlighted = span;
      }
    });
  }

  return spanMap;
}

function attachWordEvents(span, word, index) {
  const key = wordKey(word);

  span.addEventListener('mouseenter', () => {
    if (busy) return;
    if (key.length < 3) { markDisabled(span); return; }
    if (hoverCache[key] !== undefined) {
      if (!hoverCache[key]) markDisabled(span);
      return;
    }
    const q = fetchByWord(word);
    hoverCache[key] = q;
    if (!q) markDisabled(span);
  });

  span.addEventListener('click', () => {
    if (busy) return;
    if (span.classList.contains('disabled')) {
      span.classList.add('shake');
      span.addEventListener('animationend', () => span.classList.remove('shake'), { once: true });
      return;
    }
    const q = hoverCache[key] !== undefined ? hoverCache[key] : fetchByWord(word);
    hoverCache[key] = q;
    if (!q) { markDisabled(span); return; }
    doTransition(span, word, q);
  });
}

function markDisabled(span) {
  span.classList.add('disabled');
  span.style.cursor = 'default';
}

async function doTransition(clickedSpan, clickedWord, newQuote) {
  busy = true;

  if (currentQuote) {
    history.push({ word: clickedWord, quote: currentQuote });
    renderTrail();
  }

  clickedSpan.classList.add('highlighted');
  highlighted = clickedSpan;

  authorEl.classList.remove('visible');
  authorEl.textContent = '';

  const allSpans = [...quoteWrap.querySelectorAll('.word')];
  const clickedIndex = allSpans.indexOf(clickedSpan);

  allSpans.forEach(s => s.style.pointerEvents = 'none');
  cursor.className = 'typing hidden';

  const rightSpans = allSpans.slice(clickedIndex + 1);
  await deleteSpans(rightSpans);

  quoteWrap.insertBefore(cursor, clickedSpan);
  cursor.className = 'typing';
  await sleep(80);

  const leftSpans = allSpans.slice(0, clickedIndex).reverse();
  await deleteSpans(leftSpans);

  await sleep(320);

  currentQuote = newQuote;
  hoverCache = {};

  cursor.className = 'typing hidden';
  quoteWrap.appendChild(cursor);

  await typeQuoteAround(newQuote, clickedWord, clickedSpan);

  await sleep(500);
  authorEl.textContent = `— ${newQuote.author}`;
  authorEl.classList.add('visible');

  busy = false;
}

async function deleteSpans(spans) {
  for (const span of spans) {
    const text = span.textContent;
    for (let i = text.length; i > 0; i--) {
      span.textContent = text.slice(0, i - 1);
      await sleep(22 + Math.random() * 18);
    }
    span.remove();
  }
}

async function typeQuoteAround(quote, anchorWord, anchorSpan) {
  const rawWords = quote.content.split(' ');

  const re = new RegExp(`^${wordKey(anchorWord)}`, 'i');
  let anchorIndex = rawWords.findIndex(w => re.test(wordKey(w)));
  if (anchorIndex === -1) anchorIndex = 0;

  for (let i = 0; i < anchorIndex; i++) {
    const span = document.createElement('span');
    span.className = 'word';
    span.dataset.word = rawWords[i];
    quoteWrap.insertBefore(span, anchorSpan);

    for (let ci = 0; ci < rawWords[i].length; ci++) {
      span.textContent = rawWords[i].slice(0, ci + 1);
      await sleep(28 + Math.random() * 22);
    }
    attachWordEvents(span, rawWords[i], i);
    await sleep(16);
  }

  anchorSpan.textContent = rawWords[anchorIndex] || anchorWord;
  attachWordEvents(anchorSpan, rawWords[anchorIndex] || anchorWord, anchorIndex);

  cursor.className = 'typing';
  quoteWrap.insertBefore(cursor, anchorSpan.nextSibling);

  for (let i = anchorIndex + 1; i < rawWords.length; i++) {
    const span = document.createElement('span');
    span.className = 'word';
    span.dataset.word = rawWords[i];
    quoteWrap.insertBefore(span, cursor);

    for (let ci = 0; ci < rawWords[i].length; ci++) {
      span.textContent = rawWords[i].slice(0, ci + 1);
      await sleep(28 + Math.random() * 22);
    }
    attachWordEvents(span, rawWords[i], i);
    await sleep(16);
  }

  quoteWrap.appendChild(cursor);
  cursor.className = '';

  await sleep(200);
  anchorSpan.classList.remove('highlighted');
}

function renderTrail() {
  trail.innerHTML = '';
  if (history.length === 0) { trail.classList.remove('has-items'); return; }
  trail.classList.add('has-items');

  history.forEach((item, i) => {
    if (i > 0) {
      const sep = document.createElement('span');
      sep.className = 'trail-sep';
      sep.textContent = '›';
      trail.appendChild(sep);
    }
    const el = document.createElement('span');
    el.className = 'trail-word';
    el.textContent = item.word;
    el.title = `"${item.quote.content.slice(0, 60)}…"`;
    el.addEventListener('click', () => rewindTo(i));
    trail.appendChild(el);
  });
}

async function rewindTo(index) {
  if (busy) return;
  busy = true;

  const target = history[index];
  history = history.slice(0, index);
  renderTrail();

  authorEl.classList.remove('visible');
  authorEl.textContent = '';

  [...quoteWrap.querySelectorAll('.word')].forEach(n => n.remove());
  cursor.className = 'typing';
  quoteWrap.appendChild(cursor);

  hoverCache = {};
  currentQuote = target.quote;

  await typeQuote(target.quote, null);

  await sleep(500);
  authorEl.textContent = `— ${target.quote.author}`;
  authorEl.classList.add('visible');

  busy = false;
}

async function init() {
  busy = true;
  await loadQuotes();
  const q = fetchRandom();
  currentQuote = q;

  await typeQuote(q, null);

  await sleep(500);
  authorEl.textContent = `— ${q.author}`;
  authorEl.classList.add('visible');

  busy = false;
}

init();