// GAME DESIGN SWEEP: find RTP 88-95% through game mechanics, not ugly rake
// Knobs to turn:
// 1. PROB_HI/PROB_LO gap (0.7/0.3 → 0.6/0.4 = harder to read)
// 2. 2/3 partial payout (30% → 0% or 15%)
// 3. Starting multiplier (6.0 → 4.0)
// 4. Multiplier decay rate (0.25/tick → 0.35/tick)
// 5. Entry fee per round (flat cost)

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

function doTick(E,F,t,probHi,probLo){
  for(const e of E){e.px=e.x;e.py=e.y;}
  if(!F.length)spawnF(E,F);if(t%3===0)spawnF(E,F);
  for(const e of shuffle([...E])){
    const pA=e.g[0]?probHi:probLo,pH=e.g[1]?probHi:probLo,pG=e.g[2]?probHi:probLo;
    let acted=0;const acts=[
      ()=>{const nb=adj4(e.x,e.y).map(c=>entAt(E,c.x,c.y)).filter(Boolean);if(!nb.length)return 0;e.ch[0]++;if(rng()<pA){const t=nb[Math.floor(rng()*nb.length)];const ox=e.x,oy=e.y;e.x=t.x;e.y=t.y;t.x=ox;t.y=oy;e.ob[0]++;return 1;}return 0;},
      ()=>{const g=findGrp(E,e);if(!g)return 0;e.ch[1]++;if(rng()<pH){const m=moveTo(E,e,Math.round(g.x),Math.round(g.y));if(m){e.x=m.x;e.y=m.y;e.ob[1]++;return 1;}}return 0;},
      ()=>{const nf=F.length?F.reduce((b,f)=>{const d=Math.abs(e.x-f.x)+Math.abs(e.y-f.y);return d<b.d?{f,d}:b},{d:999,f:null}).f:null;if(!nf)return 0;e.ch[2]++;if(rng()<pG){const m=moveTo(E,e,nf.x,nf.y);if(m){e.x=m.x;e.y=m.y;e.ob[2]++;return 1;}}return 0;}
    ];const order=[0,1,2];shuffle(order);
    for(const i of order){if(acts[i]()){acted=1;break;}}
    if(!acted){const m=rndMov(E,e);if(m){e.x=m.x;e.y=m.y;}}
    const fi=foodAt(F,e.x,e.y);if(fi>=0)F.splice(fi,1);
  }
}

// Human heuristics (same as before - reads bars by eye)
function hGuess(ent){
  const[oA,oH,oG]=ent.ob;const tot=oA+oH+oG;const g=[0,0,0];
  if(tot<2){g[0]=rng()<.35?1:0;}else{const f=oA/tot;g[0]=f>.35?1:f<.15?0:rng()<.45?1:0;}
  if(tot<2){g[1]=rng()<.5?1:0;}else{const f=oH/tot;g[1]=f>.35?1:f<.15?0:rng()<.45?1:0;}
  if(tot<2){g[2]=rng()<.4?1:0;}else{const f=oG/tot;g[2]=f>.35?1:f<.15?0:rng()<.45?1:0;}
  return g;
}
function hPick(E){const s=[...E].sort((a,b)=>(b.ob[0]+b.ob[1]+b.ob[2])-(a.ob[0]+a.ob[1]+a.ob[2]));const r=rng();return s.slice(0,r<.15?1:r<.7?2:3);}
function hWatch(){return 6+Math.floor(rng()*7);}

// Simulate with game design params
function sim(cfg, N) {
  const {probHi, probLo, startMult, decay, partial, fee} = cfg;
  let totBet=0, totPay=0, bn=0, w3=0, w2=0;
  for (let r=0; r<N; r++) {
    const genos=shuffle([...ALL_GENOS]); const E=[];
    for(let i=0;i<NUM_ENTITIES;i++){let x=Math.floor(rng()*GRID),y=Math.floor(rng()*GRID),t=0;
      while(entAt(E,x,y)&&t<50){x=Math.floor(rng()*GRID);y=Math.floor(rng()*GRID);t++;}
      E.push({id:i,x,y,px:x,py:y,g:genos[i],name:NAMES[i],ob:[0,0,0],ch:[0,0,0]});}
    const F=[]; const wt=hWatch();
    for(let t=1;t<=wt;t++) doTick(E,F,t,probHi,probLo);
    const mult=Math.max(1.25, startMult - wt*decay);
    const tgts=hPick(E);
    const bets=[];
    for(const ent of tgts){
      const amt=10;
      bets.push({ent,guess:hGuess(ent),amt,mult});
      totBet+=amt; bn++;
    }
    for(let t=wt+1;t<=MAX_TICKS;t++) doTick(E,F,t,probHi,probLo);
    // Fee per round (spread across bets)
    const feePerBet = bets.length>0 ? fee/bets.length : 0;
    for(const b of bets){
      const cor=b.ent.g.reduce((s,v,i)=>s+(v===b.guess[i]?1:0),0);
      let pay=0;
      if(cor===3){pay=Math.round(b.amt*b.mult);w3++;}
      else if(cor===2){pay=Math.round(b.amt*partial);w2++;}
      pay = Math.max(0, pay - feePerBet);
      totPay+=pay;
    }
  }
  const rtp=(100*totPay/totBet).toFixed(1);
  return {rtp, edge:(100-parseFloat(rtp)).toFixed(1), w3pct:(100*w3/bn).toFixed(1), w2pct:(100*w2/bn).toFixed(1)};
}

const N=15000;
// Current baseline
const BASE = {probHi:0.7, probLo:0.3, startMult:6.0, decay:0.25, partial:0.3, fee:0};

const configs = [
  {name:'CURRENT (baseline)',         ...BASE},
  // Knob 1: Harder to read (narrower gap)
  {name:'Probs 0.65/0.35',           ...BASE, probHi:0.65, probLo:0.35},
  {name:'Probs 0.60/0.40',           ...BASE, probHi:0.60, probLo:0.40},
  {name:'Probs 0.55/0.45',           ...BASE, probHi:0.55, probLo:0.45},
  // Knob 2: No partial payout
  {name:'No 2/3 partial',            ...BASE, partial:0},
  {name:'2/3 pays 15% (not 30%)',    ...BASE, partial:0.15},
  // Knob 3: Lower start multiplier
  {name:'Start mult ×4.0',           ...BASE, startMult:4.0},
  {name:'Start mult ×3.0',           ...BASE, startMult:3.0},
  // Knob 4: Faster decay
  {name:'Decay 0.35/tick',           ...BASE, decay:0.35},
  {name:'Decay 0.50/tick',           ...BASE, decay:0.50},
  // Knob 5: Entry fee
  {name:'Fee 3⭐/round',             ...BASE, fee:3},
  {name:'Fee 5⭐/round',             ...BASE, fee:5},
  // COMBOS — promising mixes
  {name:'COMBO A: 0.6/0.4 + no partial',         probHi:0.6,probLo:0.4,startMult:6.0,decay:0.25,partial:0,fee:0},
  {name:'COMBO B: 0.65/0.35 + partial 15%',      probHi:0.65,probLo:0.35,startMult:6.0,decay:0.25,partial:0.15,fee:0},
  {name:'COMBO C: 0.6/0.4 + mult ×4',            probHi:0.6,probLo:0.4,startMult:4.0,decay:0.25,partial:0.3,fee:0},
  {name:'COMBO D: 0.65/0.35 + decay 0.35',       probHi:0.65,probLo:0.35,startMult:6.0,decay:0.35,partial:0.3,fee:0},
  {name:'COMBO E: 0.6/0.4 + partial 15% + fee 2',probHi:0.6,probLo:0.4,startMult:6.0,decay:0.25,partial:0.15,fee:2},
  {name:'COMBO F: 0.6/0.4 + ×5 + decay 0.3',    probHi:0.6,probLo:0.4,startMult:5.0,decay:0.30,partial:0.3,fee:0},
];

console.log('\n════════════════════════════════════════════════════════════════════');
console.log('  GAME DESIGN SWEEP: ' + N + ' rounds each, human-sim');
console.log('  Target RTP: 88-95% (house edge 5-12%)');
console.log('════════════════════════════════════════════════════════════════════');
console.log(`${'Config'.padEnd(42)}| RTP    | Edge   | 3/3%  | 2/3%`);
console.log('-'.repeat(42)+'|--------|--------|-------|------');

for (const cfg of configs) {
  const r = sim(cfg, N);
  const rtp = r.rtp.padStart(5);
  const edge = r.edge.padStart(5);
  const mark = parseFloat(r.edge)>=5 && parseFloat(r.edge)<=12 ? ' ★' :
               parseFloat(r.edge)>=3 && parseFloat(r.edge)<=15 ? ' •' : '';
  console.log(`${cfg.name.padEnd(42)}| ${rtp}% | ${edge}% | ${r.w3pct.padStart(5)}%| ${r.w2pct}%${mark}`);
}
console.log('════════════════════════════════════════════════════════════════════');
console.log('★ = ideal (5-12%), • = acceptable (3-15%)');
console.log('════════════════════════════════════════════════════════════════════\n');
