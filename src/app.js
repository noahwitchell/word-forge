'use strict';
const DATA = /*@DATA@*/null;
const COMMON = DATA.common.split(' ');
const COMMONSET = new Set(COMMON);
const EXTRA = new Set(DATA.extra.split(' '));
const SEEDS = DATA.seeds.split(' ');
const PTS = {3: 1, 4: 2, 5: 4, 6: 7, 7: 12};
const RANKS = [['Warming up', 0], ['Good start', .08], ['Moving up', .18], ['Good', .3], ['Solid', .45], ['Great', .6], ['Amazing', .75], ['Genius', .88], ['Perfect', 1]];
const KEY = 'wordhoard-v1';
const $app = document.getElementById('app');

// ---------- storage ----------
let S = load();
function load() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  s = s || {};
  s.settings = Object.assign({bank: 'slots', timer: 0}, s.settings);
  s.stats = Object.assign({played: 0, sumPct: 0, perfect: 0, streak: 0, lastDaily: null}, s.stats);
  s.done = s.done || {};          // puzzle index -> best % (0-100)
  s.seen = s.seen || Object.keys(s.done).map(Number).concat(s.cur ? [s.cur.idx] : []);   // every puzzle ever started, in order
  s.daily = s.daily || {};        // day number -> puzzle index
  s.round = s.round || 1;
  return s;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

// ---------- puzzles ----------
const count = w => { const m = {}; for (const c of w) m[c] = (m[c] || 0) + 1; return m; };
function fits(word, pool) { const m = count(word); for (const c in m) if ((pool[c] || 0) < m[c]) return false; return true; }
function dayNum(d = new Date()) { return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(2026, 10, 17)) / 864e5); }
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
function shuffled(letters) { let s; do s = shuffle([...letters]).join(''); while (letters.length > 1 && COMMONSET.has(s)); return s; }

// No repeats: every puzzle you start is marked seen and never comes back until all of them have been used.
// Variety: a new puzzle may share at most 5 of its 7 letters with any of your last 25, so days don't feel alike.
const RECENT = 25, MAXSHARED = 5;
function shared(a, b) { const m = count(a); let n = 0; for (const c of b) if (m[c] > 0) { m[c]--; n++; } return n; }
function pickFresh() {
  const seen = new Set(S.seen);
  let open = [];
  for (let i = 0; i < SEEDS.length; i++) if (!seen.has(i)) open.push(i);
  if (!open.length) { S.seen = S.seen.slice(-RECENT); S.round++; return pickFresh(); }   // every puzzle used: start a new round
  const recent = S.seen.slice(-RECENT).map(i => SEEDS[i]);
  open = shuffle(open);
  return open.find(i => recent.every(r => shared(r, SEEDS[i]) <= MAXSHARED)) ?? open[0];
}
function todaysDaily() {
  const d = dayNum();
  if (!(d in S.daily)) { S.daily = {[d]: pickFresh()}; save(); }   // chosen once per day, then fixed
  return S.daily[d];
}
function newGame(idx, daily) {
  const seed = SEEDS[idx];
  if (!S.seen.includes(idx)) S.seen.push(idx);
  S.cur = {idx, daily: daily ? dayNum() : null, letters: shuffled(seed), found: [], bonus: [], done: false, elapsed: 0};
  save(); setup(); render();
}
function nextGame() {
  if (S.stats.lastDaily !== dayNum() && !(S.cur && S.cur.daily === dayNum())) return newGame(todaysDaily(), true);
  newGame(pickFresh(), false);
}

// ---------- game state ----------
let G = null;          // derived: bank words, totals
let typed = [];        // tile indexes in the current word
let msg = null, msgTimer = 0, fresh = null, sheet = null, confirmFinish = false;
let hinting = false;   // hint mode: the next tap on an unfound word reveals its next letter

function setup() {
  const c = S.cur, pool = count(c.letters);
  const bank = COMMON.filter(w => fits(w, pool));
  const total = bank.reduce((t, w) => t + PTS[w.length], 0);
  G = {bank, total, pool, set: new Set(bank)};
  typed = [];
}
const points = () => S.cur.found.reduce((t, w) => t + PTS[w.length], 0);
function rankOf(p) { let r = RANKS[0][0]; for (const [n, t] of RANKS) if (p >= t - 1e-9) r = n; return r; }

function say(text, kind, ms = 1300) { msg = {text, kind}; clearTimeout(msgTimer); msgTimer = setTimeout(() => { msg = null; renderEntry(); }, ms); renderEntry(); }
function shake() { const e = $app.querySelector('.entry'); if (!e) return; e.classList.remove('shake'); void e.offsetWidth; e.classList.add('shake'); }

function tap(i) {
  if (S.cur.done || typed.includes(i)) return;
  if (hinting) { hinting = false; render(); }
  msg = null; typed.push(i); renderDock();
}
function back() { typed.pop(); msg = null; renderDock(); }
function doShuffle() { typed = []; S.cur.letters = shuffled(S.cur.letters); save(); renderDock(); }
function enter() {
  const c = S.cur; if (c.done) return;
  const w = typed.map(i => c.letters[i]).join('');
  typed = [];
  if (!w) return renderDock();
  if (w.length < 3) { renderDock(); shake(); return say('Words need 3 or more letters', 'soft'); }
  if (c.found.includes(w) || c.bonus.includes(w)) { renderDock(); shake(); return say('Already found', 'soft'); }
  if (G.set.has(w)) {
    c.found.push(w); fresh = w; save();
    const all = w.length === 7;
    render();
    say(all ? 'All seven letters! +' + PTS[7] : (w.length >= 5 ? 'Great word' : 'Nice') + ' +' + PTS[w.length], all ? 'gold' : '');
    const el = $app.querySelector('.w.new'); if (el) el.scrollIntoView({block: 'nearest', behavior: 'smooth'});
    if (c.found.length === G.bank.length) finish();
    return;
  }
  if (EXTRA.has(w)) { c.bonus.push(w); save(); render(); return say('Bonus word. Real, but rare', 'soft', 1600); }
  renderDock(); shake(); say('Not in the word list', 'soft');
}
// ---------- hints ----------
// Tap Hint, then tap any unfound word: its next letter (left to right) shows in the slot. The last letter is never given away.
const hintsOf = w => (S.cur.hints && S.cur.hints[w]) || 0;
function toggleHint() {
  if (S.cur.done) return;
  hinting = !hinting; typed = []; msg = null; render();
  if (hinting) { const el = $app.querySelector('.w.tap'); if (el) el.scrollIntoView({block: 'nearest', behavior: 'smooth'}); }
}
function reveal(w) {
  const c = S.cur, n = hintsOf(w);
  if (n >= w.length - 1) { say('Only the last letter is left. You can do it', 'soft', 1800); return; }
  c.hints = c.hints || {}; c.hints[w] = n + 1; c.hintCount = (c.hintCount || 0) + 1;
  hinting = false; fresh = null; save(); render();
  const el = $app.querySelector(`.w[data-w="${w}"]`); if (el) { el.classList.add('new'); el.scrollIntoView({block: 'nearest', behavior: 'smooth'}); }
}
function typeLetter(ch) {
  const c = S.cur; if (c.done) return;
  for (let i = 0; i < c.letters.length; i++) if (c.letters[i] === ch && !typed.includes(i)) return tap(i);
  shake();
}
function finish() {
  const c = S.cur; if (c.done) return;
  c.done = true; confirmFinish = false;
  const pct = Math.round(100 * points() / G.total);
  S.stats.played++; S.stats.sumPct += pct; if (pct === 100 && !c.hintCount) S.stats.perfect++;   // perfect = every word, no hints
  hinting = false;
  if (c.daily !== null) { S.stats.streak = S.stats.lastDaily === c.daily - 1 ? S.stats.streak + 1 : 1; S.stats.lastDaily = c.daily; }
  S.done[c.idx] = Math.max(pct, S.done[c.idx] || 0);
  save(); sheet = 'result'; render();
}

// ---------- timer ----------
let lastTick = Date.now();
setInterval(() => {
  const now = Date.now(), dt = now - lastTick; lastTick = now;
  const c = S.cur; if (!c || c.done || !S.settings.timer || document.hidden || sheet) return;
  c.elapsed += Math.min(dt, 2000);
  if (c.elapsed >= S.settings.timer * 1000) { c.elapsed = S.settings.timer * 1000; finish(); return; }
  const el = $app.querySelector('.clock'); if (el) paintClock(el);
  if (c.elapsed % 10000 < 1100) save();
}, 1000);
function paintClock(el) {
  const left = Math.max(0, Math.ceil((S.settings.timer * 1000 - S.cur.elapsed) / 1000));
  el.textContent = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
  el.classList.toggle('low', left <= 30);
}

// ---------- render ----------
const ICON = {
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5h11v14H9l-6-7z"/><path d="M12.5 9.5l5 5m0-5l-5 5"/></svg>',
  hint: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/></svg>',
  shuf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h3c5 0 7 10 12 10h3M3 17h3c2 0 3.3-1.6 4.5-3.6M21 7h-3c-2 0-3.3 1.6-4.5 3.6"/><path d="M18 4l3 3-3 3M18 14l3 3-3 3"/></svg>',
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
function label() {
  const c = S.cur;
  if (c.daily !== null) { const d = new Date(Date.UTC(2026, 10, 17) + c.daily * 864e5); return d.toLocaleDateString(undefined, {month: 'short', day: 'numeric', timeZone: 'UTC'}); }
  return '#' + (c.idx + 1);
}

function render() {
  const c = S.cur, p = points(), pct = p / G.total;
  const ticks = RANKS.slice(1, -1).map(r => `<u style="left:${r[1] * 100}%"></u>`).join('');
  $app.innerHTML = `
  <div class="sky">
    <span class="sub">${esc(label())}</span>
    <h1>Word Forge</h1>
    <div class="right"><button class="icon" id="menu" aria-label="Menu">${ICON.menu}</button></div>
  </div>
  <div class="score">
    <div class="row1"><span class="rank">${rankOf(pct)}</span>
      ${S.settings.timer && !c.done ? '<span class="clock"></span>' : ''}
      <span class="nums"><b>${c.found.length}</b>/${G.bank.length} words · <b>${p}</b> pts</span></div>
    <div class="bar" aria-hidden="true"><i style="width:${Math.min(100, pct * 100)}%"></i>${ticks}</div>
  </div>
  <div class="bank" id="bank">${bankHTML()}</div>
  <div class="dock"></div>
  ${sheet ? '<div class="veil" id="veil"><div class="sheet" role="dialog" aria-modal="true">' + sheetHTML() + '</div></div>' : ''}`;
  const clock = $app.querySelector('.clock'); if (clock) paintClock(clock);
  $app.querySelector('#menu').onclick = () => { sheet = 'menu'; confirmFinish = false; hinting = false; render(); };
  $app.querySelector('#bank').onclick = e => { const t = hinting && e.target.closest('.w.tap'); if (t) reveal(t.dataset.w); };
  if (sheet) wireSheet();
  renderDock();
  fresh = null;
}

function bankHTML() {
  const c = S.cur, found = new Set(c.found), mode = c.done || hinting ? 'slots' : S.settings.bank;
  let h = '';
  for (let n = 7; n >= 3; n--) {
    const ws = G.bank.filter(w => w.length === n);
    if (!ws.length) continue;
    const got = ws.filter(w => found.has(w)).length;
    const shown = mode === 'slots' ? ws : ws.filter(w => found.has(w) || hintsOf(w));
    const cells = w => [...w].map((ch, j) => found.has(w) || c.done ? `<s>${ch}</s>` : j < hintsOf(w) ? `<s class="h">${ch}</s>` : '<s></s>').join('');
    const cls = w => 'w' + (found.has(w) ? ' got' + (n === 7 ? ' all' : '') : c.done ? ' miss' : '') + (w === fresh ? ' new' : '') + (hinting && !found.has(w) ? ' tap' : '');
    h += `<div class="grp"><h3>${n} letters <em>${got} / ${ws.length}</em></h3>
      ${shown.length ? `<div class="words">${shown.map(w => `<span class="${cls(w)}" data-w="${w}"${hinting && !found.has(w) ? ' role="button" tabindex="0"' : ''} aria-label="${found.has(w) || c.done ? w : n + ' letter word'}">${cells(w)}</span>`).join('')}</div>` : '<p class="countnote">None yet</p>'}</div>`;
  }
  if (c.bonus.length) h += `<div class="grp"><h3>Bonus words <em>${c.bonus.length}</em></h3><p class="bonus">${c.bonus.map(w => `<b>${w}</b>`).join(' · ')}</p></div>`;
  return h;
}

function renderEntry() {
  const e = $app.querySelector('.entry'); if (!e) return;
  const c = S.cur;
  if (msg && !typed.length) e.innerHTML = `<span class="msg ${msg.kind || ''}">${esc(msg.text)}</span>`;
  else if (hinting) e.innerHTML = '<span class="msg gold">Tap a word to see its next letter</span>';
  else if (c.done) e.innerHTML = `<span class="msg soft">${c.found.length === G.bank.length ? 'Every word found' : 'Missed words are in red'}</span>`;
  else e.innerHTML = esc(typed.map(i => c.letters[i]).join('')) + '<span class="caret"></span>';
}

function renderDock() {
  const c = S.cur, d = $app.querySelector('.dock');
  d.innerHTML = `<div class="entry" aria-live="polite"></div>
    <div class="tiles">${[...c.letters].map((ch, i) => `<button class="tile${typed.includes(i) ? ' used' : ''}" data-i="${i}" ${c.done ? 'disabled' : ''} aria-label="${ch}">${ch}</button>`).join('')}</div>
    <div class="acts">${c.done
      ? '<button class="btn ink wide" id="next">Next puzzle</button>'
      : `<button class="btn sq" id="del" aria-label="Delete letter">${ICON.back}</button><button class="btn${hinting ? ' on' : ''}" id="hint" aria-pressed="${hinting}">${ICON.hint}${hinting ? 'Cancel' : 'Hint'}</button><button class="btn sq" id="shuf" aria-label="Shuffle letters">${ICON.shuf}</button><button class="btn ink" id="ent">Enter</button>`}</div>`;
  renderEntry();
  d.querySelectorAll('.tile').forEach(b => b.onclick = () => tap(+b.dataset.i));
  const on = (id, f) => { const b = d.querySelector('#' + id); if (b) b.onclick = f; };
  on('del', back); on('shuf', doShuffle); on('hint', toggleHint); on('ent', enter); on('next', nextGame);
}

function seg(name, value, opts) {
  return `<div class="seg" role="group">${opts.map(([v, t]) => `<button data-set="${name}" data-v="${v}" aria-pressed="${String(v) === String(value)}">${t}</button>`).join('')}</div>`;
}
function sheetHTML() {
  const c = S.cur, st = S.stats;
  if (sheet === 'result') {
    const p = points(), pct = Math.round(100 * p / G.total);
    const longest = c.found.slice().sort((a, b) => b.length - a.length)[0];
    return `<h2>${rankOf(p / G.total)}</h2>
      <div class="big"><b>${c.found.length}</b><span>of ${G.bank.length} words · ${p} of ${G.total} points (${pct}%)</span></div>
      <p class="lead" style="margin:0">${longest ? 'Longest: <b>' + longest.toUpperCase() + '</b>. ' : ''}${c.bonus.length ? c.bonus.length + ' bonus word' + (c.bonus.length > 1 ? 's' : '') + '. ' : ''}${c.hintCount ? c.hintCount + ' hint' + (c.hintCount > 1 ? 's' : '') + ' used. ' : ''}${pct < 100 ? 'The words you missed are shown in red.' : ''}</p>
      <div class="col"><button class="btn ink" id="s-next">Next puzzle</button><button class="btn" id="s-close">See the full bank</button></div>`;
  }
  const todayDone = st.lastDaily === dayNum();
  const avg = st.played ? Math.round(st.sumPct / st.played) : 0;
  return `<h2>Word Forge</h2>
    <p class="lead">Make as many words as you can from the seven letters. Every word uses 3 or more letters, and each letter only as often as it appears.</p>
    <div class="col">
      ${!c.done ? (confirmFinish
        ? `<div class="confirm"><p>End this puzzle and show every word you missed?</p><div class="pair"><button class="btn ink" id="s-fin2">Reveal words</button><button class="btn" id="s-fin0">Keep playing</button></div></div>`
        : '<button class="btn" id="s-fin">Finish and reveal words</button>') : ''}
      <button class="btn ink" id="s-new">${!todayDone && c.daily !== dayNum() ? "Today's puzzle" : 'New puzzle'}</button>
    </div>
    <div class="field"><span class="label">Word bank</span>${seg('bank', S.settings.bank, [['slots', 'Show slots'], ['count', 'Count only']])}
      <span class="hint">${S.settings.bank === 'slots' ? 'Empty slots show how many words of each length are left.' : 'Only the totals show. The full bank appears when you finish.'}</span></div>
    <div class="field"><span class="label">Timer</span>${seg('timer', S.settings.timer, [[0, 'Off'], [180, '3 min'], [300, '5 min'], [600, '10 min']])}</div>
    <div class="field"><span class="label">Your stats</span><div class="stats">
      <div class="stat"><b>${st.played}</b><span>Played</span></div>
      <div class="stat"><b>${avg}%</b><span>Average</span></div>
      <div class="stat"><b>${st.perfect}</b><span>Perfect</span></div>
      <div class="stat"><b>${st.lastDaily !== null && st.lastDaily >= dayNum() - 1 ? st.streak : 0}</b><span>Daily streak</span></div></div></div>
    <button class="btn" id="s-close">Back to the puzzle</button>
    <p class="ver">${SEEDS.length} puzzles · build __BUILD__</p>`;
}
function wireSheet() {
  const v = $app.querySelector('#veil');
  v.onclick = e => { if (e.target === v) { sheet = null; render(); } };
  const on = (id, f) => { const b = v.querySelector('#' + id); if (b) b.onclick = f; };
  on('s-close', () => { sheet = null; render(); });
  on('s-next', () => { sheet = null; nextGame(); });
  on('s-new', () => { sheet = null; if (!S.cur.done && S.cur.found.length) { /* leaving an unfinished puzzle: keep it unscored */ } nextGame(); });
  on('s-fin', () => { confirmFinish = true; render(); });
  on('s-fin0', () => { confirmFinish = false; render(); });
  on('s-fin2', finish);
  v.querySelectorAll('[data-set]').forEach(b => b.onclick = () => {
    const k = b.dataset.set; S.settings[k] = k === 'timer' ? +b.dataset.v : b.dataset.v; save(); render();
  });
}

// ---------- input ----------
addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (sheet) { if (e.key === 'Escape') { sheet = null; render(); } return; }
  if (hinting && e.key === 'Escape') { toggleHint(); return; }
  const k = e.key.toLowerCase();
  if (/^[a-z]$/.test(k)) { typeLetter(k); e.preventDefault(); }
  else if (e.key === 'Backspace') { back(); e.preventDefault(); }
  else if (e.key === 'Enter') { if (S.cur.done) nextGame(); else enter(); e.preventDefault(); }
  else if (e.key === ' ') { if (!S.cur.done) doShuffle(); e.preventDefault(); }
});
document.addEventListener('visibilitychange', () => { lastTick = Date.now(); if (document.hidden) save(); });

// ---------- boot ----------
if (S.cur && SEEDS[S.cur.idx] === [...S.cur.letters].sort().join('')) { setup(); render(); if (S.cur.done) { sheet = null; render(); } }
else nextGame();
