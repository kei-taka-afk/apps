/* 4つの学習モード（英単語・熟語・英文法・例文）のデータを1つにま止める */
(function(){
const U=window.UNITS={}; const add=(s,u)=>(U[s]=U[s]||[]).push(u);
const POS={'形容詞①':'形容詞','形容詞②':'形容詞','色':'名詞・形容詞','副詞':'副詞','代名詞など':'代名詞','前置詞':'前置詞','数':'数'};
function deck(src,kind){const c={};for(const [s,name,list] of src){c[s]=(c[s]||0)+1;
  add(s,{id:s+'-'+c[s],num:String(c[s]).padStart(2,'0'),name,pos:kind==='w'?(s==='n'?'名詞':s==='v'?'動詞':POS[name]||''):'',qs:list.split(';').map(x=>{const i=x.indexOf('|');return {t:'w',q:x.slice(0,i),ja:x.slice(i+1)}})})}}
deck(window.WORDS,'w'); deck(window.IDIOMS,'i');
const ex={};for(const [g,en,ja] of window.SENT)(ex[g]=ex[g]||[]).push([en,ja]);
let n=0,k=0;
for(const [s,ch,names] of window.POINTS){k++;const sq=[];
  for(const name of names){const G=window.GRAMMAR[n];n++;
    const mk=(q,o,ja)=>({t:'mc',q,o,ja,e:'形：'+G[0].replace(/\*/g,'')});
    add('g'+s,{id:'g'+s+'-'+n,num:String(n).padStart(2,'0'),name,chapter:ch,pat:G[0],note:[G[1],G[2]],ex:ex[n]||[],qs:[mk(G[3],G[4],G[5]),mk(G[6],G[7],G[8])]});
    for(const [en,ja] of (ex[n]||[])){const m=en.match(/^(.*?)([.?!])$/);sq.push({t:'o',q:en,ja,ch:m[1].split(' '),end:m[2],tag:name,e:'文法'+n+'：'+name})}}
  add('s'+s,{id:'s'+s+'-'+k,num:String(k).padStart(2,'0'),name:ch,qs:sq})}
const S=window.SECTIONS, sec=(p)=>({[p+'a']:S.a,[p+'b']:S.b,[p+'c']:S.c});
window.CFG={key:'chugaku_eigo_v1',brand:'English Beginner',
 sections:Object.assign({
  n:{label:'名詞',long:'人、食べ物、学校、町、時間など、物の名前を表す語。'},v:{label:'動詞',long:'go、eat、like など、動作や気持ちを表す語。'},a:{label:'その他',long:'形容詞、副詞、代名詞、前置詞、疑問詞、数など。'},
  p:{label:'動詞の表現',long:'look at、get up、take a picture など、動詞を中心にした熟語。'},q:{label:'be・前置詞の表現',long:'be good at、a lot of、at first など、be動詞や前置詞を使う熟語。'},r:{label:'会話表現',long:'挨拶、相づち、店や電話でのやり取り、誘い方・頼み方。'}},sec('g'),sec('s')),
 modes:[
  {id:'w',label:'英単語',secs:['n','v','a'],unitWord:'語',unitLabel:'グループ',listTitle:'グループ',colTitle:'英単語',notes:false,
   tip:'英語を見て意味を思い出してから、答えを見ます。スピーカーのボタンで発音も確認しましょう。',
   about:'中学英語からやり直す大人のための基本英単語500語です。名詞・動詞・その他に分け、意味の近い語をグループにまとめています。'},
  {id:'i',label:'熟語',secs:['p','q','r'],unitWord:'表現',unitLabel:'グループ',listTitle:'グループ',colTitle:'熟語',notes:false,
   tip:'英語を見て意味を思い出してから、答えを見ます。〜 や A・B には、色々な語が入ります。',
   about:'中学〜高校初級レベルの基本熟語・会話表現500です。動詞の表現、be動詞・前置詞の表現、会話表現に分けています。'},
  {id:'g',label:'英文法',secs:['ga','gb','gc'],unitWord:'問',unitLabel:'文法',listTitle:'文法のリスト',colTitle:'問題',notes:true,
   tip:'（　）に入る語句を3つの中から選びます。迷ったら「解説」を読んでから解きましょう。',
   about:'中学英語の基礎文法100項目です。1項目ごとに、形・短い解説・例文と、確認問題が2問あります。'},
  {id:'s',label:'例文',secs:['sa','sb','sc'],unitWord:'文',unitLabel:'文法のまとまり',listTitle:'文法のまとまり',colTitle:'例文',notes:false,
   tip:'日本語を見て、語句をタップして英文を組み立てます。できたら音声を聞いて、声に出してみましょう。',
   about:'英文法100項目に対応した例文150です。日本語を見て英文を組み立てる練習で、語順を身につけます。'}]};
})();
