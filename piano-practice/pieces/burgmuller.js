// ブルグミュラー 25の練習曲 Op.100 — 曲の登録（楽譜ページと小節位置）。解説は曲ごとに burgNN-notes.js で追加
window.PIANO_PIECES = window.PIANO_PIECES || [];
(function(){
  const L=[
    // id, 番号, 題名, 速度表示, 拍子(拍/小節), テンポ単位, 既定テンポ, perBeat
    ["burg01", 1,"すなおな心（La candeur）","Allegro moderato・ハ長調・4/4",4,"4分音符",152,1],
    ["burg02", 2,"アラベスク（Arabesque）","Allegro scherzando・イ短調・2/4",2,"4分音符",152,1],
    ["burg03", 3,"牧歌（Pastorale）","Andantino・ト長調・6/8",2,"付点4分音符",66,1],
    ["burg04", 4,"子供の集会（Petite réunion）","Allegro non troppo・ハ長調・4/4",4,"4分音符",152,1],
    ["burg05", 5,"無邪気（L'innocence）","Moderato・ヘ長調・3/4",3,"4分音符",108,1],
    ["burg06", 6,"進歩（Progrès）","Allegro・ハ長調・4/4",4,"4分音符",132,1],
    ["burg07", 7,"清い流れ（Le courant limpide）","Allegro・ト長調・4/4",4,"4分音符",120,1],
    ["burg08", 8,"優美（La gracieuse）","Moderato・ヘ長調・3/4",3,"4分音符",100,1],
    ["burg09", 9,"狩り（La chasse）","Allegro vivace・ハ長調・6/8",2,"付点4分音符",132,1],
    ["burg10",10,"やさしい花（Tendre fleur）","Moderato・ニ長調・4/4",4,"4分音符",120,1],
    ["burg11",11,"せきれい（La bergeronnette）","Allegro・ハ長調・2/4",2,"4分音符",112,1],
    ["burg12",12,"別れ（L'adieu）","Allegro molto agitato・イ短調・4/4",4,"4分音符",184,1],
    ["burg13",13,"なぐさめ（Consolation）","Allegro moderato・ハ長調・4/4",4,"4分音符",104,1],
    ["burg14",14,"スティリエンヌ（La styrienne）","Mouvement de valse・ト長調・3/4",3,"4分音符",132,1],
    ["burg15",15,"バラード（Ballade）","Allegro con brio・ハ短調・3/8",3,"付点4分音符",72,1/3],
    ["burg16",16,"小さな嘆き（Douce plainte）","Allegro moderato・ト短調・4/4",4,"4分音符",126,1],
    ["burg17",17,"おしゃべり（La babillarde）","Allegretto・ヘ長調・3/8",3,"付点4分音符",72,1/3],
    ["burg18",18,"心配（Inquiétude）","Allegro agitato・ホ短調・2/4",2,"4分音符",138,1],
    ["burg19",19,"アヴェ・マリア（Ave Maria）","Andantino・イ長調・3/4",3,"4分音符",100,1],
    ["burg20",20,"タランテラ（Tarentelle）","Allegro vivo・ニ短調・6/8",2,"付点4分音符",160,1],
    ["burg21",21,"天使の声（L'harmonie des anges）","Allegro moderato・ト長調・4/4",4,"4分音符",152,1],
    ["burg22",22,"舟歌（Barcarolle）","Andantino quasi Allegretto・変イ長調・6/8",2,"付点4分音符",72,1],
    ["burg23",23,"帰途（Le retour）","Molto agitato quasi Presto・変ホ長調・6/8",2,"付点4分音符",126,1],
    ["burg24",24,"つばめ（L'hirondelle）","Allegro non troppo・ト長調・4/4",4,"4分音符",138,1],
    ["burg25",25,"貴婦人の乗馬（La chevaleresque）","Allegro marziale・ハ長調・4/4",4,"4分音符",138,1],
  ];
  for(const [id,no,title,meta,bpb,unit,def,perBeat] of L){
    const pages=(window.PIANO_PAGES||{})[id]; if(!pages) continue;
    window.PIANO_PIECES.push({
      id, no, group:"ブルグミュラー 25の練習曲",
      title:`${no}. ${title}`, composer:"ブルグミュラー", meta, beatsPerBar:bpb,
      tempo:{min:40,max:200,def,score:def,unit,perBeat},
      source:"楽譜：無料公開の楽譜PDFから。版によって指番号や強弱が少し違うことがあります。",
      pages, onsets:(window.PIANO_ONSETS||{})[id]||{}, bars:{}
    });
  }
})();
