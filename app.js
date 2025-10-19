/* ===========================================
   臨床生理アプリ v15.2.8 (choices=5, choice image, explanation)
=========================================== */
const BUILD='2025-10-20-cs-15.2.8';
const DATE_TARGET='2026-02-18T00:00:00+09:00';
const TRY_EXTS=['.png','.jpg','.jpeg','.webp','.gif','.svg'];
const q$=(q)=>document.querySelector(q), q$$=(q)=>Array.from(document.querySelectorAll(q));
const state={screen:'home',all:[],filtered:[],idx:0,tags:[],years:[],tagFilter:'',yearFilter:'',session:null};

window.addEventListener('DOMContentLoaded',boot);
function countdown(){const n=q$('#countdown');if(!n)return;const t=new Date(DATE_TARGET);const tick=()=>{n.textContent=`試験日まで残り ${Math.max(0,Math.ceil((t-new Date())/86400000))} 日`;};tick();setInterval(tick,60000);}

async function boot(){
  countdown();
  try{
    const res=await fetch(`./questions.json?v=${encodeURIComponent(BUILD)}`,{cache:'no-store'});
    if(!res.ok) throw new Error(res.status);
    const raw=await res.json();
    if(!Array.isArray(raw)) throw new Error('questions.json が配列ではありません');
    state.all=raw.map(normalize).filter(q=>q.choices.length===5);
  }catch(e){
    console.error(e);
    const box=q$('#alert'); if(box){box.textContent='questions.json の読み込みに失敗しました。'; box.classList.remove('hidden');}
    return;
  }
  computeFacets(); initHome(); initFilters(); bindUI(); showHome(); setFooter();
}

function normalize(src){
  const q={...src};
  q.question=String(q.question??q.問題??q.設問??q.問??'').trim();
  let choices=Array.isArray(q.choices)?q.choices:[q.choice1,q.choice2,q.choice3,q.choice4,q.choice5];
  choices=(choices||[]).slice(0,5).map(v=>v==null?'':String(v)); while(choices.length<5) choices.push('');
  q.choices=choices;
  let ans=q.answerIndex;
  if(ans===undefined||ans===null){
    const s=String(q.answer??q.解答??'').trim();
    if(s){ const nums=s.split(/[,/・\s]+/).filter(Boolean).map(x=>parseInt(x,10)); ans=nums.length>1?Array.from(new Set(nums)).sort((a,b)=>a-b):(nums[0]??0);} else { ans=0; }
  }
  q.answerIndex=ans;
  if(Array.isArray(q.tags)) q.tags=q.tags.map(String); else { const t=String(q.tags??'').trim(); q.tags=t? t.split(/[,\u3001\uFF0C/／\|\s]+/).filter(Boolean): []; }
  let img=(q.image??'').toString().trim(); if(img && !/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(img)) img=img.replace(/\/+$/,'');
  q.imageBase=img;
  q.explanation=q.explanation??q.解説??null;
  return q;
}

function computeFacets(){const tagSet=new Set(),yearSet=new Set();for(const q of state.all){(q.tags||[]).forEach(t=>{if(/^\d{4}$/.test(t)||t==='original')yearSet.add(t);else tagSet.add(t);});}state.tags=[...tagSet];state.years=[...yearSet].sort();}

function initHome(){
  const ysel=q$('#homeYearSel'), tsel=q$('#homeTagSel');
  state.years.forEach(y=> ysel.insertAdjacentHTML('beforeend',`<option value="${esc(y)}">${esc(y)}</option>`));
  state.tags.forEach(t=> tsel.insertAdjacentHTML('beforeend',`<option value="${esc(t)}">${esc(t)}</option>`));
  const update=()=>{const c=count({year: ysel.value, tag: tsel.value}); q$('#homeCount').innerHTML = c===0?`<span style="color:#ef4444;font-weight:600;">該当 0 問（条件を変更してください）</span>`:`該当 ${c} 問`;};
  ysel.addEventListener('change',update); tsel.addEventListener('change',update);

  const yNode=q$('#homeYears'); yNode.innerHTML='';
  state.years.forEach(y=>{ const c=count({year:y, tag: tsel.value}); const d=document.createElement('div'); d.className='tile'; d.innerHTML=`<h3>${esc(y)}</h3><div class="muted">${c}問</div>`; d.addEventListener('click',()=>{ ysel.value=y; update(); }); yNode.appendChild(d); });

  const tNode=q$('#homeTags'); tNode.innerHTML='';
  const allDiv=document.createElement('div'); allDiv.className='tile'; allDiv.innerHTML=`<h3>全ての分野</h3><div class="muted">${state.all.length}問</div>`; allDiv.addEventListener('click',()=>{ tsel.value=''; update(); }); tNode.appendChild(allDiv);
  state.tags.forEach(t=>{ const c=count({year: ysel.value, tag: t}); const d=document.createElement('div'); d.className='tile'; d.innerHTML=`<h3>${esc(t)}</h3><div class="muted">${c}問</div>`; d.addEventListener('click',()=>{ tsel.value=t; update(); }); tNode.appendChild(d); });

  q$('#homeStartBtn').addEventListener('click',()=> startFromHome({year: ysel.value, tag: tsel.value}));
  q$('#homeStartAllBtn').addEventListener('click',()=> startFromHome({year:'', tag:''}));
  update();
}
function count({year='',tag=''}){return state.all.filter(q=>{const t=q.tags||[];return (year===''||t.includes(year))&&(tag===''||t.includes(tag));}).length;}

function initFilters(){const tagSel=q$('#tagFilter'), yearSel=q$('#yearFilter');state.tags.forEach(t=> tagSel.insertAdjacentHTML('beforeend',`<option value="${esc(t)}">${esc(t)}</option>`));state.years.forEach(y=> yearSel.insertAdjacentHTML('beforeend',`<option value="${esc(y)}">${esc(y)}</option>`));}
function applyFilters(){const tag=(q$('#tagFilter')?.value||state.tagFilter)||'';const year=(q$('#yearFilter')?.value||state.yearFilter)||'';state.filtered=state.all.filter(q=>{const t=q.tags||[];return (year===''||t.includes(year))&&(tag===''||t.includes(tag));});state.tagFilter=tag;state.yearFilter=year;state.idx=0;}
function startFromHome({year='',tag=''}={}){const ySel=q$('#yearFilter'),tSel=q$('#tagFilter');if(ySel)ySel.value=year;if(tSel)tSel.value=tag;state.yearFilter=year;state.tagFilter=tag;applyFilters();const n=state.filtered.length;if(!n){const a=q$('#alert');if(a){a.textContent='該当問題が0件のため開始できません。';a.classList.remove('hidden');}return;}state.session={startedAt:Date.now(),correct:0,total:n};showQuiz();render();}

function showHome(){q$('#homeScreen').classList.remove('hidden');q$('#quizScreen').classList.add('hidden');q$('#resultScreen').classList.add('hidden');state.screen='home'; setFooter();}
function showQuiz(){q$('#homeScreen').classList.add('hidden');q$('#quizScreen').classList.remove('hidden');q$('#resultScreen').classList.add('hidden');state.screen='quiz'; setFooter();}
function showResult(){q$('#homeScreen').classList.add('hidden');q$('#quizScreen').classList.add('hidden');q$('#resultScreen').classList.remove('hidden');state.screen='result'; setFooter();}
function setFooter(){const home=state.screen==='home'; q$('#prevBtn').classList.toggle('hidden',home); q$('#nextBtn').classList.toggle('hidden',home); q$('#progress').classList.toggle('hidden',home);}

function render(){if(state.screen!=='quiz')return;const total=state.filtered.length;const qtext=q$('#qtext'),qimg=q$('#qimage'),explain=q$('#explain');const q=state.filtered[state.idx];qtext.textContent=q.question||'';q$('#qmeta').textContent=`ID：${q.id??`idx:${state.idx}`}`;renderImage(q);renderChoices(q);explain.classList.add('hidden');explain.innerHTML='';q$('#progress').textContent=`${state.idx+1} / ${total}`;updateNextButtonAvailability(q);}

function renderImage(q){const node=q$('#qimage');const base=(q.imageBase||q.image||'').trim();if(!base){node.classList.add('hidden');node.innerHTML='';return;}node.classList.remove('hidden');let i=0;const img=document.createElement('img');img.style.maxWidth='100%';img.style.borderRadius='12px';img.style.border='1px solid rgba(15,23,42,.1)';const set=()=>{const src=/\.[a-z]{3,4}$/i.test(base)?base:(base+TRY_EXTS[i]);img.src=src;img.alt='問題図';};img.onerror=()=>{i++;if(i<TRY_EXTS.length)set();else{node.classList.add('hidden');node.innerHTML='';}};set();node.innerHTML='';node.appendChild(img);}

function renderChoices(q){const wrap=q$('#choices');wrap.innerHTML='';const multi=Array.isArray(q.answerIndex);const order=[0,1,2,3,4];for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}order.forEach(idx=>{const val=String(q.choices[idx]??'');const btn=document.createElement('button');btn.className='choice';btn.setAttribute('data-idx',String(idx));btn.setAttribute('aria-pressed','false');if(/^assets\//.test(val)||/^images\//.test(val)){const base=/\.[a-z]{3,4}$/i.test(val)?val:val.replace(/\/+$/,'');const img=document.createElement('img');img.style.maxWidth='100%';img.style.display='block';let k=0;const set=()=>{img.src=/\.[a-z]{3,4}$/i.test(base)?base:(base+TRY_EXTS[k]);};img.onerror=()=>{k++;if(k<TRY_EXTS.length)set();else btn.textContent='(画像なし)';};set();btn.appendChild(img);}else{btn.innerHTML=esc(val||'　');}btn.addEventListener('click',()=>{if(multi){btn.classList.toggle('selected');btn.setAttribute('aria-pressed',String(btn.classList.contains('selected')));}else{q$$('#choices .choice').forEach(el=>{el.classList.remove('selected');el.setAttribute('aria-pressed','false');});btn.classList.add('selected');btn.setAttribute('aria-pressed','true');}updateNextButtonAvailability(q);});wrap.appendChild(btn);});q$('#nextBtn').textContent='解答する';}

function updateNextButtonAvailability(q){const selected=q$$('#choices .choice.selected');const next=q$('#nextBtn');if(Array.isArray(q.answerIndex)){const need=q.answerIndex.length;next.disabled=(selected.length!==need);next.title=selected.length!==need?`この問題は ${need} 個選んでください`:'';}else{next.disabled=(selected.length!==1);next.title=selected.length!==1?'選択肢を1つ選んでください':'';}}

function grade(){const q=state.filtered[state.idx];const selectedNodes=q$$('#choices .choice.selected');if(!selectedNodes.length){updateNextButtonAvailability(q);return;}if(Array.isArray(q.answerIndex)&&selectedNodes.length!==q.answerIndex.length){updateNextButtonAvailability(q);return;}const selected=selectedNodes.map(el=>Number(el.getAttribute('data-idx')));const result=isCorrect(selected,q.answerIndex);const answerSet=new Set(Array.isArray(q.answerIndex)?q.answerIndex:[q.answerIndex]);q$$('#choices .choice').forEach(el=>{const i=Number(el.getAttribute('data-idx'));if(answerSet.has(i))el.classList.add('correct');if(selected.includes(i)&&!answerSet.has(i))el.classList.add('incorrect');});const ex=q$('#explain');ex.classList.remove('hidden');const multi=Array.isArray(q.answerIndex);const head=result.ok?(multi?`🎉 全て正解です（${result.total}/${result.total}）`:'🎉 正解です'):(multi?`▲ 部分正解：${result.partial}/${result.total}。残りの選択肢も確認しましょう。`:`✕ 不正解。もう一度見直しましょう。`);ex.innerHTML=`<div>${head}</div>${q.explanation?`<div style="margin-top:6px;">${esc(q.explanation)}</div>`:''}`;if(state.idx>=state.filtered.length-1){q$('#nextBtn').textContent='結果を見る';}else{q$('#nextBtn').textContent='次へ';}q$('#nextBtn').disabled=false;}
function next(){if(state.screen==='home')return;if(state.screen==='result'){showHome();return;}const btn=q$('#nextBtn');if(btn.textContent.includes('解答')){grade();return;}if(btn.textContent.includes('結果')){showResult();return;}if(state.idx<state.filtered.length-1)state.idx+=1;render();}
function prev(){if(state.screen!=='quiz')return;if(state.idx>0)state.idx-=1;render();}
function bindUI(){q$('#homeBtn')?.addEventListener('click',showHome);q$('#statsBtn')?.addEventListener('click',()=>alert('成績・弱点は後日実装'));q$('#tagFilter')?.addEventListener('change',()=>{applyFilters();render();});q$('#yearFilter')?.addEventListener('change',()=>{applyFilters();render();});q$('#nextBtn')?.addEventListener('click',next);q$('#prevBtn')?.addEventListener('click',prev);}
function applyFilters(){const tag=(q$('#tagFilter')?.value||state.tagFilter)||'';const year=(q$('#yearFilter')?.value||state.yearFilter)||'';state.filtered=state.all.filter(q=>{const t=q.tags||[];return (year===''||t.includes(year))&&(tag===''||t.includes(tag));});state.tagFilter=tag;state.yearFilter=year;state.idx=0;}
function isCorrect(selected,answerIndex){if(Array.isArray(answerIndex)){const c=[...answerIndex].sort((a,b)=>a-b);const u=[...new Set(selected)].sort((a,b)=>a-b);let i=0,j=0,hit=0;while(i<u.length&&j<c.length){if(u[i]===c[j]){hit++;i++;j++;}else if(u[i]<c[j])i++;else j++;}if(c.length!==u.length)return{ok:false,partial:hit,total:c.length};return{ok:c.every((v,k)=>v===u[k]),partial:hit,total:c.length};}return{ok:(selected.length===1&&selected[0]===answerIndex),partial:(selected.includes(answerIndex)?1:0),total:1};}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
