(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const app=$('#app');
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const pick=(a,n)=>shuffle(a).slice(0,n);
const yen=n=>Number(n).toLocaleString('ja-JP');
const parseNum=s=>{s=String(s||'').replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0)).replace(/[，,円%％\s]/g,'');if(!/^-?\d+(\.\d+)?$/.test(s))return null;return Math.abs(+s)};

/* ---------- 科目と問題 ---------- */
const GS=['1','2'];
const GR={'1':{label:'1級',units:window.UNITS['1']},'2':{label:'2級',units:window.UNITS['2']}};
const KIND={mc:'읽기',l:'듣기'};
const QS={}, BYUNIT={};
for(const g of GS) for(const u of GR[g].units){
  u.grade=g; BYUNIT[u.id]=[];
  u.qs.forEach((x,i)=>{const q=Object.assign({id:u.id+'-'+i,unit:u.id,grade:g,kind:x.t},x);QS[q.id]=q;BYUNIT[u.id].push(q)});
}

/* ---------- 記録（この端末＋サインイン時はクラウド） ---------- */
const KEY='topik_v1';
let P={}, AIQ={}, ui={grade:'1',unit:{'1':'all','2':'all'}}, cloud=false;
try{const o=JSON.parse(localStorage.getItem(KEY)||'{}');P=o.p||{};AIQ=o.ai||{};if(o.ui)Object.assign(ui,o.ui)}catch(e){}
if(!GS.includes(ui.grade))ui.grade='1';
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
      saveLocal();
    }
    dbDoc=ref; cloud=true; refresh(); flush();
  }catch(e){}
})();

/* ---------- 共通 ---------- */
const unitsOf=g=>GR[g].units;
const unitById=id=>GS.flatMap(unitsOf).find(u=>u.id===id);
const LV=['未学習','わからない','要復習','完了'];
const level=id=>{const p=P[id];return p&&p.g?p.g:0};
const ORDER={'1':[],'2':[]};
for(const g of GS)unitsOf(g).forEach(u=>BYUNIT[u.id].forEach(q=>{ORDER[g].push(q);q.no=String(ORDER[g].length).padStart(3,'0')}));
const aiCards=uid=>{const u=unitById(uid);return u?(AIQ[uid]||[]).map((a,i)=>Object.assign({},a,{unit:uid,grade:u.grade,kind:'mc',isAi:true,no:'AI'+(i+1)})):[]};
const scopeCards=g=>{const u=ui.unit[g]||'all';return u==='all'?[...ORDER[g],...unitsOf(g).flatMap(x=>aiCards(x.id))]:[...(BYUNIT[u]||[]),...aiCards(u)]};
const uno=u=>u.id.split('-')[1].padStart(2,'0');
Object.assign(ui,Object.assign({view:'home',sf:{'1':['0','1','2'],'2':['0','1','2']},order:'seq',round:10,ar:true,auto:true,rs:{'1':null,'2':null},sp:{'1':null,'2':null}},ui));
for(const g of GS){if(!ui.sf[g])ui.sf[g]=['0','1','2'];if(!(g in ui.rs))ui.rs[g]=null;if(!(g in ui.sp))ui.sp[g]=null;if(!ui.unit[g]||(ui.unit[g]!=='all'&&!BYUNIT[ui.unit[g]]))ui.unit[g]='all'}
if(!['home','study','list','settings'].includes(ui.view))ui.view='home';
const sfList=()=>{const f=(ui.sf[ui.grade]||[]).filter(x=>['0','1','2','3'].includes(x));return f.length?f:['0','1','2']};

/* ---------- 骨組み ---------- */
const VIEWS=[['home','Home'],['study','Study'],['list','Cards'],['settings','Setting']];
app.innerHTML=`
<header><div class="brand"><b>TOPIK</b><div class="seg" role="group" aria-label="級">${GS.map(x=>`<button data-g="${x}">${GR[x].label}</button>`).join('')}</div></div>
  <div class="hrow"><nav aria-label="画面">${VIEWS.map(v=>`<button data-view="${v[0]}">${v[1]}</button>`).join('')}</nav><button class="askhd" id="askhd" type="button">AIに質問</button></div></header>
<div class="sync" id="sync">記録はこの端末に保存されます</div>
<section id="v-home"></section><section id="v-study" hidden></section><section id="v-list" hidden></section><section id="v-settings" hidden></section>
<section id="v-ai" hidden><div class="askp aiview"><div class="askhead" id="ai-head"></div><div class="asklog" id="ai-log"></div>
  <form class="askin" id="ai-form"><input type="text" id="ai-in" placeholder="質問を入力" aria-label="質問" autocomplete="off"><button type="submit" id="ai-send">送信</button></form></div></section>`;
let view='home';
function show(v){
  stopAudio();
  if(view==='ai'&&v!=='ai'&&askCtl){askCtl.abort();askCtl=null}
  if(v!=='study'&&view==='study'&&cur)keepId=cur.id;
  view=v; if(v!=='ai'){ui.view=v;saveLocal()}
  document.querySelectorAll('header [data-view]').forEach(b=>b.toggleAttribute('aria-current',b.dataset.view===v));
  $('#askhd').toggleAttribute('aria-current',v==='ai');
  ['home','study','list','settings','ai'].forEach(x=>$('#v-'+x).hidden=x!==v);
  document.querySelectorAll('.seg button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.g===ui.grade)));
  if(v==='home')renderHome(); if(v==='study')renderStudy(); if(v==='list')renderList(); if(v==='settings')renderSettings();
  window.scrollTo(0,0);
}
function refresh(){ $('#sync').textContent=cloud?'記録はあなたのアカウントに保存されています':'記録はこの端末に保存されます'; if(MK)return; if(view==='study'&&cur)keepId=cur.id; if(view!=='ai')show(view) }
document.querySelectorAll('header [data-view]').forEach(b=>b.onclick=()=>{if(MK)MK=null;show(b.dataset.view)});
document.querySelectorAll('.seg button').forEach(b=>b.onclick=()=>{ui.grade=b.dataset.g;MK=null;cur=null;keepId=null;againQ=[];deck=[];used.clear();HIST.length=0;saveLocal();show(view==='ai'?'home':view)});
$('#askhd').onclick=()=>openAI(null);

/* ---------- 音声（録音した韓国語の声。なければ端末の声） ---------- */
const SPK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>';
const AV='1'; let AIDX=null, AIDXP=null; const CH=new Map(), URLS=new Map(); const player=new Audio(); let ptok=0;
function loadIdx(){if(!AIDXP)AIDXP=fetch('audio/index.json?v='+AV).then(r=>r.ok?r.json():{}).then(j=>AIDX=j).catch(()=>AIDX={});return AIDXP}
function loadCh(c){if(!CH.has(c))CH.set(c,fetch('audio/c'+String(c).padStart(2,'0')+'.mp3?v='+AV).then(r=>{if(!r.ok)throw 0;return r.arrayBuffer()}).catch(e=>{CH.delete(c);throw e}));return CH.get(c)}
async function clip(t){await loadIdx();const e=AIDX&&AIDX[t];if(!e)return null;if(URLS.has(t))return URLS.get(t);const b=await loadCh(e[0]);const u=URL.createObjectURL(new Blob([b.slice(e[1],e[1]+e[2])],{type:'audio/mpeg'}));URLS.set(t,u);return u}
function devSay(t){t=t.replace(/(^|\n)\s*(남자|여자)\s*:/g,'$1');try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.lang='ko-KR';const v=speechSynthesis.getVoices().find(x=>/^ko/i.test(x.lang));if(v)u.voice=v;speechSynthesis.speak(u)}catch(e){}}
function stopAudio(){ptok++;player.pause();try{speechSynthesis.cancel()}catch(e){}}
async function say(t){if(!t)return;const k=++ptok;player.pause();let u=null;try{u=await clip(t)}catch(e){}if(k!==ptok)return;if(!u)return devSay(t);player.src=u;const p=player.play();if(p&&p.catch)p.catch(()=>devSay(t))}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-say]');if(b){e.preventDefault();e.stopPropagation();say(b.dataset.say)}},true);
loadIdx();

/* ---------- Home ---------- */
function renderHome(){
  const g=ui.grade, all=ORDER[g], k=[0,0,0,0]; all.forEach(q=>k[level(q.id)]++);
  const kinds={mc:0,l:0}; all.forEach(q=>kinds[q.kind]++);
  $('#v-home').innerHTML=`
  <div class="today"><div><small>未完了</small><strong>${all.length-k[3]}</strong></div><div><small>完了</small><strong style="color:var(--good)">${k[3]}</strong></div></div>
  <div class="start"><button class="btn primary" id="go">Study</button><span class="hint">${GR[g].label}・全${all.length}枚（읽기・語彙・文法${kinds.mc}・듣기${kinds.l}）</span></div>
  <div class="panel lvp"><h2>理解度別に復習</h2>
    ${[1,2,3].map(n=>`<div class="lvrow"><span class="lvdot l${n}"></span><b>${LV[n]}</b><strong>${k[n]}</strong><button class="btn" data-lv="${n}" ${k[n]?'':'disabled'}>復習</button></div>`).join('')}
    <p class="hint">最後に選んだ理解度でまとめています。「復習」を押すと、その理解度のカードだけでStudyを始めます。</p></div>
  <div class="panel"><h2>単元ごとの進み具合</h2><div class="ulist">${unitsOf(g).map(u=>{const qs=BYUNIT[u.id],d=qs.filter(q=>level(q.id)===3).length;return `<button class="urow" data-u="${u.id}"><span class="nm"><span class="num">${uno(u)}</span>${esc(u.name)}</span><span class="num ct">${d}/${qs.length}</span><span class="bar"><i style="width:${d/qs.length*100}%"></i></span></button>`}).join('')}</div></div>
  <div class="panel"><h2>模擬試験</h2><p class="hint">${GR[g].label}の全単元から25問（듣기10問・읽기15問）を出題し、自動で採点します。TOPIK Iの合格ラインに合わせて、${g==='1'?'1級は40%（200点中80点）':'2級は70%（200点中140点）'}で判定します。</p><div><button class="btn" id="mock">${GR[g].label}の模擬試験を始める</button></div></div>
  <div class="panel"><h2>TOPIK I（1・2級）の試験</h2><table class="exam"><tbody>
    <tr><th>듣기</th><td>聞き取り30問（紙の試験で40分）</td><td class="num">100点</td></tr>
    <tr><th>읽기</th><td>読解40問（紙の試験で60分）</td><td class="num">100点</td></tr>
    <tr><th>判定</th><td>200点中 80点以上で1級、140点以上で2級</td><td class="num"></td></tr></tbody></table>
    <p class="hint">問題も選択肢もすべて韓国語です。このアプリでは試験と同じ韓国語の指示文で練習し、解説を日本語で読めるようにしています。3〜6級はTOPIK II（듣기・쓰기・읽기、300点）です。試験時間や日程は、TOPIK公式サイトで確認してください。</p></div>`;
  $('#go').onclick=()=>show('study');
  document.querySelectorAll('[data-lv]').forEach(b=>b.onclick=()=>{ui.sf[g]=[b.dataset.lv];resetDeck();show('study')});
  document.querySelectorAll('.urow').forEach(b=>b.onclick=()=>{ui.unit[g]=b.dataset.u;resetDeck();show('study')});
  $('#mock').onclick=mockStart;
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
    <label class="usel"><span>単元</span><select id="selUnit"><option value="all">すべての単元</option>${unitsOf(g).map(u=>`<option value="${u.id}"${uid===u.id?' selected':''}>${uno(u)} ${esc(u.name)}</option>`).join('')}</select></label>
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
  else body=`<div class="setbtns" style="margin:0"><button class="btn primary" id="set-go" ${pool?'':'disabled'}>▶ スタート</button></div>${pool?`<p class="hint">${ui.round}枚ずつ学習します。選択肢をタップすると答え合わせ、シートをタップすると答えだけを見られます。듣기の問題は音声が自動で流れます。</p>`:'<p class="hint">選んだ理解度のカードがありません。上のボタンで理解度を選び直してください。</p>'}`;
  $('#stage').innerHTML=`<div class="panel done">${body}</div>`;
  $('#set-go').onclick=()=>{ui.rs[g]={n:((r&&r.n)||0)+1,w:[],on:true};againQ=[];keepId=null;saveLocal();renderStudy()};
}
function renderCard(){
  const g=ui.grade, rs=ui.rs[g];
  if(!rs||!rs.on)return setPanel();
  if(!keepId&&rs.w.length>=ui.round&&!againQ.length){ui.rs[g]={...rs,on:false};saveLocal();return setPanel()}
  let q=null;
  if(keepId&&cur&&cur.id===keepId){keepId=null;cur.revealed=false;cur.chosen=null;opened=false;drawCard($('#stage'),false);return}
  if(keepId)q=scopeCards(g).find(x=>x.id===keepId)||null; keepId=null;
  if(!q)q=nextStudy();
  if(!q){cur=null;$('#stage').innerHTML=`<div class="panel done"><p>選んだ理解度のカードがありません。上のボタンで理解度を選び直してください。</p></div>`;return}
  cur=newCS(q); opened=false;
  drawCard($('#stage'),false);
}

/* ---------- カード ---------- */
function newCS(q){
  const c={q,id:q.id,revealed:false,chosen:null};
  if(q.kind==='mc'||q.kind==='l')c.order=shuffle(q.o.map((_,k)=>k));
  return c;
}
function jTable(q){
  const n=Math.max(q.d.length,q.c.length); let rows='';
  for(let i=0;i<n;i++){const d=q.d[i],c=q.c[i];
    rows+=`<tr><td>${d?esc(d[0]):''}</td><td class="r num">${d?yen(d[1]):''}</td><td>${c?esc(c[0]):''}</td><td class="r num">${c?yen(c[1]):''}</td></tr>`}
  return `<div class="jwrap"><table class="jt"><thead><tr><th>借方科目</th><th class="r">金額</th><th>貸方科目</th><th class="r">金額</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function cardParts(c){
  const q=c.q; let body=esc(q.q).replace(/\n/g,'<br>'),opts='',ans='',hint='';
  if(q.kind==='mc'||q.kind==='l'){
    opts=`<div class="opts">${c.order.map((k,j)=>`<button class="opt" data-k="${k}"><span class="k">${'①②③④'[j]}</span><span>${esc(q.o[k])}</span></button>`).join('')}</div>`;
    ans=`<p class="ja">${'①②③④'[c.order.indexOf(0)]}　${esc(q.o[0])}</p>`;
    if(q.kind==='l'){ hint=`<button class="play big" type="button" data-say="${esc(q.s)}">${SPK}<span>音声を聞く</span></button>`; ans=`<p class="script"><span>${esc(q.s).replace(/\n/g,'<br>')}</span><button class="spk" type="button" data-say="${esc(q.s)}" aria-label="もう一度聞く">${SPK}</button></p>`+ans; }
    else if(q.s){ ans+=`<p class="script">${esc(q.s)}<button class="spk" type="button" data-say="${esc(q.s)}" aria-label="韓国語を聞く">${SPK}</button></p>`; }
  }else if(q.kind==='j'){
    hint='<p class="hint task">仕訳を紙に書いてから答えを見ましょう。</p>';
    ans=jTable(q);
  }else{
    opts=`<label class="numin"><span>答え</span><input type="text" inputmode="decimal" id="numIn" autocomplete="off" placeholder="数値を入力（省略可）"><span class="u">${esc((q.a.match(/円\/時間|%|円/)||['円'])[0])}</span></label>`;
    ans=`<p class="ja num">${esc(q.a)}</p>`;
  }
  ans+=`<p class="exp">${esc(q.e)}</p>${q.isAi?'<p class="aiwarn">AIが作成し、AIが確認した問題です。疑問があれば「AIに質問」で確認してください。</p>':''}`;
  return {body,opts,ans,hint};
}
function drawCard(el,mock){
  const c=cur,q=c.q,u=unitById(q.unit),k=level(q.id);
  const {body,opts,ans,hint}=cardParts(c);
  el.innerHTML=`
  <article class="card">${mock?'':'<button class="askcard" type="button" data-askai>AIに質問</button>'}
    <div class="meta"><span class="num">No.${q.no||''}</span><span class="tag kd k-${q.kind}">${KIND[q.kind]}</span><span class="tag">${esc(u?u.name:'')}</span>${q.isAi?'<span class="tag ai">AI作成</span>':''}${mock?'':`<span class="tag lvchip l${k}">${LV[k]}</span>`}</div>
    <p class="qtext">${body}</p>${hint}${opts}
    <div class="answer${mock?' mock':''}" id="ans">${ans}${mock?'':'<button class="sheet" id="sheet">答えを見る<small>タップまたはSpace</small></button>'}</div>
  </article>
  ${mock?'<div id="nextWrap"></div>':`<div class="grades" id="grades">${[1,2,3].map(n=>`<button class="g${n}" data-g="${n}">${LV[n]}<kbd>${n}</kbd></button>`).join('')}</div>`}`;
  el.querySelectorAll('.opt').forEach(b=>b.onclick=()=>choose(b,mock));
  if(q.kind==='l'&&ui.auto!==false)setTimeout(()=>say(q.s),250);
  const ni=$('#numIn'); if(ni)ni.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();reveal(undefined,mock)}};
  if(mock){ if(q.kind!=='mc'&&q.kind!=='l'){$('#nextWrap').innerHTML='<button class="btn primary wide" id="see">答えを見る</button>';$('#see').onclick=()=>reveal(undefined,true)} }
  else{$('#sheet').onclick=()=>reveal();el.querySelectorAll('#grades button').forEach(b=>b.onclick=()=>grade(+b.dataset.g))}
}
function choose(btn,mock){
  if(cur.revealed)return;
  const q=cur.q,k=+btn.dataset.k,ok=k===0; cur.chosen=q.o[k];
  btn.classList.add(ok?'ok':'ng');
  reveal(ok,mock);
}
function reveal(ok,mock){
  if(!cur||cur.revealed)return; cur.revealed=true; opened=true; stopAudio();
  const q=cur.q;
  if(q.kind==='n'){const ni=$('#numIn');if(ni){const v=parseNum(ni.value);if(ni.value.trim()){ok=v!==null&&v===q.num;cur.chosen=ni.value.trim();ni.classList.add(ok?'ok':'ng')}ni.disabled=true}}
  document.querySelectorAll('#stage .opt').forEach(b=>{b.disabled=true;if(+b.dataset.k===0)b.classList.add('ok')});
  const a=$('#ans'); a.classList.add('open');
  if(q.kind==='mc'&&q.s&&ui.auto!==false&&!mock)say(q.s);
  if(ok!==undefined)a.insertAdjacentHTML('afterbegin',`<p class="verdict ${ok?'v-ok':'v-ng'}">${ok?'正解':'不正解'+(q.kind==='n'&&cur.chosen?'（あなたの答え：'+esc(cur.chosen)+'）':'')}</p>`);
  if(mock){
    const last=MK.i===MK.list.length-1;
    const fin=r=>{stopAudio();if(r)MK.score++;else MK.miss.push(q);setLevel(q.id,r?3:1);if(last)mockResult();else{MK.i++;mockShow()}};
    if(ok!==undefined){$('#nextWrap').innerHTML=`<button class="btn primary wide" id="next">${last?'結果を見る':'次の問題'}</button>`;$('#next').onclick=()=>fin(ok);$('#next').focus({preventScroll:true})}
    else{$('#nextWrap').innerHTML=`<div class="selfck"><button class="btn" id="ng">✕ 間違えた</button><button class="btn primary" id="okb">○ 合っていた</button></div>`;$('#ng').onclick=()=>fin(false);$('#okb').onclick=()=>fin(true)}
  }else{const b=$(ok===false?'#grades .g1':'#grades .g3');if(b)b.focus({preventScroll:true})}
}
function setLevel(id,g){const p=P[id]||{n:0};p.n=(p.n||0)+1;p.g=g;p.t=Date.now();P[id]=p;save()}
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
    card=e.target.closest('.card'); on=!!card&&!!cur&&e.touches.length===1&&!e.target.closest('input,select,textarea,.askcard,.jwrap,.play,.spk');
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
let askCtl=null, askFor=undefined, askTurns=[], aiBack='home', aiCard=null;
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-askai]');if(b){e.preventDefault();e.stopPropagation();openAI(b.dataset.askai||'cur')}},true);
const jText=q=>'借方：'+q.d.map(x=>x[0]+' '+yen(x[1])).join('、')+' ／ 貸方：'+q.c.map(x=>x[0]+' '+yen(x[1])).join('、');
function cardContext(c){
  const q=c.q, st=c.revealed?('答えを確認済み'+(c.chosen?'（受験者の答え: '+c.chosen+'）':'')):'まだ答えを見ていない。質問で求められない限り正解は明かさず、考え方のヒントにとどめること';
  const body=q.kind==='l'?`聞き取り問題（音声: ${q.s}）\n問題: ${q.q}\n選択肢: ${q.o.join(' / ')}\n正解: ${q.o[0]}`:`問題: ${q.q}\n選択肢: ${q.o.join(' / ')}\n正解: ${q.o[0]}${q.s?'\n関係する韓国語: '+q.s:''}`;
  return `${body}\n解説: ${q.e}\n受験者の状態: ${st}${q.isAi?'\n※この問題はAIが作成したもの。誤りがあれば率直に指摘すること。':''}`;
}
function progressSummary(){const lines=[];
  for(const x of GS){lines.push(`【${GR[x].label}】`);
    for(const u of unitsOf(x)){const k=[0,0,0,0];BYUNIT[u.id].forEach(q=>k[level(q.id)]++);lines.push(`${u.name}: 全${BYUNIT[u.id].length}枚／完了${k[3]}・要復習${k[2]}・わからない${k[1]}・未学習${k[0]}`)}}
  return lines.join('\n')}
function askRules(){
  const head=`あなたはTOPIK（韓国語能力試験）の1級から6級までの合格を目指す日本人学習者の韓国語の先生です。いまはTOPIK I（1・2級）に取り組んでいます。受験者の質問に日本語で答えてください。
- スマホで読むので短く、結論から（長くても12行程度）
- マークダウン記号（#、**、表）は使わず、箇条書きは「・」を使う。韓国語には必要に応じて日本語訳と発音（ハングルの発音表記［ ］）を添える
- 文法は、接続のルール（パッチムの有無・陽母音/陰母音・変則活用）や発音の変化まで具体的に説明する。不確かなことは断定しない
- TOPIK Iの出題形式（듣기：알맞은 대답・이어지는 말・장소・화제・내용 일치・중심 생각、읽기：화제・빈칸・안내문・내용 일치・중심 생각・순서 배열）を意識して、解き方のコツも教える
- 問題の正解や解説に誤りがあると判断したら、遠慮なく指摘する
- 質問は音声入力で書かれていることがある。聞き間違いがありそうなら、文脈から意図をくみ取り、最初に「〜という質問ですね」と短く確認してから答える`;
  if(aiCard)return head+'\n\n[受験者がいま見ているカード]\n'+cardContext(aiCard);
  return head+`\n- このアプリ（Studyで単元と理解度を選んで学習、理解度3段階、Cards一覧、Homeの模擬試験、CardsでのAI類題）を使った学習の進め方も提案してよい\n\n[受験者の学習状況]\n${progressSummary()}\nいま選んでいる級: ${GR[ui.grade].label}`;
}
function openAI(which){
  if(view==='ai')return;
  aiBack=view;
  const c=which==='cur'?cur:(which?(()=>{const q=Object.values(QS).concat(...Object.keys(AIQ).map(aiCards)).find(x=>x.id===which);return q?Object.assign(newCS(q),{revealed:true}):null})():(view==='study'?cur:null));
  const key=c?c.id:null;
  if(key!==askFor){askFor=key;askTurns=[];$('#ai-log').innerHTML=''}
  aiCard=c;
  const lb=c?c.q.q:'';
  $('#ai-head').innerHTML=(c?`<span>このカードについて：<b>${esc(lb.slice(0,40))}${lb.length>40?'…':''}</b></span>`:`<span>学習の進め方や、TOPIK・韓国語のことを何でも</span>`)+`<button class="askx" type="button" id="ai-x" aria-label="閉じる">×</button>`;
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
  <div class="tools"><label class="usel"><span>単元</span><select id="lUnit"><option value="all">すべての単元</option>${unitsOf(g).map(u=>`<option value="${u.id}"${uid===u.id?' selected':''}>${uno(u)} ${esc(u.name)}</option>`).join('')}</select></label></div>
  <div class="listbar"><div class="stf" id="stf" role="group" aria-label="理解度で絞り込む">${[0,1,2,3].map(k=>`<button data-st="${k}" class="l${k}" aria-pressed="${listSt.includes(String(k))}">${LV[k]}</button>`).join('')}</div><span class="hint">${cards.length}枚</span></div>
  <div class="table"><table class="lt"><colgroup><col class="c1"><col class="c2"><col class="c3"></colgroup><thead><tr><th>No.</th><th>問題</th><th>理解度</th></tr></thead><tbody>${cards.map(q=>{const k=level(q.id),op=OPEN.has(q.id);
    return `<tr class="w" data-id="${q.id}" aria-expanded="${op}"><td class="num">${esc(q.no)}</td><td class="qt"><span class="kd k-${q.kind}">${KIND[q.kind]}</span>${esc(q.q)}</td><td class="st"><span class="lvdot l${k}"></span>${LV[k]}</td></tr>`+(op?detailRow(q):'')}).join('')}</tbody></table></div>
  ${uid!=='all'?`<div class="panel"><h2>AIで類題を追加</h2><p class="hint">この単元の論点からAIが읽기形式の4択問題を5問つくり、別のAIが正誤を確認してから、この単元のカードに追加します。</p><div><button class="btn" id="gen">類題を5問つくる</button></div><p class="hint" id="genMsg" role="status"></p></div>`:'<p class="hint">単元を選ぶと、その単元の類題をAIでつくれます。</p>'}`;
  $('#lUnit').onchange=e=>{ui.unit[g]=e.target.value;resetDeck();renderList()};
  document.querySelectorAll('#stf [data-st]').forEach(b=>b.onclick=()=>{const v=b.dataset.st;listSt=listSt.includes(v)?listSt.filter(x=>x!==v):[...listSt,v];renderList()});
  document.querySelectorAll('tr.w').forEach(r=>r.onclick=()=>{const id=r.dataset.id;OPEN.has(id)?OPEN.delete(id):OPEN.add(id);renderList()});
  document.querySelectorAll('[data-study]').forEach(b=>b.onclick=e=>{e.stopPropagation();const id=b.dataset.study;const q=all.find(x=>x.id===id);ui.unit[g]=q.unit;resetDeck();keepId=id;const rs=ui.rs[g];if(!rs||!rs.on)ui.rs[g]={n:((rs&&rs.n)||0)+1,w:[],on:true};show('study')});
  if(uid!=='all')$('#gen').onclick=()=>genQs(unitById(uid));
}
function detailRow(q){
  const c=Object.assign(newCS(q),{revealed:true}); const p=cardParts(c);
  return `<tr class="det"><td colspan="3"><div class="detail"><button class="askcard in" type="button" data-askai="${q.id}">AIに質問</button>
    <p class="qtext sm">${p.body}</p>${q.kind==='l'?`<p class="script"><span>${esc(q.s).replace(/\n/g,'<br>')}</span><button class="spk" type="button" data-say="${esc(q.s)}" aria-label="聞く">${SPK}</button></p>`:''}${q.kind==='mc'||q.kind==='l'?`<ul class="olist">${q.o.map((o,i)=>`<li class="${i===0?'right':''}">${esc(o)}</li>`).join('')}</ul>`:''}
    <div class="answer open">${q.kind==='l'?p.ans.replace(/^<p class="script">[\s\S]*?<\/p>/,''):p.ans}</div><div><button class="btn sm" data-study="${q.id}">このカードから学習する</button></div></div></td></tr>`;
}

/* ---------- AI類題（作成→検証） ---------- */
async function genQs(u){
  const msg=$('#genMsg'), btn=$('#gen');
  const sample=await cap('sample');
  if(!sample){msg.textContent='この画面ではAI機能を使えません。claude.aiでこのページを開くと使えます。';return}
  btn.disabled=true; msg.textContent='AIが問題をつくっています…';
  const existing=pick(BYUNIT[u.id],12).map(q=>'・'+q.q).join('\n');
  const valid=x=>x&&typeof x.q==='string'&&Array.isArray(x.choices)&&x.choices.length===4&&x.choices.every(c=>typeof c==='string'&&c.trim())&&new Set(x.choices).size===4&&typeof x.explanation==='string';
  try{
    const r1=await sample.json(`あなたはTOPIK（韓国語能力試験）TOPIK I・${GR[u.grade].label}レベルの問題作成者です。
単元「${u.name}」の論点（${u.topics}）から、読み（읽기）形式の4択問題を5問つくってください。
条件:
- TOPIK Iの${GR[u.grade].label}レベルの語彙・文法に合わせる（${u.grade==='1'?'1級は約800語の生活語彙、基本の助詞、-아요/-ㅂ니다、過去、否定、-고 싶다、-고 있다、-(으)ㄹ 거예요 など':'2級は約1,500〜2,000語、-는데、-(으)면서、-기 때문에、-(으)려고、-게 되다、-기로 하다、-(으)ㄹ 것 같다、-아/어 놓다 など、公共の場面の語彙'}）
- 問題文は本試験と同じ韓国語の指示文（例：「（　）에 들어갈 가장 알맞은 것을 고르십시오.」「다음의 내용과 같은 것을 고르십시오.」）にし、選択肢も韓国語。解説は日本語で、本文の和訳も添える
- 正解はただ1つに定まり、誤答ははっきり誤りであること。韓国語のつづりと文法を必ず確認する
- 解説は3〜4文で、本文の意味、正解の理由、間違えやすい点
- 次の既存問題とは違う語・切り口にする
${existing}
JSONだけを出力: {"questions":[{"q":"問題文","choices":["正解","誤答1","誤答2","誤答3"],"explanation":"解説"}]}
choicesの先頭を必ず正解にすること。`,{modelTier:'default'});
    const list=(r1&&r1.questions||[]).filter(valid);
    if(!list.length)throw {code:'empty'};
    msg.textContent='別のAIが正誤を確認しています…';
    const r2=await sample.json(`あなたはTOPIKの問題の校閲者で、韓国語のネイティブ話者です。次の4択問題（choicesの先頭が正解とされている）を1問ずつ厳しく確認してください。
確認すること: 正解が本当に正しいか（つづり・発音表記・活用・助詞）／誤答に正解になりうるものがないか／解説に誤りがないか／${GR[u.grade].label}の範囲として適切か。
- 正しく直せるなら修正し、直せない・確信が持てないものは除外する
- 修正後もchoicesの先頭を正解にする
問題: ${JSON.stringify(list)}
JSONだけを出力: {"questions":[{"q":"","choices":["","","",""],"explanation":""}],"removed":除外した数}`,{modelTier:'complex'});
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
  const sel=(id,cv,list)=>`<select id="${id}">${list.map(o=>`<option value="${o[0]}"${String(cv)===String(o[0])?' selected':''}>${o[1]}</option>`).join('')}</select>`;
  $('#v-settings').innerHTML=`<div class="panel">
    <div class="field"><div><label for="s-round">1セットの枚数</label><p>Studyで1回に学習するカードの枚数。</p></div>${sel('s-round',ui.round,[[5,5],[10,10],[15,15],[20,20],[25,25]])}</div>
    <div class="field"><div><label for="s-order">順番</label><p>Studyでのカードの順番。</p></div>${sel('s-order',ui.order,[['seq','番号順'],['rand','ランダム']])}</div>
    <div class="field"><div><label for="s-auto">音声の自動再生</label><p>듣기の問題はカードが出たとき、읽기の問題は答えを開いたときに韓国語を読み上げます。</p></div>${sel('s-auto',ui.auto!==false?1:0,[[1,'ON'],[0,'OFF']])}</div>
    <div class="field"><div><label for="s-ar">リトライ</label><p>「わからない」にしたカードを、5枚後にもう一度出します。</p></div>${sel('s-ar',ui.ar!==false?1:0,[[1,'ON'],[0,'OFF']])}</div>
    <div class="field"><div><label>記録のリセット</label><p>1級と2級のすべてのカードを未学習に戻し、AIでつくった類題も消します。元には戻せません。</p></div><div class="row"><button class="btn danger" id="reset">リセット</button></div></div>
  </div>
  <p class="hint">問題と解説は確認していますが、誤りが残っている可能性があります。気になる点はカードの「AIに質問」で確かめてください。AIが作成した類題や回答にも誤りが含まれることがあります。</p>`;
  const on=(id,f)=>$(id).onchange=e=>{f(e.target.value);saveLocal()};
  on('#s-round',v=>ui.round=+v); on('#s-order',v=>{ui.order=v;deck=[];used.clear()}); on('#s-ar',v=>{ui.ar=v==='1';if(!ui.ar)againQ=[]}); on('#s-auto',v=>ui.auto=v==='1');
  const r=$('#reset'); r.onclick=()=>{if(r.dataset.c){P={};AIQ={};HIST.length=0;ui.rs={'1':null,'2':null};ui.sp={'1':null,'2':null};resetDeck();save();r.textContent='リセットしました';r.disabled=true}else{r.dataset.c=1;r.textContent='もう一度押すと消去します'}};
}

/* ---------- 模擬試験 ---------- */
let MK=null;
function mockStart(){
  const src=[];
  const portion=(units,cnt)=>{const pool=units.map(u=>BYUNIT[u.id]);const sum=pool.reduce((a,b)=>a+b.length,0);const out=[];
    pool.forEach(p=>out.push(...pick(p,Math.max(1,Math.round(cnt*p.length/sum)))));src.push(...shuffle(out).slice(0,cnt))};
  const g=ui.grade, wr=unitsOf(g).filter(u=>!/듣기/.test(u.name)), li=unitsOf(g).filter(u=>/듣기/.test(u.name));
  portion(li,10); portion(wr,15);
  MK={list:src,i:0,score:0,miss:[],saved:cur,line:ui.grade==='1'?.4:.7};
  show('home'); mockShow();
}
function mockShow(){
  const n=MK.list.length; cur=newCS(MK.list[MK.i]);
  $('#v-home').innerHTML=`<div class="sessrow"><button class="btn sm" id="quit">← 模擬試験をやめる</button><span class="hint num">${MK.i+1} / ${n}</span></div><div class="pbar"><i style="width:${MK.i/n*100}%"></i></div><div id="stage"></div>`;
  $('#quit').onclick=mockExit; drawCard($('#stage'),true); window.scrollTo(0,0);
}
function mockExit(){stopAudio();cur=MK?MK.saved:null;MK=null;show('home')}
function mockResult(){
  const n=MK.list.length,pct=Math.round(MK.score/n*100);
  $('#v-home').innerHTML=`<div class="panel done"><h2>模擬試験の結果</h2><p class="res"><span class="num big">${MK.score}</span> / ${n}（${pct}%）</p>
  <p class="${pct>=MK.line*100?'pass':'fail'}">${pct>=MK.line*100?`${GR[ui.grade].label}の合格ライン（${MK.line*100}%）を超えています`:`${GR[ui.grade].label}の合格ライン（${MK.line*100}%）まで、あと${Math.max(0,Math.ceil(n*MK.line)-MK.score)}問`}</p><div class="setbtns"><button class="btn primary" id="back">Homeに戻る</button></div></div>
  ${MK.miss.length?`<div class="panel"><h2>間違えた問題（「わからない」としてStudyに出ます）</h2><div class="miss">${MK.miss.map(q=>`<div><b>${esc(q.q)}</b>${q.kind==='l'?'音声：'+esc(q.s).replace(/\n/g,' ／ ')+'<br>':''}正解：${esc(q.o[0])}</div>`).join('')}</div></div>`:''}`;
  $('#back').onclick=mockExit; window.scrollTo(0,0);
}

show(ui.view);
})();
