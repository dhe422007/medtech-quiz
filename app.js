// Quiz PWA app.js (year + tag filters, multi-answer, shuffled choices, end view score)
const STATE_KEY = 'quiz_state_v3';
const BOOKMARK_KEY = 'quiz_bookmarks_v1';
const WRONG_KEY = 'quiz_wrongs_v1';

let questions = [];
let order = [];         // filtered/shuffled question indexes
let index = 0;

let deferredPrompt = null;
let mode = 'all'; // 'all' | 'wrong' | 'bookmarked'

// per-question temp state
let selectedSet = new Set();
let answered = false;

const els = {
  tagFilter: document.getElementById('tagFilter'),
  yearFilter: document.getElementById('yearFilter'),
  modeSelect: document.getElementById('modeSelect'),
  startBtn: document.getElementById('startBtn'),
  shuffleBtn: document.getElementById('shuffleBtn'),
  progressNum: document.getElementById('progressNum'),
  accuracy: document.getElementById('accuracy'),
  streak: document.getElementById('streak'),
  progressBar: document.getElementById('progressBar'),
  viewTop: document.getElementById('viewTop'),
  viewQuiz: document.getElementById('viewQuiz'),
  viewEnd: document.getElementById('viewEnd'),
  qid: document.getElementById('qid'),
  questionText: document.getElementById('questionText'),
  qImage: document.getElementById('qImage'),
  tagsWrap: document.getElementById('tagsWrap'),
  choices: document.getElementById('choices'),
  explain: document.getElementById('explain'),
  prevBtn: document.getElementById('prevBtn'),
  nextBtn: document.getElementById('nextBtn'),
  bookmarkBtn: document.getElementById('bookmarkBtn'),
  finalAccuracy: document.getElementById('finalAccuracy'),
  backHomeBtn: document.getElementById('backHomeBtn'),
};

const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const loadJSON = async (path) => {
  const res = await fetch(path);
  if (!res.ok) throw new Error('failed to load ' + path);
  return await res.json();
};

let stats = { totalAnswered: 0, totalCorrect: 0, streak: 0 };

const saveState = () => {
  const state = {
    index, order, mode,
    stats,
    currentTag: els.tagFilter.value,
    currentYear: els.yearFilter.value,
  };
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
};
const loadState = () => {
  const s = localStorage.getItem(STATE_KEY);
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
};

const getBookmarks = () => new Set(JSON.parse(localStorage.getItem(BOOKMARK_KEY) || '[]'));
const setBookmarks = (set) => localStorage.setItem(BOOKMARK_KEY, JSON.stringify([...set]));
const getWrongs = () => new Set(JSON.parse(localStorage.getItem(WRONG_KEY) || '[]'));
const setWrongs = (set) => localStorage.setItem(WRONG_KEY, JSON.stringify([...set]));

const updateStatsUI = () => {
  els.progressNum.textContent = `${Math.min(index+1, Math.max(order.length,1))}/${order.length}`;
  const acc = stats.totalAnswered ? Math.round((stats.totalCorrect / stats.totalAnswered) * 100) : 0;
  els.accuracy.textContent = `${acc}%`;
  els.streak.textContent = stats.streak;
  const percent = Math.round(((index+1)/Math.max(order.length,1))*100);
  els.progressBar.style.width = percent + '%';
};

const renderTags = (q) => {
  els.tagsWrap.innerHTML = '';
  (q.tags || []).forEach(t => {
    const span = document.createElement('span');
    span.className = 'tag';
    span.textContent = t;
    els.tagsWrap.appendChild(span);
  });
};

const isYearTag = (t) => /^\d{4}$/.test(String(t).trim());
const asCorrectArray = (ans) => Array.isArray(ans) ? ans.slice().map(Number) : [Number(ans)];

const showView = (name) => {
  els.viewTop.classList.remove('active');
  els.viewQuiz.classList.remove('active');
  els.viewEnd.classList.remove('active');
  if (name==='top') els.viewTop.classList.add('active');
  if (name==='quiz') els.viewQuiz.classList.add('active');
  if (name==='end') els.viewEnd.classList.add('active');
};

const gradeCurrent = () => {
  const q = questions[order[index]];
  const correctArray = asCorrectArray(q.answerIndex).sort((a,b)=>a-b);
  const pickedArray = [...selectedSet].sort((a,b)=>a-b);
  const isAllMatch = correctArray.length === pickedArray.length &&
    correctArray.every((v, i) => v === pickedArray[i]);

  const buttons = [...document.querySelectorAll('.choice')];
  buttons.forEach(b => {
    const bi = Number(b.dataset.index);
    if (correctArray.includes(bi)) b.classList.add('correct');
    if (selectedSet.has(bi) && !correctArray.includes(bi)) b.classList.add('incorrect');
    b.disabled = true;
  });

  stats.totalAnswered += 1;
  if (isAllMatch) {
    stats.totalCorrect += 1;
    stats.streak += 1;
    const wr = getWrongs(); wr.delete(q.id); setWrongs(wr);
  } else {
    stats.streak = 0;
    const wr = getWrongs(); wr.add(q.id); setWrongs(wr);
  }
  els.explain.classList.remove('hidden');
  updateStatsUI();

  answered = true;
  els.nextBtn.textContent = (index < order.length-1) ? '次へ ▶' : '結果を見る';
  saveState();
};

const renderQuestion = () => {
  const q = questions[order[index]];
  els.qid.textContent = q.id || `Q${order[index]+1}`;
  els.questionText.textContent = q.question;

  if (q.image) {
    els.qImage.src = q.image;
    els.qImage.alt = q.imageAlt || '';
    els.qImage.classList.remove('hidden');
  } else {
    els.qImage.classList.add('hidden');
    els.qImage.removeAttribute('src');
    els.qImage.removeAttribute('alt');
  }

  renderTags(q);
  els.explain.classList.add('hidden');
  els.explain.textContent = q.explanation || '';
  els.choices.innerHTML = '';

  selectedSet = new Set();
  answered = false;
  els.nextBtn.textContent = '解答する';
  els.nextBtn.disabled = true;

  const idxs = q.choices.map((_,i)=>i);
  const shuffled = shuffle(idxs);
  shuffled.forEach(i => {
    const btn = document.createElement('button');
    btn.className = 'choice';
    btn.textContent = q.choices[i];
    btn.dataset.index = i;
    btn.addEventListener('click', () => {
      if (answered) return;
      if (selectedSet.has(i)) { selectedSet.delete(i); btn.classList.remove('selected'); }
      else { selectedSet.add(i); btn.classList.add('selected'); }
      els.nextBtn.disabled = selectedSet.size === 0;
    });
    els.choices.appendChild(btn);
  });

  const bms = getBookmarks();
  els.bookmarkBtn.textContent = bms.has(q.id) ? '★ ブックマーク中' : '☆ ブックマーク';

  updateStatsUI();
  saveState();
};

const applyFilter = () => {
  const tagSel  = els.tagFilter.value;
  const yearSel = els.yearFilter.value;
  const wr = getWrongs();
  const bms = getBookmarks();

  const base = questions.map((q,i)=>i).filter(i => {
    const tags = questions[i].tags||[];
    if (tagSel) {
      const hasTag = tags.some(t => !isYearTag(t) && String(t)===tagSel);
      if (!hasTag) return false;
    }
    if (yearSel) {
      const hasYear = tags.some(t => isYearTag(t) && String(t)===yearSel);
      if (!hasYear) return false;
    }
    if (mode==='wrong' && !wr.has(questions[i].id)) return false;
    if (mode==='bookmarked' && !bms.has(questions[i].id)) return false;
    return true;
  });

  order = base;
  index = 0;
};

const populateFilters = () => {
  const yearSet = new Set();
  const tagSet = new Set();
  questions.forEach(q => (q.tags||[]).forEach(t => (isYearTag(t)?yearSet:tagSet).add(String(t))));

  const curTag = els.tagFilter.value;
  els.tagFilter.innerHTML = '<option value="">全分野</option>' + [...tagSet].sort().map(t=>`<option value="${t}">${t}</option>`).join('');
  if ([...tagSet].includes(curTag)) els.tagFilter.value = curTag;

  const curYear = els.yearFilter.value;
  els.yearFilter.innerHTML = '<option value="">全年度</option>' + [...yearSet].sort().map(y=>`<option value="${y}">${y}</option>`).join('');
  if ([...yearSet].includes(curYear)) els.yearFilter.value = curYear;
};

const next = () => {
  if (!answered) { gradeCurrent(); return; }
  if (index < order.length - 1) {
    index += 1;
    renderQuestion();
  } else {
    const acc = stats.totalAnswered ? Math.round((stats.totalCorrect / stats.totalAnswered) * 100) : 0;
    els.finalAccuracy.textContent = `${acc}%`;
    showView('end');
  }
};
const prev = () => { if (index > 0) { index -= 1; renderQuestion(); } };

els.startBtn.addEventListener('click', () => {
  mode = els.modeSelect.value;
  applyFilter();
  if (order.length === 0) { alert('該当の問題がありません。'); return; }
  order = shuffle(order);
  index = 0;
  showView('quiz');
  renderQuestion();
});

els.shuffleBtn.addEventListener('click', () => {
  order = shuffle(order);
  index = 0;
  if (els.viewQuiz.classList.contains('active')) renderQuestion();
});

els.prevBtn.addEventListener('click', prev);
els.nextBtn.addEventListener('click', next);
els.modeSelect.addEventListener('change', (e) => { mode = e.target.value; if (els.viewQuiz.classList.contains('active')) { applyFilter(); renderQuestion(); }});
els.tagFilter.addEventListener('change', () => { if (els.viewQuiz.classList.contains('active')) { applyFilter(); renderQuestion(); }});
els.yearFilter.addEventListener('change', () => { if (els.viewQuiz.classList.contains('active')) { applyFilter(); renderQuestion(); }});
els.bookmarkBtn.addEventListener('click', () => { const q = questions[order[index]]; const b = getBookmarks(); if (b.has(q.id)) b.delete(q.id); else b.add(q.id); setBookmarks(b); renderQuestion(); });
els.backHomeBtn.addEventListener('click', () => { showView('top'); });

window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; });

(async function init(){
  try {
    questions = await loadJSON('./questions.json?v=1');
    populateFilters();

    const st = loadState();
    if (st) {
      stats = st.stats || stats;
      if (st.currentTag) els.tagFilter.value = st.currentTag;
      if (st.currentYear) els.yearFilter.value = st.currentYear;
      mode = st.mode || 'all';
      els.modeSelect.value = mode;
      applyFilter();
    } else {
      applyFilter();
    }

    els.progressNum.textContent = `0/${order.length}`;
    els.accuracy.textContent = stats.totalAnswered ? `${Math.round((stats.totalCorrect/stats.totalAnswered)*100)}%` : '0%';
    els.streak.textContent = stats.streak;
    els.progressBar.style.width = '0%';
  } catch (err) {
    console.error(err);
    alert('questions.json を読み込めませんでした。');
  }
})();
