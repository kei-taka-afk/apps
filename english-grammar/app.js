(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const app=$('#app');
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const pick=(a,n)=>shuffle(a).slice(0,n);

/* ---------- sections, units, questions ---------- */
const GS=['v','n','l'];
const GR={v:{label:'Verbs',long:'Verbs: tenses, modals, conditionals, passive, reported speech, -ing and to',units:window.UNITS.v},
          n:{label:'Nouns',long:'Nouns and articles, pronouns and determiners, relative clauses, adjectives and adverbs',units:window.UNITS.n},
          l:{label:'Links',long:'Linking words, prepositions, phrasal verbs, word order',units:window.UNITS.l}};
const KIND={mc:'Choose',t:'Type',o:'Order',e:'Find the mistake'};
const NONE='—';
const optLabel=o=>o===NONE?'— (no word)':o;
const tidy=s=>s.replace(/\s+/g,' ').replace(/ ([,.?!])/g,'$1').trim();
const cap=s=>s?s[0].toUpperCase()+s.slice(1):s;
const full=q=>cap(q.ch.join(' '))+q.end;
const corr=q=>q.kind==='e'?q.w:0;
const stem=q=>q.q.replace(/\s*\[[^\]]*\]\s*$/,'');
const filled=(q,a,b)=>tidy(stem(q).replace('( )',a===NONE?'':(b?'\u0001'+a+'\u0002':a)));
const fixed=(q,b)=>{let s='',i=0;q.raw.replace(/\[([^\]]+)\]|([^\[]+)/g,(m,x,t)=>{if(x!==undefined){s+=(i===q.w?(q.fix?(b?'\u0001'+q.fix+'\u0002':q.fix):''):x);i++}else s+=t;return m});return cap(tidy(s))};
const mark=s=>esc(s).replace('\u0001','<b>').replace('\u0002','</b>');
const norm=s=>String(s||'').toLowerCase().replace(/[‘’`]/g,"'").replace(/[.?!]+$/,'').replace(/\s+/g,' ').trim();
const ansText=q=>q.kind==='o'?full(q):q.kind==='e'?q.p[q.w]+' → '+(q.fix||'(remove it)'):q.kind==='t'?q.a[0]:q.o[0];
const QS={}, BYUNIT={};
for(const g of GS) for(const u of GR[g].units){
  u.grade=g; BYUNIT[u.id]=[]; u.topics=u.note.join(' ').replace(/[*>]/g,'');
  u.qs.forEach((x,i)=>{const q=Object.assign({id:u.id+'-'+i,unit:u.id,grade:g,kind:x.t},x);QS[q.id]=q;BYUNIT[u.id].push(q)});
}

/* ---------- progress (this device, plus your account when signed in) ---------- */
const KEY='eng_grammar_en_v1';
const blankG=v=>{const o={};GS.forEach(g=>o[g]=typeof v==='function'?v():v);return o};
let P={}, AIQ={}, ui={grade:'v',unit:blankG('all')}, cloud=false;
try{const o=JSON.parse(localStorage.getItem(KEY)||'{}');P=o.p||{};AIQ=o.ai||{};if(o.ui)Object.assign(ui,o.ui)}catch(e){}
if(!GS.includes(ui.grade))ui.grade='v';
let dbDoc=null, saveT=null;
function saveLocal(){try{localStorage.setItem(KEY,JSON.stringify({p:P,ai:AIQ,ui}))}catch(e){}}
function save(){saveLocal();clearTimeout(saveT);saveT=setTimeout(flush,1500)}
function flush(){clearTimeout(saveT);if(!dbDoc)return;dbDoc.set({p:JSON.stringify(P),ai:JSON.stringify(AIQ),t:Date.now()}).catch(()=>{})}
document.addEventListener('visibilitychange',()=>{if(document.hidden)flush()});
async function capab(name){try{if(!window.claude||!window.claude.use)return null;return await window.claude.use(name)}catch(e){return null}}
(async()=>{
  const db=await capab('db'), user=await capab('user'); if(!db||!user)return;
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

/* ---------- shared ---------- */
const unitsOf=g=>GR[g].units;
const unitById=id=>GS.flatMap(unitsOf).find(u=>u.id===id);
const LV=['New','Again','Review','Done'];
const level=id=>{const p=P[id];return p&&p.g?p.g:0};
const ORDER=blankG(()=>[]);
for(const g of GS)unitsOf(g).forEach(u=>BYUNIT[u.id].forEach(q=>{ORDER[g].push(q);q.no=String(ORDER[g].length).padStart(3,'0')}));
const aiCards=uid=>(AIQ[uid]||[]).map((a,i)=>Object.assign({},a,{unit:uid,grade:unitById(uid).grade,kind:'mc',isAi:true,no:'AI'+(i+1)}));
const scopeCards=g=>{const u=ui.unit[g]||'all';return u==='all'?[...ORDER[g],...unitsOf(g).flatMap(x=>aiCards(x.id))]:[...(BYUNIT[u]||[]),...aiCards(u)]};
const uno=u=>u.id.split('-')[1].padStart(2,'0');
ui=Object.assign({view:'home',sf:blankG(()=>['0','1','2']),order:'seq',round:10,ar:true,rs:blankG(null),sp:blankG(null),nu:blankG(null)},ui);
for(const g of GS){if(!ui.sf[g])ui.sf[g]=['0','1','2'];if(!(g in ui.rs))ui.rs[g]=null;if(!(g in ui.sp))ui.sp[g]=null;if(!ui.nu)ui.nu={};if(!ui.unit[g]||(ui.unit[g]!=='all'&&!BYUNIT[ui.unit[g]]))ui.unit[g]='all'}
const MAINV=['home','notes','study','list','settings'];
if(!MAINV.includes(ui.view))ui.view='home';
const sfList=()=>{const f=(ui.sf[ui.grade]||[]).filter(x=>['0','1','2','3'].includes(x));return f.length?f:['0','1','2']};

/* ---------- frame ---------- */
const VIEWS=[['home','Home'],['notes','Units'],['study','Practice'],['list','Cards'],['settings','Settings']];
app.innerHTML=`
<header><div class="brand"><b>English Grammar</b><div class="seg" role="group" aria-label="Section">${GS.map(x=>`<button data-g="${x}">${GR[x].label}</button>`).join('')}</div></div>
  <div class="hrow"><nav aria-label="Screens">${VIEWS.map(v=>`<button data-view="${v[0]}">${v[1]}</button>`).join('')}</nav><button class="askhd" id="askhd" type="button">Ask AI</button></div></header>
<div class="sync" id="sync">Your progress is saved on this device</div>
${MAINV.map(v=>`<section id="v-${v}" hidden></section>`).join('')}
<section id="v-ai" hidden><div class="askp aiview"><div class="askhead" id="ai-head"></div><div class="asklog" id="ai-log"></div>
  <form class="askin" id="ai-form"><input type="text" id="ai-in" placeholder="Type your question" aria-label="Question" autocomplete="off"><button type="submit" id="ai-send">Send</button></form></div></section>`;
let view='home';
function show(v){
  if(view==='ai'&&v!=='ai'&&askCtl){askCtl.abort();askCtl=null}
  if(v!=='study'&&view==='study'&&cur)keepId=cur.id;
  view=v; if(v!=='ai'){ui.view=v;saveLocal()}
  document.querySelectorAll('header [data-view]').forEach(b=>b.toggleAttribute('aria-current',b.dataset.view===v));
  $('#askhd').toggleAttribute('aria-current',v==='ai');
  [...MAINV,'ai'].forEach(x=>$('#v-'+x).hidden=x!==v);
  document.querySelectorAll('.seg button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.g===ui.grade)));
  if(v==='home')renderHome(); if(v==='notes')renderNotes(); if(v==='study')renderStudy(); if(v==='list')renderList(); if(v==='settings')renderSettings();
  window.scrollTo(0,0);
}
function refresh(){ $('#sync').textContent=cloud?'Your progress is saved to your account':'Your progress is saved on this device'; if(MK)return; if(view==='study'&&cur)keepId=cur.id; if(view!=='ai')show(view) }
document.querySelectorAll('header [data-view]').forEach(b=>b.onclick=()=>{if(MK)MK=null;show(b.dataset.view)});
document.querySelectorAll('.seg button').forEach(b=>b.onclick=()=>{ui.grade=b.dataset.g;MK=null;cur=null;keepId=null;againQ=[];deck=[];used.clear();HIST.length=0;saveLocal();show(view==='ai'?'home':view)});
$('#askhd').onclick=()=>openAI(null);

/* ---------- Home ---------- */
function renderHome(){
  const g=ui.grade, all=ORDER[g], k=[0,0,0,0]; all.forEach(q=>k[level(q.id)]++);
  const total=GS.reduce((a,x)=>a+ORDER[x].length,0), nunits=GS.reduce((a,x)=>a+unitsOf(x).length,0);
  $('#v-home').innerHTML=`
  <div class="today"><div><small>To do</small><strong>${all.length-k[3]}</strong></div><div><small>Done</small><strong style="color:var(--good)">${k[3]}</strong></div></div>
  <div class="start"><button class="btn primary" id="go">Practice</button><span class="hint">${GR[g].label}: ${unitsOf(g).length} units, ${all.length} exercises</span></div>
  <div class="panel lvp"><h2>REVIEW BY LEVEL</h2>
    ${[1,2,3].map(n=>`<div class="lvrow"><span class="lvdot l${n}"></span><b>${LV[n]}</b><strong>${k[n]}</strong><button class="btn" data-lv="${n}" ${k[n]?'':'disabled'}>Review</button></div>`).join('')}
    <p class="hint">Cards are grouped by the last level you chose. Tap Review to practise only that level.</p></div>
  <div class="panel"><h2>UNITS</h2><p class="hint">${esc(GR[g].long)}. Tap a unit to read its study page, then practise it.</p><div class="ulist">${unitsOf(g).map(u=>{const qs=BYUNIT[u.id],d=qs.filter(q=>level(q.id)===3).length;return `<button class="urow" data-u="${u.id}"><span class="nm"><span class="num">${uno(u)}</span>${esc(u.name)}</span><span class="num ct">${d}/${qs.length}</span><span class="bar"><i style="width:${d/qs.length*100}%"></i></span></button>`}).join('')}</div></div>
  <div class="panel"><h2>TEST</h2><p class="hint">25 exercises from all three sections. Choose, find-the-mistake and typed answers are marked automatically; so is an ordering exercise if you place every word. Aim for 80%.</p><div><button class="btn" id="mock">Start a test</button></div></div>
  <div class="panel"><h2>ABOUT</h2><p class="hint">${nunits} units and ${total} exercises at intermediate level (about B1–B2). Each unit has a short study page with rules and examples, followed by exercises — read first, then practise. Explanations are in English and use British spelling. All examples and exercises were written for this app.</p></div>`;
  $('#go').onclick=()=>show('study');
  document.querySelectorAll('[data-lv]').forEach(b=>b.onclick=()=>{ui.sf[g]=[b.dataset.lv];resetDeck();show('study')});
  document.querySelectorAll('.urow').forEach(b=>b.onclick=()=>{ui.nu[g]=b.dataset.u;saveLocal();show('notes')});
  $('#mock').onclick=mockStart;
}

/* ---------- Units (study pages) ---------- */
const rich=s=>esc(s).replace(/\*([^*]+)\*/g,'<b>$1</b>');
function noteHtml(u){return u.note.map(l=>l.startsWith('> ')?`<p class="ex" lang="en">${rich(l.slice(2))}</p>`:`<p class="rule">${rich(l)}</p>`).join('')}
function renderNotes(){
  const g=ui.grade, us=unitsOf(g); let u=us.find(x=>x.id===ui.nu[g])||us[0]; const i=us.indexOf(u);
  const qs=BYUNIT[u.id], d=qs.filter(q=>level(q.id)===3).length;
  $('#v-notes').innerHTML=`
  <div class="progress"><label class="usel"><span>Unit</span><select id="nUnit">${us.map(x=>`<option value="${x.id}"${x===u?' selected':''}>${uno(x)} ${esc(x.name)}</option>`).join('')}</select></label></div>
  <article class="panel note"><div class="meta"><span class="num">${GR[g].label} ${uno(u)}</span><span class="num">${d}/${qs.length} done</span></div>
    <h1 class="ntitle">${esc(u.name)}</h1>${noteHtml(u)}
    <div class="setbtns"><button class="btn primary" id="nGo">Practise this unit</button><button class="btn" data-askunit>Ask AI about this unit</button></div></article>
  <div class="sessrow"><button class="btn sm" id="nPrev" ${i>0?'':'disabled'}>← Previous</button><button class="btn sm" id="nNext" ${i<us.length-1?'':'disabled'}>Next →</button></div>`;
  const go=id=>{ui.nu[g]=id;saveLocal();renderNotes();window.scrollTo(0,0)};
  $('#nUnit').onchange=e=>go(e.target.value);
  $('#nPrev').onclick=()=>go(us[i-1].id); $('#nNext').onclick=()=>go(us[i+1].id);
  $('#nGo').onclick=()=>{ui.unit[g]=u.id;ui.sf[g]=['0','1','2','3'];resetDeck();ui.rs[g]={n:((ui.rs[g]&&ui.rs[g].n)||0)+1,w:[],on:true};show('study')};
  $('[data-askunit]').onclick=()=>openAI(null,u);
}

/* ---------- Practice ---------- */
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
    <label class="usel"><span>Unit</span><select id="selUnit"><option value="all">All units</option>${unitsOf(g).map(u=>`<option value="${u.id}"${uid===u.id?' selected':''}>${uno(u)} ${esc(u.name)}</option>`).join('')}</select></label>
    <div class="stf" id="sf" role="group" aria-label="Levels to include">${[0,1,2,3].map(k=>`<button data-sf="${k}" class="l${k}" aria-pressed="${f.includes(String(k))}">${LV[k]} <span class="num">${cnt[k]}</span></button>`).join('')}</div>
    <div class="sessrow"><span class="hint">${rs&&rs.on?`${Math.min(rs.w.length,ui.round)}/${ui.round}`+(rs.w.length>=ui.round&&againQ.length?` · retry ${againQ.length}`:''):`${n} cards`}</span>
      <button class="btn sm" id="reshuffle" type="button">⇄ Shuffle</button><button class="btn sm" id="againre" type="button" aria-pressed="${ui.ar!==false}">↻ Retry: ${ui.ar!==false?'ON':'OFF'}</button></div>
    <span class="keys">Space: show answer · 1–3 or ← ↓ →: level · ⌫: undo</span>
    <span class="swhint">Swipe the card: ← Again · ↓ Review · Done →</span>
  </div>
  <div id="stage"></div>
  <div class="undorow"><button class="btn" id="undo" ${HIST.length?'':'hidden'}>↶ Undo last rating</button></div>`;
  $('#selUnit').onchange=e=>{ui.unit[g]=e.target.value;resetDeck();renderStudy()};
  document.querySelectorAll('#sf [data-sf]').forEach(b=>b.onclick=()=>{const v=b.dataset.sf;let s=sfList();s=s.includes(v)?s.filter(x=>x!==v):[...s,v];if(!s.length)return;ui.sf[g]=s;if(!opened){cur=null;keepId=null}saveLocal();renderStudy()});
  $('#reshuffle').onclick=()=>{ui.order='rand';deck=[];used.clear();cur=null;keepId=null;lastId=null;saveLocal();flash(0,'⇄ Shuffled');renderStudy()};
  $('#againre').onclick=()=>{ui.ar=ui.ar===false;if(ui.ar===false)againQ=[];saveLocal();renderStudy()};
  $('#undo').onclick=undo;
  bindSwipe();
  renderCard();
}
function setPanel(){
  cur=null; opened=false;
  const g=ui.grade, r=ui.rs[g], done=r&&r.n&&!r.on, pool=scopeCards(g).filter(inPool).length, uid=ui.unit[g];
  let body;
  if(done){const k=[0,0,0,0];for(const id of r.w)k[level(id)]++;
    body=`<p>${r.w.length} cards finished.</p><div class="setsum"><span class="tag lvchip l1">Again ${k[1]}</span><span class="tag lvchip l2">Review ${k[2]}</span><span class="tag lvchip l3">Done ${k[3]}</span></div>
      <div class="setbtns"><button class="btn primary" id="set-go" ${pool?'':'disabled'}>Next ${ui.round} →</button></div>`}
  else body=`<div class="setbtns" style="margin:0"><button class="btn primary" id="set-go" ${pool?'':'disabled'}>▶ Start</button>${uid&&uid!=='all'?'<button class="btn" id="set-note">Read the study page first</button>':''}</div>${pool?`<p class="hint">You practise ${ui.round} cards at a time. Before you look at the answer, try to say why it is right.</p>`:'<p class="hint">No cards at the levels you selected. Choose different levels above.</p>'}`;
  $('#stage').innerHTML=`<div class="panel done">${body}</div>`;
  $('#set-go').onclick=()=>{ui.rs[g]={n:((r&&r.n)||0)+1,w:[],on:true};againQ=[];keepId=null;saveLocal();renderStudy()};
  const sn=$('#set-note'); if(sn)sn.onclick=()=>{ui.nu[g]=uid;saveLocal();show('notes')};
}
function renderCard(){
  const g=ui.grade, rs=ui.rs[g];
  if(!rs||!rs.on)return setPanel();
  if(!keepId&&rs.w.length>=ui.round&&!againQ.length){ui.rs[g]={...rs,on:false};saveLocal();return setPanel()}
  let q=null;
  if(keepId&&cur&&cur.id===keepId){keepId=null;cur=newCS(cur.q);opened=false;drawCard($('#stage'),false);return}
  if(keepId)q=scopeCards(g).find(x=>x.id===keepId)||null; keepId=null;
  if(!q)q=nextStudy();
  if(!q){cur=null;$('#stage').innerHTML=`<div class="panel done"><p>No cards at the levels you selected. Choose different levels above.</p></div>`;return}
  cur=newCS(q); opened=false;
  drawCard($('#stage'),false);
}

/* ---------- cards ---------- */
function newCS(q){
  const c={q,id:q.id,revealed:false,chosen:null};
  if(q.kind==='mc')c.order=shuffle(q.o.map((_,k)=>k));
  else if(q.kind==='o'){c.sel=[];do{c.order=shuffle(q.ch.map((_,k)=>k))}while(q.ch.length>1&&c.order.every((k,i)=>k===i))}
  return c;
}
const qHtml=s=>esc(s).replace('( )','<span class="bl">(　　　)</span>').replace(/\[([^\]]+)\]\s*$/,'<span class="hw">$1</span>');
function cardParts(c){
  const q=c.q; let body,opts='',ans='',hint='';
  if(q.kind==='mc'){
    body=qHtml(q.q);
    opts=`<div class="opts">${c.order.map((k,j)=>`<button class="opt" data-k="${k}"><span class="k">${'ABCD'[j]}</span><span>${esc(optLabel(q.o[k]))}</span></button>`).join('')}</div>`;
    ans=`<p class="ja">${'ABCD'[c.order.indexOf(0)]}　${esc(optLabel(q.o[0]))}</p>${q.q.includes('( )')?`<p class="en">${mark(filled(q,q.o[0],true))}</p>`:''}`;
  }else if(q.kind==='t'){
    body=qHtml(q.q);
    hint='<p class="hint task">Type the missing words, using the word(s) in brackets.</p>';
    opts=`<div class="numin"><input type="text" id="tIn" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Your answer (optional)" aria-label="Your answer"><button class="btn sm" id="tGo" type="button">Check</button></div>`;
    ans=`<p class="ja">${esc(q.a[0])}</p><p class="en">${mark(filled(q,q.a[0],true))}</p>${q.a.length>1?`<p class="tr">Also correct: ${q.a.slice(1).map(esc).join(' · ')}</p>`:''}`;
  }else if(q.kind==='e'){
    let i=0; body=esc(q.raw).replace(/\[([^\]]+)\]/g,(m,x)=>`<span class="ep"><sup>${'ABCD'[i++]}</sup>${x}</span>`);
    hint='<p class="hint task">One of the underlined parts A–D is wrong. Which one?</p>';
    opts=`<div class="opts">${q.p.map((x,k)=>`<button class="opt" data-k="${k}"><span class="k">${'ABCD'[k]}</span><span>${esc(x)}</span></button>`).join('')}</div>`;
    ans=`<p class="ja">${'ABCD'[q.w]}　${esc(q.p[q.w])} → ${q.fix?esc(q.fix):'(remove it)'}</p><p class="en">${mark(fixed(q,true))}</p>`;
  }else{
    body=esc(q.pre);
    hint='<p class="hint task">Tap the words in the right order.</p>';
    opts='<div class="obox"><div class="oline" id="oline"></div><div class="ochips" id="ochips"></div></div>';
    ans=`<p class="ja en1">${esc(full(q))}</p>`;
  }
  ans+=`<p class="exp">${esc(q.e)}</p>${q.isAi?'<p class="aiwarn">Written by AI and checked by AI. If something looks wrong, use Ask AI to check it.</p>':''}`;
  return {body,opts,ans,hint};
}
function drawOrder(){
  const c=cur; if(!c||c.q.kind!=='o')return; const q=c.q,line=$('#oline'),box=$('#ochips'); if(!line||!box)return;
  line.innerHTML=c.sel.length?c.sel.map((k,i)=>`<button type="button" class="chip on" data-i="${i}">${esc(q.ch[k])}</button>`).join(''):'<span class="ph">Your sentence appears here</span>';
  box.innerHTML=c.order.map(k=>`<button type="button" class="chip" data-k="${k}"${c.sel.includes(k)?' disabled':''}>${esc(q.ch[k])}</button>`).join('');
  if(c.revealed){document.querySelectorAll('#stage .chip').forEach(b=>b.disabled=true);return}
  box.querySelectorAll('.chip').forEach(b=>b.onclick=()=>{c.sel.push(+b.dataset.k);drawOrder();if(c.sel.length===q.ch.length)reveal(c.sel.map(k=>q.ch[k]).join(' ')===q.ch.join(' '),!!MK)});
  line.querySelectorAll('.chip').forEach(b=>b.onclick=()=>{c.sel.splice(+b.dataset.i,1);drawOrder()});
}
function drawCard(el,mock){
  const c=cur,q=c.q,u=unitById(q.unit),k=level(q.id);
  const {body,opts,ans,hint}=cardParts(c);
  el.innerHTML=`
  <article class="card">${mock?'':'<button class="askcard" type="button" data-askai>Ask AI</button>'}
    <div class="meta"><span class="num">No.${q.no||''}</span><span class="tag kd k-${q.kind}">${KIND[q.kind]}</span><span class="tag">${esc(u?u.name:'')}</span>${q.isAi?'<span class="tag ai">AI</span>':''}${mock?'':`<span class="tag lvchip l${k}">${LV[k]}</span>`}</div>
    <p class="qtext" lang="en">${body}</p>${hint}${opts}
    <div class="answer${mock?' mock':''}" id="ans">${ans}${mock?'':'<button class="sheet" id="sheet">Show answer<small>tap or Space</small></button>'}</div>
  </article>
  ${mock?'<div id="nextWrap"></div>':`<div class="grades" id="grades">${[1,2,3].map(n=>`<button class="g${n}" data-g="${n}">${LV[n]}<kbd>${n}</kbd></button>`).join('')}</div>`}`;
  el.querySelectorAll('.opt').forEach(b=>b.onclick=()=>choose(b,mock));
  if(q.kind==='o')drawOrder();
  const ti=el.querySelector('#tIn'); if(ti){ti.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();reveal(undefined,mock)}};el.querySelector('#tGo').onclick=()=>reveal(undefined,mock)}
  if(mock){ if(q.kind==='o'){$('#nextWrap').innerHTML='<button class="btn primary wide" id="see">Show answer</button>';$('#see').onclick=()=>reveal(undefined,true)} }
  else{$('#sheet').onclick=()=>reveal();el.querySelectorAll('#grades button').forEach(b=>b.onclick=()=>grade(+b.dataset.g))}
}
function choose(btn,mock){
  if(cur.revealed)return;
  const q=cur.q,k=+btn.dataset.k,ok=k===corr(q); cur.chosen=q.kind==='e'?q.p[k]:q.o[k];
  btn.classList.add(ok?'ok':'ng');
  reveal(ok,mock);
}
function reveal(ok,mock){
  if(!cur||cur.revealed)return; cur.revealed=true; opened=true;
  const q=cur.q, st=$('#stage');
  if(q.kind==='t'){const ti=st.querySelector('#tIn');if(ti){const v=ti.value.trim();if(v){ok=q.a.some(a=>norm(a)===norm(v));cur.chosen=v;ti.classList.add(ok?'ok':'ng')}ti.disabled=true;const b=st.querySelector('#tGo');if(b)b.disabled=true}}
  if(q.kind==='o'){if(cur.sel.length)cur.chosen=cur.sel.map(k=>q.ch[k]).join(' ');drawOrder();const l=$('#oline');if(l&&ok!==undefined)l.classList.add(ok?'ok':'ng')}
  st.querySelectorAll('.opt').forEach(b=>{b.disabled=true;if(+b.dataset.k===corr(q))b.classList.add('ok')});
  const a=$('#ans'); a.classList.add('open');
  if(ok!==undefined)a.insertAdjacentHTML('afterbegin',`<p class="verdict ${ok?'v-ok':'v-ng'}">${ok?'Correct':'Not quite'+(q.kind==='t'&&cur.chosen?' — you wrote: '+esc(cur.chosen):'')}</p>`);
  if(mock){
    const last=MK.i===MK.list.length-1;
    const fin=r=>{if(r)MK.score++;else MK.miss.push(q);setLevel(q.id,r?3:1);if(last)mockResult();else{MK.i++;mockShow()}};
    if(ok!==undefined){$('#nextWrap').innerHTML=`<button class="btn primary wide" id="next">${last?'See your result':'Next'}</button>`;$('#next').onclick=()=>fin(ok);$('#next').focus({preventScroll:true})}
    else{$('#nextWrap').innerHTML=`<div class="selfck"><button class="btn" id="ng">✕ I was wrong</button><button class="btn primary" id="okb">○ I was right</button></div>`;$('#ng').onclick=()=>fin(false);$('#okb').onclick=()=>fin(true)}
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
  flash(g,['','← Again','↓ Review','Done →'][g]); tintCard(card,g,1);
  if(card){card.style.transition='transform .18s ease, opacity .18s ease';card.style.transform=g===1?'translateX(-40%) rotate(-4deg)':g===2?'translateY(30%)':'translateX(40%) rotate(4deg)';card.style.opacity='0'}
  setTimeout(()=>grade(g),170);
}
function bindSwipe(){
  const stage=$('#stage'); let sx=0,sy=0,on=false,card=null,mode='',canDown=false;
  const reset=()=>{tintCard(card,0,0);if(card){card.style.transition='transform .15s ease';card.style.transform='';const c=card;setTimeout(()=>{c.style.transition=''},160)}};
  stage.addEventListener('touchstart',e=>{
    card=e.target.closest('.card'); on=!!card&&!!cur&&e.touches.length===1&&!e.target.closest('input,select,textarea,.askcard,.obox,.numin');
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

/* ---------- Ask AI ---------- */
let askCtl=null, askFor=undefined, askTurns=[], aiBack='home', aiCard=null, aiUnit=null;
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-askai]');if(b){e.preventDefault();e.stopPropagation();openAI(b.dataset.askai||'cur')}},true);
function cardContext(c){
  const q=c.q, st=c.revealed?('has seen the answer'+(c.chosen?' (the learner answered: '+c.chosen+')':'')):'has NOT seen the answer yet — do not give the answer unless asked; give a hint about how to think instead';
  const body=q.kind==='e'?`Find-the-mistake exercise (the [ ] parts are the candidates): ${q.raw}\nAnswer: ${q.p[q.w]} → ${q.fix||'(remove it)'}\nCorrect sentence: ${fixed(q)}`
    :q.kind==='mc'?`Multiple-choice exercise: ${q.q}\nOptions: ${q.o.join(' / ')}\nAnswer: ${q.o[0]}`
    :q.kind==='t'?`Typed gap-fill exercise: ${q.q}\nAccepted answers: ${q.a.join(' / ')}`
    :`Word-order exercise: ${q.pre}\nWords: ${q.ch.slice().sort().join(' / ')}\nAnswer: ${full(q)}`;
  const u=unitById(q.unit);
  return `Unit: ${u?u.name:''}\n${body}\nExplanation shown in the app: ${q.e}\nThe learner ${st}.${q.isAi?'\nNote: this exercise was written by AI. Say so plainly if it contains a mistake.':''}`;
}
function progressSummary(){const lines=[];
  for(const x of GS){lines.push(`[${GR[x].label}]`);
    for(const u of unitsOf(x)){const k=[0,0,0,0];BYUNIT[u.id].forEach(q=>k[level(q.id)]++);if(k[1]+k[2]+k[3])lines.push(`${u.name}: ${BYUNIT[u.id].length} cards — done ${k[3]}, review ${k[2]}, again ${k[1]}, new ${k[0]}`)}}
  return lines.join('\n')}
function askRules(){
  const head=`You are a friendly English grammar teacher. The learner is an adult studying English as a foreign language at intermediate level (B1–B2); their first language is Japanese. Answer in English.
- Use clear, simple English (short sentences, common words) so that the explanation itself is good reading practice. If the learner writes in Japanese or asks for Japanese, you may add a short Japanese gloss.
- Keep it short and start with the answer (about 12 lines at most), because it is read on a phone.
- No markdown symbols (#, **, tables). Use "-" for lists. Put each example sentence on its own line.
- Give two or three natural example sentences, and say what a learner would typically get wrong.
- Where British and American usage differ, say so in one line.
- If you think the exercise's answer or explanation is wrong, say so plainly.
- The question may come from voice input. If a word looks misheard, work out the meaning from context and briefly confirm it first.`;
  if(aiCard)return head+'\n\n[The card the learner is looking at]\n'+cardContext(aiCard);
  if(aiUnit)return head+`\n\n[The study page the learner is reading]\nUnit: ${aiUnit.name}\n${aiUnit.note.join('\n')}`;
  return head+`\n- You may also suggest how to use this app: read a unit's study page under Units, practise it, rate each card Again / Review / Done, use Review by level on Home, take a Test, and add AI exercises under Cards.\n\n[The learner's progress — units not listed are untouched]\n${progressSummary()||'(nothing yet)'}\nCurrent section: ${GR[ui.grade].label}`;
}
function openAI(which,unit){
  if(view==='ai')return;
  aiBack=view;
  const c=unit?null:which==='cur'?cur:(which?(()=>{const q=Object.values(QS).concat(...Object.keys(AIQ).map(aiCards)).find(x=>x.id===which);return q?Object.assign(newCS(q),{revealed:true}):null})():(view==='study'?cur:null));
  const key=unit?'u:'+unit.id:c?c.id:null;
  if(key!==askFor){askFor=key;askTurns=[];$('#ai-log').innerHTML=''}
  aiCard=c; aiUnit=unit||null;
  const lb=c?c.q.q:'';
  $('#ai-head').innerHTML=(c?`<span>About this card: <b>${esc(lb.slice(0,48))}${lb.length>48?'…':''}</b></span>`:unit?`<span>About this unit: <b>${esc(unit.name)}</b></span>`:`<span>Ask anything about English grammar or how to study</span>`)+`<button class="askx" type="button" id="ai-x" aria-label="Close">×</button>`;
  $('#ai-x').onclick=()=>{if(aiBack==='study'&&cur)keepId=cur.id;show(aiBack)};
  if(aiBack==='study'&&cur)keepId=cur.id;
  show('ai'); setTimeout(()=>$('#ai-in').focus({preventScroll:true}),0);
}
async function askAI(qt){
  qt=qt.trim(); if(!qt)return;
  if(askCtl)askCtl.abort();
  const log=$('#ai-log'), sendB=$('#ai-send');
  const sample=await capab('sample');
  if(!sample){log.innerHTML='<p class="aihint">Ask AI is not available in this view. Open this page in claude.ai to use it.</p>';return}
  log.insertAdjacentHTML('beforeend','<div class="msg u"></div><div class="msg a wait">Thinking…</div>');
  log.children[log.children.length-2].textContent=qt;
  const out=log.lastElementChild; out.scrollIntoView({block:'nearest'});
  askTurns.push({role:'user',content:qt});
  const ctl=askCtl=new AbortController(); sendB.textContent='Stop'; sendB.type='button'; sendB.onclick=()=>ctl.abort();
  try{
    const r=await sample([{role:'user',content:askRules()},{role:'assistant',content:'Understood. What would you like to ask?'},...askTurns.slice(-8)],{cache:false,signal:ctl.signal,onText:({text})=>{out.classList.remove('wait');out.textContent=text}});
    out.classList.remove('wait'); out.textContent=r.text; askTurns.push({role:'assistant',content:r.text});
  }catch(e){
    askTurns.pop(); out.classList.remove('wait');
    if(e&&e.code==='cancelled')out.textContent=e.text?e.text+'\n(stopped)':'Stopped';
    else if(e&&['not_granted','sampling_disabled','not_declared','capability_disabled','capability_removed'].includes(e.code))out.textContent='Ask AI has not been allowed for this page.';
    else if(e&&e.code==='rate_limited')out.textContent='Too many questions just now. Please try again in a little while.';
    else out.textContent=(e&&e.text?e.text+'\n':'')+'The answer did not arrive. Please send your question again.';
  }finally{if(askCtl===ctl)askCtl=null;sendB.textContent='Send';sendB.type='submit';sendB.onclick=null}
}
$('#ai-form').onsubmit=e=>{e.preventDefault();const t=$('#ai-in').value;$('#ai-in').value='';askAI(t)};

/* ---------- Cards (list) ---------- */
let listSt=[]; const OPEN=new Set();
function renderList(){
  const g=ui.grade, uid=ui.unit[g]||'all', all=scopeCards(g);
  const cards=all.filter(q=>!listSt.length||listSt.includes(String(level(q.id))));
  $('#v-list').innerHTML=`
  <div class="tools"><label class="usel"><span>Unit</span><select id="lUnit"><option value="all">All units</option>${unitsOf(g).map(u=>`<option value="${u.id}"${uid===u.id?' selected':''}>${uno(u)} ${esc(u.name)}</option>`).join('')}</select></label></div>
  <div class="listbar"><div class="stf" id="stf" role="group" aria-label="Filter by level">${[0,1,2,3].map(k=>`<button data-st="${k}" class="l${k}" aria-pressed="${listSt.includes(String(k))}">${LV[k]}</button>`).join('')}</div><span class="hint">${cards.length} cards</span></div>
  <div class="table"><table class="lt"><colgroup><col class="c1"><col class="c2"><col class="c3"></colgroup><thead><tr><th>No.</th><th>Exercise</th><th>Level</th></tr></thead><tbody>${cards.map(q=>{const k=level(q.id),op=OPEN.has(q.id);
    return `<tr class="w" data-id="${q.id}" aria-expanded="${op}"><td class="num">${esc(q.no)}</td><td class="qt"><span class="kd k-${q.kind}">${KIND[q.kind]}</span>${esc(q.kind==='o'?full(q):q.q)}</td><td class="st"><span class="lvdot l${k}"></span>${LV[k]}</td></tr>`+(op?detailRow(q):'')}).join('')}</tbody></table></div>
  ${uid!=='all'?`<div class="panel"><h2>ADD AI EXERCISES</h2><p class="hint">AI writes five new multiple-choice exercises for this unit, a second AI checks them, and they are added to this unit's cards.</p><div><button class="btn" id="gen">Write five more</button></div><p class="hint" id="genMsg" role="status"></p></div>`:'<p class="hint">Choose a unit to add AI-written exercises for it.</p>'}`;
  $('#lUnit').onchange=e=>{ui.unit[g]=e.target.value;resetDeck();renderList()};
  document.querySelectorAll('#stf [data-st]').forEach(b=>b.onclick=()=>{const v=b.dataset.st;listSt=listSt.includes(v)?listSt.filter(x=>x!==v):[...listSt,v];renderList()});
  document.querySelectorAll('tr.w').forEach(r=>r.onclick=()=>{const id=r.dataset.id;OPEN.has(id)?OPEN.delete(id):OPEN.add(id);renderList()});
  document.querySelectorAll('[data-study]').forEach(b=>b.onclick=e=>{e.stopPropagation();const id=b.dataset.study;const q=all.find(x=>x.id===id);ui.unit[g]=q.unit;ui.sf[g]=['0','1','2','3'];resetDeck();keepId=id;const rs=ui.rs[g];if(!rs||!rs.on)ui.rs[g]={n:((rs&&rs.n)||0)+1,w:[],on:true};show('study')});
  if(uid!=='all')$('#gen').onclick=()=>genQs(unitById(uid));
}
function detailRow(q){
  const c=Object.assign(newCS(q),{revealed:true}); const p=cardParts(c);
  return `<tr class="det"><td colspan="3"><div class="detail"><button class="askcard in" type="button" data-askai="${q.id}">Ask AI</button>
    <p class="qtext sm" lang="en">${p.body}</p>${q.kind==='mc'?`<ul class="olist">${q.o.map((o,i)=>`<li class="${i===0?'right':''}">${esc(optLabel(o))}</li>`).join('')}</ul>`:''}
    <div class="answer open">${p.ans}</div><div><button class="btn sm" data-study="${q.id}">Practise from this card</button></div></div></td></tr>`;
}

/* ---------- AI exercises (write, then check) ---------- */
async function genQs(u){
  const msg=$('#genMsg'), btn=$('#gen');
  const sample=await capab('sample');
  if(!sample){msg.textContent='AI features are not available in this view. Open this page in claude.ai to use them.';return}
  btn.disabled=true; msg.textContent='AI is writing exercises…';
  const existing=BYUNIT[u.id].map(q=>'- '+q.q).join('\n');
  const valid=x=>x&&typeof x.q==='string'&&(x.q.match(/\( \)/g)||[]).length===1&&Array.isArray(x.choices)&&x.choices.length===4&&x.choices.every(c=>typeof c==='string'&&c.trim())&&new Set(x.choices).size===4&&typeof x.explanation==='string';
  try{
    const r1=await sample.json(`You write English grammar exercises for adult learners at intermediate level (B1–B2).
Unit: "${u.name}". The unit's study page says:
${u.note.join('\n')}
Write 5 multiple-choice gap-fill exercises that practise exactly this unit.
Rules:
- Each exercise is one or two natural, original sentences in British English with exactly one gap written as ( ).
- Exactly one option is correct. The three wrong options must be clearly ungrammatical or clearly wrong in this context — not merely less common.
- The explanation is one or two short sentences in simple English that name the rule.
- Use different sentences and situations from these existing exercises:
${existing}
Output JSON only: {"questions":[{"q":"sentence with ( )","choices":["correct","wrong","wrong","wrong"],"explanation":"why"}]}
The correct answer must always be first in choices.`,{modelTier:'default'});
    const list=(r1&&r1.questions||[]).filter(valid);
    if(!list.length)throw {code:'empty'};
    msg.textContent='A second AI is checking them…';
    const r2=await sample.json(`You are a strict editor of English grammar exercises. Check each multiple-choice gap-fill below (the first choice is claimed to be correct).
Check: is the sentence natural and correct with the first choice? Could any other choice also be acceptable in standard British or American English? Is the explanation accurate? Is there exactly one ( )?
- Fix an exercise if you can do so with confidence; otherwise remove it.
- Keep the correct answer first in choices.
Exercises: ${JSON.stringify(list)}
Output JSON only: {"questions":[{"q":"","choices":["","","",""],"explanation":""}],"removed":number removed}`,{modelTier:'complex'});
    const checked=(r2&&r2.questions||[]).filter(valid);
    if(!checked.length)throw {code:'empty'};
    const stamp=Date.now().toString(36);
    AIQ[u.id]=[...(AIQ[u.id]||[]),...checked.map((x,i)=>({id:'ai-'+u.id+'-'+stamp+i,q:x.q,o:x.choices,e:x.explanation}))].slice(-60); save();
    const removed=Math.max(0,list.length-checked.length);
    renderList();
    $('#genMsg').textContent=`Added ${checked.length} exercise${checked.length===1?'':'s'}${removed?` (${removed} removed by the check)`:''}. They are at the end of the list, numbered "AI".`;
  }catch(e){
    btn.disabled=false;
    msg.textContent=e&&e.code==='not_granted'?'AI features were not allowed.':e&&e.code==='rate_limited'?'AI is busy just now. Please try again in a little while.':'The exercises could not be written. Please try again.';
  }
}

/* ---------- Settings ---------- */
function renderSettings(){
  const sel=(id,cv,list)=>`<select id="${id}">${list.map(o=>`<option value="${o[0]}"${String(cv)===String(o[0])?' selected':''}>${o[1]}</option>`).join('')}</select>`;
  $('#v-settings').innerHTML=`<div class="panel">
    <div class="field"><div><label for="s-round">Cards per set</label><p>How many cards you practise at one time.</p></div>${sel('s-round',ui.round,[[5,5],[7,7],[10,10],[15,15],[20,20],[25,25]])}</div>
    <div class="field"><div><label for="s-order">Order</label><p>The order of cards in Practice.</p></div>${sel('s-order',ui.order,[['seq','In order'],['rand','Random']])}</div>
    <div class="field"><div><label for="s-ar">Retry</label><p>A card you rate "Again" comes back five cards later.</p></div>${sel('s-ar',ui.ar!==false?1:0,[[1,'ON'],[0,'OFF']])}</div>
    <div class="field"><div><label>Reset progress</label><p>Sets every card in all three sections back to New and deletes the AI exercises. This cannot be undone.</p></div><div class="row"><button class="btn danger" id="reset">Reset</button></div></div>
  </div>
  <p class="hint">The exercises and explanations have been checked, but mistakes may remain. If something looks wrong, check it with Ask AI on the card. AI-written exercises and answers can also contain mistakes.</p>`;
  const on=(id,f)=>$(id).onchange=e=>{f(e.target.value);saveLocal()};
  on('#s-round',v=>ui.round=+v); on('#s-order',v=>{ui.order=v;deck=[];used.clear()}); on('#s-ar',v=>{ui.ar=v==='1';if(!ui.ar)againQ=[]});
  const r=$('#reset'); r.onclick=()=>{if(r.dataset.c){P={};AIQ={};HIST.length=0;ui.rs=blankG(null);ui.sp=blankG(null);resetDeck();save();r.textContent='Reset done';r.disabled=true}else{r.dataset.c=1;r.textContent='Tap again to erase'}};
}

/* ---------- Test ---------- */
let MK=null;
function mockStart(){
  const src=[];
  const portion=(units,cnt)=>{const pool=units.map(u=>BYUNIT[u.id]);const sum=pool.reduce((a,b)=>a+b.length,0);const out=[];
    pool.forEach(p=>out.push(...pick(p,Math.max(1,Math.round(cnt*p.length/sum)))));
    if(out.length<cnt){const has=new Set(out);out.push(...pick(pool.flat().filter(q=>!has.has(q)),cnt-out.length))}src.push(...shuffle(out).slice(0,cnt))};
  portion(unitsOf('v'),13); portion(unitsOf('n'),7); portion(unitsOf('l'),5);
  MK={list:shuffle(src),i:0,score:0,miss:[],saved:cur};
  show('home'); mockShow();
}
function mockShow(){
  const n=MK.list.length; cur=newCS(MK.list[MK.i]);
  $('#v-home').innerHTML=`<div class="sessrow"><button class="btn sm" id="quit">← Leave the test</button><span class="hint num">${MK.i+1} / ${n}</span></div><div class="pbar"><i style="width:${MK.i/n*100}%"></i></div><div id="stage"></div>`;
  $('#quit').onclick=mockExit; drawCard($('#stage'),true); window.scrollTo(0,0);
}
function mockExit(){cur=MK?MK.saved:null;MK=null;show('home')}
function mockResult(){
  const n=MK.list.length,pct=Math.round(MK.score/n*100);
  $('#v-home').innerHTML=`<div class="panel done"><h2>TEST RESULT</h2><p class="res"><span class="num big">${MK.score}</span> / ${n} (${pct}%)</p>
  <p class="${pct>=80?'pass':'fail'}">${pct>=80?'You reached the 80% target.':`${Math.max(0,Math.ceil(n*.8)-MK.score)} more for the 80% target.`}</p><div class="setbtns"><button class="btn primary" id="back">Back to Home</button></div></div>
  ${MK.miss.length?`<div class="panel"><h2>WHAT YOU MISSED (these are now rated "Again")</h2><div class="miss">${MK.miss.map(q=>`<div><b lang="en">${esc(q.kind==='o'?q.pre:q.q)}</b>Answer: ${esc(ansText(q))}<br><span class="hint">${esc(unitById(q.unit).name)}</span></div>`).join('')}</div></div>`:''}`;
  $('#back').onclick=mockExit; window.scrollTo(0,0);
}

show(ui.view);
})();
