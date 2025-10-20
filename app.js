// app.js — 0-based grading fixed & blue header buttons
const STATE_KEY = 'quiz_state_v5';
const BOOKMARK_KEY = 'quiz_bookmarks_v1';
const WRONG_KEY = 'quiz_wrongs_v1';
const STATS_BY_TAG_KEY = 'quiz_stats_by_tag_v2';
const STATS_BY_YEAR_KEY = 'quiz_stats_by_year_v1';

let questions = [];
let order = [];
let index = 0;
let mode = 'all';
let selectedSet = new Set();
let answered = false;
let session = { startAt: null, perTag: {}, perYear: {} };

const els = {
  // top
  viewTop: document.getElementById('viewTop'),
  matchCount: document.getElementById('matchCount'),
  yearFilter: document.getElementById('yearFilter'),
  tagFilter: document.getElementById('tagFilter'),
  modeSelect: document.getElementById('modeSelect'),
  startBtn: document.getElementById('startBtn'),
  yearGrid: document.getElementById('yearGrid'),
  tagGrid: document.getElementById('tagGrid'),
  // quiz
  viewQuiz: document.getElementById('viewQuiz'),
  qid: document.getElementById('qid'),
  questionText: document.getElementById('questionText'),
  qImage: document.getElementById('qImage'),
  tagsWrap: document.getElementById('tagsWrap'),
  choices: document.getElementById('choices'),
  explain: document.getElementById('explain'),
  prevBtn: document.getElementById('prevBtn'),
  nextBtn: document.getElementById('nextBtn'),
  bookmarkBtn: document.getElementById('bookmarkBtn'),
  progressBar: document.getElementById('progressBar'),
  progressNum: document.getElementById('progressNum'),
  accuracy: document.getElementById('accuracy'),
  streak: document.getElementById('streak'),
  // end
  viewEnd: document.getElementById('viewEnd'),
  finalAccuracy: document.getElementById('finalAccuracy'),
  finalCounts: document.getElementById('finalCounts'),
  finalDate: document.getElementById('finalDate'),
  finalDuration: document.getElementById('finalDuration'),
  weaknessList: document.getElementById('weaknessList'),
  backHomeBtn: document.getElementById('backHomeBtn'),
  toStatsBtn2: document.getElementById('toStatsBtn2'),
  // stats
  viewStats: document.getElementById('viewStats'),
  statsOverview: document.getElementById('statsOverview'),
  statsByTagTbody: document.getElementById('statsByTagTbody'),
  statsByYearTbody: document.getElementById('statsByYearTbody'),
  reviewWrongsBtn: document.getElementById('reviewWrongsBtn'),
  reviewBookmarksBtn: document.getElementById('reviewBookmarksBtn'),
  resetStatsBtn: document.getElementById('resetStatsBtn'),
  backTopBtn: document.getElementById('backTopBtn'),
  // header
  goTopBtn: document.getElementById('goTopBtn'),
  toStatsBtn: document.getElementById('toStatsBtn')
};

// ===== Countdown (JST) =====
function updateCountdown(){
  const now = new Date();
  const exam = new Date('2026-02-18T00:00:00+09:00');
  const ms = exam - now;
  const days = Math.max(0, Math.ceil(ms / (24*60*60*1000)));
  const el = document.getElementById('countdown');
  if (el) el.textContent = `残り ${days} 日`;
}
function scheduleCountdownRefresh(){
  updateCountdown();
  const now = new Date(); const next = new Date(now);
  next.setDate(now.getDate()+1); next.setHours(0,0,0,0);
  setTimeout(()=>{ updateCountdown(); setInterval(updateCountdown, 24*60*60*1000); }, next-now);
}

// ===== Utilities =====
const shuffle = (arr)=>{ const a=arr.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; };
const loadJSON = async (path)=>{ const res=await fetch(path); if(!res.ok) throw new Error('failed to load '+path); return await res.json(); };
const isYearTag = (t)=>{ const s=String(t).trim().toLowerCase(); return /^\d{4}$/.test(s) || s==='original' || s==='過去問'; };
const asCorrectArray = (ans)=> Array.isArray(ans) ? ans.slice().map(Number) : [Number(ans)];

// images: “ファイル名だけ”は ./assets/images/ を自動付与。URL/相対パスはそのまま。
const hasExt = (t)=>/\.(jpg|jpeg|png|webp|gif)$/i.test(t||'');
const resolveImageSrc = (raw)=>{
  if (!raw) return null;
  const t = String(raw).trim();
  if (!t || /^(-|なし|null|na)$/i.test(t)) return null;
  if (/^https?:\/\//i.test(t) || t.includes('/')) return hasExt(t) ? t : null;
  return hasExt(t) ? `./assets/images/${t}` : null;
};

// ===== Local Storage =====
const saveJSON = (k,v)=>localStorage.setItem(k, JSON.stringify(v));
const loadJSONls = (k, def=null)=>{ try{ const s=localStorage.getItem(k); return s? JSON.parse(s): def; } catch { return def; } };
const getBookmarks = ()=> new Set(loadJSONls(BOOKMARK_KEY, []));
const setBookmarks = (set)=> saveJSON(BOOKMARK_KEY, [...set]);
const getWrongs = ()=> new Set(loadJSONls(WRONG_KEY, []));
const setWrongs = (set)=> saveJSON(WRONG_KEY, [...set]);

let stats = loadJSONls(STATE_KEY+'_stats', { totalAnswered:0, totalCorrect:0, streak:0 });
function persistStats(){ saveJSON(STATE_KEY+'_stats', stats); }

function showView(name){
  ['viewTop','viewQuiz','viewEnd','viewStats'].forEach(id=>document.getElementById(id).classList.remove('active'));
  if (name==='top') els.viewTop.classList.add('active');
  if (name==='quiz') els.viewQuiz.classList.add('active');
  if (name==='end') els.viewEnd.classList.add('active');
  if (name==='stats') { els.viewStats.classList.add('active'); renderStatsPage(); }
}

function updateStatsUI(){
  els.progressNum.textContent = `${Math.min(index+1, Math.max(order.length,1))}/${order.length}`;
  const acc = stats.totalAnswered ? Math.round((stats.totalCorrect / stats.totalAnswered)*100) : 0;
  els.accuracy.textContent = `${acc}%`;
  els.streak.textContent = stats.streak;
  const percent = Math.round(((index+1)/Math.max(order.length,1))*100);
  els.progressBar.style.width = percent + '%';
}

// ===== Card Home =====
function buildCounts(){
  const yearCounts = new Map(); const tagCounts = new Map();
  questions.forEach(q=>{
    const tags = q.tags || [];
    tags.filter(isYearTag).forEach(y=> yearCounts.set(y,(yearCounts.get(y)||0)+1));
    tags.filter(t=>!isYearTag(t)).forEach(t=> tagCounts.set(t,(tagCounts.get(t)||0)+1));
  });
  return { yearCounts, tagCounts };
}
function renderCardGrid(){
  const { yearCounts, tagCounts } = buildCounts();
  const years = [...yearCounts.entries()].sort((a,b)=>{
    const [ya]=a, [yb]=b;
    const na = /^\d{4}$/.test(ya)?parseInt(ya,10):-Infinity;
    const nb = /^\d{4}$/.test(yb)?parseInt(yb,10):-Infinity;
    if (na!==-Infinity || nb!==-Infinity) return na-nb;
    return String(ya).localeCompare(String(yb));
  });
  els.yearGrid.innerHTML = years.map(([y,c])=>(
    `<div class="tile" data-year="${y}"><strong>${y}</strong><small>${c}問</small></div>`
  )).join('');

  const tags = [...tagCounts.entries()].sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
  els.tagGrid.innerHTML = [
    `<div class="tile" data-tag=""><strong>全ての分野</strong><small>${questions.length}問</small></div>`,
    ...tags.map(([t,c])=>`<div class="tile" data-tag="${t}"><strong>${t}</strong><small>${c}問</small></div>`)
  ].join('');

  [...els.yearGrid.querySelectorAll('.tile')].forEach(tile=>{
    tile.addEventListener('click', ()=>{ els.yearFilter.value = tile.dataset.year; updateMatchCount(); });
  });
  [...els.tagGrid.querySelectorAll('.tile')].forEach(tile=>{
    tile.addEventListener('click', ()=>{ els.tagFilter.value = tile.dataset.tag || ''; updateMatchCount(); });
  });
}
function updateMatchCount(){
  const tagSel = els.tagFilter.value;
  const yearSel = els.yearFilter.value;
  const wr = getWrongs();
  const bms = getBookmarks();
  const base = questions.map((q,i)=>i).filter(i=>{
    const tags = questions[i].tags||[];
    if (tagSel){ const hasTag = tags.some(t=>!isYearTag(t) && String(t)===tagSel); if(!hasTag) return false; }
    if (yearSel){ const hasYear = tags.some(t=>isYearTag(t) && String(t)===yearSel); if(!hasYear) return false; }
    if (mode==='wrong' && !wr.has(questions[i].id)) return false;
    if (mode==='bookmarked' && !bms.has(questions[i].id)) return false;
    return true;
  });
  els.matchCount.textContent = String(base.length);
  return base;
}

// ===== Quiz =====
function renderTags(q){
  els.tagsWrap.innerHTML = '';
  (q.tags || []).forEach(t=>{
    const s=document.createElement('span'); s.className='tag'; s.textContent=t;
    els.tagsWrap.appendChild(s);
  });
}
function renderQuestion(){
  const q = questions[order[index]];
  els.qid.textContent = q.id || `Q${order[index]+1}`;
  els.questionText.textContent = q.question || '';

  const src = resolveImageSrc(q.image);
  if (src){
    els.qImage.classList.remove('hidden');
    els.qImage.alt = q.imageAlt || '';
    els.qImage.onerror = ()=>{ els.qImage.classList.add('hidden'); els.qImage.removeAttribute('src'); els.qImage.removeAttribute('alt'); };
    els.qImage.src = src;
  }else{
    els.qImage.classList.add('hidden'); els.qImage.removeAttribute('src'); els.qImage.removeAttribute('alt');
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
  shuffled.forEach(i=>{
    const btn=document.createElement('button'); btn.className='choice';
    const val=q.choices[i];
    let choiceImg=null;
    if (typeof val==='string' && hasExt(val)) choiceImg = resolveImageSrc(val);
    if (choiceImg){
      btn.textContent=''; const img=document.createElement('img');
      img.alt=`choice${i+1}`; img.style.maxWidth='100%'; img.style.height='auto';
      img.onerror=()=>{ img.remove(); btn.textContent='[画像なし]'; };
      img.src=choiceImg; btn.appendChild(img);
    }else{
      btn.textContent = val;
    }
    btn.dataset.index=i;
    btn.addEventListener('click',()=>{
      if (answered) return;
      if (selectedSet.has(i)){ selectedSet.delete(i); btn.classList.remove('selected'); }
      else{ selectedSet.add(i); btn.classList.add('selected'); }
      els.nextBtn.disabled = selectedSet.size===0;
    });
    els.choices.appendChild(btn);
  });

  const bms = getBookmarks();
  els.bookmarkBtn.textContent = bms.has(q.id) ? '★ ブックマーク中' : '☆ ブックマーク';

  updateStatsUI();
}
function gradeCurrent(){
  const q = questions[order[index]];
  // —— 0始まり固定。questions.jsonの値をそのまま使用 ——
  const correct = asCorrectArray(q.answerIndex).map(Number).sort((a,b)=>a-b);
  const picked  = [...selectedSet].sort((a,b)=>a-b);
  const ok = (picked.length===correct.length) && picked.every((v,i)=>v===correct[i]);

  [...document.querySelectorAll('.choice')].forEach(b=>{
    const bi = Number(b.dataset.index);
    if (correct.includes(bi)) b.classList.add('correct');
    if (selectedSet.has(bi) && !correct.includes(bi)) b.classList.add('incorrect');
    b.disabled = true;
  });

  stats.totalAnswered += 1;
  if (ok){ stats.totalCorrect += 1; stats.streak += 1; const w=getWrongs(); w.delete(q.id); setWrongs(w); }
  else { stats.streak = 0; const w=getWrongs(); w.add(q.id); setWrongs(w); }
  localStorage.setItem('quiz_lastAnswered', new Date().toISOString());
  els.explain.classList.remove('hidden');
  updateStatsUI(); persistStats();

  (q.tags||[]).forEach(t=>{
    if (!session.perTag[t]) session.perTag[t]={ans:0, cor:0};
    session.perTag[t].ans += 1;
    if (ok) session.perTag[t].cor += 1;
  });
  (q.tags||[]).forEach(t=>{
    if (isYearTag(t)){
      if (!session.perYear[t]) session.perYear[t]={ans:0, cor:0};
      session.perYear[t].ans += 1;
      if (ok) session.perYear[t].cor += 1;
    }
  });

  answered = true;
  els.nextBtn.textContent = (index < order.length-1) ? '次へ ▶' : '結果を見る';
}

// ===== Filter / End / Stats =====
function applyFilter(){
  const tagSel = els.tagFilter.value;
  const yearSel = els.yearFilter.value;
  const wr = getWrongs();
  const bms = getBookmarks();

  const base = questions.map((q,i)=>i).filter(i=>{
    const tags = questions[i].tags||[];
    if (tagSel){ const hasTag = tags.some(t=>!isYearTag(t) && String(t)===tagSel); if(!hasTag) return false; }
    if (yearSel){ const hasYear = tags.some(t=>isYearTag(t) && String(t)===yearSel); if(!hasYear) return false; }
    if (mode==='wrong' && !wr.has(questions[i].id)) return false;
    if (mode==='bookmarked' && !bms.has(questions[i].id)) return false;
    return true;
  });

  order = base; index = 0;
  els.matchCount.textContent = String(order.length);
}
function renderEndPage(){
  const acc = stats.totalAnswered ? Math.round((stats.totalCorrect / stats.totalAnswered)*100) : 0;
  els.finalAccuracy.textContent = `${acc}%`;
  const wrongs = stats.totalAnswered - stats.totalCorrect;
  els.finalCounts.textContent = `正解 ${stats.totalCorrect} / 不正解 ${wrongs}（全${stats.totalAnswered}問）`;
  els.finalDate.textContent = `回答日時：${new Date().toLocaleString('ja-JP', { timeZone:'Asia/Tokyo' })}`;

  if (session.startAt){
    const ms = Date.now() - session.startAt;
    const m = Math.floor(ms/60000), s = Math.floor((ms%60000)/1000);
    els.finalDuration.textContent = `所要時間：${m}分${s}秒`;
  } else { els.finalDuration.textContent = ''; }

  const rows=[];
  Object.entries(session.perTag).forEach(([k,v])=>{ if (v.ans>=3) rows.push({kind:'分野', key:k, ans:v.ans, acc: Math.round((v.cor/v.ans)*100)}); });
  Object.entries(session.perYear).forEach(([k,v])=>{ if (v.ans>=3) rows.push({kind:'年度', key:k, ans:v.ans, acc: Math.round((v.cor/v.ans)*100)}); });
  rows.sort((a,b)=>a.acc-b.acc || b.ans-a.ans);

  if (!rows.length){
    els.weaknessList.innerHTML = '<p class="notice">（今回の回答数が少ないため、弱点分析は表示できません）</p>';
  }else{
    els.weaknessList.innerHTML = `
      <table class="table">
        <thead><tr><th>種別</th><th>ラベル</th><th>正答率</th><th>回答数</th></tr></thead>
        <tbody>${rows.slice(0,5).map(r=>`<tr><td>${r.kind}</td><td>${r.key}</td><td>${r.acc}%</td><td>${r.ans}</td></tr>`).join('')}</tbody>
      </table>`;
  }
}
function getStatsByTag(){ return loadJSONls(STATS_BY_TAG_KEY, {}); }
function setStatsByTag(o){ saveJSON(STATS_BY_TAG_KEY, o); }
function getStatsByYear(){ return loadJSONls(STATS_BY_YEAR_KEY, {}); }
function setStatsByYear(o){ saveJSON(STATS_BY_YEAR_KEY, o); }
function renderStatsPage(){
  const acc = stats.totalAnswered ? Math.round((stats.totalCorrect / stats.totalAnswered)*100) : 0;
  els.statsOverview.innerHTML = `累計 正答率：<b>${acc}%</b>（正解 ${stats.totalCorrect} / 全 ${stats.totalAnswered}）`;

  const sbt = getStatsByTag();
  const rowsTag = Object.entries(sbt).map(([k,v])=>{
    const ans=v.answered||0, cor=v.correct||0, a=ans?Math.round((cor/ans)*100):0;
    return {k, ans, cor, a};
  }).sort((a,b)=>a.k.localeCompare(b.k));
  els.statsByTagTbody.innerHTML = rowsTag.length ? rowsTag.map(r=>`<tr><td>${r.k}</td><td>${r.a}%</td><td>${r.cor}/${r.ans}</td></tr>`).join('') : '<tr><td colspan="3">（データなし）</td></tr>';

  const sby = getStatsByYear();
  const rowsYear = Object.entries(sby).map(([k,v])=>{
    const ans=v.answered||0, cor=v.correct||0, a=ans?Math.round((cor/ans)*100):0;
    return {k, ans, cor, a};
  }).sort((a,b)=>{
    const an=/^\d{4}$/.test(a.k)?parseInt(a.k,10):Infinity;
    const bn=/^\d{4}$/.test(b.k)?parseInt(b.k,10):Infinity;
    return an-bn || a.k.localeCompare(b.k);
  });
  els.statsByYearTbody.innerHTML = rowsYear.length ? rowsYear.map(r=>`<tr><td>${r.k}</td><td>${r.a}%</td><td>${r.cor}/${r.ans}</td></tr>`).join('') : '<tr><td colspan="3">（データなし）</td></tr>';
}

// ===== Navigation / Events =====
function toTop(){ showView('top'); }
function toStats(){ showView('stats'); }

els.goTopBtn.addEventListener('click', toTop);
els.toStatsBtn.addEventListener('click', toStats);
els.toStatsBtn2.addEventListener('click', toStats);
els.backHomeBtn.addEventListener('click', toTop);
els.backTopBtn.addEventListener('click', toTop);

els.startBtn.addEventListener('click', ()=>{
  mode = els.modeSelect.value;
  const base = updateMatchCount();
  if (base.length===0){ alert('該当の問題がありません。条件を変えてみてください。'); return; }
  order = shuffle(base);
  index = 0;
  session = { startAt: Date.now(), perTag:{}, perYear:{} };
  showView('quiz'); renderQuestion(); updateStatsUI();
});

els.prevBtn.addEventListener('click', ()=>{ if (index>0){ index--; renderQuestion(); }});
els.nextBtn.addEventListener('click', ()=>{
  if (!answered){ gradeCurrent(); return; }
  if (index < order.length-1){ index++; renderQuestion(); }
  else{ renderEndPage(); showView('end'); }
});
els.bookmarkBtn.addEventListener('click', ()=>{
  const q=questions[order[index]]; const set=getBookmarks();
  if (set.has(q.id)) set.delete(q.id); else set.add(q.id);
  setBookmarks(set);
  renderQuestion();
});

['change','input'].forEach(ev=>{
  els.yearFilter.addEventListener(ev, ()=>{ updateMatchCount(); });
  els.tagFilter.addEventListener(ev,  ()=>{ updateMatchCount(); });
  els.modeSelect.addEventListener(ev, ()=>{ mode = els.modeSelect.value; updateMatchCount(); });
});

els.reviewWrongsBtn.addEventListener('click', ()=>{
  mode='wrong'; els.modeSelect.value='wrong';
  const base = updateMatchCount(); if (base.length===0){ alert('間違えた問題がありません。'); return; }
  order = shuffle(base); index=0; showView('quiz'); renderQuestion();
});
els.reviewBookmarksBtn.addEventListener('click', ()=>{
  mode='bookmarked'; els.modeSelect.value='bookmarked';
  const base = updateMatchCount(); if (base.length===0){ alert('ブックマークがありません。'); return; }
  order = shuffle(base); index=0; showView('quiz'); renderQuestion();
});
els.resetStatsBtn.addEventListener('click', ()=>{
  if (!confirm('この端末の学習履歴をリセットしますか？（ブックマーク・間違いも消えます）')) return;
  localStorage.clear();
  stats={ totalAnswered:0,totalCorrect:0,streak:0 };
  order=[]; index=0; alert('リセットしました。');
  toTop(); renderCardGrid(); populateFilters(); updateMatchCount();
});

// ===== Init =====
(async function init(){
  try{
    questions = await loadJSON('./questions.json?v=21');
    renderCardGrid();
    populateFilters();
    updateMatchCount();
    scheduleCountdownRefresh();
  }catch(e){
    console.error(e);
    alert('questions.json を読み込めませんでした。');
  }
})();
function populateFilters(){
  const years = new Set(), tags = new Set();
  questions.forEach(q => (q.tags||[]).forEach(t => (isYearTag(t)?years:tags).add(String(t))));
  els.yearFilter.innerHTML = '<option value="">すべての年度</option>' + [...years].sort((a,b)=>{
    const an=/^\d{4}$/.test(a)?parseInt(a,10):-Infinity;
    const bn=/^\d{4}$/.test(b)?parseInt(b,10):-Infinity;
    return an-bn || String(a).localeCompare(String(b));
  }).map(y=>`<option value="${y}">${y}</option>`).join('');
  els.tagFilter.innerHTML = '<option value="">全ての分野</option>' + [...tags].sort().map(t=>`<option value="${t}">${t}</option>`).join('');
}

