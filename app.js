// app.js (top UI reverted + robust image resolver)
const STATE_KEY = 'quiz_state_v4';
const BOOKMARK_KEY = 'quiz_bookmarks_v1';
const WRONG_KEY = 'quiz_wrongs_v1';
const STATS_BY_TAG_KEY = 'quiz_stats_by_tag_v2';
const STATS_BY_YEAR_KEY = 'quiz_stats_by_year_v1';

let questions = [];
let order = [];
let index = 0;
let mode = 'all';
let deferredPrompt = null;

let selectedSet = new Set();
let answered = false;

// セッション計測
let session = { startAt: null, perTag: {}, perYear: {} };

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
  viewStats: document.getElementById('viewStats'),
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
  finalCounts: document.getElementById('finalCounts'),
  finalDate: document.getElementById('finalDate'),
  finalDuration: document.getElementById('finalDuration'),
  weaknessList: document.getElementById('weaknessList'),
  backHomeBtn: document.getElementById('backHomeBtn'),
  toStatsBtn2: document.getElementById('toStatsBtn2'),
  resumeBtn: document.getElementById('resumeBtn'),
  resumeInfo: document.getElementById('resumeInfo'),
  statsOverview: document.getElementById('statsOverview'),
  statsByTagTbl: document.querySelector('#statsByTagTbl tbody'),
  statsByYearTbl: document.querySelector('#statsByYearTbl tbody'),
  reviewWrongsBtn: document.getElementById('reviewWrongsBtn'),
  reviewBookmarksBtn: document.getElementById('reviewBookmarksBtn'),
  resetStatsBtn: document.getElementById('resetStatsBtn'),
  backTopBtn: document.getElementById('backTopBtn'),
};

function updateCountdown(){
  const now = new Date();
  const exam = new Date('2026-02-18T00:00:00+09:00');
  const msPerDay = 24*60*60*1000;
  let days = Math.ceil((exam - now)/msPerDay);
  if (days < 0) days = 0;
  const el = document.getElementById('countdown');
  if (el) el.textContent = `残り ${days} 日`;
}
function scheduleCountdownRefresh(){
  updateCountdown();
  const now = new Date(); const next = new Date(now);
  next.setDate(now.getDate()+1); next.setHours(0,0,0,0);
  setTimeout(()=>{ updateCountdown(); setInterval(updateCountdown, 24*60*60*1000); }, next-now);
}

// 画像ヘルパー（“？”防止＋自動パス補完）
const isNoImage = (s)=>{ if(!s) return true; const t=String(s).trim(); if(!t) return true; return /^(-|なし|null|na)$/i.test(t); };
const hasExt = (t)=>/\.(jpg|jpeg|png|webp|gif)$/i.test(t);
const resolveImageSrc = (raw)=>{
  if (!raw) return null;
  const t = String(raw).trim();
  if (!t || /^(-|なし|null|na)$/i.test(t)) return null;
  // フル/相対パス・URLはそのまま
  if (/^https?:\/\//i.test(t) || t.includes('/')) {
    return hasExt(t) ? t : null;
  }
  // ファイル名のみ → assets/images に補完
  return hasExt(t) ? `./assets/images/${t}` : null;
};

// 汎用
const shuffle = (arr)=>{ const a=arr.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; };
const loadJSON = async (path)=>{ const res=await fetch(path); if(!res.ok) throw new Error('failed to load '+path); return await res.json(); };

let stats = { totalAnswered:0, totalCorrect:0, streak:0 };

const saveState = ()=>{
  const state = {
    index, order, mode, stats,
    currentTag: els.tagFilter.value,
    currentYear: els.yearFilter.value,
    sessionStart: session.startAt
  };
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
};
const loadState = ()=>{
  const s = localStorage.getItem(STATE_KEY);
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
};
const getBookmarks = ()=> new Set(JSON.parse(localStorage.getItem(BOOKMARK_KEY) || '[]'));
const setBookmarks = (set)=> localStorage.setItem(BOOKMARK_KEY, JSON.stringify([...set]));
const getWrongs = ()=> new Set(JSON.parse(localStorage.getItem(WRONG_KEY) || '[]'));
const setWrongs = (set)=> localStorage.setItem(WRONG_KEY, JSON.stringify([...set]));
const getStatsByTag = ()=> JSON.parse(localStorage.getItem(STATS_BY_TAG_KEY) || '{}');
const setStatsByTag = (obj)=> localStorage.setItem(STATS_BY_TAG_KEY, JSON.stringify(obj));
const getStatsByYear = ()=> JSON.parse(localStorage.getItem(STATS_BY_YEAR_KEY) || '{}');
const setStatsByYear = (obj)=> localStorage.setItem(STATS_BY_YEAR_KEY, JSON.stringify(obj));

const isYearTag = (t)=>{ const s=String(t).trim().toLowerCase(); return /^\d{4}$/.test(s) || s==='original'; };
const asCorrectArray = (ans)=> Array.isArray(ans) ? ans.slice().map(Number) : [Number(ans)];

const showView = (name)=>{
  ['viewTop','viewQuiz','viewEnd','viewStats'].forEach(id=>document.getElementById(id).classList.remove('active'));
  if (name==='top') els.viewTop.classList.add('active');
  if (name==='quiz') els.viewQuiz.classList.add('active');
  if (name==='end') els.viewEnd.classList.add('active');
  if (name==='stats') { els.viewStats.classList.add('active'); renderStatsPage(); }
};

const updateStatsUI = ()=>{
  els.progressNum.textContent = `${Math.min(index+1, Math.max(order.length,1))}/${order.length}`;
  const acc = stats.totalAnswered ? Math.round((stats.totalCorrect / stats.totalAnswered) * 100) : 0;
  els.accuracy.textContent = `${acc}%`;
  els.streak.textContent = stats.streak;
  const percent = Math.round(((index+1)/Math.max(order.length,1))*100);
  els.progressBar.style.width = percent + '%';
};
const renderTags = (q)=>{
  els.tagsWrap.innerHTML = '';
  (q.tags || []).forEach(t=>{
    const span=document.createElement('span');
    span.className='tag'; span.textContent=t;
    els.tagsWrap.appendChild(span);
  });
};

// 採点
const gradeCurrent = ()=>{
  const q = questions[order[index]];
  let correctArray = asCorrectArray(q.answerIndex).map(Number);
  // 1始まりデータにも対応
  const maxChoice = q.choices.length;
  const isOneBased = correctArray.length>0 && correctArray.every(n=>Number.isInteger(n) && n>=1 && n<=maxChoice) && !correctArray.includes(0);
  if (isOneBased) correctArray = correctArray.map(n=>n-1);

  const pickedArray = [...selectedSet].sort((a,b)=>a-b);
  const isAllMatch = correctArray.length===pickedArray.length &&
    correctArray.sort((a,b)=>a-b).every((v,i)=>v===pickedArray[i]);

  // 表示
  const buttons=[...document.querySelectorAll('.choice')];
  buttons.forEach(b=>{
    const bi=Number(b.dataset.index);
    if (correctArray.includes(bi)) b.classList.add('correct');
    if (selectedSet.has(bi) && !correctArray.includes(bi)) b.classList.add('incorrect');
    b.disabled=true;
  });

  // 累計
  stats.totalAnswered += 1;
  if (isAllMatch) {
    stats.totalCorrect += 1; stats.streak += 1;
    const wr=getWrongs(); wr.delete(q.id); setWrongs(wr);
  } else {
    stats.streak = 0; const wr=getWrongs(); wr.add(q.id); setWrongs(wr);
  }
  localStorage.setItem('quiz_lastAnswered', new Date().toISOString());
  els.explain.classList.remove('hidden');
  updateStatsUI();

  // セッション集計
  (q.tags||[]).forEach(t=>{
    if (!session.perTag[t]) session.perTag[t]={ans:0, cor:0};
    session.perTag[t].ans += 1;
    if (isAllMatch) session.perTag[t].cor += 1;
  });
  (q.tags||[]).forEach(t=>{
    if (isYearTag(t)) {
      if (!session.perYear[t]) session.perYear[t]={ans:0, cor:0};
      session.perYear[t].ans += 1;
      if (isAllMatch) session.perYear[t].cor += 1;
    }
  });

  // 端末累積
  const sbt=getStatsByTag();
  (q.tags||[]).forEach(t=>{
    if (!sbt[t]) sbt[t]={answered:0, correct:0};
    sbt[t].answered += 1; if (isAllMatch) sbt[t].correct += 1;
  });
  setStatsByTag(sbt);

  const sby=getStatsByYear();
  (q.tags||[]).forEach(t=>{
    if (isYearTag(t)) {
      if (!sby[t]) sby[t]={answered:0, correct:0};
      sby[t].answered += 1; if (isAllMatch) sby[t].correct += 1;
    }
  });
  setStatsByYear(sby);

  answered = true;
  els.nextBtn.textContent = (index < order.length-1) ? '次へ ▶' : '結果を見る';
  saveState();
};

// 出題
const renderQuestion = ()=>{
  const q = questions[order[index]];
  els.qid.textContent = q.id || `Q${order[index]+1}`;
  els.questionText.textContent = q.question;

  // 本文画像（自動パス補完 + 壊れたら非表示）
  const imgSrc = resolveImageSrc(q.image);
  if (imgSrc) {
    els.qImage.classList.remove('hidden');
    els.qImage.alt = q.imageAlt || '';
    els.qImage.onerror = ()=>{ els.qImage.classList.add('hidden'); els.qImage.removeAttribute('src'); els.qImage.removeAttribute('alt'); };
    els.qImage.onload = ()=>{};
    els.qImage.src = imgSrc;
  } else {
    els.qImage.classList.add('hidden'); els.qImage.removeAttribute('src'); els.qImage.removeAttribute('alt');
  }

  renderTags(q);
  els.explain.classList.add('hidden');
  els.explain.textContent = q.explanation || '';
  els.choices.innerHTML = '';

  selectedSet = new Set(); answered=false;
  els.nextBtn.textContent='解答する'; els.nextBtn.disabled=true;

  const idxs = q.choices.map((_,i)=>i);
  const shuffled = shuffle(idxs);
  shuffled.forEach(i=>{
    const btn=document.createElement('button'); btn.className='choice';
    const val=q.choices[i];

    // 画像選択肢にも対応（ファイル名だけなら自動で assets/images/ を補完）
    let choiceImg = null;
    if (typeof val === 'string' && /\.(jpg|jpeg|png|webp|gif)$/i.test(val)) {
      choiceImg = resolveImageSrc(val);
    }
    if (choiceImg) {
      btn.textContent=''; const img=document.createElement('img');
      img.alt=`choice${i+1}`; img.style.maxWidth='100%'; img.style.height='auto';
      img.onerror=()=>{ img.remove(); btn.textContent='[画像なし]'; };
      img.onload=()=>{}; img.src=choiceImg; btn.appendChild(img);
    } else {
      btn.textContent = val;
    }

    btn.dataset.index=i;
    btn.addEventListener('click',()=>{
      if (answered) return;
      if (selectedSet.has(i)) { selectedSet.delete(i); btn.classList.remove('selected'); }
      else { selectedSet.add(i); btn.classList.add('selected'); }
      els.nextBtn.disabled = selectedSet.size===0;
    });
    els.choices.appendChild(btn);
  });

  const bms=getBookmarks();
  els.bookmarkBtn.textContent = bms.has(q.id) ? '★ ブックマーク中' : '☆ ブックマーク';

  updateStatsUI(); saveState();
};

// フィルタ
const applyFilter = ()=>{
  const tagSel=els.tagFilter.value, yearSel=els.yearFilter.value;
  const wr=getWrongs(), bms=getBookmarks();

  const base = questions.map((q,i)=>i).filter(i=>{
    const tags=questions[i].tags||[];
    if (tagSel){ const hasTag=tags.some(t=>!isYearTag(t) && String(t)===tagSel); if(!hasTag) return false; }
    if (yearSel){ const hasYear=tags.some(t=>isYearTag(t) && String(t)===yearSel); if(!hasYear) return false; }
    if (mode==='wrong' && !wr.has(questions[i].id)) return false;
    if (mode==='bookmarked' && !bms.has(questions[i].id)) return false;
    return true;
  });

  order = base; index=0;
};
const populateFilters = ()=>{
  const yearSet=new Set(), tagSet=new Set();
  questions.forEach(q=>(q.tags||[]).forEach(t=>(isYearTag(t)?yearSet:tagSet).add(String(t))));
  const curTag=els.tagFilter.value;
  els.tagFilter.innerHTML = '<option value="">全分野</option>' + [...tagSet].sort().map(t=>`<option value="${t}">${t}</option>`).join('');
  if ([...tagSet].includes(curTag)) els.tagFilter.value = curTag;

  const yearLabel=(y)=>(String(y).toLowerCase()==='original' ? 'original（自作）' : y);
  const years=[...yearSet].sort((a,b)=>{ const an=/^\d{4}$/.test(a)?parseInt(a,10):Infinity; const bn=/^\d{4}$/.test(b)?parseInt(b,10):Infinity; return an-bn || String(a).localeCompare(String(b)); });
  const curYear=els.yearFilter.value;
  els.yearFilter.innerHTML = '<option value="">全年度</option>' + years.map(y=>`<option value="${y}">${yearLabel(y)}</option>`).join('');
  if ([...yearSet].includes(curYear)) els.yearFilter.value = curYear;
};

// 結果ページ描画
function renderEndPage(){
  const acc = stats.totalAnswered ? Math.round((stats.totalCorrect / stats.totalAnswered)*100) : 0;
  els.finalAccuracy.textContent = `${acc}%`;
  const wrongs = stats.totalAnswered - stats.totalCorrect;
  els.finalCounts.textContent = `正解 ${stats.totalCorrect} / 不正解 ${wrongs}（全${stats.totalAnswered}問）`;

  const jp = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  els.finalDate.textContent = `回答日時：${jp}`;

  // 経過時間
  if (session.startAt) {
    const ms = Date.now() - session.startAt;
    const m = Math.floor(ms/60000), s = Math.floor((ms%60000)/1000);
    els.finalDuration.textContent = `所要時間：${m}分${s}秒`;
  } else {
    els.finalDuration.textContent = '';
  }

  // 今回の弱点（回答3以上、正答率昇順で上位5）
  const listEl = document.getElementById('weaknessList');
  const rows=[];
  Object.entries(session.perTag).forEach(([k,v])=>{
    if (v.ans>=3){ rows.push({kind:'分野', key:k, ans:v.ans, acc: v.ans? Math.round((v.cor/v.ans)*100):0}); }
  });
  Object.entries(session.perYear).forEach(([k,v])=>{
    if (v.ans>=3){ rows.push({kind:'年度', key:k, ans:v.ans, acc: v.ans? Math.round((v.cor/v.ans)*100):0}); }
  });
  rows.sort((a,b)=>a.acc-b.acc || b.ans-a.ans);
  if (rows.length===0) {
    listEl.innerHTML = '<p>（今回の回答数が少ないため、弱点分析はありません）</p>';
  } else {
    listEl.innerHTML = '<table><thead><tr><th>種別</th><th>ラベル</th><th>正答率</th><th>回答数</th></tr></thead><tbody>'
      + rows.slice(0,5).map(r=>`<tr><td>${r.kind}</td><td>${r.key}</td><td>${r.acc}%</td><td>${r.ans}</td></tr>`).join('')
      + '</tbody></table>';
  }
}

// 成績ページ描画（累積）
function renderStatsPage(){
  // 概要
  const totalAns = stats.totalAnswered, totalCor = stats.totalCorrect;
  const acc = totalAns? Math.round((totalCor/totalAns)*100):0;
  els.statsOverview.innerHTML = `累計 正答率：<b>${acc}%</b>（正解 ${totalCor} / 全 ${totalAns}）`;

  // 分野別
  const sbt = getStatsByTag();
  const rowsTag = Object.entries(sbt).map(([k,v])=>{
    const ans=v.answered||0, cor=v.correct||0, a=ans?Math.round((cor/ans)*100):0;
    return {k, ans, cor, a};
  }).sort((a,b)=>a.k.localeCompare(b.k));
  els.statsByTagTbl.innerHTML = rowsTag.length ? rowsTag.map(r=>`<tr><td>${r.k}</td><td>${r.a}%</td><td>${r.cor}/${r.ans}</td></tr>`).join('') : '<tr><td colspan="3">（データなし）</td></tr>';

  // 年度別
  const sby = getStatsByYear();
  const rowsYear = Object.entries(sby).map(([k,v])=>{
    const ans=v.answered||0, cor=v.correct||0, a=ans?Math.round((cor/ans)*100):0;
    return {k, ans, cor, a};
  }).sort((a,b)=>{
    const an=/^\d{4}$/.test(a.k)?parseInt(a.k,10):Infinity;
    const bn=/^\d{4}$/.test(b.k)?parseInt(b.k,10):Infinity;
    return an-bn || a.k.localeCompare(b.k);
  });
  els.statsByYearTbl.innerHTML = rowsYear.length ? rowsYear.map(r=>`<tr><td>${r.k}</td><td>${r.a}%</td><td>${r.cor}/${r.ans}</td></tr>`).join('') : '<tr><td colspan="3">（データなし）</td></tr>';
}

// 結果へ / 戻る
const next = ()=>{
  if (!answered) { gradeCurrent(); return; }
  if (index < order.length - 1) {
    index += 1; renderQuestion();
  } else {
    renderEndPage(); showView('end');
  }
};
const prev = ()=>{ if (index>0){ index-=1; renderQuestion(); } };

// イベント
els.toStatsBtn2.addEventListener('click', ()=> showView('stats'));
els.backHomeBtn.addEventListener('click', ()=> showView('top'));
els.backTopBtn.addEventListener('click', ()=> showView('top'));

els.startBtn.addEventListener('click', ()=>{
  mode = els.modeSelect.value;
  applyFilter();
  if (order.length===0){ alert('該当の問題がありません。'); return; }
  order = shuffle(order); index=0;
  // セッション開始
  session = { startAt: Date.now(), perTag:{}, perYear:{} };
  showView('quiz'); renderQuestion();
});
els.shuffleBtn.addEventListener('click', ()=>{ order=shuffle(order); index=0; if (els.viewQuiz.classList.contains('active')) renderQuestion(); });
els.prevBtn.addEventListener('click', prev);
els.nextBtn.addEventListener('click', next);

els.modeSelect.addEventListener('change', (e)=>{ mode=e.target.value; if (els.viewQuiz.classList.contains('active')){ applyFilter(); renderQuestion(); }});
els.tagFilter.addEventListener('change', ()=>{ if (els.viewQuiz.classList.contains('active')){ applyFilter(); renderQuestion(); }});
els.yearFilter.addEventListener('change', ()=>{ if (els.viewQuiz.classList.contains('active')){ applyFilter(); renderQuestion(); }});
els.bookmarkBtn.addEventListener('click', ()=>{
  const q=questions[order[index]]; const b=getBookmarks();
  if (b.has(q.id)) b.delete(q.id); else b.add(q.id); setBookmarks(b); renderQuestion();
});
els.reviewWrongsBtn && els.reviewWrongsBtn.addEventListener('click', ()=>{
  mode='wrong'; els.modeSelect.value='wrong'; applyFilter();
  if (order.length===0){ alert('間違えた問題がありません。'); return; }
  order=shuffle(order); index=0; showView('quiz'); renderQuestion();
});
els.reviewBookmarksBtn && els.reviewBookmarksBtn.addEventListener('click', ()=>{
  mode='bookmarked'; els.modeSelect.value='bookmarked'; applyFilter();
  if (order.length===0){ alert('ブックマークがありません。'); return; }
  order=shuffle(order); index=0; showView('quiz'); renderQuestion();
});
els.resetStatsBtn && els.resetStatsBtn.addEventListener('click', ()=>{
  if (!confirm('この端末に保存された学習履歴（分野・年度の集計）をリセットしますか？\n※ ブックマーク/間違いリスト/進捗も消えます。')) return;
  localStorage.removeItem(STATE_KEY);
  localStorage.removeItem(BOOKMARK_KEY);
  localStorage.removeItem(WRONG_KEY);
  localStorage.removeItem(STATS_BY_TAG_KEY);
  localStorage.removeItem(STATS_BY_YEAR_KEY);
  stats={totalAnswered:0,totalCorrect:0,streak:0};
  order=[]; index=0;
  alert('学習履歴をリセットしました。');
  showView('top'); renderStatsPage();
});

// 初期化
(async function init(){
  try {
    questions = await loadJSON('./questions.json?v=11');
    populateFilters();

    const st0 = loadState();
    const canResume = st0 && Array.isArray(st0.order) && st0.order.length>0;
    if (canResume && els.resumeBtn && els.resumeInfo) {
      els.resumeBtn.classList.remove('hidden');
      const last = localStorage.getItem('quiz_lastAnswered');
      const when = last ? new Date(last).toLocaleString('ja-JP', { timeZone:'Asia/Tokyo' }) : '—';
      els.resumeInfo.textContent = `前回の進捗：${Math.min((st0.index||0)+1, st0.order.length)}/${st0.order.length}　最終回答：${when}`;
      els.resumeBtn.onclick = ()=>{
        mode = st0.mode || 'all';
        if (st0.currentTag) els.tagFilter.value = st0.currentTag;
        if (st0.currentYear) els.yearFilter.value = st0.currentYear;
        stats = st0.stats || stats;
        order = st0.order || [];
        index = Math.min(st0.index||0, Math.max(0, order.length-1));
        session.startAt = st0.sessionStart || Date.now();
        showView('quiz'); renderQuestion();
      };
    }

    const st = loadState();
    if (st) {
      stats = st.stats || stats;
      if (st.currentTag) els.tagFilter.value = st.currentTag;
      if (st.currentYear) els.yearFilter.value = st.currentYear;
      mode = st.mode || 'all';
      els.modeSelect.value = mode;
      session.startAt = st.sessionStart || null;
      applyFilter();
    } else {
      applyFilter();
    }

    updateStatsUI();
    scheduleCountdownRefresh();
  } catch (e) {
    console.error(e); alert('questions.json を読み込めませんでした。');
  }
})();
