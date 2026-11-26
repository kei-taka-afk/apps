/* English Beginner：英単語・熟語・英文法・例文の4モードを切り替える学習アプリの本体。
   アプリごとの違いは window.CFG と window.UNITS で決まる。 */
(function(){
'use strict';
const CFG=window.CFG, UN=window.UNITS;
const $=(s,r=document)=>r.querySelector(s);
const app=$('#app');
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const pick=(a,n)=>shuffle(a).slice(0,n);

/* ---------- 分野・単元・カード ---------- */
const GS=Object.keys(CFG.sections);
const GR={}; GS.forEach(g=>GR[g]=Object.assign({units:UN[g]||[]},CFG.sections[g]));
const KIND={w:'カード',mc:'選択',o:'並べ替え'};
const MODES=CFG.modes;
const modeOf=g=>MODES.find(m=>m.secs.includes(g));
const M=()=>modeOf(ui.grade);
const curSecs=()=>M().secs;
const full=q=>q.ch.join(' ')+q.end;
const filled=(q,b)=>q.q.replace('( )',b?'\u0001'+q.o[0]+'\u0002':q.o[0]);
const mark=s=>esc(s).replace('\u0001','<b>').replace('\u0002','</b>');
const ansText=q=>q.kind==='o'?full(q):q.kind==='w'?q.ja:q.o[0];
const sayText=q=>q.kind==='o'?full(q):q.kind==='w'?q.q:(q.q.includes('( )')?filled(q):'');
const QS={}, BYUNIT={};
for(const g of GS) for(const u of GR[g].units){
  u.grade=g; BYUNIT[u.id]=[];
  u.qs.forEach((x,i)=>{const q=Object.assign({id:u.id+'-'+i,unit:u.id,grade:g,kind:x.t},x);QS[q.id]=q;BYUNIT[u.id].push(q)});
}

/* ---------- 音声 ---------- */
let TTS=null, canSay=typeof window.speechSynthesis!=='undefined';
function sayFallback(t){try{const u=new SpeechSynthesisUtterance(t);u.lang='en-US';u.rate=.85;speechSynthesis.cancel();speechSynthesis.speak(u)}catch(e){}}
function say(t){t=String(t||'').replace(/〜ing/g,'doing').replace(/[〜…]/g,' ').replace(/\s+/g,' ').trim();if(!t)return;if(TTS){TTS.speak(t,{language:'en',rate:.85}).catch(e=>{if(!e||e.code!=='viewer_stopped')sayFallback(t)})}else sayFallback(t)}
const SPK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
const spk=t=>t?`<button type="button" class="speak sm" data-say="${esc(t)}" aria-label="音声を聞く">${SPK}</button>`:'';
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-say]');if(b){e.preventDefault();e.stopPropagation();say(b.dataset.say)}},true);

/* ---------- 学習記録（この端末＋サインイン中はアカウント） ---------- */
const KEY=CFG.key;
const blankG=v=>{const o={};GS.forEach(g=>o[g]=typeof v==='function'?v():v);return o};
let P={}, ui={grade:GS[0],unit:blankG('all')}, cloud=false;
try{const o=JSON.parse(localStorage.getItem(KEY)||'{}');P=o.p||{};if(o.ui)Object.assign(ui,o.ui)}catch(e){}
if(!GS.includes(ui.grade))ui.grade=GS[0];
let dbDoc=null, saveT=null;
function saveLocal(){try{localStorage.setItem(KEY,JSON.stringify({p:P,ui}))}catch(e){}}
function save(){saveLocal();clearTimeout(saveT);saveT=setTimeout(flush,1500)}
function flush(){clearTimeout(saveT);if(!dbDoc)return;dbDoc.set({p:JSON.stringify(P),t:Date.now()}).catch(()=>{})}
document.addEventListener('visibilitychange',()=>{if(document.hidden)flush()});
async function capab(name){try{if(!window.claude||!window.claude.use)return null;return await window.claude.use(name)}catch(e){return null}}
capab('tts').then(t=>{TTS=t});
(async()=>{
  const db=await capab('db'), user=await capab('user'); if(!db||!user)return;
  let id=null;try{id=await user.id()}catch(e){} if(!id)return;
  const ref=db.doc('data/users/'+id+'/state');
  try{
    const snap=await Promise.race([ref.get(),new Promise((_,r)=>setTimeout(()=>r('t'),10000))]);
    if(snap&&snap.exists){const d=snap.data()||{};
      try{const rp=JSON.parse(d.p||'{}');for(const k in rp){if(!P[k]||(rp[k].n||0)>(P[k].n||0))P[k]=rp[k]}}catch(e){}
      saveLocal();
    }
    dbDoc=ref; cloud=true; refresh(); flush();
  }catch(e){}
})();

/* ---------- 共通 ---------- */
const unitsOf=g=>GR[g].units;
const unitById=id=>GS.flatMap(unitsOf).find(u=>u.id===id);
const LV=['未学習','もう一度','要復習','完了'];
const level=id=>{const p=P[id];return p&&p.g?p.g:0};
const ORDER=blankG(()=>[]);
for(const g of GS)unitsOf(g).forEach(u=>BYUNIT[u.id].forEach(q=>{ORDER[g].push(q);q.no=String(ORDER[g].length).padStart(3,'0')}));
const scopeCards=g=>{const u=ui.unit[g]||'all';return u==='all'?ORDER[g]:(BYUNIT[u]||[])};
ui=Object.assign({view:'home',sf:blankG(()=>['0','1','2']),order:'seq',round:10,ar:true,rs:blankG(null),sp:blankG(null),nu:blankG(null)},ui);
for(const g of GS){if(!ui.sf[g])ui.sf[g]=['0','1','2'];if(!(g in ui.rs))ui.rs[g]=null;if(!(g in ui.sp))ui.sp[g]=null;if(!ui.nu)ui.nu={};if(!ui.unit[g]||(ui.unit[g]!=='all'&&!BYUNIT[ui.unit[g]]))ui.unit[g]='all'}
const VIEWS=[['home','ホーム'],['notes','解説'],['study','練習'],['list','一覧'],['settings','設定']];
const MAINV=VIEWS.map(v=>v[0]);
if(!MAINV.includes(ui.view))ui.view='home';
const sfList=()=>{const f=(ui.sf[ui.grade]||[]).filter(x=>['0','1','2','3'].includes(x));return f.length?f:['0','1','2']};

/* ---------- 枠 ---------- */
app.innerHTML=`
<header><div class="brand"><b>${esc(CFG.brand)}</b><nav class="modes" aria-label="学習モード">${MODES.map(m=>`<button type="button" data-m="${m.id}">${esc(m.label)}</button>`).join('')}</nav><div class="seg" role="group" aria-label="分野">${GS.map(x=>`<button data-g="${x}">${esc(GR[x].label)}</button>`).join('')}</div></div>
  <div class="hrow"><nav aria-label="画面">${VIEWS.map(v=>`<button data-view="${v[0]}">${v[1]}</button>`).join('')}</nav><button class="askhd" id="askhd" type="button">AIに質問</button></div></header>
<div class="sync" id="sync">学習記録はこの端末に保存されます</div>
${MAINV.map(v=>`<section id="v-${v}" hidden></section>`).join('')}
<section id="v-ai" hidden><div class="askp aiview"><div class="askhead" id="ai-head"></div><div class="asklog" id="ai-log"></div>
  <form class="askin" id="ai-form"><input type="text" id="ai-in" placeholder="質問を入力" aria-label="質問" autocomplete="off"><button type="submit" id="ai-send">送信</button></form></div></section>`;
let view='home';
function show(v){
  if(v==='notes'&&!M().notes)v='home';
  if(view==='ai'&&v!=='ai'&&askCtl){askCtl.abort();askCtl=null}
  if(v!=='study'&&view==='study'&&cur)keepId=cur.id;
  view=v; if(v!=='ai'){ui.view=v;saveLocal()}
  document.querySelectorAll('header [data-view]').forEach(b=>b.toggleAttribute('aria-current',b.dataset.view===v));
  $('#askhd').toggleAttribute('aria-current',v==='ai');
  [...MAINV,'ai'].forEach(x=>$('#v-'+x).hidden=x!==v);
  document.querySelectorAll('.seg button').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.g===ui.grade));b.hidden=!curSecs().includes(b.dataset.g)});
  document.querySelectorAll('.modes button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.m===M().id)));
  $('header [data-view="notes"]').hidden=!M().notes;
  if(v==='home')renderHome(); if(v==='notes')renderNotes(); if(v==='study')renderStudy(); if(v==='list')renderList(); if(v==='settings')renderSettings();
  window.scrollTo(0,0);
}
function refresh(){ $('#sync').textContent=cloud?'学習記録はアカウントに保存されます':'学習記録はこの端末に保存されます'; if(MK)return; if(view==='study'&&cur)keepId=cur.id; if(view!=='ai')show(view) }
document.querySelectorAll('header [data-view]').forEach(b=>b.onclick=()=>{if(MK)MK=null;show(b.dataset.view)});
document.querySelectorAll('.seg button').forEach(b=>b.onclick=()=>{ui.grade=b.dataset.g;MK=null;cur=null;keepId=null;againQ=[];deck=[];used.clear();HIST.length=0;saveLocal();show(view==='ai'?'home':view)});
document.querySelectorAll('.modes button').forEach(b=>b.onclick=()=>{const m=MODES.find(x=>x.id===b.dataset.m);if(m===M())return;ui.lastG=ui.lastG||{};ui.lastG[M().id]=ui.grade;ui.grade=ui.lastG[m.id]||m.secs[0];MK=null;cur=null;keepId=null;againQ=[];deck=[];used.clear();HIST.length=0;saveLocal();show('home')});
$('#askhd').onclick=()=>openAI(null);

/* ---------- ホーム ---------- */
function renderHome(){
  const g=ui.grade, all=ORDER[g], k=[0,0,0,0]; all.forEach(q=>k[level(q.id)]++);
  const total=curSecs().reduce((a,x)=>a+ORDER[x].length,0);
  $('#v-home').innerHTML=`
  <div class="today"><div><small>残り</small><strong>${all.length-k[3]}</strong></div><div><small>完了</small><strong style="color:var(--good)">${k[3]}</strong></div></div>
  <div class="start"><button class="btn primary" id="go">練習する</button><span class="hint">${esc(GR[g].label)}・${all.length}${M().unitWord}</span></div>
  <div class="panel lvp"><h2>レベル別の復習</h2>
    ${[1,2,3].map(n=>`<div class="lvrow"><span class="lvdot l${n}"></span><b>${LV[n]}</b><strong>${k[n]}</strong><button class="btn" data-lv="${n}" ${k[n]?'':'disabled'}>復習</button></div>`).join('')}
    <p class="hint">最後に選んだ評価ごとに分かれています。「復習」で、そのレベルのカードだけを練習できます。</p></div>
  <div class="panel"><h2>${esc(M().listTitle)}</h2><p class="hint">${esc(GR[g].long||'')}${M().notes?' 選ぶと、解説のページが開きます。':' 選ぶと、そこだけを練習できます。'}</p><div class="ulist">${unitsOf(g).map(u=>{const qs=BYUNIT[u.id],d=qs.filter(q=>level(q.id)===3).length;return `<button class="urow" data-u="${u.id}"><span class="nm">${u.num?`<span class="num">${u.num}</span>`:''}${esc(u.name)}</span><span class="num ct">${d}/${qs.length}</span><span class="bar"><i style="width:${d/qs.length*100}%"></i></span></button>`}).join('')}</div></div>
  <div class="panel"><h2>テスト</h2><p class="hint">このモードの全ての分野から20問を出します。8割正解が目標です。</p><div><button class="btn" id="mock">テストを始める</button></div></div>
  <div class="panel"><h2>このアプリについて</h2><p class="hint">${esc(M().about)}（全${total}${M().unitWord}）</p></div>`;
  $('#go').onclick=()=>show('study');
  document.querySelectorAll('[data-lv]').forEach(b=>b.onclick=()=>{ui.sf[g]=[b.dataset.lv];resetDeck();show('study')});
  document.querySelectorAll('.urow').forEach(b=>b.onclick=()=>{if(M().notes){ui.nu[g]=b.dataset.u;saveLocal();show('notes')}else startUnit(b.dataset.u)});
  $('#mock').onclick=mockStart;
}
function startUnit(id){const g=ui.grade;ui.unit[g]=id;ui.sf[g]=['0','1','2','3'];resetDeck();ui.rs[g]={n:((ui.rs[g]&&ui.rs[g].n)||0)+1,w:[],on:true};show('study')}

/* ---------- 解説（文法モード） ---------- */
const rich=s=>esc(s).replace(/\*([^*]+)\*/g,'<b>$1</b>');
function exHtml(u){return (u.ex||[]).map(x=>`<div class="exrow"><p class="ex" lang="en">${esc(x[0])}${spk(x[0])}</p><p class="tr">${esc(x[1])}</p></div>`).join('')}
function renderNotes(){
  const g=ui.grade, us=unitsOf(g); let u=us.find(x=>x.id===ui.nu[g])||us[0]; const i=us.indexOf(u);
  const qs=BYUNIT[u.id], d=qs.filter(q=>level(q.id)===3).length;
  $('#v-notes').innerHTML=`
  <div class="progress"><label class="usel"><span>文法</span><select id="nUnit">${us.map(x=>`<option value="${x.id}"${x===u?' selected':''}>${x.num} ${esc(x.name)}</option>`).join('')}</select></label></div>
  <article class="panel note"><div class="meta"><span class="num">${esc(GR[g].label)} ${u.num}</span><span class="num">${d}/${qs.length}</span></div>
    <h1 class="ntitle">${esc(u.name)}</h1>${u.pat?`<p class="pat" lang="en">${rich(u.pat)}</p>`:''}
    ${u.note.map(l=>`<p class="rule">${rich(l)}</p>`).join('')}
    ${u.ex&&u.ex.length?`<h2>例文</h2>${exHtml(u)}`:''}
    <div class="setbtns"><button class="btn primary" id="nGo">この文法を練習する</button><button class="btn" id="nAsk">AIに質問</button></div></article>
  <div class="sessrow"><button class="btn sm" id="nPrev" ${i>0?'':'disabled'}>← 前</button><button class="btn sm" id="nNext" ${i<us.length-1?'':'disabled'}>次 →</button></div>`;
  const go=id=>{ui.nu[g]=id;saveLocal();renderNotes();window.scrollTo(0,0)};
  $('#nUnit').onchange=e=>go(e.target.value);
  $('#nPrev').onclick=()=>go(us[i-1].id); $('#nNext').onclick=()=>go(us[i+1].id);
  $('#nGo').onclick=()=>startUnit(u.id);
  $('#nAsk').onclick=()=>openAI(null,u);
}

/* ---------- 練習 ---------- */
let cur=null, opened=false, keepId=null, againQ=[], sess=0, lastId=null, deck=[], used=new Set();
const HIST=[];
function resetDeck(){cur=null;keepId=null;deck=[];used.clear();againQ=[];saveLocal()}
function inPool(q){return sfList().includes(String(level(q.id)))}
function nextStudy(){
  const g=ui.grade, rs=ui.rs[g], list=scopeCards(g);
  if(rs&&rs.on&&rs.w.length>=ui.round){ if(againQ.length){return list.find(q=>q.id===againQ.shift().id)||null} return null }
  const k=againQ.findIndex(a=>a.at<=sess&&a.id!==lastId);
  if(k>=0){const a=againQ.splice(k,1)[0];const q=list.find(x=>x.id===a.id);if(q)return q}
  const wait=new Set(againQ.map(a=>a.id));
  const pool=list.filter(q=>q.id!==lastId&&!wait.has(q.id)&&inPool(q));
  if(!pool.length){ if(againQ.length){const a=againQ.shift();return list.find(q=>q.id===a.id)||null} const l=list.find(q=>q.id===lastId);return l&&inPool(l)?l:null }
  if(ui.order==='rand'){
    deck=deck.filter(id=>pool.some(q=>q.id===id));
    const inDeck=new Set(deck); for(const q of pool) if(!inDeck.has(q.id)&&!used.has(q.id)) deck.splice(Math.floor(Math.random()*(deck.length+1)),0,q.id);
    if(!deck.length){used.clear();deck=shuffle(pool.map(q=>q.id))}
    return pool.find(q=>q.id===deck[0]);
  }
  const sp=ui.sp[g], idx=sp?list.findIndex(q=>q.id===sp):-1;
  return list.slice(idx+1).find(q=>pool.includes(q))||pool[0];
}
function renderStudy(){
  const g=ui.grade, f=sfList(), list=scopeCards(g), cnt=[0,0,0,0]; list.forEach(q=>cnt[level(q.id)]++);
  const rs=ui.rs[g], n=list.filter(inPool).length, uid=ui.unit[g]||'all';
  $('#v-study').innerHTML=`
  <div class="progress">
    <label class="usel"><span>${esc(M().unitLabel)}</span><select id="selUnit"><option value="all">全て</option>${unitsOf(g).map(u=>`<option value="${u.id}"${uid===u.id?' selected':''}>${u.num?u.num+' ':''}${esc(u.name)}</option>`).join('')}</select></label>
    <div class="stf" id="sf" role="group" aria-label="出すカード">${[0,1,2,3].map(k=>`<button data-sf="${k}" class="l${k}" aria-pressed="${f.includes(String(k))}">${LV[k]} <span class="num">${cnt[k]}</span></button>`).join('')}</div>
    <div class="sessrow"><span class="hint">${rs&&rs.on?`${Math.min(rs.w.length,ui.round)}/${ui.round}`+(rs.w.length>=ui.round&&againQ.length?`・再出題 ${againQ.length}`:''):`${n}枚`}</span>
      <button class="btn sm" id="reshuffle" type="button">⇄ シャッフル</button><button class="btn sm" id="againre" type="button" aria-pressed="${ui.ar!==false}">↻ 再出題：${ui.ar!==false?'ON':'OFF'}</button></div>
    <span class="keys">スペース：答えを見る　1〜3 または ← ↓ →：評価　⌫：取り消し</span>
    <span class="swhint">カードをスワイプ：← もう一度　↓ 要復習　完了 →</span>
  </div>
  <div id="stage"></div>
  <div class="undorow"><button class="btn" id="undo" ${HIST.length?'':'hidden'}>↶ 1つ戻す</button></div>`;
  $('#selUnit').onchange=e=>{ui.unit[g]=e.target.value;resetDeck();renderStudy()};
  document.querySelectorAll('#sf [data-sf]').forEach(b=>b.onclick=()=>{const v=b.dataset.sf;let s=sfList();s=s.includes(v)?s.filter(x=>x!==v):[...s,v];if(!s.length)return;ui.sf[g]=s;if(!opened){cur=null;keepId=null}saveLocal();renderStudy()});
  $('#reshuffle').onclick=()=>{ui.order='rand';deck=[];used.clear();cur=null;keepId=null;lastId=null;saveLocal();flash(0,'⇄ シャッフルしました');renderStudy()};
  $('#againre').onclick=()=>{ui.ar=ui.ar===false;if(ui.ar===false)againQ=[];saveLocal();renderStudy()};
  $('#undo').onclick=undo;
  bindSwipe();
  renderCard();
}
function setPanel(){
  cur=null; opened=false;
  const g=ui.grade, r=ui.rs[g], done=r&&r.n&&!r.on, pool=scopeCards(g).filter(inPool).length;
  let body;
  if(done){const k=[0,0,0,0];for(const id of r.w)k[level(id)]++;
    body=`<p>${r.w.length}枚、終わりました。</p><div class="setsum"><span class="tag lvchip l1">もう一度 ${k[1]}</span><span class="tag lvchip l2">要復習 ${k[2]}</span><span class="tag lvchip l3">完了 ${k[3]}</span></div>
      <div class="setbtns"><button class="btn primary" id="set-go" ${pool?'':'disabled'}>次の${ui.round}枚 →</button></div>`}
  else body=`<div class="setbtns" style="margin:0"><button class="btn primary" id="set-go" ${pool?'':'disabled'}>▶ 始める</button></div>${pool?`<p class="hint">${ui.round}枚ずつ練習します。${esc(M().tip)}</p>`:'<p class="hint">選んだレベルのカードがありません。上で出すレベルを選び直してください。</p>'}`;
  $('#stage').innerHTML=`<div class="panel done">${body}</div>`;
  $('#set-go').onclick=()=>{ui.rs[g]={n:((r&&r.n)||0)+1,w:[],on:true};againQ=[];keepId=null;saveLocal();renderStudy()};
}
function renderCard(){
  const g=ui.grade, rs=ui.rs[g];
  if(!rs||!rs.on)return setPanel();
  if(!keepId&&rs.w.length>=ui.round&&!againQ.length){ui.rs[g]={...rs,on:false};saveLocal();return setPanel()}
  let q=null;
  if(keepId&&cur&&cur.id===keepId){keepId=null;cur=newCS(cur.q);opened=false;drawCard($('#stage'),false);return}
  if(keepId)q=scopeCards(g).find(x=>x.id===keepId)||null; keepId=null;
  if(!q)q=nextStudy();
  if(!q){cur=null;$('#stage').innerHTML=`<div class="panel done"><p>選んだレベルのカードがありません。上で出すレベルを選び直してください。</p></div>`;return}
  cur=newCS(q); opened=false;
  drawCard($('#stage'),false);
}

/* ---------- カード ---------- */
function newCS(q){
  const c={q,id:q.id,revealed:false,chosen:null};
  if(q.kind==='w'){const others=[...new Set(BYUNIT[q.unit].filter(x=>x.ja!==q.ja).map(x=>x.ja))];c.opts=shuffle([q.ja,...pick(others,3)])}
  else if(q.kind==='mc')c.opts=shuffle(q.o);
  else{c.sel=[];do{c.order=shuffle(q.ch.map((_,k)=>k))}while(q.ch.length>1&&c.order.every((k,i)=>k===i))}
  return c;
}
const right=q=>q.kind==='w'?q.ja:q.o[0];
function cardParts(c,mock){
  const q=c.q; let body,opts='',ans='',hint='',cls='';
  const optBtns=()=>`<div class="opts">${c.opts.map((o,j)=>`<button class="opt" data-o="${esc(o)}"><span class="k">${'ABCD'[j]}</span><span${q.kind==='mc'?' lang="en"':''}>${esc(o)}</span></button>`).join('')}</div>`;
  if(q.kind==='w'){
    cls=' word'+(q.q.length>12?' long':''); body=`<span>${esc(q.q)}</span>`+spk(q.q);
    if(ui.choice||mock){hint='<p class="hint task">意味を選びましょう。</p>';opts=optBtns()}
    ans=`<p class="ja mean">${esc(q.ja)}</p>`;
  }else if(q.kind==='mc'){
    body=esc(q.q).replace('( )','<span class="bl">(　　　)</span>');
    hint=q.ja?`<p class="tr">${esc(q.ja)}</p>`:'';
    opts=optBtns();
    ans=`<p class="ja" lang="en">${esc(q.o[0])}</p>${q.q.includes('( )')?`<p class="en">${mark(filled(q,true))}${spk(filled(q))}</p>`:''}${q.e?`<p class="exp">${esc(q.e)}</p>`:''}`;
  }else{
    body=esc(q.ja);
    hint='<p class="hint task">語句をタップして、英文を組み立てましょう。</p>';
    opts='<div class="obox"><div class="oline" id="oline"></div><div class="ochips" id="ochips"></div></div>';
    ans=`<p class="ja en1" lang="en">${esc(full(q))}${spk(full(q))}</p>${q.e?`<p class="exp">${esc(q.e)}</p>`:''}`;
  }
  return {body,opts,ans,hint,cls};
}
function drawOrder(){
  const c=cur; if(!c||c.q.kind!=='o')return; const q=c.q,line=$('#oline'),box=$('#ochips'); if(!line||!box)return;
  line.innerHTML=c.sel.length?c.sel.map((k,i)=>`<button type="button" class="chip on" data-i="${i}">${esc(q.ch[k])}</button>`).join(''):'<span class="ph">ここに並びます</span>';
  box.innerHTML=c.order.map(k=>`<button type="button" class="chip" data-k="${k}"${c.sel.includes(k)?' disabled':''}>${esc(q.ch[k])}</button>`).join('');
  if(c.revealed){document.querySelectorAll('#stage .chip').forEach(b=>b.disabled=true);return}
  box.querySelectorAll('.chip').forEach(b=>b.onclick=()=>{c.sel.push(+b.dataset.k);drawOrder();if(c.sel.length===q.ch.length)reveal(c.sel.map(k=>q.ch[k]).join(' ')===q.ch.join(' '),!!MK)});
  line.querySelectorAll('.chip').forEach(b=>b.onclick=()=>{c.sel.splice(+b.dataset.i,1);drawOrder()});
}
function drawCard(el,mock){
  const c=cur,q=c.q,u=unitById(q.unit),k=level(q.id);
  const {body,opts,ans,hint,cls}=cardParts(c,mock);
  el.innerHTML=`
  <article class="card">${mock?'':'<button class="askcard" type="button" data-askai>AIに質問</button>'}
    <div class="meta"><span class="num">No.${q.no||''}</span><span class="tag kd k-${q.kind}">${KIND[q.kind]}</span>${u&&u.pos?`<span class="tag">${esc(u.pos)}</span>`:''}<span class="tag">${esc(q.tag||(u?u.name:''))}</span>${mock?'':`<span class="tag lvchip l${k}">${LV[k]}</span>`}</div>
    <p class="qtext${cls}"${q.kind==='o'?'':' lang="en"'}>${body}</p>${hint}${opts}
    <div class="answer${mock?' mock':''}" id="ans">${ans}${mock?'':'<button class="sheet" id="sheet">答えを見る<small>タップ または スペース</small></button>'}</div>
  </article>
  ${mock?'<div id="nextWrap"></div>':`<div class="grades" id="grades">${[1,2,3].map(n=>`<button class="g${n}" data-g="${n}">${LV[n]}<kbd>${n}</kbd></button>`).join('')}</div>`}`;
  el.querySelectorAll('.opt').forEach(b=>b.onclick=()=>choose(b,mock));
  if(q.kind==='o')drawOrder();
  if(mock){ if(q.kind==='o'){$('#nextWrap').innerHTML='<button class="btn primary wide" id="see">答えを見る</button>';$('#see').onclick=()=>reveal(undefined,true)} }
  else{$('#sheet').onclick=()=>reveal();el.querySelectorAll('#grades button').forEach(b=>b.onclick=()=>grade(+b.dataset.g))}
}
function choose(btn,mock){
  if(cur.revealed)return;
  const q=cur.q,ok=btn.dataset.o===right(q); cur.chosen=btn.dataset.o;
  btn.classList.add(ok?'ok':'ng');
  reveal(ok,mock);
}
function reveal(ok,mock){
  if(!cur||cur.revealed)return; cur.revealed=true; opened=true;
  const q=cur.q, st=$('#stage');
  if(q.kind==='o'){if(cur.sel.length)cur.chosen=cur.sel.map(k=>q.ch[k]).join(' ');drawOrder();const l=$('#oline');if(l&&ok!==undefined)l.classList.add(ok?'ok':'ng')}
  else st.querySelectorAll('.opt').forEach(b=>{b.disabled=true;if(b.dataset.o===right(q))b.classList.add('ok')});
  const a=$('#ans'); a.classList.add('open');
  if(ok!==undefined)a.insertAdjacentHTML('afterbegin',`<p class="verdict ${ok?'v-ok':'v-ng'}">${ok?'正解':'不正解'}</p>`);
  if(ui.auto&&!mock)say(sayText(q));
  if(mock){
    const last=MK.i===MK.list.length-1;
    const fin=r=>{if(r)MK.score++;else MK.miss.push(q);setLevel(q.id,r?3:1);if(last)mockResult();else{MK.i++;mockShow()}};
    if(ok!==undefined){$('#nextWrap').innerHTML=`<button class="btn primary wide" id="next">${last?'結果を見る':'次へ'}</button>`;$('#next').onclick=()=>fin(ok);$('#next').focus({preventScroll:true})}
    else{$('#nextWrap').innerHTML=`<div class="selfck"><button class="btn" id="ng">✕ 間違えた</button><button class="btn primary" id="okb">○ できた</button></div>`;$('#ng').onclick=()=>fin(false);$('#okb').onclick=()=>fin(true)}
  }else{const b=$(ok===false?'#grades .g1':'#grades .g3');if(b)b.focus({preventScroll:true})}
}
function setLevel(id,g){const p=P[id]||{n:0};p.n=(p.n||0)+1;p.g=g;p.t=Date.now();P[id]=p;save()}
function grade(g){
  if(!cur)return;
  const gr=ui.grade, id=cur.id;
  HIST.push({id,p:P[id]?JSON.parse(JSON.stringify(P[id])):undefined,rs:JSON.parse(JSON.stringify(ui.rs[gr])),aq:againQ.slice(),sess,lastId,sp:ui.sp[gr],deck:deck.slice(),used:[...used]}); if(HIST.length>30)HIST.shift();
  deck=deck.filter(x=>x!==id); used.add(id);
  setLevel(id,g); lastId=id;
  if(ui.order!=='rand')ui.sp[gr]=id;
  sess++; againQ=againQ.filter(a=>a.id!==id);
  const rs=ui.rs[gr]; if(rs&&rs.on&&!rs.w.includes(id))ui.rs[gr]={...rs,w:[...rs.w,id]};
  if(g===1&&ui.ar!==false)againQ.push({id,at:sess+5});
  saveLocal(); cur=null; renderStudy();
}
function undo(){
  const h=HIST.pop(); if(!h)return; const gr=ui.grade;
  if(h.p===undefined)delete P[h.id]; else P[h.id]=h.p;
  ui.rs[gr]=h.rs; againQ=h.aq; sess=h.sess; lastId=h.lastId; ui.sp[gr]=h.sp; deck=h.deck; used=new Set(h.used); keepId=h.id;
  save(); if(view!=='study')show('study'); else renderStudy();
}
function flash(g,t){const d=document.createElement('div');d.className='swflash l'+g;d.textContent=t;document.body.appendChild(d);setTimeout(()=>d.remove(),650)}
const SWIPE_KEY={ArrowLeft:1,ArrowDown:2,ArrowRight:3};
const SWIPE_RGB=['','179,38,30','161,98,10','31,107,74'];
function tintCard(card,g,k){if(!card)return;if(!g||k<=0){card.style.boxShadow='';card.style.borderColor='';return}
  const a=Math.min(1,k);card.style.boxShadow=`inset 0 0 0 2000px rgba(${SWIPE_RGB[g]},${(0.16*a).toFixed(3)})`;card.style.borderColor=`rgba(${SWIPE_RGB[g]},${(0.25+0.5*a).toFixed(2)})`}
function rateBySwipe(g){
  if(!cur)return;
  const card=$('#stage .card');
  flash(g,['','← もう一度','↓ 要復習','完了 →'][g]); tintCard(card,g,1);
  if(card){card.style.transition='transform .18s ease, opacity .18s ease';card.style.transform=g===1?'translateX(-40%) rotate(-4deg)':g===2?'translateY(30%)':'translateX(40%) rotate(4deg)';card.style.opacity='0'}
  setTimeout(()=>grade(g),170);
}
function bindSwipe(){
  const stage=$('#stage'); let sx=0,sy=0,on=false,card=null,mode='',canDown=false;
  const reset=()=>{tintCard(card,0,0);if(card){card.style.transition='transform .15s ease';card.style.transform='';const c=card;setTimeout(()=>{c.style.transition=''},160)}};
  stage.addEventListener('touchstart',e=>{
    card=e.target.closest('.card'); on=!!card&&!!cur&&e.touches.length===1&&!e.target.closest('input,select,textarea,.askcard,.obox,.speak');
    if(!on)return; const t=e.touches[0]; sx=t.clientX; sy=t.clientY; mode='';
    canDown=card.getBoundingClientRect().top>=-4; card.style.transition='';
  },{passive:true});
  stage.addEventListener('touchmove',e=>{
    if(!on)return; const t=e.touches[0], dx=t.clientX-sx, dy=t.clientY-sy;
    if(!mode){if(Math.abs(dx)<8&&Math.abs(dy)<8)return; mode=Math.abs(dx)>Math.abs(dy)?'x':(dy>0&&canDown?'down':'scroll')}
    if(mode==='scroll')return;
    if(e.cancelable)e.preventDefault();
    if(mode==='x'){const m=Math.max(-140,Math.min(140,dx));card.style.transform=`translateX(${m}px) rotate(${m/60}deg)`;tintCard(card,m<0?1:3,Math.abs(m)/70)}
    else{const m=Math.max(0,Math.min(160,dy));card.style.transform=`translateY(${m}px)`;tintCard(card,2,m/80)}
  },{passive:false});
  stage.addEventListener('touchend',e=>{
    if(!on)return; on=false; const t=e.changedTouches[0], dx=t.clientX-sx, dy=t.clientY-sy;
    if(mode==='x'&&Math.abs(dx)>70)return rateBySwipe(dx<0?1:3);
    if(mode==='down'&&dy>80)return rateBySwipe(2);
    reset();
  },{passive:true});
  stage.addEventListener('touchcancel',()=>{on=false;reset()},{passive:true});
}
document.addEventListener('keydown',e=>{
  if(view!=='study'||MK||e.target.closest('input,select,textarea'))return;
  if(e.code==='Space'||e.key==='Enter'){if(cur&&!opened){e.preventDefault();reveal()}}
  else if(/^[1-3]$/.test(e.key)&&cur){e.preventDefault();grade(+e.key)}
  else if(SWIPE_KEY[e.key]&&cur){e.preventDefault();rateBySwipe(SWIPE_KEY[e.key])}
  else if((e.key==='z'&&(e.metaKey||e.ctrlKey))||e.key==='Backspace'){if(HIST.length){e.preventDefault();undo()}}
});

/* ---------- AIに質問 ---------- */
let askCtl=null, askFor=undefined, askTurns=[], aiBack='home', aiCard=null, aiUnit=null;
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-askai]');if(b){e.preventDefault();e.stopPropagation();openAI(b.dataset.askai||'cur')}},true);
function cardContext(c){
  const q=c.q, st=c.revealed?'答えを見た後'+(c.chosen?'（学習者の答え：'+c.chosen+'）':''):'まだ答えを見ていない（聞かれないかぎり答えは言わず、考え方のヒントを出す）';
  const body=q.kind==='w'?`英単語: ${q.q}\n意味: ${q.ja}`:q.kind==='mc'?`問題: ${q.q}${q.ja?'\n和訳: '+q.ja:''}\n選択肢: ${q.o.join(' / ')}\n正解: ${q.o[0]}${q.e?'\n解説: '+q.e:''}`:`日本語: ${q.ja}\n正解の英文: ${full(q)}`;
  const u=unitById(q.unit);
  return `${u?'単元: '+u.name+'\n':''}${q.tag?'文法: '+q.tag+'\n':''}${body}\n状況: ${st}`;
}
function askRules(){
  const head=`あなたは、中学英語からやり直している大人の学習者に英語を教える講師です。質問に日本語で答えてください。
- 相手は大人なので、子供向けの言い回しはしない。平易で落ち着いた日本語で、短く答える（長くても10行程度）。文法用語は使って良いが、初出の時に一言で説明する
- 英語の例文は短く簡単なものを1〜3つ。1行に1文で書き、すぐ下に日本語の意味を書く
- マークダウン記号（#、**、表）は使わない。箇条書きは「・」を使う
- 学び直しの人がつまずきやすい点（中学で習ったはずだが忘れている点）を先回りして補う
- 問題や答えに誤りがあると判断したら、はっきり伝える
- 質問は音声入力のことがある。聞き間違いがありそうなら、意図をくみ取って最初に短く確認する`;
  if(aiCard)return head+'\n\n【学習者がいま見ているカード】\n'+cardContext(aiCard);
  if(aiUnit)return head+`\n\n【学習者がいま読んでいる文法の解説】\n${aiUnit.name}\n形: ${aiUnit.pat||''}\n${aiUnit.note.join('\n')}`;
  return head+`\n\n【このアプリ】${CFG.brand}（学習モード：${M().label}）：${M().about}`;
}
function openAI(which,unit){
  if(view==='ai')return;
  aiBack=view;
  const c=unit?null:which==='cur'?cur:(which&&QS[which]?Object.assign(newCS(QS[which]),{revealed:true}):(view==='study'?cur:null));
  const key=unit?'u:'+unit.id:c?c.id:null;
  if(key!==askFor){askFor=key;askTurns=[];$('#ai-log').innerHTML=''}
  aiCard=c; aiUnit=unit||null;
  const lb=c?(c.q.kind==='o'?full(c.q):c.q.q):'';
  $('#ai-head').innerHTML=(c?`<span>このカードについて：<b>${esc(lb.slice(0,40))}${lb.length>40?'…':''}</b></span>`:unit?`<span>この文法について：<b>${esc(unit.name)}</b></span>`:`<span>英語のことを何でも質問できます</span>`)+`<button class="askx" type="button" id="ai-x" aria-label="閉じる">×</button>`;
  $('#ai-x').onclick=()=>{if(aiBack==='study'&&cur)keepId=cur.id;show(aiBack)};
  if(aiBack==='study'&&cur)keepId=cur.id;
  show('ai'); setTimeout(()=>$('#ai-in').focus({preventScroll:true}),0);
}
async function askAI(qt){
  qt=qt.trim(); if(!qt)return;
  if(askCtl)askCtl.abort();
  const log=$('#ai-log'), sendB=$('#ai-send');
  const sample=await capab('sample');
  if(!sample){log.innerHTML='<p class="aihint">この画面ではAIに質問できません。claude.ai でこのページを開くと使えます。</p>';return}
  log.insertAdjacentHTML('beforeend','<div class="msg u"></div><div class="msg a wait">考えています…</div>');
  log.children[log.children.length-2].textContent=qt;
  const out=log.lastElementChild; out.scrollIntoView({block:'nearest'});
  askTurns.push({role:'user',content:qt});
  const ctl=askCtl=new AbortController(); sendB.textContent='止める'; sendB.type='button'; sendB.onclick=()=>ctl.abort();
  try{
    const r=await sample([{role:'user',content:askRules()},{role:'assistant',content:'分かりました。質問をどうぞ。'},...askTurns.slice(-8)],{cache:false,signal:ctl.signal,onText:({text})=>{out.classList.remove('wait');out.textContent=text}});
    out.classList.remove('wait'); out.textContent=r.text; askTurns.push({role:'assistant',content:r.text});
  }catch(e){
    askTurns.pop(); out.classList.remove('wait');
    if(e&&e.code==='cancelled')out.textContent=e.text?e.text+'\n（止めました）':'止めました';
    else if(e&&['not_granted','sampling_disabled','not_declared','capability_disabled','capability_removed'].includes(e.code))out.textContent='AIへの質問が許可されていません。';
    else if(e&&e.code==='rate_limited')out.textContent='質問が続いたので、少し時間をおいてからもう一度聞いてください。';
    else out.textContent=(e&&e.text?e.text+'\n':'')+'答えが届きませんでした。もう一度送ってください。';
  }finally{if(askCtl===ctl)askCtl=null;sendB.textContent='送信';sendB.type='submit';sendB.onclick=null}
}
$('#ai-form').onsubmit=e=>{e.preventDefault();const t=$('#ai-in').value;$('#ai-in').value='';askAI(t)};

/* ---------- いちらん ---------- */
let listSt=[]; const OPEN=new Set();
function renderList(){
  const g=ui.grade, uid=ui.unit[g]||'all', all=scopeCards(g);
  const cards=all.filter(q=>!listSt.length||listSt.includes(String(level(q.id))));
  $('#v-list').innerHTML=`
  <div class="tools"><label class="usel"><span>${esc(M().unitLabel)}</span><select id="lUnit"><option value="all">全て</option>${unitsOf(g).map(u=>`<option value="${u.id}"${uid===u.id?' selected':''}>${u.num?u.num+' ':''}${esc(u.name)}</option>`).join('')}</select></label></div>
  <div class="listbar"><div class="stf" id="stf" role="group" aria-label="絞り込み">${[0,1,2,3].map(k=>`<button data-st="${k}" class="l${k}" aria-pressed="${listSt.includes(String(k))}">${LV[k]}</button>`).join('')}</div><span class="hint">${cards.length}枚</span></div>
  <div class="table"><table class="lt"><colgroup><col class="c1"><col class="c2"><col class="c3"></colgroup><thead><tr><th>No.</th><th>${esc(M().colTitle)}</th><th>レベル</th></tr></thead><tbody>${cards.map(q=>{const k=level(q.id),op=OPEN.has(q.id);
    return `<tr class="w" data-id="${q.id}" aria-expanded="${op}"><td class="num">${esc(q.no)}</td><td class="qt" lang="en">${esc(q.kind==='o'?full(q):q.q)}</td><td class="st"><span class="lvdot l${k}"></span>${LV[k]}</td></tr>`+(op?detailRow(q):'')}).join('')}</tbody></table></div>`;
  $('#lUnit').onchange=e=>{ui.unit[g]=e.target.value;resetDeck();renderList()};
  document.querySelectorAll('#stf [data-st]').forEach(b=>b.onclick=()=>{const v=b.dataset.st;listSt=listSt.includes(v)?listSt.filter(x=>x!==v):[...listSt,v];renderList()});
  document.querySelectorAll('tr.w').forEach(r=>r.onclick=()=>{const id=r.dataset.id;OPEN.has(id)?OPEN.delete(id):OPEN.add(id);renderList()});
  document.querySelectorAll('[data-study]').forEach(b=>b.onclick=e=>{e.stopPropagation();const id=b.dataset.study;const q=QS[id];ui.unit[g]=q.unit;ui.sf[g]=['0','1','2','3'];resetDeck();keepId=id;const rs=ui.rs[g];if(!rs||!rs.on)ui.rs[g]={n:((rs&&rs.n)||0)+1,w:[],on:true};show('study')});
}
function detailRow(q){
  const c=Object.assign(newCS(q),{revealed:true}); const p=cardParts(c);
  return `<tr class="det"><td colspan="3"><div class="detail"><button class="askcard in" type="button" data-askai="${q.id}">AIに質問</button>
    ${q.kind==='o'?`<p class="tr">${esc(q.ja)}</p>`:q.kind==='mc'&&q.ja?`<p class="tr">${esc(q.ja)}</p>`:''}
    <div class="answer open">${p.ans}</div><div><button class="btn sm" data-study="${q.id}">このカードから練習する</button></div></div></td></tr>`;
}

/* ---------- せってい ---------- */
function renderSettings(){
  const sel=(id,cv,list)=>`<select id="${id}">${list.map(o=>`<option value="${o[0]}"${String(cv)===String(o[0])?' selected':''}>${o[1]}</option>`).join('')}</select>`;
  $('#v-settings').innerHTML=`<div class="panel">
    <div class="field"><div><label for="s-round">1回の枚数</label><p>一度に練習するカードの枚数です。</p></div>${sel('s-round',ui.round,[[5,5],[10,10],[15,15],[20,20]])}</div>
    <div class="field"><div><label for="s-order">出題順</label><p>練習でカードを出す順番です。</p></div>${sel('s-order',ui.order,[['seq','番号順'],['rand','ランダム']])}</div>
    <div class="field"><div><label for="s-choice">英単語・熟語の出し方</label><p>カードは、英語を見て意味を思い出してから答えを見ます。4択は、意味を4つから選びます。</p></div>${sel('s-choice',ui.choice?1:0,[[0,'カード'],[1,'4択']])}</div>
    <div class="field"><div><label for="s-auto">音声の自動再生</label><p>答えを見た時に、英語の音声を自動で流します。</p></div>${sel('s-auto',ui.auto?1:0,[[0,'OFF'],[1,'ON']])}</div>
    <div class="field"><div><label for="s-ar">再出題</label><p>「もう一度」にしたカードを、5枚後にもう一度出します。</p></div>${sel('s-ar',ui.ar!==false?1:0,[[1,'ON'],[0,'OFF']])}</div>
    <div class="field"><div><label>記録のリセット</label><p>全てのモードのカードを「未学習」に戻します。元には戻せません。</p></div><div class="row"><button class="btn danger" id="reset">リセット</button></div></div>
  </div>
  <p class="hint">音声は、使っている端末やアプリによっては出ないことがあります。内容は確認していますが、誤りが残っている可能性があります。気になる点は「AIに質問」で確かめてください。</p>`;
  const on=(id,f)=>$(id).onchange=e=>{f(e.target.value);saveLocal()};
  on('#s-round',v=>ui.round=+v); on('#s-order',v=>{ui.order=v;deck=[];used.clear()}); on('#s-auto',v=>ui.auto=v==='1'); on('#s-choice',v=>{ui.choice=v==='1';cur=null;keepId=null}); on('#s-ar',v=>{ui.ar=v==='1';if(!ui.ar)againQ=[]});
  const r=$('#reset'); r.onclick=()=>{if(r.dataset.c){P={};HIST.length=0;ui.rs=blankG(null);ui.sp=blankG(null);resetDeck();save();r.textContent='リセットしました';r.disabled=true}else{r.dataset.c=1;r.textContent='もう一度押すと消去します'}};
}

/* ---------- テスト ---------- */
let MK=null;
function mockStart(){
  const SS=curSecs(), N=20, total=SS.reduce((a,g)=>a+ORDER[g].length,0); let src=[];
  SS.forEach(g=>src.push(...pick(ORDER[g],Math.max(1,Math.round(N*ORDER[g].length/total)))));
  if(src.length<N){const has=new Set(src);src.push(...pick(SS.flatMap(g=>ORDER[g]).filter(q=>!has.has(q)),N-src.length))}
  MK={list:shuffle(src).slice(0,N),i:0,score:0,miss:[],saved:cur};
  show('home'); mockShow();
}
function mockShow(){
  const n=MK.list.length; cur=newCS(MK.list[MK.i]);
  $('#v-home').innerHTML=`<div class="sessrow"><button class="btn sm" id="quit">← テストをやめる</button><span class="hint num">${MK.i+1} / ${n}</span></div><div class="pbar"><i style="width:${MK.i/n*100}%"></i></div><div id="stage"></div>`;
  $('#quit').onclick=mockExit; drawCard($('#stage'),true); window.scrollTo(0,0);
}
function mockExit(){cur=MK?MK.saved:null;MK=null;show('home')}
function mockResult(){
  const n=MK.list.length,pct=Math.round(MK.score/n*100);
  $('#v-home').innerHTML=`<div class="panel done"><h2>テストの結果</h2><p class="res"><span class="num big">${MK.score}</span> / ${n}（${pct}%）</p>
  <p class="${pct>=80?'pass':'fail'}">${pct>=80?'目標の8割を超えました。':`目標の8割まで、あと${Math.max(0,Math.ceil(n*.8)-MK.score)}問です。`}</p><div class="setbtns"><button class="btn primary" id="back">ホームに戻る</button></div></div>
  ${MK.miss.length?`<div class="panel"><h2>間違えたカード（「もう一度」に入れました）</h2><div class="miss">${MK.miss.map(q=>`<div><b${q.kind==='o'?'':' lang="en"'}>${esc(q.kind==='o'?q.ja:q.q)}</b>答え：<span lang="en">${esc(ansText(q))}</span></div>`).join('')}</div></div>`:''}`;
  $('#back').onclick=mockExit; window.scrollTo(0,0);
}

show(ui.view);
})();
