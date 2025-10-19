/* ===========================================
   臨床生理アプリ v15.2.7 (images resolver, choices fix)
=========================================== */
const BUILD = '2025-10-19-cs-15.2.7';
const DATE_TARGET = '2026-02-18T00:00:00+09:00';
const q$ = (q) => document.querySelector(q);
const q$$ = (q) => Array.from(document.querySelectorAll(q));
const params = new URLSearchParams(location.search);
const DBG = params.get('dbg') === '1';

const state = { screen:'home', all:[], filtered:[], idx:0, tags:[], years:[], tagFilter:'', yearFilter:'', session:null };
const TRY_EXTS = ['.png','.jpg','.jpeg','.webp','.gif','.svg'];

function log(...a){ if (DBG) console.log('[DBG]', ...a); }
function showError(msg){ const box = q$('#alert'); if (!box) return; box.textContent = msg; box.classList.remove('hidden'); }
function hideError(){ const box=q$('#alert'); if (box) box.classList.add('hidden'); }

function startCountdown(){
  const node=q$('#countdown'); if (!node) return;
  const target=new Date(DATE_TARGET);
  const tick=()=>{ const days=Math.max(0, Math.ceil((target - new Date())/86400000)); node.textContent=`試験日まで残り ${days} 日`; };
  tick(); setInterval(tick, 60000);
}

window.addEventListener('DOMContentLoaded', boot);

async function boot(){
  startCountdown();
  try{
    const res = await fetch(`./questions.json?v=${encodeURIComponent(BUILD)}`, {cache:'no-store'});
    if (!res.ok) throw new Error(`questions.json 読み込み失敗: ${res.status}`);
    const raw = await res.json();
    if (!Array.isArray(raw)) throw new Error('questions.json が配列ではありません');
    state.all = raw.map(normalizeQuestion).filter(q => q.choices.length >= 2);
    log('questions loaded:', state.all.length);
  }catch(e){
    console.error(e); showError('questions.json の読み込みに失敗しました。'); return;
  }

  computeFacets(); initHome(); initFilters(); bindUI(); showHome(); setFooterVisibility();
}

/** Excel/JSON 混在に耐える正規化 */
function normalizeQuestion(src){
  const q = {...src};

  // question
  q.question = String(q.question ?? q.設問 ?? q.問題 ?? q.問 ?? '').trim();

  // choices: choices[] が無ければ choice1..5 を拾って配列化
  let choices = Array.isArray(q.choices) ? q.choices : [];
  if (!choices.length){
    const cands = [q.choice1, q.choice2, q.choice3, q.choice4, q.choice5];
    choices = cands.filter(v => v !== undefined && v !== null).map(v => String(v).trim()).filter(s => s !== '');
  }
  q.choices = choices.slice(0,5);

  // answerIndex: 0始まりを前提。なければ answer から生成（複数もOK）
  let ans = q.answerIndex;
  if (ans === undefined || ans === null){
    const a = (q.answer ?? q.解答 ?? '').toString().trim();
    if (a){
      if (/^-?\d+(?:\s*[,/・\s]\s*-?\d+)*$/.test(a)){
        const nums = a.split(/[,/・\s]+/).filter(Boolean).map(s=>parseInt(s,10));
        ans = nums.length === 1 ? nums[0] : Array.from(new Set(nums)).sort((x,y)=>x-y);
      }
    }
  }
  if (Array.isArray(ans)){ q.answerIndex = ans.map(n=>Number(n)); }
  else q.answerIndex = Number.isFinite(ans) ? Number(ans) : 0;

  // tags: 文字列でも配列でもOK
  if (Array.isArray(q.tags)) q.tags = q.tags.map(String);
  else {
    const t = String(q.tags ?? '').trim();
    q.tags = t ? t.split(/[,\u3001\uFF0C/／\|\s]+/).filter(Boolean) : [];
  }

  // image: 拡張子なしでもOKにするため imageBase を作成
  let img = (q.image ?? '').toString().trim();
  if (img && !/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(img)){
    img = img.replace(/\/+$/,''); // 末尾スラッシュ除去
  }
  q.imageBase = img; // 表示時に拡張子を順に試す
  return q;
}

function computeFacets(){
  const tagSet = new Set(), yearSet = new Set();
  for (const q of state.all){
    (q.tags||[]).forEach(t => {
      if (/^\d{4}$/.test(t) || t === 'original') yearSet.add(t);
      else tagSet.add(t);
    });
  }
  state.tags = Array.from(tagSet);
  state.years = Array.from(yearSet).sort();
}

function initHome(){
  const ysel=q$('#homeYearSel'), tsel=q$('#homeTagSel');
  state.years.forEach(y => ysel.insertAdjacentHTML('beforeend', `<option value="${esc(y)}">${esc(y)}</option>`));
  state.tags.forEach(t => tsel.insertAdjacentHTML('beforeend', `<option value="${esc(t)}">${esc(t)}</option>`));

  const updateCount = ()=>{
    const c = estimateCount({year: ysel.value, tag: tsel.value});
    q$('#homeCount').innerHTML = c===0 ? `<span class="count-warn">該当 0 問（条件を変更してください）</span>` : `該当 ${c} 問`;
  };
  ysel.addEventListener('change', updateCount);
  tsel.addEventListener('change', updateCount);

  // 年度タイル
  const yNode=q$('#homeYears'); yNode.innerHTML='';
  state.years.forEach(y => {
    const c=estimateCount({year:y, tag: tsel.value});
    const div=document.createElement('div'); div.className='tile';
    div.innerHTML=`<h3>${esc(y)}</h3><div class="muted">${c}問</div>`;
    div.addEventListener('click',()=>{ ysel.value=y; updateCount(); });
    yNode.appendChild(div);
  });

  // 分野タイル（＋全ての分野）
  const tNode=q$('#homeTags'); tNode.innerHTML='';
  const allDiv=document.createElement('div'); allDiv.className='tile';
  allDiv.innerHTML=`<h3>全ての分野</h3><div class="muted">${state.all.length}問</div>`;
  allDiv.addEventListener('click',()=>{ tsel.value=''; updateCount(); });
  tNode.appendChild(allDiv);

  state.tags.forEach(t => {
    const c=estimateCount({year: ysel.value, tag: t});
    const div=document.createElement('div'); div.className='tile';
    div.innerHTML=`<h3>${esc(t)}</h3><div class="muted">${c}問</div>`;
    div.addEventListener('click',()=>{ tsel.value=t; updateCount(); });
    tNode.appendChild(div);
  });

  q$('#homeStartBtn').addEventListener('click', ()=>{ startFromHome({year: ysel.value, tag: tsel.value}); });
  q$('#homeStartAllBtn').addEventListener('click', ()=>{ startFromHome({year: '', tag: ''}); });
  updateCount();
}

function estimateCount({year='', tag=''}){
  return state.all.filter(q=>{
    const tags = (q.tags||[]);
    const okYear = (year === '' || tags.includes(year));
    const okTag  = (tag  === '' || tags.includes(tag));
    return okYear && okTag;
  }).length;
}

function initFilters(){
  const tagSel=q$('#tagFilter'), yearSel=q$('#yearFilter');
  state.tags.forEach(t => tagSel.insertAdjacentHTML('beforeend', `<option value="${esc(t)}">${esc(t)}</option>`));
  state.years.forEach(y => yearSel.insertAdjacentHTML('beforeend', `<option value="${esc(y)}">${esc(y)}</option>`));
}

function applyFilters(){
  const tag = (q$('#tagFilter')?.value ?? state.tagFilter) || '';
  const year = (q$('#yearFilter')?.value ?? state.yearFilter) || '';
  state.filtered = state.all.filter(q=>{
    const tags=(q.tags||[]);
    const okYear=(year==='' || tags.includes(year));
    const okTag=(tag==='' || tags.includes(tag));
    return okYear && okTag;
  });
  state.tagFilter=tag; state.yearFilter=year; state.idx=0;
  log('applyFilters ->', {year, tag, count: state.filtered.length});
}

function startFromHome({year='', tag=''}={}){
  hideError();
  const ySel=q$('#yearFilter'), tSel=q$('#tagFilter');
  if (ySel) ySel.value = year;
  if (tSel) tSel.value = tag;
  state.yearFilter = year; state.tagFilter = tag;
  applyFilters();
  const count = state.filtered.length;
  if (count <= 0){
    q$('#homeCount').innerHTML = `<span class="count-warn">該当 0 問（条件を変更してください）</span>`;
    showError('該当問題が0件のため開始できません。条件を変更してください。');
    return;
  }
  state.session={ startedAt: Date.now(), correct:0, total: count };
  showQuiz(); render();
}

function showHome(){ q$('#homeScreen').classList.remove('hidden'); q$('#quizScreen').classList.add('hidden'); q$('#resultScreen').classList.add('hidden'); state.screen='home'; setFooterVisibility(); }
function showQuiz(){ q$('#homeScreen').classList.add('hidden'); q$('#quizScreen').classList.remove('hidden'); q$('#resultScreen').classList.add('hidden'); state.screen='quiz'; setFooterVisibility(); }
function showResult(){ q$('#homeScreen').classList.add('hidden'); q$('#quizScreen').classList.add('hidden'); q$('#resultScreen').classList.remove('hidden'); state.screen='result'; setFooterVisibility(); }
function setFooterVisibility(){ const isHome=state.screen==='home'; q$('#prevBtn').classList.toggle('hidden', isHome); q$('#nextBtn').classList.toggle('hidden', isHome); q$('#progress').classList.toggle('hidden', isHome); }

function render(){
  if (state.screen!=='quiz') return;
  const total=state.filtered.length;
  const qtext=q$('#qtext'), qimg=q$('#qimage'), explain=q$('#explain');
  if (!total){
    qtext.textContent='該当する問題がありません。トップページまたはフィルタを変更してください。';
    q$('#choices').innerHTML=''; qimg.classList.add('hidden'); explain.classList.add('hidden'); q$('#progress').textContent=''; q$('#qmeta').textContent=''; q$('#nextBtn').disabled=true; return;
  }
  const q = state.filtered[state.idx];
  q$('#qtext').textContent = q.question || '';
  q$('#qmeta').textContent = `ID：${getQuestionId(q)}`;
  renderImage(q); renderChoices(q);
  explain.classList.add('hidden'); explain.innerHTML='';
  q$('#progress').textContent = `${state.idx+1} / ${total}`;
  updateNextButtonAvailability(q);
}

function getQuestionId(q){ return (q && (q.id!==undefined && q.id!==null)) ? String(q.id) : `idx:${state.idx}`; }

// 画像パス自動解決（拡張子順に試す）
function renderImage(q){
  const node=q$('#qimage');
  const base = (q.imageBase || q.image || '').trim();
  if (!base){ node.classList.add('hidden'); node.innerHTML=''; return; }
  node.classList.remove('hidden');
  let i=0;
  const img=document.createElement('img');
  img.style.maxWidth='100%'; img.style.borderRadius='12px'; img.style.border='1px solid rgba(15,23,42,.1)';
  const setSrc=()=>{ const src = /\.[a-z]{3,4}$/i.test(base) ? base : (base + TRY_EXTS[i]); img.src = src; img.alt = '問題図'; };
  img.onerror=()=>{ i++; if (i<TRY_EXTS.length) setSrc(); else { node.classList.add('hidden'); node.innerHTML=''; } };
  setSrc();
  node.innerHTML=''; node.appendChild(img);
}

function renderChoices(q){
  const wrap=q$('#choices'); wrap.innerHTML='';
  const multi = Array.isArray(q.answerIndex);
  const n=(q.choices||[]).length;
  const order = Array.from({length:n}, (_,i)=>i);
  for (let i=order.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [order[i],order[j]]=[order[j],order[i]]; }
  order.forEach((origIdx)=>{
    const text=q.choices[origIdx];
    const btn=document.createElement('button');
    btn.className='choice';
    btn.setAttribute('data-idx', String(origIdx));
    btn.setAttribute('aria-pressed','false');
    btn.innerHTML=esc(text);
    btn.addEventListener('click',()=>{
      if (multi){ btn.classList.toggle('selected'); btn.setAttribute('aria-pressed', String(btn.classList.contains('selected'))); }
      else { q$$('#choices .choice').forEach(el=>{ el.classList.remove('selected'); el.setAttribute('aria-pressed','false'); }); btn.classList.add('selected'); btn.setAttribute('aria-pressed','true'); }
      updateNextButtonAvailability(q);
    });
    wrap.appendChild(btn);
  });
  q$('#nextBtn').textContent='解答する';
}

function updateNextButtonAvailability(q){
  const selected=q$$('#choices .choice.selected'); const nextBtn=q$('#nextBtn');
  if (Array.isArray(q.answerIndex)){ const need=q.answerIndex.length; nextBtn.disabled=(selected.length!==need); nextBtn.title=selected.length!==need?`この問題は ${need} 個選んでください`:''; }
  else { nextBtn.disabled=(selected.length!==1); nextBtn.title=selected.length!==1?'選択肢を1つ選んでください':''; }
}

function grade(){
  const q=state.filtered[state.idx];
  const selectedNodes=q$$('#choices .choice.selected');
  if (!selectedNodes.length){ updateNextButtonAvailability(q); return; }
  if (Array.isArray(q.answerIndex) && selectedNodes.length!==q.answerIndex.length){ updateNextButtonAvailability(q); return; }
  const selected=selectedNodes.map(el=>Number(el.getAttribute('data-idx')));
  const result=isCorrectAnswer(selected, q.answerIndex);
  const correctSet=new Set(Array.isArray(q.answerIndex)?q.answerIndex:[q.answerIndex]);
  q$$('#choices .choice').forEach(el=>{ const idx=Number(el.getAttribute('data-idx')); if (correctSet.has(idx)) el.classList.add('correct'); if (selected.includes(idx) && !correctSet.has(idx)) el.classList.add('incorrect'); });
  const explain=q$('#explain'); const multi=Array.isArray(q.answerIndex);
  const feedback = result.ok ? (multi?`🎉 全て正解です（${result.total}/${result.total}）`:'🎉 正解です') : (multi?`▲ 部分正解：${result.partial}/${result.total}。残りの選択肢も確認しましょう。`:`✕ 不正解。もう一度見直しましょう。`);
  explain.classList.remove('hidden'); explain.innerHTML = `<div>${feedback}</div>`;
  if (state.idx >= state.filtered.length-1){ q$('#nextBtn').textContent='結果を見る'; } else { q$('#nextBtn').textContent='次へ'; }
  q$('#nextBtn').disabled=false;
}

function next(){ if (state.screen==='home') return; if (state.screen==='result'){ showHome(); return; } const btn=q$('#nextBtn'); if (btn.textContent.includes('解答')) { grade(); return; } if (btn.textContent.includes('結果')) { showResult(); return; } if (state.idx < state.filtered.length-1) state.idx += 1; render(); }
function prev(){ if (state.screen!=='quiz') return; if (state.idx > 0) state.idx -= 1; render(); }

function bindUI(){
  q$('#homeBtn')?.addEventListener('click', showHome);
  q$('#statsBtn')?.addEventListener('click', ()=>alert('成績・弱点は後日実装（起動優先のセーフモード）'));
  q$('#tagFilter')?.addEventListener('change', ()=>{ applyFilters(); render(); });
  q$('#yearFilter')?.addEventListener('change', ()=>{ applyFilters(); render(); });
  q$('#nextBtn')?.addEventListener('click', next);
  q$('#prevBtn')?.addEventListener('click', prev);
}

function isCorrectAnswer(selected, answerIndex){
  if (Array.isArray(answerIndex)){
    const c=[...answerIndex].sort((a,b)=>a-b);
    const u=[...new Set(selected)].sort((a,b)=>a-b);
    let i=0,j=0,hit=0; while(i<u.length && j<c.length){ if (u[i]===c[j]){ hit++; i++; j++; } else if (u[i]<c[j]) i++; else j++; }
    if (c.length !== u.length) return { ok:false, partial:hit, total:c.length };
    return { ok: c.every((v,k)=>v===u[k]), partial: hit, total: c.length };
  }
  return { ok: (selected.length===1 && selected[0]===answerIndex), partial: (selected.includes(answerIndex)?1:0), total:1 };
}
function esc(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
