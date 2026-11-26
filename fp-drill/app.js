(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const app=$('#app');
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const pick=(a,n)=>shuffle(a).slice(0,n);
const DAY=864e5;
const today=()=>Math.floor((Date.now()-new Date().getTimezoneOffset()*60000)/DAY);
const INT=[1,3,7,14,30];

/* ---------- 問題の組み立て ---------- */
const GR={3:{label:'3級',units:window.UNITS3},2:{label:'2級',units:window.UNITS2}};
const QS={}; const BYUNIT={};
function add(q){QS[q.id]=q;(BYUNIT[q.unit]=BYUNIT[q.unit]||[]).push(q)}
// データ形式：四択・三択は [問題文,[正解,誤答…],解説]、○×は [記述,true/false,解説]
for(const g of [3,2]) for(const u of GR[g].units){
  u.grade=g;
  (u.qs||[]).forEach((a,i)=>{
    if(typeof a[1]==='boolean')add({id:u.id+'-'+i,unit:u.id,grade:g,kind:'mc',tf:true,q:a[0],o:a[1]?['○','×']:['×','○'],e:a[2]});
    else add({id:u.id+'-'+i,unit:u.id,grade:g,kind:'mc',q:a[0],o:a[1],e:a[2]});
  });
}

/* ---------- 記録（この端末＋サインイン時はクラウド） ---------- */
const KEY='fpdrill_v1';
let P={}, AIQ={}, ui={grade:3,unit:{3:'all',2:'all'},mode:'auto',tab:'home',cnt:{day:0,n:0},newCnt:{day:0,n:0},newLimit:20,newOrder:'order',swipe:true,gloss:true}, cloud=false;
try{const o=JSON.parse(localStorage.getItem(KEY)||'{}');P=o.p||{};AIQ=o.ai||{};if(o.ui)Object.assign(ui,o.ui); if(!['home','study','list','settings'].includes(ui.tab))ui.tab='home';}catch(e){}
let dbDoc=null, saveT=null;
function saveLocal(){try{localStorage.setItem(KEY,JSON.stringify({p:P,ai:AIQ,ui}))}catch(e){}}
function save(){saveLocal();clearTimeout(saveT);saveT=setTimeout(flush,1500)}
function flush(){clearTimeout(saveT);if(!dbDoc)return;dbDoc.set({p:JSON.stringify(P),ai:JSON.stringify(AIQ),t:Date.now()}).catch(()=>{})}
document.addEventListener('visibilitychange',()=>{if(document.hidden)flush()});
async function cap(name){try{if(!window.claude||!window.claude.use)return null;return await window.claude.use(name)}catch(e){return null}}
(async()=>{
  const db=await cap('db'), user=await cap('user'); if(!db||!user)return;
  let id=null;try{id=await user.id()}catch(e){} if(!id)return;
  const ref=db.doc('data/users/'+id+'/state');
  try{
    const snap=await Promise.race([ref.get(),new Promise((_,r)=>setTimeout(()=>r('t'),10000))]);
    if(snap&&snap.exists){const d=snap.data()||{};
      try{const rp=JSON.parse(d.p||'{}');for(const k in rp){if(!P[k]||(rp[k].n||0)>(P[k].n||0))P[k]=rp[k]}}catch(e){}
      try{const ra=JSON.parse(d.ai||'{}');for(const k in ra){if(!AIQ[k]||ra[k].length>AIQ[k].length)AIQ[k]=ra[k]}}catch(e){}
      saveLocal(); refresh();
    }
    dbDoc=ref; cloud=true; refresh(); flush();
  }catch(e){}
})();

function record(id,r){
  const p=P[id]||{n:0}; p.n=(p.n||0)+1; p.r=r; p.l=(r==='ok'||r==='review')?1:0;
  if(r==='no'){p.b=0;p.d=today()+1}
  else if(r==='vague'){p.b=Math.max(0,(p.b||0)-1);p.d=today()+1}
  else{p.b=p.b==null?1:Math.min(p.b+1,4);p.d=today()+(r==='review'?1:INT[p.b])}
  P[id]=p; save();
}
const isOk=id=>P[id]&&P[id].l===1;
const due=id=>P[id]&&P[id].d<=today();

/* ---------- 共通 ---------- */
const unitsOf=g=>GR[g].units;
const unitById=id=>[...unitsOf(3),...unitsOf(2)].find(u=>u.id===id);
const LV=['未学習','わからない','要復習','完了'];
const level=id=>{const p=P[id];if(!p)return 0;if(p.g)return p.g;return p.r==='vague'?2:(p.l?3:1)};
const label=q=>(q.tf?'【○×】':'')+q.q;
const TFL={'○':'○（適切）','×':'×（不適切）'};
const optText=(q,k)=>q.tf?TFL[q.o[k]]:q.o[k];
const GLIST=(window.GLOSS||[]).slice().sort((a,b)=>b[0].length-a[0].length);
function glossFor(texts){const out=[],defs=new Set();
  for(let t of texts){if(!t)continue;for(const g of GLIST){if(out.length>=4)break;if(t.includes(g[0])&&!defs.has(g[1])){out.push(g);defs.add(g[1]);t=t.split(g[0]).join('〓')}}}
  return out}
// 番号（級ごとの通し番号）
const ORDER={3:[],2:[]};
for(const g of [3,2])unitsOf(g).forEach(u=>BYUNIT[u.id].forEach(q=>{ORDER[g].push(q);q.no=String(ORDER[g].length).padStart(3,'0')}));
const aiCards=uid=>(AIQ[uid]||[]).map((a,i)=>Object.assign({},a,{unit:uid,grade:unitById(uid).grade,kind:'mc',isAi:true,no:'AI'+(i+1)}));
const scopeCards=g=>{const u=ui.unit[g]||'all';return u==='all'?[...ORDER[g],...unitsOf(g).flatMap(x=>aiCards(x.id))]:[...BYUNIT[u],...aiCards(u)]};
// 設定の初期値
Object.assign(ui,Object.assign({view:'home',sf:{3:['0','1','2'],2:['0','1','2']},order:'seq',round:20,ar:true,rs:{3:null,2:null},sp:{3:null,2:null}},ui));
if(!ui.sf||!ui.sf[3])ui.sf={3:['0','1','2'],2:['0','1','2']}; if(!ui.rs)ui.rs={3:null,2:null}; if(!ui.sp)ui.sp={3:null,2:null};
if(!['home','study','list','settings','ai'].includes(ui.view))ui.view='home';
const sfList=()=>{const f=(ui.sf[ui.grade]||[]).filter(x=>['0','1','2','3'].includes(x));return f.length?f:['0','1','2']};

/* ---------- 骨組み ---------- */
const VIEWS=[['home','Home'],['study','Study'],['list','Cards'],['settings','Setting']];
app.innerHTML=`
<header><div class="brand"><b>FPドリル</b><div class="seg" role="group" aria-label="級">${[3,2].map(x=>`<button data-g="${x}">${GR[x].label}</button>`).join('')}</div></div>
  <div class="hrow"><nav aria-label="画面">${VIEWS.map(v=>`<button data-view="${v[0]}">${v[1]}</button>`).join('')}</nav><button class="askhd" id="askhd" type="button">AIに質問</button></div></header>
<div class="sync" id="sync">記録はこの端末に保存されます</div>
<section id="v-home"></section><section id="v-study" hidden></section><section id="v-list" hidden></section><section id="v-settings" hidden></section>
<section id="v-ai" hidden><div class="askp aiview"><div class="askhead" id="ai-head"></div><div class="asklog" id="ai-log"></div>
  <form class="askin" id="ai-form"><input type="text" id="ai-in" placeholder="質問を入力" aria-label="質問" autocomplete="off"><button type="submit" id="ai-send">送信</button></form></div></section>`;
let view='home';
function show(v){
  if(view==='ai'&&v!=='ai'&&askCtl){askCtl.abort();askCtl=null}
  if(v!=='study'&&view==='study'&&cur)keepId=cur.id;
  view=v; if(v!=='ai'){ui.view=v;saveLocal()}
  document.querySelectorAll('header [data-view]').forEach(b=>b.toggleAttribute('aria-current',b.dataset.view===v));
  $('#askhd').toggleAttribute('aria-current',v==='ai');
  ['home','study','list','settings','ai'].forEach(x=>$('#v-'+x).hidden=x!==v);
  document.querySelectorAll('.seg button').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.g===ui.grade)));
  if(v==='home')renderHome(); if(v==='study')renderStudy(); if(v==='list')renderList(); if(v==='settings')renderSettings();
  window.scrollTo(0,0);
}
function refresh(){ if(MK)return; if(view==='study'&&cur)keepId=cur.id; $('#sync').textContent=cloud?'記録はあなたのアカウントに保存されています':'記録はこの端末に保存されます'; if(view!=='ai')show(view) }
document.querySelectorAll('header [data-view]').forEach(b=>b.onclick=()=>show(b.dataset.view));
document.querySelectorAll('.seg button').forEach(b=>b.onclick=()=>{ui.grade=+b.dataset.g;cur=null;keepId=null;againQ=[];deck=[];used.clear();HIST.length=0;saveLocal();show(view==='ai'?'home':view)});
$('#askhd').onclick=()=>openAI(null);

/* ---------- Home ---------- */
function renderHome(){
  const g=ui.grade, all=ORDER[g], k=[0,0,0,0]; all.forEach(q=>k[level(q.id)]++);
  $('#v-home').innerHTML=`
  <div class="today"><div><small>未完了</small><strong>${all.length-k[3]}</strong></div><div><small>完了</small><strong style="color:var(--good)">${k[3]}</strong></div></div>
  <div class="start"><button class="btn primary" id="go">Study</button><span class="hint">${GR[g].label}・全${all.length}枚</span></div>
  <div class="panel lvp"><h2>理解度別に復習</h2>
    ${[1,2,3].map(n=>`<div class="lvrow"><span class="lvdot l${n}"></span><b>${LV[n]}</b><strong>${k[n]}</strong><button class="btn" data-lv="${n}" ${k[n]?'':'disabled'}>復習</button></div>`).join('')}
    <p class="hint">最後に選んだ理解度でまとめています。「復習」を押すと、その理解度のカードだけでStudyを始めます。</p></div>
  <div class="panel"><h2>単元ごとの進み具合</h2><div class="ulist">${unitsOf(g).map(u=>{const qs=BYUNIT[u.id],d=qs.filter(q=>level(q.id)===3).length;return `<button class="urow" data-u="${u.id}"><span class="nm"><span class="num">${u.id.split('-')[1].padStart(2,'0')}</span>${esc(u.name)}</span><span class="num ct">${d}/${qs.length}</span><span class="bar"><i style="width:${d/qs.length*100}%"></i></span></button>`}).join('')}</div></div>
  <div class="panel"><h2>模擬試験</h2><p class="hint">${g===3?'3級の学科と同じ形式で、○×30問＋三択30問の計60問':'2級の学科と同じ形式で、四択60問'}。6分野からまんべんなく出題し、合格基準（60問中36問・60％）と比べます。</p><div><button class="btn" id="mock">模擬試験を始める</button></div></div>`;
  $('#go').onclick=()=>show('study');
  document.querySelectorAll('[data-lv]').forEach(b=>b.onclick=()=>{ui.sf[g]=[b.dataset.lv];resetDeck();show('study')});
  document.querySelectorAll('.urow').forEach(b=>b.onclick=()=>{ui.unit[g]=b.dataset.u;resetDeck();show('study')});
  $('#mock').onclick=()=>mockStart(g);
}

/* ---------- Study ---------- */
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
    <label class="usel"><span>単元</span><select id="selUnit"><option value="all">すべての単元</option>${unitsOf(g).map(u=>`<option value="${u.id}"${uid===u.id?' selected':''}>${u.id.split('-')[1].padStart(2,'0')} ${esc(u.name)}</option>`).join('')}</select></label>
    <div class="stf" id="sf" role="group" aria-label="出題する理解度">${[0,1,2,3].map(k=>`<button data-sf="${k}" class="l${k}" aria-pressed="${f.includes(String(k))}">${LV[k]} <span class="num">${cnt[k]}</span></button>`).join('')}</div>
    <div class="sessrow"><span class="hint">${rs&&rs.on?`${Math.min(rs.w.length,ui.round)}/${ui.round}`+(rs.w.length>=ui.round&&againQ.length?` ・ リトライ ${againQ.length}`:''):`${n}枚`}</span>
      <button class="btn sm" id="reshuffle" type="button">⇄ シャッフル</button><button class="btn sm" id="againre" type="button" aria-pressed="${ui.ar!==false}">↻ リトライ: ${ui.ar!==false?'ON':'OFF'}</button></div>
    <span class="keys">Space: 答えを見る ・ 1–3 または ← ↓ →: 理解度 ・ ⌫: 取り消し</span>
    <span class="swhint">カードをスワイプ： ← わからない ・ ↓ 要復習 ・ 完了 →</span>
  </div>
  <div id="stage"></div>
  <div class="undorow"><button class="btn" id="undo" ${HIST.length?'':'hidden'}>↶ 直前の評価を取り消す</button></div>`;
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
    body=`<p>${r.w.length}枚おわりました。</p><div class="setsum"><span class="tag lvchip l1">わからない ${k[1]}</span><span class="tag lvchip l2">要復習 ${k[2]}</span><span class="tag lvchip l3">完了 ${k[3]}</span></div>
      <div class="setbtns"><button class="btn primary" id="set-go" ${pool?'':'disabled'}>次の${ui.round}枚 →</button></div>`}
  else body=`<div class="setbtns" style="margin:0"><button class="btn primary" id="set-go" ${pool?'':'disabled'}>▶ スタート</button></div>${pool?'':'<p class="hint">選んだ理解度のカードがありません。上のボタンで理解度を選び直してください。</p>'}`;
  $('#stage').innerHTML=`<div class="panel done">${body}</div>`;
  $('#set-go').onclick=()=>{ui.rs[g]={n:((r&&r.n)||0)+1,w:[],on:true};againQ=[];keepId=null;saveLocal();renderStudy()};
}
function renderCard(){
  const g=ui.grade, rs=ui.rs[g];
  if(!rs||!rs.on)return setPanel();
  if(!keepId&&rs.w.length>=ui.round&&!againQ.length){ui.rs[g]={...rs,on:false};saveLocal();return setPanel()}
  let q=null;
  if(keepId&&cur&&cur.id===keepId){const c=cur;keepId=null;c.revealed=false;c.chosen=null;opened=false;drawCard($('#stage'),false);return}
  if(keepId)q=scopeCards(g).find(x=>x.id===keepId)||null; keepId=null;
  if(!q)q=nextStudy();
  if(!q){cur=null;$('#stage').innerHTML=`<div class="panel done"><p>選んだ理解度のカードがありません。上のボタンで理解度を選び直してください。</p></div>`;return}
  cur=newCS(q); opened=false;
  drawCard($('#stage'),false);
}

/* ---------- カード ---------- */
function newCS(q){
  const c={q,id:q.id,revealed:false,chosen:null};
  if(q.tf)c.order=q.o[0]==='○'?[0,1]:[1,0];
  else c.order=shuffle(q.o.map((_,k)=>k));
  return c;
}
const KL='ABCD';
function cardParts(c){
  const q=c.q; let body='',opts='',fig='',ans='';
  body=esc(q.q);
  opts=`<div class="opts${q.tf?' tf':''}">${c.order.map((k,j)=>`<button class="opt" data-k="${k}">${q.tf?'':`<span class="k">${KL[j]}</span>`}<span>${esc(optText(q,k))}</span></button>`).join('')}</div>`;
  ans=`<p class="ja">${q.tf?'正解：'+esc(TFL[q.o[0]]):KL[c.order.indexOf(0)]+'　'+esc(q.o[0])}</p><p class="exp">${esc(q.e)}</p>${q.isAi?'<p class="aiwarn">AIが作成し、AIが確認した問題です。疑問があれば「AIに質問」で確認してください。</p>':''}`;
  if(ui.gloss!==false){const gl=glossFor(q.tf?[q.q,q.e]:[q.o[0],q.q,q.e,...q.o.slice(1)]);
    if(gl.length)ans+=`<div class="gloss"><b class="lab">あわせて覚える</b><dl>${gl.map(x=>`<dt>${esc(x[0])}</dt><dd>${esc(x[1])}</dd>`).join('')}</dl></div>`}
  return {body,opts,fig,ans};
}
function drawCard(el,mock){
  const c=cur,q=c.q,u=unitById(q.unit),k=level(q.id);
  const {body,opts,fig,ans}=cardParts(c);
  el.innerHTML=`
  <article class="card">${mock?'':'<button class="askcard" type="button" data-askai>AIに質問</button>'}
    <div class="meta"><span class="num">No.${q.no||''}</span><span class="tag">${esc(u?u.name:'')}</span>${q.tf?'<span class="tag">○×</span>':''}${q.isAi?'<span class="tag ai">AI作成</span>':''}${mock?'':`<span class="tag lvchip l${k}">${LV[k]}</span>`}</div>
    <p class="qtext">${body}</p>${fig}${opts}
    <div class="answer${mock?' mock':''}" id="ans">${ans}${mock?'':'<button class="sheet" id="sheet">答えを見る<small>タップまたはSpace</small></button>'}</div>
  </article>
  ${mock?'<div id="nextWrap"></div>':`<div class="grades" id="grades">${[1,2,3].map(n=>`<button class="g${n}" data-g="${n}">${LV[n]}<kbd>${n}</kbd></button>`).join('')}</div>`}`;
  el.querySelectorAll('.opt').forEach(b=>b.onclick=()=>choose(b,mock));
  if(!mock){$('#sheet').onclick=()=>reveal();el.querySelectorAll('#grades button').forEach(b=>b.onclick=()=>grade(+b.dataset.g))}
}
function choose(btn,mock){
  if(cur.revealed)return;
  const q=cur.q; let ok;
  const k=+btn.dataset.k;ok=k===0;cur.chosen=optText(q,k);
  btn.classList.add(ok?'ok':'ng');
  reveal(ok,mock);
}
function reveal(ok,mock){
  if(!cur||cur.revealed)return; cur.revealed=true; opened=true;
  const q=cur.q;
  document.querySelectorAll('#stage .opt').forEach(b=>{b.disabled=true;if(+b.dataset.k===0)b.classList.add('ok')});
  const a=$('#ans'); a.classList.add('open');
  if(ok!==undefined)a.insertAdjacentHTML('afterbegin',`<p class="verdict ${ok?'v-ok':'v-ng'}">${ok?'正解':'不正解'}</p>`);
  if(mock){
    if(ok)MK.score++; else MK.miss.push(q);
    setLevel(q.id,ok?3:1);
    const last=MK.i===MK.list.length-1;
    $('#nextWrap').innerHTML=`<button class="btn primary wide" id="next">${last?'結果を見る':'次の問題'}</button>`;
    $('#next').onclick=()=>{if(last)mockResult();else{MK.i++;mockShow()}}; $('#next').focus({preventScroll:true});
  }else{const b=$(ok===false?'#grades .g1':'#grades .g3');if(b)b.focus({preventScroll:true})}
}
function setLevel(id,g){const p=P[id]||{n:0};p.n=(p.n||0)+1;p.g=g;p.l=g===3?1:0;p.r=['','no','vague','ok'][g];p.t=Date.now();P[id]=p;save()}
function grade(g){
  if(!cur)return;
  const gr=ui.grade, id=cur.id;
  HIST.push({id,p:P[id]?JSON.parse(JSON.stringify(P[id])):undefined,rs:JSON.parse(JSON.stringify(ui.rs[gr])),aq:againQ.slice(),sess,lastId,sp:ui.sp[gr],deck:deck.slice(),used:[...used]}); if(HIST.length>30)HIST.shift();
  deck=deck.filter(x=>x!==id); used.add(id);
  setLevel(id,g); lastId=id;
  if(ui.order!=='rand'&&!cur.q.isAi)ui.sp[gr]=id;
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
  flash(g,['','← わからない','↓ 要復習','完了 →'][g]); tintCard(card,g,1);
  if(card){card.style.transition='transform .18s ease, opacity .18s ease';card.style.transform=g===1?'translateX(-40%) rotate(-4deg)':g===2?'translateY(30%)':'translateX(40%) rotate(4deg)';card.style.opacity='0'}
  setTimeout(()=>grade(g),170);
}
function bindSwipe(){
  const stage=$('#stage'); let sx=0,sy=0,on=false,card=null,mode='',canDown=false;
  const reset=()=>{tintCard(card,0,0);if(card){card.style.transition='transform .15s ease';card.style.transform='';const c=card;setTimeout(()=>{c.style.transition=''},160)}};
  stage.addEventListener('touchstart',e=>{
    card=e.target.closest('.card'); on=!!card&&!!cur&&e.touches.length===1&&!e.target.closest('input,select,textarea,.askcard');
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

/* ---------- AIに質問（画面） ---------- */
let askCtl=null, askFor=undefined, askTurns=[], aiBack='home', aiCard=null;
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-askai]');if(b){e.preventDefault();e.stopPropagation();openAI(b.dataset.askai||'cur')}},true);
function cardContext(c){
  const q=c.q, st=c.revealed?('答えを確認済み'+(c.chosen?'（選んだ答え: '+c.chosen+'）':'')):'まだ答えを見ていない。質問で求められない限り正解は明かさず、考え方のヒントにとどめること';
  return `問題: ${q.tf?'（○×問題）':''}${q.q}\n選択肢: ${q.o.map((_,k)=>optText(q,k)).join(' / ')}\n正解: ${optText(q,0)}\n解説: ${q.e}\n受験者の状態: ${st}${q.isAi?'\n※この問題はAIが作成したもの。誤りがあれば率直に指摘すること。':''}`;
}
function progressSummary(){const lines=[];
  for(const x of [3,2]){lines.push(`【${GR[x].label}】`);
    for(const u of unitsOf(x)){const k=[0,0,0,0];BYUNIT[u.id].forEach(q=>k[level(q.id)]++);lines.push(`${u.name}: 全${BYUNIT[u.id].length}枚／完了${k[3]}・要復習${k[2]}・わからない${k[1]}・未学習${k[0]}`)}}
  return lines.join('\n')}
function askRules(){
  const head=`あなたはFP技能検定（ファイナンシャル・プランニング技能検定、3級・2級）の講師です。受験者の質問に日本語で答えてください。
- スマホで読むので短く、結論から（長くても10行程度）
- マークダウン記号（#、**、表）は使わず、箇条書きは「・」を使う
- FP技能検定の出題範囲（ライフプランニングと資金計画、リスク管理、金融資産運用、タックスプランニング、不動産、相続・事業承継）に沿って説明する
- 税制・社会保険の金額や率は改正で変わる。受験する回の法令基準日の数値か確信が持てないときは断定せず、最新のテキストや日本FP協会・金財の発表で確認するよう伝える
- 計算問題は式を1行ずつ示す
- 問題の正解や解説に誤りがあると判断したら、遠慮なく指摘する
- 質問は音声入力で書かれていることがある。聞き間違いがありそうなら、文脈から意図をくみ取り、最初に「〜という質問ですね」と短く確認してから答える`;
  if(aiCard)return head+'\n\n[受験者がいま見ているカード]\n'+cardContext(aiCard);
  return head+`\n- このアプリ（Studyで単元と理解度を選んで学習、セット学習、理解度3段階、Cards一覧、Homeの模擬試験、CardsでのAI類題）を使った学習の進め方も提案してよい\n\n[受験者の学習状況]\n${progressSummary()}\nいま選んでいる級: ${GR[ui.grade].label}`;
}
function openAI(which){
  if(view==='ai')return;
  aiBack=view;
  const c=which==='cur'?cur:(which&&which!=='cur'?(()=>{const q=Object.values(QS).concat(...Object.keys(AIQ).map(aiCards)).find(x=>x.id===which);return q?Object.assign(newCS(q),{revealed:true}):null})():(view==='study'?cur:null));
  const key=c?c.id:null;
  if(key!==askFor){askFor=key;askTurns=[];$('#ai-log').innerHTML=''}
  aiCard=c;
  $('#ai-head').innerHTML=(c?`<span>このカードについて：<b>${esc(label(c.q).slice(0,40))}${label(c.q).length>40?'…':''}</b></span>`:`<span>学習の進め方や、お金・FPのことを何でも</span>`)+`<button class="askx" type="button" id="ai-x" aria-label="閉じる">×</button>`;
  $('#ai-x').onclick=()=>{if(aiBack==='study'&&cur)keepId=cur.id;show(aiBack)};
  if(aiBack==='study'&&cur)keepId=cur.id;
  show('ai'); setTimeout(()=>$('#ai-in').focus({preventScroll:true}),0);
}
async function askAI(qt){
  qt=qt.trim(); if(!qt)return;
  if(askCtl)askCtl.abort();
  const log=$('#ai-log'), sendB=$('#ai-send');
  const sample=await cap('sample');
  if(!sample){log.innerHTML='<p class="aihint">AIへの質問はこの画面では使えません。claude.aiでこのページを開くと使えます。</p>';return}
  log.insertAdjacentHTML('beforeend','<div class="msg u"></div><div class="msg a wait">考えています…</div>');
  log.children[log.children.length-2].textContent=qt;
  const out=log.lastElementChild; out.scrollIntoView({block:'nearest'});
  askTurns.push({role:'user',content:qt});
  const ctl=askCtl=new AbortController(); sendB.textContent='停止'; sendB.type='button'; sendB.onclick=()=>ctl.abort();
  try{
    const r=await sample([{role:'user',content:askRules()},{role:'assistant',content:'わかりました。質問をどうぞ。'},...askTurns.slice(-8)],{cache:false,signal:ctl.signal,onText:({text})=>{out.classList.remove('wait');out.textContent=text}});
    out.classList.remove('wait'); out.textContent=r.text; askTurns.push({role:'assistant',content:r.text});
  }catch(e){
    askTurns.pop(); out.classList.remove('wait');
    if(e&&e.code==='cancelled')out.textContent=e.text?e.text+'\n（停止しました）':'停止しました';
    else if(e&&['not_granted','sampling_disabled','not_declared','capability_disabled','capability_removed'].includes(e.code))out.textContent='AIへの質問が許可されていないため使えません。';
    else if(e&&e.code==='rate_limited')out.textContent='今は質問が多すぎます。少し時間をおいてからもう一度どうぞ。';
    else out.textContent=(e&&e.text?e.text+'\n':'')+'うまく回答を受け取れませんでした。もう一度送ってください。';
  }finally{if(askCtl===ctl)askCtl=null;sendB.textContent='送信';sendB.type='submit';sendB.onclick=null}
}
$('#ai-form').onsubmit=e=>{e.preventDefault();const t=$('#ai-in').value;$('#ai-in').value='';askAI(t)};

/* ---------- Cards（一覧） ---------- */
let listSt=[]; const OPEN=new Set();
function renderList(){
  const g=ui.grade, uid=ui.unit[g]||'all', all=scopeCards(g);
  const cards=all.filter(q=>!listSt.length||listSt.includes(String(level(q.id))));
  $('#v-list').innerHTML=`
  <div class="tools"><label class="usel"><span>単元</span><select id="lUnit"><option value="all">すべての単元</option>${unitsOf(g).map(u=>`<option value="${u.id}"${uid===u.id?' selected':''}>${u.id.split('-')[1].padStart(2,'0')} ${esc(u.name)}</option>`).join('')}</select></label></div>
  <div class="listbar"><div class="stf" id="stf" role="group" aria-label="理解度で絞り込む">${[0,1,2,3].map(k=>`<button data-st="${k}" class="l${k}" aria-pressed="${listSt.includes(String(k))}">${LV[k]}</button>`).join('')}</div><span class="hint">${cards.length}枚</span></div>
  <div class="table"><table><colgroup><col class="c1"><col class="c2"><col class="c3"></colgroup><thead><tr><th>No.</th><th>問題</th><th>理解度</th></tr></thead><tbody>${cards.map(q=>{const k=level(q.id),op=OPEN.has(q.id);
    return `<tr class="w" data-id="${q.id}" aria-expanded="${op}"><td class="num">${esc(q.no)}</td><td class="qt">${esc(label(q))}</td><td class="st"><span class="lvdot l${k}"></span>${LV[k]}</td></tr>`+(op?detailRow(q):'')}).join('')}</tbody></table></div>
  ${uid!=='all'?`<div class="panel"><h2>AIで類題を追加</h2><p class="hint">この単元の論点からAIが${g===3?'三択':'四択'}問題を5問つくり、別のAIが正誤を確認してから、この単元のカードに追加します。</p><div><button class="btn" id="gen">類題を5問つくる</button></div><p class="hint" id="genMsg" role="status"></p></div>`:'<p class="hint">単元を選ぶと、その単元の類題をAIでつくれます。</p>'}`;
  $('#lUnit').onchange=e=>{ui.unit[g]=e.target.value;resetDeck();renderList()};
  document.querySelectorAll('#stf [data-st]').forEach(b=>b.onclick=()=>{const v=b.dataset.st;listSt=listSt.includes(v)?listSt.filter(x=>x!==v):[...listSt,v];renderList()});
  document.querySelectorAll('tr.w').forEach(r=>r.onclick=()=>{const id=r.dataset.id;OPEN.has(id)?OPEN.delete(id):OPEN.add(id);renderList()});
  document.querySelectorAll('[data-study]').forEach(b=>b.onclick=e=>{e.stopPropagation();const id=b.dataset.study;const q=all.find(x=>x.id===id);ui.unit[g]=q.unit;resetDeck();keepId=id;const rs=ui.rs[g];if(!rs||!rs.on)ui.rs[g]={n:((rs&&rs.n)||0)+1,w:[],on:true};show('study')});
  if(uid!=='all')$('#gen').onclick=()=>genQs(unitById(uid));
}
function detailRow(q){
  const c=Object.assign(newCS(q),{revealed:true}); if(!q.tf)c.order=q.o.map((_,k)=>k); const p=cardParts(c);
  return `<tr class="det"><td colspan="3"><div class="detail"><button class="askcard in" type="button" data-askai="${q.id}">AIに質問</button>
    <p class="qtext sm">${p.body}</p>${p.fig}${q.tf?'':`<ul class="olist">${q.o.map((o,i)=>`<li class="${i===0?'right':''}">${esc(o)}</li>`).join('')}</ul>`}
    <div class="answer open">${p.ans}</div><div><button class="btn sm" data-study="${q.id}">このカードから学習する</button></div></div></td></tr>`;
}

/* ---------- AI類題（作成→検証） ---------- */
async function genQs(u){
  const msg=$('#genMsg'), btn=$('#gen');
  const sample=await cap('sample');
  if(!sample){msg.textContent='この画面ではAI機能を使えません。claude.aiでこのページを開くと使えます。';return}
  btn.disabled=true; msg.textContent='AIが問題をつくっています…';
  const existing=pick(BYUNIT[u.id].filter(q=>q.q),15).map(q=>'・'+q.q).join('\n');
  const NC=u.grade===3?3:4, CH=u.grade===3?'三択':'四択', SAMPLE=u.grade===3?'["正解","誤答1","誤答2"]':'["正解","誤答1","誤答2","誤答3"]';
  const valid=x=>x&&typeof x.q==='string'&&Array.isArray(x.choices)&&x.choices.length===NC&&x.choices.every(c=>typeof c==='string'&&c.trim())&&new Set(x.choices).size===NC&&typeof x.explanation==='string';
  try{
    const r1=await sample.json(`あなたはFP技能検定${GR[u.grade].label}（学科）の問題作成者です。
単元「${u.name}」の論点（${u.topics}）から、${CH}問題を5問つくってください。
条件:
- FP${GR[u.grade].label}の出題範囲と難易度に合わせる。計算問題を含めてもよい
- 事実として確実な内容だけを使う。改正で変わりやすい金額・率（基礎控除額、給付制限期間、iDeCo拠出限度額など）は避け、長く変わっていない制度の仕組みや数値を使う
- 正解はただ1つに定まり、誤答ははっきり誤りであること
- 解説は3〜4文で、正解の理由、誤答がなぜ違うか、覚え方のポイント
- 次の既存問題とは違う切り口にする
${existing}
JSONだけを出力: {"questions":[{"q":"問題文","choices":${SAMPLE},"explanation":"解説"}]}
choicesの先頭を必ず正解にすること。`,{modelTier:'default'});
    const list=(r1&&r1.questions||[]).filter(valid);
    if(!list.length)throw {code:'empty'};
    msg.textContent='別のAIが正誤を確認しています…';
    const r2=await sample.json(`あなたはFP技能検定の問題の校閲者です。次の${CH}問題（choicesの先頭が正解とされている）を1問ずつ厳しく確認してください。
確認すること: 正解が本当に正しいか／誤答に正解になりうるものがないか／解説に誤りがないか／${GR[u.grade].label}の範囲として適切か。
- 正しく直せるなら修正し、直せない・確信が持てないものは除外する
- 修正後もchoicesの先頭を正解にする
問題: ${JSON.stringify(list)}
JSONだけを出力: {"questions":[{"q":"","choices":${u.grade===3?'["","",""]':'["","","",""]'},"explanation":""}],"removed":除外した数}`,{modelTier:'complex'});
    const checked=(r2&&r2.questions||[]).filter(valid);
    if(!checked.length)throw {code:'empty'};
    const stamp=Date.now().toString(36);
    AIQ[u.id]=[...(AIQ[u.id]||[]),...checked.map((x,i)=>({id:'ai-'+u.id+'-'+stamp+i,q:x.q,o:x.choices,e:x.explanation}))].slice(-60); save();
    const removed=Math.max(0,list.length-checked.length);
    renderList();
    $('#genMsg').textContent=`${checked.length}問を追加しました${removed?`（確認で${removed}問を除外）`:''}。一覧の最後に「AI」の番号で並んでいます。`;
  }catch(e){
    btn.disabled=false;
    msg.textContent=e&&e.code==='not_granted'?'AI機能の利用が許可されませんでした。':e&&e.code==='rate_limited'?'AIの利用が混み合っています。少し時間をおいてから試してください。':'問題をつくれませんでした。もう一度試してください。';
  }
}

/* ---------- Setting ---------- */
function renderSettings(){
  const sel=(id,cur,list)=>`<select id="${id}">${list.map(o=>`<option value="${o[0]}"${String(cur)===String(o[0])?' selected':''}>${o[1]}</option>`).join('')}</select>`;
  $('#v-settings').innerHTML=`<div class="panel">
    <div class="field"><div><label for="s-round">1セットの枚数</label><p>Studyで1回に学習するカードの枚数。</p></div>${sel('s-round',ui.round,[[5,5],[10,10],[15,15],[20,20],[25,25]])}</div>
    <div class="field"><div><label for="s-order">順番</label><p>Studyでのカードの順番。</p></div>${sel('s-order',ui.order,[['seq','番号順'],['rand','ランダム']])}</div>
    <div class="field"><div><label for="s-ar">リトライ</label><p>「わからない」にしたカードを、5枚後にもう一度出します。</p></div>${sel('s-ar',ui.ar!==false?1:0,[[1,'ON'],[0,'OFF']])}</div>
    <div class="field"><div><label for="s-gloss">「あわせて覚える」</label><p>答えに出てくる用語の解説を、解説の下に表示します。</p></div>${sel('s-gloss',ui.gloss!==false?1:0,[[1,'表示する'],[0,'表示しない']])}</div>
    <div class="field"><div><label>記録のリセット</label><p>${GR[ui.grade].label}と${GR[ui.grade===3?2:3].label}のすべてのカードを未学習に戻します。元には戻せません。</p></div><div class="row"><button class="btn danger" id="reset">リセット</button></div></div>
  </div>
  <p class="hint">税制・社会保険の金額や率は毎年のように改正されます。この問題集は改正の影響を受けにくい論点を中心にしていますが、受験する回の法令基準日に合わせて、最新のテキストや日本FP協会・金財の発表で確認してください。AIが作成した類題や回答には誤りが含まれることがあります。</p>`;
  const on=(id,f)=>$(id).onchange=e=>{f(e.target.value);saveLocal()};
  on('#s-round',v=>ui.round=+v); on('#s-order',v=>{ui.order=v;deck=[];used.clear()}); on('#s-ar',v=>{ui.ar=v==='1';if(!ui.ar)againQ=[]}); on('#s-gloss',v=>ui.gloss=v==='1');
  const r=$('#reset'); r.onclick=()=>{if(r.dataset.c){P={};AIQ={};HIST.length=0;ui.rs={3:null,2:null};ui.sp={3:null,2:null};resetDeck();save();r.textContent='リセットしました';r.disabled=true}else{r.dataset.c=1;r.textContent='もう一度押すと消去します'}};
}

/* ---------- 模擬試験 ---------- */
let MK=null;
function mockStart(g){
  const take=(units,cnt,f)=>{const out=[];const pool=units.map(u=>BYUNIT[u.id].filter(f));const sum=pool.reduce((a,b)=>a+b.length,0);let left=cnt;
    pool.forEach((p,i)=>{const n=i===pool.length-1?left:Math.round(cnt*p.length/sum);left-=n;out.push(...pick(p,Math.max(0,n)))});return shuffle(out)};
  const list=g===3?[...take(unitsOf(3),30,q=>q.tf),...take(unitsOf(3),30,q=>!q.tf)]:take(unitsOf(2),60,()=>true);
  MK={list,i:0,score:0,miss:[],g,saved:cur}; $('#v-study').innerHTML='';
  mockShow();
}
function mockShow(){
  const n=MK.list.length; cur=newCS(MK.list[MK.i]);
  $('#v-home').innerHTML=`<div class="sessrow"><button class="btn sm" id="quit">← 模擬試験をやめる</button><span class="hint num">${MK.i+1} / ${n}</span></div><div class="pbar"><i style="width:${MK.i/n*100}%"></i></div><div id="stage"></div>`;
  $('#quit').onclick=mockExit; drawCard($('#stage'),true); window.scrollTo(0,0);
}
function mockExit(){cur=MK.saved;MK=null;show('home')}
function mockResult(){
  const n=MK.list.length,pct=Math.round(MK.score/n*100);
  $('#v-home').innerHTML=`<div class="panel done"><h2>模擬試験（${GR[MK.g].label}）の結果</h2><p class="res"><span class="num big">${MK.score}</span> / ${n}（${pct}%）</p>
  <p class="${pct>=60?'pass':'fail'}">${pct>=60?'合格基準（60％）に届いています':`合格基準（60％）まで、あと${Math.max(0,Math.ceil(n*.6)-MK.score)}問`}</p><div class="setbtns"><button class="btn primary" id="back">Homeに戻る</button></div></div>
  ${MK.miss.length?`<div class="panel"><h2>間違えた問題（「わからない」としてStudyに出ます）</h2><div class="miss">${MK.miss.map(q=>`<div><b>${esc(label(q))}</b>正解：${esc(optText(q,0))}</div>`).join('')}</div></div>`:''}`;
  $('#back').onclick=mockExit; window.scrollTo(0,0);
}

show(ui.view);
})();
