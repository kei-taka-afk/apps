(function(){
'use strict';
const H=window.H, HN=window.HN;
const $=(s,r=document)=>r.querySelector(s);
const app=$('#app');
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const pick=(a,n)=>shuffle(a).slice(0,n);
const DAY=864e5;
const today=()=>Math.floor((Date.now()-new Date().getTimezoneOffset()*60000)/DAY);
const INT=[1,3,7,14,30];

/* ---------- 色の距離 ---------- */
const rgb=h=>{h=h.replace('#','');return[0,2,4].map(i=>parseInt(h.substr(i,2),16))};
const dist=(a,b)=>{const x=rgb(a),y=rgb(b);return Math.hypot(x[0]-y[0],x[1]-y[1],x[2]-y[2])};

/* ---------- トーン・色相環・分光反射率 ---------- */
const TONES=[
 ['p','ペール',1,1.0,'#F4C9CD','明清色'],['ltg','ライトグレイッシュ',1,2.0,'#BBA8AA','中間色'],['g','グレイッシュ',1,3.0,'#7C6266','中間色'],['dkg','ダークグレイッシュ',1,4.0,'#3F2A2C','暗清色'],
 ['lt','ライト',2,1.4,'#F09AA4','明清色'],['sf','ソフト',2,2.2,'#D48C94','中間色'],['d','ダル',2,3.0,'#A3646B','中間色'],['dk','ダーク',2,3.8,'#6B1E28','暗清色'],
 ['b','ブライト',3,1.7,'#EA5A6E','明清色'],['s','ストロング',3,2.5,'#C2253F','中間色'],['dp','ディープ',3,3.3,'#9E1A2F','暗清色'],
 ['v','ビビッド',4,2.5,'#DF0029','純色']];
function toneFig(hide){
  let g='';
  const X=c=>34+(c-1)*72, Y=r=>22+(r-1)*50;
  g+=`<text x="10" y="12" class="fl">明度↑</text><text x="250" y="200" class="fl">彩度→</text>`;
  TONES.forEach(t=>{
    const x=X(t[2])+28,y=Y(t[3])+8;
    if(t[0]===hide) g+=`<circle cx="${x}" cy="${y}" r="20" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="4 3"/><text x="${x}" y="${y+6}" text-anchor="middle" class="fq">？</text>`;
    else g+=`<circle cx="${x}" cy="${y}" r="20" fill="${t[4]}"/><text x="${x}" y="${y+4}" text-anchor="middle" class="ft" fill="${['p','ltg','lt','sf'].includes(t[0])?'#2a1a1c':'#ffffff'}">${t[0]}</text>`;
  });
  return `<svg viewBox="0 0 300 205" width="300" height="205" style="max-width:100%;color:var(--fg)" role="img" aria-label="PCCSトーン図（赤の色相で表示）">${g}</svg>`;
}
function ringFig(mark){
  const cx=110,cy=110,R=96,r=58;let g='';
  for(let n=1;n<=24;n++){
    const a0=((n-8)*15-90-7.5)*Math.PI/180, a1=a0+15*Math.PI/180;
    const p=(rr,a)=>[cx+rr*Math.cos(a),cy+rr*Math.sin(a)];
    const [x0,y0]=p(R,a0),[x1,y1]=p(R,a1),[x2,y2]=p(r,a1),[x3,y3]=p(r,a0);
    g+=`<path d="M${x0} ${y0}A${R} ${R} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${r} ${r} 0 0 0 ${x3} ${y3}Z" fill="${H[n]}" ${n===mark?'stroke="currentColor" stroke-width="3"':''}/>`;
    const am=a0+7.5*Math.PI/180, [lx,ly]=p((R+r)/2,am);
    if(n===mark) g+=`<text x="${lx}" y="${ly+6}" text-anchor="middle" class="fq" fill="#fff">？</text>`;
    else if([2,8,12,18].includes(n)) g+=`<text x="${lx}" y="${ly+4}" text-anchor="middle" class="ft" fill="${n===8?'#222':'#fff'}">${n}</text>`;
  }
  return `<svg viewBox="0 0 220 220" width="210" height="210" style="max-width:100%;color:var(--fg)" role="img" aria-label="PCCS色相環">${g}</svg>`;
}
const SPEC={
 白:w=>.88, 黒:w=>.05, 灰:w=>.40,
 赤:w=>.06+.76/(1+Math.exp(-(w-600)/12)),
 黄:w=>.07+.80/(1+Math.exp(-(w-505)/12)),
 緑:w=>.07+.50*Math.exp(-((w-530)**2)/(2*32*32)),
 青:w=>.06+.58/(1+Math.exp((w-500)/14))};
const SPEC_E={白:'全波長で反射率が高く平らな曲線は白です。',黒:'全波長で反射率が低く平らな曲線は黒です。',灰:'全波長でほぼ同じ中くらいの反射率は灰色です。',赤:'長波長（600nm以上）だけ反射率が高いので赤に見えます。',黄:'中〜長波長（500nm以上）をよく反射し、短波長を吸収するので黄に見えます。',緑:'中波長（500〜560nm付近）に山があるので緑に見えます。',青:'短波長（500nm以下）をよく反射するので青に見えます。'};
function specFig(k){
  const W=280,Hh=150,L=34,B=125,T=10,Rr=270;
  const X=w=>L+(w-380)/(780-380)*(Rr-L), Y=v=>B-v*(B-T);
  let d='';for(let w=380;w<=780;w+=5)d+=(w===380?'M':'L')+X(w).toFixed(1)+' '+Y(SPEC[k](w)).toFixed(1);
  let ax=`<line x1="${L}" y1="${B}" x2="${Rr}" y2="${B}" stroke="currentColor" stroke-width="1"/><line x1="${L}" y1="${T}" x2="${L}" y2="${B}" stroke="currentColor" stroke-width="1"/>`;
  [400,500,600,700].forEach(w=>ax+=`<text x="${X(w)}" y="${B+14}" text-anchor="middle" class="fl">${w}</text>`);
  [0,50,100].forEach(v=>ax+=`<text x="${L-4}" y="${Y(v/100)+4}" text-anchor="end" class="fl">${v}</text>`);
  ax+=`<text x="${Rr}" y="${B+28}" text-anchor="end" class="fl">波長(nm)</text><text x="2" y="${T+4}" class="fl">%</text>`;
  return `<svg viewBox="0 0 ${W} ${Hh+12}" width="${W}" height="${Hh+12}" style="max-width:100%;color:var(--fg)" role="img" aria-label="分光反射率曲線">${ax}<path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2.5"/></svg>`;
}
function lightFig(){return `<svg viewBox="0 0 220 100" width="220" height="100" style="max-width:100%" role="img" aria-label="白と黒の背景に同じ灰色"><rect width="110" height="100" fill="#FFFFFF" stroke="#CCCCCC"/><rect x="110" width="110" height="100" fill="#111111"/><rect x="35" y="30" width="40" height="40" fill="#808080"/><rect x="145" y="30" width="40" height="40" fill="#808080"/></svg>`}
function assimFig(){let a='',b='';for(let i=0;i<22;i++){a+=`<rect x="${i*10}" width="3" height="80" fill="#FFFFFF"/>`;b+=`<rect x="${i*10}" width="3" height="80" fill="#111111"/>`}
  return `<svg viewBox="0 0 220 80" width="105" height="80" role="img" aria-label="白線の入った赤"><rect width="220" height="80" fill="#D7263D"/>${a}</svg><svg viewBox="0 0 220 80" width="105" height="80" role="img" aria-label="黒線の入った赤"><rect width="220" height="80" fill="#D7263D"/>${b}</svg>`}

/* ---------- 色を見分ける問題（自動生成。カードごとに決まった乱数で、毎回同じ色になる） ---------- */
function rng(seed){let h=1779033703^seed.length;for(let i=0;i<seed.length;i++){h=Math.imul(h^seed.charCodeAt(i),3432918353);h=h<<13|h>>>19}
  return function(){h=Math.imul(h^h>>>16,2246822507);h=Math.imul(h^h>>>13,3266489909);h^=h>>>16;return (h>>>0)/4294967296}}
function hsl(h,s,l){h=((h%360)+360)%360;s/=100;l/=100;const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));
  return '#'+[f(0),f(8),f(4)].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('').toUpperCase()}
const mix=(a,b,t)=>{const x=rgb(a),y=rgb(b);return '#'+x.map((v,i)=>Math.round(v*(1-t)+y[i]*t).toString(16).padStart(2,'0')).join('').toUpperCase()};
function lstar(hex){const c=rgb(hex).map(v=>{v/=255;return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4)});const Y=0.2126*c[0]+0.7152*c[1]+0.0722*c[2];return Y>0.008856?116*Math.cbrt(Y)-16:903.3*Y}
// 色の仲間ごとの「黄み寄りの端」と「青み寄りの端」の色相（HSL）
const LEAN=[
 {n:'赤',y:16,b:-14,s:82,l:48,e:'赤は、オレンジ（黄）の方向に寄るほど黄み寄り、ローズや赤紫の方向に寄るほど青み寄りです。'},
 {n:'ピンク',y:10,b:-28,s:78,l:76,e:'ピンクは、コーラルやサーモンの方向が黄み寄り、ローズやラベンダーピンクの方向が青み寄りです。'},
 {n:'緑',y:92,b:162,s:55,l:42,e:'緑は、黄緑の方向が黄み寄り、青緑の方向が青み寄りです。'},
 {n:'青',y:192,b:232,s:72,l:45,e:'青は、緑みの青（ターコイズ寄り）が黄み寄り、紫みの青が青み寄りです。'},
 {n:'黄',y:40,b:58,s:92,l:56,e:'黄は、赤み（山吹色）寄りが黄み寄り、緑みのレモンイエロー寄りが青み寄りです。'},
 {n:'紫',y:300,b:262,s:45,l:50,e:'紫は、赤紫の方向が暖かい黄み寄り、青紫の方向が青み寄りとして扱われます。'},
];
function genLean(uid,g,variant,add){
  LEAN.forEach((F,i)=>['y','b'].forEach(dir=>{
    const id=`${uid}-${variant}${i}${dir}`, r=rng(id), jit=variant==='L2'?0.55:1;
    const steps=[0,1/3,2/3,1].map(t=>t*jit+(1-jit)*0.5*r()); // 応用は差を小さく
    const cols=steps.map(t=>hsl(F.y+(F.b-F.y)*t,F.s,F.l+(r()-0.5)*4));
    const ans=dir==='y'?0:3, order=[ans,...[0,1,2,3].filter(k=>k!==ans)];
    add({id,unit:uid,grade:g,kind:'mc',swo:order.map(k=>cols[k]),q:`最も${dir==='y'?'黄み':'青み'}寄りの${F.n}はどれ？`,o:order.map(k=>cols[k]),e:F.e+'明るさや鮮やかさではなく、色みの方向だけに注目して比べます。'});
  }));
}
function genLight(uid,g,add){
  for(let i=0;i<8;i++){const id=`${uid}-li${i}`,r=rng(id);
    let cols;for(let t=0;t<50;t++){cols=[0,1,2,3].map(()=>hsl(r()*360,40+r()*50,30+r()*45));const L=cols.map(lstar).sort((a,b)=>a-b);if(L[1]-L[0]>9&&L[2]-L[1]>9&&L[3]-L[2]>9)break}
    const hi=i%2===0; const sorted=cols.slice().sort((a,b)=>hi?lstar(b)-lstar(a):lstar(a)-lstar(b));
    add({id,unit:uid,grade:g,kind:'mc',swo:sorted,q:`最も明度が${hi?'高い（明るい）':'低い（暗い）'}色はどれ？`,o:sorted,e:'明度は、色みにかかわらず、白に近いか黒に近いかで判断します。黄や黄緑は鮮やかでも明るく、青や紫は鮮やかでも暗めです。目を細めると、明暗の差が比べやすくなります。'})}
}
function genSat(uid,g,add){
  for(let i=0;i<8;i++){const id=`${uid}-sa${i}`,r=rng(id),h=r()*360,l=42+r()*14;
    const S=[92,66,42,20], cols=S.map(s=>hsl(h,s,l)); const hi=i%2===0; const o=hi?cols:cols.slice().reverse();
    add({id,unit:uid,grade:g,kind:'mc',swo:o,q:`最も彩度が${hi?'高い（鮮やかな）':'低い（くすんだ）'}色はどれ？`,o,e:'彩度は鮮やかさの度合いです。同じくらいの明るさでも、灰みが少なく色みが強いほど彩度が高くなります。'})}
}
function genClear(uid,g,add){
  for(let i=0;i<8;i++){const id=`${uid}-cl${i}`,r=rng(id),h=r()*360,pure=hsl(h,95,50);
    const tint=mix(pure,'#FFFFFF',0.35+r()*0.3), shade=mix(pure,'#000000',0.3+r()*0.3), tint2=mix(pure,'#FFFFFF',0.1+r()*0.15);
    const grayL=Math.round(110+r()*60), gray='#'+grayL.toString(16).padStart(2,'0').repeat(3).toUpperCase(), dull=mix(pure,gray,0.55+r()*0.15);
    const askDull=i%2===0;
    if(askDull){const o=[dull,tint,shade,tint2];
      add({id,unit:uid,grade:g,kind:'mc',swo:o,q:'灰みを含んだ濁色（ソフトな色）はどれ？',o,e:'濁色は、純色に灰色を混ぜた、くすんだやわらかい色です。白だけ・黒だけを混ぜた色は、明るくても暗くても澄んだ清色です。'})}
    else{const dull2=mix(hsl(h+25,95,50),gray,0.6),dull3=mix(hsl(h-25,95,50),'#'+(grayL-40).toString(16).padStart(2,'0').repeat(3),0.6);const o=[tint,dull,dull2,dull3];
      add({id,unit:uid,grade:g,kind:'mc',swo:o,q:'澄んだ清色（クリアな色）はどれ？',o,e:'清色は、純色に白または黒だけを混ぜた澄んだ色です。灰みを含むと濁色になります。'})}
  }
}
function genDiff(uid,g,add){
  const T=[['色相','2色は、明るさと鮮やかさがほぼ同じで、色みの方向（色相）だけが違います。'],['明度','2色は、色みと鮮やかさが近く、明るさ（明度）が大きく違います。'],['彩度','2色は、色みと明るさが近く、鮮やかさ（彩度）が大きく違います。']];
  for(let i=0;i<12;i++){const id=`${uid}-df${i}`,r=rng(id),k=i%3,h=r()*360,s=55+r()*30,l=45+r()*10;
    let a=hsl(h,s,l),b;
    if(k===0){for(let t=0;t<80;t++){const hh=r()*360;a=hsl(hh,s,l);b=hsl(hh+(r()<.5?-1:1)*(40+r()*20),s,l);if(Math.abs(lstar(a)-lstar(b))<5)break}}
    if(k===1){a=hsl(h,s,30+r()*8);b=hsl(h,s,68+r()*8)}
    if(k===2){a=hsl(h,90,l);b=hsl(h,22+r()*8,l)}
    const others=T.filter((_,j)=>j!==k).map(x=>x[0]);
    add({id,unit:uid,grade:g,kind:'mc',sw:[[a,'A'],[b,'B']],q:'AとBの2色で、違いが最も大きい属性は？',o:[T[k][0],...others,'ほとんど違いはない'],e:T[k][1]+'1つの属性だけが違う2色を比べると、その属性が顔の見え方にどう影響するかを確かめられます。'})}
}

/* ---------- 問題の組み立て ---------- */
const GR={3:{label:'モジュール1',short:'M1',units:window.UNITS3},2:{label:'モジュール2',short:'M2',units:window.UNITS2}};
const ALLCOLORS=[...window.UNITS3,...window.UNITS2].flatMap(u=>u.colors||[]);
const QS={}; const BYUNIT={};
function add(q){QS[q.id]=q;(BYUNIT[q.unit]=BYUNIT[q.unit]||[]).push(q)}
for(const g of [3,2]) for(const u of GR[g].units){
  u.grade=g;
  (u.qs||[]).forEach((a,i)=>add(Object.assign({id:u.id+'-'+i,unit:u.id,grade:g,kind:'mc',q:a[0],o:a[1],e:a[2]},a[3]||{})));
  (u.auto||[]).forEach(t=>{
    if(t==='tone') TONES.forEach((T,i)=>{const others=pick(TONES.filter(x=>x!==T),3);
      add({id:u.id+'-t'+i,unit:u.id,grade:g,kind:'mc',q:'PCCSのトーン図（赤の色相で表示）で、「？」の位置にあるトーンは？',o:[T[0]+'（'+T[1]+'）',...others.map(x=>x[0]+'（'+x[1]+'）')],e:`${T[0]}（${T[1]}）は${T[5]}のトーンです。トーン図は縦が明度、横が彩度。右端の純色vから、左上へ白を、左下へ黒を、左へ灰色を混ぜた順に並びます。`,fig:{tone:T[0]}})});
    if(t==='ring') [3,5,10,14,16,20,22,24].forEach(n=>{const others=pick([...Array(24)].map((_,i)=>i+1).filter(x=>x!==n&&Math.abs(x-n)>1),3);
      add({id:u.id+'-r'+n,unit:u.id,grade:g,kind:'mc',q:'PCCSの色相環で、「？」の位置の色相は？（数字は心理四原色の番号）',o:[n+':'+HN[n],...others.map(x=>x+':'+HN[x])],e:`心理四原色（2:R・8:Y・12:G・18:B）を手がかりに数えます。「？」は ${n}:${HN[n]} です。`,fig:{ring:n}})});
    if(t==='lean')genLean(u.id,g,'L',add);
    if(t==='lean2')genLean(u.id,g,'L2',add);
    if(t==='light')genLight(u.id,g,add);
    if(t==='sat')genSat(u.id,g,add);
    if(t==='clear')genClear(u.id,g,add);
    if(t==='diff')genDiff(u.id,g,add);
    if(t==='spec') Object.keys(SPEC).forEach((k,i)=>{const others=pick(Object.keys(SPEC).filter(x=>x!==k),3);
      add({id:u.id+'-s'+i,unit:u.id,grade:g,kind:'mc',q:'この分光反射率曲線を持つ物体は、昼光のもとで何色に見える？',o:[k,...others],e:SPEC_E[k],fig:{spec:k}})});
  });
  (u.colors||[]).forEach((c,i)=>add({id:u.id+'-c'+i,unit:u.id,grade:g,kind:'color',c}));
  if(u.write) ALLCOLORS.forEach((c,i)=>add({id:u.id+'-w'+i,unit:u.id,grade:g,kind:'write',c}));
}

/* ---------- 記録（この端末＋サインイン時はクラウド） ---------- */
const KEY='jpca_pc_v1';
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
const label=q=>q.kind==='mc'?q.q:q.kind==='write'?'色名を書く：'+q.c[0]:'色名：'+q.c[0];
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
<header><div class="brand"><b>パーソナルカラー検定</b><div class="seg" role="group" aria-label="級">${[3,2].map(x=>`<button data-g="${x}" aria-label="${GR[x].label}">${GR[x].short}</button>`).join('')}</div></div>
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
  <div class="panel"><h2>模擬試験</h2><p class="hint">${g===3?'モジュール1の全単元から50問':'モジュール2から40問＋モジュール1から10問の計50問'}（本番の問題数は公表されていないため50問）。選択肢を選んで採点し、合格ラインの目安（70％前後）と比べます。</p><div><button class="btn" id="mock">模擬試験を始める</button></div></div>`;
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
function colorDistractors(c){
  const pool=shuffle(ALLCOLORS.filter(x=>x!==c&&dist(x[1],c[1])>75)), out=[];
  for(const x of pool){if(out.every(y=>dist(y[1],x[1])>60))out.push(x);if(out.length===3)break}
  return out;
}
function figHTML(q){
  if(q.sw)return `<div class="fig">${q.sw.map(s=>`<div class="chip"><span style="background:${s[0]}"></span>${esc(s[1])}</div>`).join('')}</div>`;
  if(q.fig==='light')return `<div class="fig">${lightFig()}</div>`;
  if(q.fig==='assim')return `<div class="fig">${assimFig()}</div>`;
  if(q.fig&&q.fig.tone)return `<div class="fig">${toneFig(q.fig.tone)}</div>`;
  if(q.fig&&q.fig.ring)return `<div class="fig">${ringFig(q.fig.ring)}</div>`;
  if(q.fig&&q.fig.spec)return `<div class="fig">${specFig(q.fig.spec)}</div>`;
  return '';
}
function newCS(q){
  const c={q,id:q.id,revealed:false,chosen:null};
  if(q.kind==='color'){c.all=shuffle([q.c,...colorDistractors(q.c)]);c.mode=Math.random()<.5?'pickSwatch':'pickName';c.correctJ=c.all.indexOf(q.c)}
  if(q.kind==='mc')c.order=shuffle(q.o.map((_,k)=>k));
  return c;
}
function cardParts(c){
  const q=c.q; let body='',opts='',fig='',ans='';
  if(q.kind==='color'){
    if(c.mode==='pickSwatch'){
      body=`「${esc(q.c[0])}」はどの色？`;
      opts=`<div class="opts sw">${c.all.map((x,j)=>`<button class="opt swo" data-j="${j}"><span class="s" style="background:${x[1]}"></span><span class="nmz"></span></button>`).join('')}</div>`;
      ans=`<div class="ans-row"><span class="ans-sw" style="background:${q.c[1]}"></span><div><p class="ja">${esc(q.c[0])}</p><p class="exp">${esc(q.c[2])}。</p></div></div>`;
    }else{
      body='この色の色名は？'; fig=`<div class="fig"><div class="big-sw" style="background:${q.c[1]}"></div></div>`;
      opts=`<div class="opts">${c.all.map((x,j)=>`<button class="opt" data-j="${j}"><span class="k">${'ABCD'[j]}</span><span>${esc(x[0])}</span></button>`).join('')}</div>`;
      ans=`<p class="ja">${'ABCD'[c.correctJ]}　${esc(q.c[0])}</p><p class="exp">${esc(q.c[2])}。</p>`;
    }
  }else if(q.kind==='write'){
    body='この色の慣用色名は？（紙に書いてから答えを見る）'; fig=`<div class="fig"><div class="big-sw" style="background:${q.c[1]}"></div></div>`;
    ans=`<p class="ja">${esc(q.c[0])}</p><p class="exp">${esc(q.c[2])}。</p>`;
  }else{
    body=esc(q.q); fig=figHTML(q);
    opts=q.swo?`<div class="opts sw">${c.order.map((k,j)=>`<button class="opt swo" data-k="${k}" aria-label="${'ABCD'[j]}"><span class="s" style="background:${q.swo[k]}"></span><span class="nmz">${'ABCD'[j]}</span></button>`).join('')}</div>`
      :`<div class="opts">${c.order.map((k,j)=>`<button class="opt" data-k="${k}"><span class="k">${'ABCD'[j]}</span><span>${esc(q.o[k])}</span></button>`).join('')}</div>`;
    ans=q.swo?`<div class="ans-row"><span class="ans-sw" style="background:${q.swo[0]}"></span><p class="ja">${'ABCD'[c.order.indexOf(0)]} の色</p></div><p class="exp">${esc(q.e)}</p>`:`<p class="ja">${'ABCD'[c.order.indexOf(0)]}　${esc(q.o[0])}</p><p class="exp">${esc(q.e)}</p>${q.isAi?'<p class="aiwarn">AIが作成し、AIが確認した問題です。疑問があれば「AIに質問」で確認してください。</p>':''}`;
  }
  if(ui.gloss!==false&&q.kind==='mc'){const gl=glossFor(q.swo?[q.q,q.e]:[q.o[0],q.q,q.e,...q.o.slice(1)]);
    if(gl.length)ans+=`<div class="gloss"><b class="lab">あわせて覚える</b><dl>${gl.map(x=>`<dt>${esc(x[0])}</dt><dd>${esc(x[1])}</dd>`).join('')}</dl></div>`}
  return {body,opts,fig,ans};
}
function drawCard(el,mock){
  const c=cur,q=c.q,u=unitById(q.unit),k=level(q.id);
  const {body,opts,fig,ans}=cardParts(c);
  el.innerHTML=`
  <article class="card">${mock?'':'<button class="askcard" type="button" data-askai>AIに質問</button>'}
    <div class="meta"><span class="num">No.${q.no||''}</span><span class="tag">${esc(u?u.name:'')}</span>${q.isAi?'<span class="tag ai">AI作成</span>':''}${mock?'':`<span class="tag lvchip l${k}">${LV[k]}</span>`}</div>
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
  if(q.kind==='color'){const j=+btn.dataset.j;ok=j===cur.correctJ;cur.chosen=cur.all[j][0]}
  else{const k=+btn.dataset.k;ok=k===0;cur.chosen=q.o[k]}
  btn.classList.add(ok?'ok':'ng');
  reveal(ok,mock);
}
function reveal(ok,mock){
  if(!cur||cur.revealed)return; cur.revealed=true; opened=true;
  const q=cur.q;
  document.querySelectorAll('#stage .opt').forEach(b=>{b.disabled=true;
    if(q.kind==='color'){const jj=+b.dataset.j;if(jj===cur.correctJ)b.classList.add('ok');const nm=b.querySelector('.nmz');if(nm)nm.textContent=cur.all[jj][0]}
    else if(+b.dataset.k===0)b.classList.add('ok')});
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
  if(q.kind==='color')return `問題: ${c.mode==='pickSwatch'?'「'+q.c[0]+'」の色を色見本から選ぶ':'色見本（'+q.c[1]+'）の慣用色名を選ぶ。選択肢: '+(c.all||[]).map(x=>x[0]).join(' / ')}\n正解: ${q.c[0]}（${q.c[2]}）\n受験者の状態: ${st}`;
  if(q.kind==='write')return `問題: 色見本（${q.c[1]}）の慣用色名を書く（記述式の練習）\n正解: ${q.c[0]}（${q.c[2]}）\n受験者の状態: ${st}`;
  return `問題: ${q.q}${q.swo?'（選択肢は色見本。色はカラーコードで示す）':''}${q.sw?'\n図の色見本: '+q.sw.map(x=>(x[1]?x[1]+'=':'')+x[0]).join(' / '):''}\n選択肢: ${q.o.join(' / ')}\n正解: ${q.o[0]}\n解説: ${q.e}\n受験者の状態: ${st}${q.isAi?'\n※この問題はAIが作成したもの。誤りがあれば率直に指摘すること。':''}`;
}
function progressSummary(){const lines=[];
  for(const x of [3,2]){lines.push(`【${GR[x].label}】`);
    for(const u of unitsOf(x)){const k=[0,0,0,0];BYUNIT[u.id].forEach(q=>k[level(q.id)]++);lines.push(`${u.name}: 全${BYUNIT[u.id].length}枚／完了${k[3]}・要復習${k[2]}・わからない${k[1]}・未学習${k[0]}`)}}
  return lines.join('\n')}
function askRules(){
  const head=`あなたは色彩技能パーソナルカラー検定（日本パーソナルカラー協会、モジュール1・2）の講師です。受験者の質問に日本語で答えてください。
- スマホで読むので短く、結論から（長くても10行程度）
- マークダウン記号（#、**、表）は使わず、箇条書きは「・」を使う
- 色の四属性（色相・明度・彩度・清濁）と、それが顔の見え方に与える影響を軸に説明する。協会の公式テキスト独自の表現や基準で確信が持てないことは断定せず、公式テキストで確認するよう伝える
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
  $('#ai-head').innerHTML=(c?`<span>このカードについて：<b>${esc(label(c.q).slice(0,40))}${label(c.q).length>40?'…':''}</b></span>`:`<span>学習の進め方や、パーソナルカラーのことを何でも</span>`)+`<button class="askx" type="button" id="ai-x" aria-label="閉じる">×</button>`;
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
    return `<tr class="w" data-id="${q.id}" aria-expanded="${op}"><td class="num">${esc(q.no)}</td><td class="qt">${q.kind!=='mc'?`<span class="mini" style="background:${q.c[1]}"></span>`:''}${esc(label(q))}</td><td class="st"><span class="lvdot l${k}"></span>${LV[k]}</td></tr>`+(op?detailRow(q):'')}).join('')}</tbody></table></div>
  ${uid!=='all'?`<div class="panel"><h2>AIで類題を追加</h2><p class="hint">この単元の論点からAIが4択問題を5問つくり、別のAIが正誤を確認してから、この単元のカードに追加します。</p><div><button class="btn" id="gen">類題を5問つくる</button></div><p class="hint" id="genMsg" role="status"></p></div>`:'<p class="hint">単元を選ぶと、その単元の類題をAIでつくれます。</p>'}`;
  $('#lUnit').onchange=e=>{ui.unit[g]=e.target.value;resetDeck();renderList()};
  document.querySelectorAll('#stf [data-st]').forEach(b=>b.onclick=()=>{const v=b.dataset.st;listSt=listSt.includes(v)?listSt.filter(x=>x!==v):[...listSt,v];renderList()});
  document.querySelectorAll('tr.w').forEach(r=>r.onclick=()=>{const id=r.dataset.id;OPEN.has(id)?OPEN.delete(id):OPEN.add(id);renderList()});
  document.querySelectorAll('[data-study]').forEach(b=>b.onclick=e=>{e.stopPropagation();const id=b.dataset.study;const q=all.find(x=>x.id===id);ui.unit[g]=q.unit;resetDeck();keepId=id;const rs=ui.rs[g];if(!rs||!rs.on)ui.rs[g]={n:((rs&&rs.n)||0)+1,w:[],on:true};show('study')});
  if(uid!=='all')$('#gen').onclick=()=>genQs(unitById(uid));
}
function detailRow(q){
  const c=Object.assign(newCS(q),{revealed:true}); const p=cardParts(c);
  return `<tr class="det"><td colspan="3"><div class="detail"><button class="askcard in" type="button" data-askai="${q.id}">AIに質問</button>
    <p class="qtext sm">${p.body}</p>${p.fig}${q.swo?`<div class="opts sw">${q.swo.map((h,i)=>`<span class="opt swo${i===0?' ok':''}"><span class="s" style="background:${h}"></span></span>`).join('')}</div>`:''}${q.kind==='mc'&&!q.swo?`<ul class="olist">${q.o.map((o,i)=>`<li class="${i===0?'right':''}">${esc(o)}</li>`).join('')}</ul>`:''}
    <div class="answer open">${p.ans}</div><div><button class="btn sm" data-study="${q.id}">このカードから学習する</button></div></div></td></tr>`;
}

/* ---------- AI類題（作成→検証） ---------- */
async function genQs(u){
  const msg=$('#genMsg'), btn=$('#gen');
  const sample=await cap('sample');
  if(!sample){msg.textContent='この画面ではAI機能を使えません。claude.aiでこのページを開くと使えます。';return}
  btn.disabled=true; msg.textContent='AIが問題をつくっています…';
  const existing=pick(BYUNIT[u.id].filter(q=>q.q),15).map(q=>'・'+q.q).join('\n');
  const valid=x=>x&&typeof x.q==='string'&&Array.isArray(x.choices)&&x.choices.length===4&&x.choices.every(c=>typeof c==='string'&&c.trim())&&new Set(x.choices).size===4&&typeof x.explanation==='string';
  try{
    const r1=await sample.json(`あなたは色彩技能パーソナルカラー検定（日本パーソナルカラー協会）の${GR[u.grade].label}の問題作成者です。
単元「${u.name}」の論点（${u.topics}）から、4択問題を5問つくってください。
条件:
- ${GR[u.grade].label}の公式テキストの範囲と難易度に合わせる
- 事実として確実な内容だけを使う。数値・人名・年号は確実なものに限る
- 正解はただ1つに定まり、誤答ははっきり誤りであること
- 解説は3〜4文で、正解の理由、誤答がなぜ違うか、覚え方のポイント
- 次の既存問題とは違う切り口にする
${existing}
JSONだけを出力: {"questions":[{"q":"問題文","choices":["正解","誤答1","誤答2","誤答3"],"explanation":"解説"}]}
choicesの先頭を必ず正解にすること。`,{modelTier:'default'});
    const list=(r1&&r1.questions||[]).filter(valid);
    if(!list.length)throw {code:'empty'};
    msg.textContent='別のAIが正誤を確認しています…';
    const r2=await sample.json(`あなたは色彩技能パーソナルカラー検定の問題の校閲者です。次の4択問題（choicesの先頭が正解とされている）を1問ずつ厳しく確認してください。
確認すること: 正解が本当に正しいか／誤答に正解になりうるものがないか／解説に誤りがないか／${GR[u.grade].label}の範囲として適切か。
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
  const sel=(id,cur,list)=>`<select id="${id}">${list.map(o=>`<option value="${o[0]}"${String(cur)===String(o[0])?' selected':''}>${o[1]}</option>`).join('')}</select>`;
  $('#v-settings').innerHTML=`<div class="panel">
    <div class="field"><div><label for="s-round">1セットの枚数</label><p>Studyで1回に学習するカードの枚数。</p></div>${sel('s-round',ui.round,[[5,5],[10,10],[15,15],[20,20],[25,25]])}</div>
    <div class="field"><div><label for="s-order">順番</label><p>Studyでのカードの順番。</p></div>${sel('s-order',ui.order,[['seq','番号順'],['rand','ランダム']])}</div>
    <div class="field"><div><label for="s-ar">リトライ</label><p>「わからない」にしたカードを、5枚後にもう一度出します。</p></div>${sel('s-ar',ui.ar!==false?1:0,[[1,'ON'],[0,'OFF']])}</div>
    <div class="field"><div><label for="s-gloss">「あわせて覚える」</label><p>答えに出てくる用語の解説を、解説の下に表示します。</p></div>${sel('s-gloss',ui.gloss!==false?1:0,[[1,'表示する'],[0,'表示しない']])}</div>
    <div class="field"><div><label>記録のリセット</label><p>${GR[ui.grade].label}と${GR[ui.grade===3?2:3].label}のすべてのカードを未学習に戻します。元には戻せません。</p></div><div class="row"><button class="btn danger" id="reset">リセット</button></div></div>
  </div>
  <p class="hint">色見本は画面上の目安の色で、画面の設定によって見え方が変わります。本番は紙のカラーチャートで出題されるので、PCCS新配色カード199aや協会の配色カードでも見分ける練習をしてください。AIが作成した類題や回答には誤りが含まれることがあります。</p>`;
  const on=(id,f)=>$(id).onchange=e=>{f(e.target.value);saveLocal()};
  on('#s-round',v=>ui.round=+v); on('#s-order',v=>{ui.order=v;deck=[];used.clear()}); on('#s-ar',v=>{ui.ar=v==='1';if(!ui.ar)againQ=[]}); on('#s-gloss',v=>ui.gloss=v==='1');
  const r=$('#reset'); r.onclick=()=>{if(r.dataset.c){P={};AIQ={};HIST.length=0;ui.rs={3:null,2:null};ui.sp={3:null,2:null};resetDeck();save();r.textContent='リセットしました';r.disabled=true}else{r.dataset.c=1;r.textContent='もう一度押すと消去します'}};
}

/* ---------- 模擬試験 ---------- */
let MK=null;
function mockStart(g){
  const total=50, src=[];
  const portion=(units,cnt)=>{const pool=units.map(u=>BYUNIT[u.id].filter(q=>q.kind!=='write'));const sum=pool.reduce((a,b)=>a+b.length,0);
    pool.forEach(p=>src.push(...pick(p,Math.max(1,Math.round(cnt*p.length/sum)))))};
  if(g===3)portion(unitsOf(3),total); else{portion(unitsOf(2),40);portion(unitsOf(3),10)}
  MK={list:shuffle(src).slice(0,total),i:0,score:0,miss:[],g,saved:cur}; $('#v-study').innerHTML='';
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
  <p class="${pct>=70?'pass':'fail'}">${pct>=70?'合格ラインの目安（70％前後）を超えています':`合格ラインの目安（70％前後）まで、あと${Math.max(0,Math.ceil(n*.7)-MK.score)}問`}</p><div class="setbtns"><button class="btn primary" id="back">Homeに戻る</button></div></div>
  ${MK.miss.length?`<div class="panel"><h2>間違えた問題（「わからない」としてStudyに出ます）</h2><div class="miss">${MK.miss.map(q=>`<div><b>${esc(label(q))}</b>正解：${esc(q.c?q.c[0]:q.swo?'色見本の問題':q.o[0])}</div>`).join('')}</div></div>`:''}`;
  $('#back').onclick=mockExit; window.scrollTo(0,0);
}

show(ui.view);
})();
