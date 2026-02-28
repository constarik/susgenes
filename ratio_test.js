// Test 2:1 ratio: probHi=2/3, probLo=1/3 with various payout combos

const GRID=6,NUM_ENTITIES=8,MAX_TICKS=20;
const ALL_GENOS=[];for(let i=0;i<8;i++)ALL_GENOS.push([(i>>2)&1,(i>>1)&1,i&1]);
const NAMES=['Alpha','Beta','Gamma','Delta','Epsilon','Zeta','Eta','Theta'];
function rng(){return Math.random();}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function entAt(E,x,y){return E.find(e=>e.x===x&&e.y===y);}
function foodAt(F,x,y){return F.findIndex(f=>f.x===x&&f.y===y);}
function adj4(x,y){const r=[];for(const[dx,dy]of[[0,-1],[0,1],[-1,0],[1,0]]){const nx=x+dx,ny=y+dy;if(nx>=0&&nx<GRID&&ny>=0&&ny<GRID)r.push({x:nx,y:ny});}return r;}
function findGrp(E,e){let b=null,bc=0;for(let gx=0;gx<GRID-1;gx++)for(let gy=0;gy<GRID-1;gy++){let c=0;for(let dx=0;dx<2;dx++)for(let dy=0;dy<2;dy++){const o=entAt(E,gx+dx,gy+dy);if(o&&o!==e)c++;}if(c>bc){bc=c;b={x:gx+.5,y:gy+.5};}}return bc>=2?b:null;}
function moveTo(E,e,tx,ty){const dx=tx-e.x,dy=ty-e.y,c=[];if(dx>0)c.push({x:e.x+1,y:e.y});if(dx<0)c.push({x:e.x-1,y:e.y});if(dy>0)c.push({x:e.x,y:e.y+1});if(dy<0)c.push({x:e.x,y:e.y-1});const v=c.filter(p=>p.x>=0&&p.x<GRID&&p.y>=0&&p.y<GRID&&!entAt(E,p.x,p.y));return v.length?v[Math.floor(rng()*v.length)]:null;}
function rndMov(E,e){const a=adj4(e.x,e.y).filter(c=>!entAt(E,c.x,c.y));return a.length?a[Math.floor(rng()*a.length)]:null;}
function spawnF(E,F){let t=0;while(t<30){const x=Math.floor(rng()*GRID),y=Math.floor(rng()*GRID);if(!entAt(E,x,y)&&foodAt(F,x,y)<0){F.push({x,y});return;}t++;}}
function doTick(E,F,t,pH,pL){
  for(const e of E){e.px=e.x;e.py=e.y;}
  if(!F.length)spawnF(E,F);if(t%3===0)spawnF(E,F);
  for(const e of shuffle([...E])){
    const pA=e.g[0]?pH:pL,pHd=e.g[1]?pH:pL,pG=e.g[2]?pH:pL;
    let acted=0;const acts=[
      ()=>{const nb=adj4(e.x,e.y).map(c=>entAt(E,c.x,c.y)).filter(Boolean);if(!nb.length)return 0;e.ch[0]++;if(rng()<pA){const t=nb[Math.floor(rng()*nb.length)];const ox=e.x,oy=e.y;e.x=t.x;e.y=t.y;t.x=ox;t.y=oy;e.ob[0]++;return 1;}return 0;},
      ()=>{const g=findGrp(E,e);if(!g)return 0;e.ch[1]++;if(rng()<pHd){const m=moveTo(E,e,Math.round(g.x),Math.round(g.y));if(m){e.x=m.x;e.y=m.y;e.ob[1]++;return 1;}}return 0;},
      ()=>{const nf=F.length?F.reduce((b,f)=>{const d=Math.abs(e.x-f.x)+Math.abs(e.y-f.y);return d<b.d?{f,d}:b},{d:999,f:null}).f:null;if(!nf)return 0;e.ch[2]++;if(rng()<pG){const m=moveTo(E,e,nf.x,nf.y);if(m){e.x=m.x;e.y=m.y;e.ob[2]++;return 1;}}return 0;}
    ];const order=[0,1,2];shuffle(order);
    for(const i of order){if(acts[i]()){acted=1;break;}}
    if(!acted){const m=rndMov(E,e);if(m){e.x=m.x;e.y=m.y;}}
    const fi=foodAt(F,e.x,e.y);if(fi>=0)F.splice(fi,1);
  }
}
function hGuess(ent){
  const[oA,oH,oG]=ent.ob;const tot=oA+oH+oG;const g=[0,0,0];
  if(tot<2){g[0]=rng()<.35?1:0;}else{const f=oA/tot;g[0]=f>.35?1:f<.15?0:rng()<.45?1:0;}
  if(tot<2){g[1]=rng()<.5?1:0;}else{const f=oH/tot;g[1]=f>.35?1:f<.15?0:rng()<.45?1:0;}
  if(tot<2){g[2]=rng()<.4?1:0;}else{const f=oG/tot;g[2]=f>.35?1:f<.15?0:rng()<.45?1:0;}
  return g;
}
function hPick(E){const s=[...E].sort((a,b)=>(b.ob[0]+b.ob[1]+b.ob[2])-(a.ob[0]+a.ob[1]+a.ob[2]));const r=rng();return s.slice(0,r<.15?1:r<.7?2:3);}
function hWatch(){return 6+Math.floor(rng()*7);}

// 2:1 ratio = probHi=2/3, probLo=1/3
const PH=2/3, PL=1/3, N=20000;

function sim(cfg) {
  const {startMult,decay,partial,fee,label}=cfg;
  let totBet=0,totPay=0,bn=0,w3=0,w2=0;
  for(let r=0;r<N;r++){
    const genos=shuffle([...ALL_GENOS]);const E=[];
    for(let i=0;i<NUM_ENTITIES;i++){let x=Math.floor(rng()*GRID),y=Math.floor(rng()*GRID),t=0;
      while(entAt(E,x,y)&&t<50){x=Math.floor(rng()*GRID);y=Math.floor(rng()*GRID);t++;}
      E.push({id:i,x,y,px:x,py:y,g:genos[i],name:NAMES[i],ob:[0,0,0],ch:[0,0,0]});}
    const F=[];const wt=hWatch();
    for(let t=1;t<=wt;t++)doTick(E,F,t,PH,PL);
    const mult=Math.max(1.25,startMult-wt*decay);
    const tgts=hPick(E);const bets=[];
    for(const ent of tgts){bets.push({ent,guess:hGuess(ent),amt:10,mult});totBet+=10;bn++;}
    for(let t=wt+1;t<=MAX_TICKS;t++)doTick(E,F,t,PH,PL);
    const fpb=bets.length>0?fee/bets.length:0;
    for(const b of bets){
      const cor=b.ent.g.reduce((s,v,i)=>s+(v===b.guess[i]?1:0),0);
      let pay=0;if(cor===3){pay=Math.round(b.amt*b.mult);w3++;}
      else if(cor===2){pay=Math.round(b.amt*partial);w2++;}
      totPay+=Math.max(0,pay-fpb);
    }
  }
  const rtp=(100*totPay/totBet).toFixed(1);
  return{label,rtp,edge:(100-parseFloat(rtp)).toFixed(1),w3:(100*w3/bn).toFixed(1),w2:(100*w2/bn).toFixed(1)};
}

const cfgs=[
  {label:'2:1 baseline (×6, partial 30%)',    startMult:6.0,decay:0.25,partial:0.30,fee:0},
  {label:'2:1 + no partial',                  startMult:6.0,decay:0.25,partial:0,   fee:0},
  {label:'2:1 + partial 15%',                 startMult:6.0,decay:0.25,partial:0.15,fee:0},
  {label:'2:1 + partial 20%',                 startMult:6.0,decay:0.25,partial:0.20,fee:0},
  {label:'2:1 + ×5 start',                    startMult:5.0,decay:0.25,partial:0.30,fee:0},
  {label:'2:1 + ×5 + partial 20%',            startMult:5.0,decay:0.25,partial:0.20,fee:0},
  {label:'2:1 + ×5 + no partial',             startMult:5.0,decay:0.25,partial:0,   fee:0},
  {label:'2:1 + decay 0.30',                  startMult:6.0,decay:0.30,partial:0.30,fee:0},
  {label:'2:1 + decay 0.35',                  startMult:6.0,decay:0.35,partial:0.30,fee:0},
  {label:'2:1 + decay 0.30 + partial 20%',    startMult:6.0,decay:0.30,partial:0.20,fee:0},
  {label:'2:1 + ×5 + decay 0.30 + part 20%',  startMult:5.0,decay:0.30,partial:0.20,fee:0},
];

console.log('\n══════════════════════════════════════════════════════════════════');
console.log('  PROB RATIO 2:1 (Hi=66.7%, Lo=33.3%) — '+N+' rounds');
console.log('══════════════════════════════════════════════════════════════════');
console.log(`${'Config'.padEnd(42)}| RTP    | Edge   | 3/3%  | 2/3%`);
console.log('-'.repeat(42)+'|--------|--------|-------|------');
for(const c of cfgs){
  const r=sim(c);
  const mark=parseFloat(r.edge)>=5&&parseFloat(r.edge)<=12?' ★':parseFloat(r.edge)>=3&&parseFloat(r.edge)<=15?' •':'';
  console.log(`${r.label.padEnd(42)}| ${r.rtp.padStart(5)}% | ${r.edge.padStart(5)}% | ${r.w3.padStart(5)}%| ${r.w2}%${mark}`);
}
console.log('══════════════════════════════════════════════════════════════════\n');
