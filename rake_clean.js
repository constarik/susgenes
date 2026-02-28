// CLEAN RAKE ANALYSIS: measures pure bet-level return, no bankroll ruin
// Each round: infinite bankroll, just track bet_amount vs payout

const GRID=6,NUM_ENTITIES=8,MAX_TICKS=20,PROB_HI=0.7,PROB_LO=0.3;
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
function doTick(E,F,t){
  for(const e of E){e.px=e.x;e.py=e.y;}
  if(!F.length)spawnF(E,F);if(t%3===0)spawnF(E,F);
  for(const e of shuffle([...E])){
    const pA=e.g[0]?PROB_HI:PROB_LO,pH=e.g[1]?PROB_HI:PROB_LO,pG=e.g[2]?PROB_HI:PROB_LO;
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
function hGuess(ent){
  const[oA,oH,oG]=ent.ob;const tot=oA+oH+oG;const g=[0,0,0];
  if(tot<2){g[0]=rng()<.35?1:0;}else{const f=oA/tot;g[0]=f>.35?1:f<.15?0:rng()<.45?1:0;}
  if(tot<2){g[1]=rng()<.5?1:0;}else{const f=oH/tot;g[1]=f>.35?1:f<.15?0:rng()<.45?1:0;}
  if(tot<2){g[2]=rng()<.4?1:0;}else{const f=oG/tot;g[2]=f>.35?1:f<.15?0:rng()<.45?1:0;}
  return g;
}
function hPick(E){const s=[...E].sort((a,b)=>(b.ob[0]+b.ob[1]+b.ob[2])-(a.ob[0]+a.ob[1]+a.ob[2]));const r=rng();return s.slice(0,r<.15?1:r<.7?2:3);}
function hWatch(){return 6+Math.floor(rng()*7);}

// Pure bet-level analysis: fixed bet=10, infinite bankroll
function simulate(rake, N) {
  let totBet=0, totPay=0, bn=0, w3=0, w2=0, wLoss=0;
  for (let r=0; r<N; r++) {
    const genos=shuffle([...ALL_GENOS]); const E=[];
    for(let i=0;i<NUM_ENTITIES;i++){let x=Math.floor(rng()*GRID),y=Math.floor(rng()*GRID),t=0;
      while(entAt(E,x,y)&&t<50){x=Math.floor(rng()*GRID);y=Math.floor(rng()*GRID);t++;}
      E.push({id:i,x,y,px:x,py:y,g:genos[i],name:NAMES[i],ob:[0,0,0],ch:[0,0,0]});}
    const F=[]; const wt=hWatch();
    for(let t=1;t<=wt;t++) doTick(E,F,t);
    const mult=Math.max(1.25, 6.0-wt*0.25);
    const tgts=hPick(E);
    for (const ent of tgts) {
      const amt=10; // fixed bet for clean measurement
      const guess=hGuess(ent);
      // Run remaining ticks (we do this once, all bets see same final state)
      // Actually need to run ticks before resolving - do it once per round
      totBet+=amt; bn++;
      // Store for later resolution
      ent._guess=guess; ent._amt=amt; ent._mult=mult;
    }
    for(let t=wt+1;t<=MAX_TICKS;t++) doTick(E,F,t);
    for (const ent of tgts) {
      const cor=ent.g.reduce((s,v,i)=>s+(v===ent._guess[i]?1:0),0);
      let pay=0;
      if(cor===3){pay=Math.round(ent._amt*ent._mult);w3++;}
      else if(cor===2){pay=Math.round(ent._amt*0.3);w2++;}
      else{wLoss++;}
      totPay+=Math.round(pay*(1-rake/100));
    }
  }
  const rtp=(100*totPay/totBet).toFixed(1);
  const edge=(100-parseFloat(rtp)).toFixed(1);
  return {rake,totBet,totPay,bn,w3,w2,wLoss,rtp,edge};
}

const ROUNDS=20000;
const rakes=[0, 5, 10, 15, 20, 25, 28, 30, 32, 35, 38, 40, 42, 45, 50];

console.log('\n══════════════════════════════════════════════════════════════════');
console.log('  CLEAN RAKE ANALYSIS: pure bet-level RTP (' + ROUNDS + ' rounds)');
console.log('  Fixed 10⭐ bets, infinite bankroll, no ruin effects');
console.log('══════════════════════════════════════════════════════════════════');
console.log('Rake%  |  RTP    | House edge | 3/3 win% | 2/3 part% | Loss%');
console.log('-------|---------|------------|----------|-----------|------');

for (const rake of rakes) {
  const r=simulate(rake,ROUNDS);
  const w3p=(100*r.w3/r.bn).toFixed(1);
  const w2p=(100*r.w2/r.bn).toFixed(1);
  const wLp=(100*r.wLoss/r.bn).toFixed(1);
  const mark=parseFloat(r.edge)>=5&&parseFloat(r.edge)<=15?' ★ TARGET':
             parseFloat(r.edge)<0?' ← PLAYER WINS':'';
  console.log(`  ${String(rake).padStart(2)}%  | ${r.rtp.padStart(6)}% | ${r.edge.padStart(6)}%     | ${w3p.padStart(5)}%   | ${w2p.padStart(6)}%    | ${wLp.padStart(5)}%${mark}`);
}
console.log('══════════════════════════════════════════════════════════════════');
console.log('Ideal: RTP 85-95% (house edge 5-15%). Slots typically 92-96%.');
console.log('══════════════════════════════════════════════════════════════════\n');
