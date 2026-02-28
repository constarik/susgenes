// HUMAN-SIM: simulates a human player who reads behavior bars "by eye"
// No Bayesian math — just heuristics like "it swaps a lot → A+", "it clusters → H+"
// Run: node human_sim.js [rounds=10000]

const GRID = 6, NUM_ENTITIES = 8, MAX_TICKS = 20;
const PROB_HI = 0.7, PROB_LO = 0.3;
const ALL_GENOS = [];
for (let i = 0; i < 8; i++) ALL_GENOS.push([(i>>2)&1, (i>>1)&1, i&1]);

const NAMES = ['Alpha','Beta','Gamma','Delta','Epsilon','Zeta','Eta','Theta'];

function rng() { return Math.random(); }
function shuffle(arr) { for (let i = arr.length-1; i > 0; i--) { const j = Math.floor(rng()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; }

// ========== GAME ENGINE (from index.html) ==========
function entAt(ents, x, y) { return ents.find(e => e.x===x && e.y===y); }
function foodAt(food, x, y) { return food.findIndex(f => f.x===x && f.y===y); }
function getAdj4(x, y) {
  const r = [];
  for (const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
    const nx=x+dx, ny=y+dy;
    if (nx>=0 && nx<GRID && ny>=0 && ny<GRID) r.push({x:nx,y:ny});
  } return r;
}
function findGroup(ents, e) {
  let best=null, bc=0;
  for (let gx=0; gx<GRID-1; gx++) for (let gy=0; gy<GRID-1; gy++) {
    let c=0; for (let dx=0;dx<2;dx++) for (let dy=0;dy<2;dy++) { const o=entAt(ents,gx+dx,gy+dy); if(o&&o!==e)c++; }
    if (c>bc) { bc=c; best={x:gx+0.5,y:gy+0.5}; }
  } return bc>=2 ? best : null;
}
function moveToward(ents, e, tx, ty) {
  const dx=tx-e.x, dy=ty-e.y, c=[];
  if(dx>0)c.push({x:e.x+1,y:e.y}); if(dx<0)c.push({x:e.x-1,y:e.y});
  if(dy>0)c.push({x:e.x,y:e.y+1}); if(dy<0)c.push({x:e.x,y:e.y-1});
  const v=c.filter(p=>p.x>=0&&p.x<GRID&&p.y>=0&&p.y<GRID&&!entAt(ents,p.x,p.y));
  return v.length ? v[Math.floor(rng()*v.length)] : null;
}
function randomMove(ents, e) {
  const a=getAdj4(e.x,e.y).filter(c=>!entAt(ents,c.x,c.y));
  return a.length ? a[Math.floor(rng()*a.length)] : null;
}

function spawnFood(ents, food) {
  let t=0; while(t<30) {
    const x=Math.floor(rng()*GRID), y=Math.floor(rng()*GRID);
    if (!entAt(ents,x,y) && foodAt(food,x,y)<0) { food.push({x,y}); return; } t++;
  }
}

function doTick(ents, food, tickNum) {
  for (const e of ents) { e.px=e.x; e.py=e.y; }
  if (food.length===0) spawnFood(ents, food);
  if (tickNum%3===0) spawnFood(ents, food);
  const shuffled = [...ents].sort(()=>rng()-0.5);

  for (const e of shuffled) {
    const pA = e.geno[0] ? PROB_HI : PROB_LO;
    const pH = e.geno[1] ? PROB_HI : PROB_LO;
    const pG = e.geno[2] ? PROB_HI : PROB_LO;
    let acted = false;
    const actions = [
      { gene:0, fn:()=>{
        const nb=getAdj4(e.x,e.y).map(c=>entAt(ents,c.x,c.y)).filter(Boolean);
        if(!nb.length) return false; e.chances[0]++;
        if(rng()<pA){ const t=nb[Math.floor(rng()*nb.length)];
          const ox=e.x,oy=e.y; e.x=t.x;e.y=t.y;t.x=ox;t.y=oy; e.obs[0]++; return true; }
        return false;
      }},
      { gene:1, fn:()=>{
        const g=findGroup(ents,e); if(!g) return false; e.chances[1]++;
        if(rng()<pH){ const m=moveToward(ents,e,Math.round(g.x),Math.round(g.y));
          if(m){e.x=m.x;e.y=m.y;e.obs[1]++;return true;} } return false;
      }},
      { gene:2, fn:()=>{
        const nf = food.length ? food.reduce((b,f)=>{const d=Math.abs(e.x-f.x)+Math.abs(e.y-f.y);return d<b.d?{f,d}:b},{d:999,f:null}).f : null;
        if(!nf) return false; e.chances[2]++;
        if(rng()<pG){ const m=moveToward(ents,e,nf.x,nf.y);
          if(m){e.x=m.x;e.y=m.y;e.obs[2]++;return true;} } return false;
      }}
    ];
    shuffle(actions);
    for (const a of actions) { if(a.fn()){ acted=true; break; } }
    if (!acted) { const m=randomMove(ents,e); if(m){e.x=m.x;e.y=m.y;} }
    const fi=foodAt(food,e.x,e.y);
    if(fi>=0) food.splice(fi,1);
  }
}

// ========== HUMAN-SIM STRATEGY ==========
// A human player doesn't compute probabilities.
// They look at the colored bar and think:
// "Lots of red? Aggressive. Lots of green? Herding. Yellow? Greedy."
// If bar is tiny or empty — coin flip, slightly biased to minus.
// Humans are OVERCONFIDENT about what they "clearly see" and wishy-washy on weak signals.

function humanGuess(ent) {
  const [obsA, obsH, obsG] = ent.obs;
  const total = obsA + obsH + obsG;
  const guess = [0, 0, 0];

  // Gene 0 - Aggression: "did I see it push others around?"
  if (total < 2) {
    // Almost no data — gut feel, humans lean "no" on aggression
    guess[0] = rng() < 0.35 ? 1 : 0;
  } else {
    const fracA = obsA / total;
    // Human: "more than a third of the bar is red → definitely aggressive"
    // "barely any red → not aggressive"
    // Fuzzy zone in between
    if (fracA > 0.35) guess[0] = 1;
    else if (fracA < 0.15) guess[0] = 0;
    else guess[0] = rng() < 0.45 ? 1 : 0; // unsure, slight lean to minus
  }

  // Gene 1 - Herding: "is it joining the group?"
  if (total < 2) {
    guess[1] = rng() < 0.5 ? 1 : 0; // no idea
  } else {
    const fracH = obsH / total;
    if (fracH > 0.35) guess[1] = 1;
    else if (fracH < 0.15) guess[1] = 0;
    else guess[1] = rng() < 0.45 ? 1 : 0;
  }

  // Gene 2 - Greed: "is it chasing food?"
  if (total < 2) {
    guess[2] = rng() < 0.4 ? 1 : 0; // slight lean minus
  } else {
    const fracG = obsG / total;
    if (fracG > 0.35) guess[2] = 1;
    else if (fracG < 0.15) guess[2] = 0;
    else guess[2] = rng() < 0.45 ? 1 : 0;
  }

  return guess;
}

// Human picks who to bet on: entities that "stood out" (most active bars)
function humanPickTargets(ents) {
  const sorted = [...ents].sort((a,b) => {
    const ta = a.obs[0]+a.obs[1]+a.obs[2];
    const tb = b.obs[0]+b.obs[1]+b.obs[2];
    return tb - ta;
  });
  // Human bets on 2-3 entities (sometimes 1 if cautious, rarely 4)
  const r = rng();
  const numBets = r < 0.15 ? 1 : r < 0.7 ? 2 : 3;
  return sorted.slice(0, numBets);
}

// Human bet sizing: cautious with small bankroll, bolder when rich
function humanBetSize(balance) {
  if (balance <= 10) return 5;
  if (balance <= 30) return 5;
  if (balance <= 60) return 10;
  if (balance <= 150) return rng() < 0.6 ? 10 : 25;
  return rng() < 0.5 ? 10 : rng() < 0.8 ? 25 : 50;
}

// How many ticks does a human watch? 6-12 (impatient humans watch fewer)
function humanWatchTicks() {
  return 6 + Math.floor(rng() * 7); // 6-12
}

// ========== MAIN SIMULATION ==========
const NUM_ROUNDS = parseInt(process.argv[2]) || 10000;
const START_BALANCE = 100;

let balance = START_BALANCE;
let stats = { rounds: 0, betsPlaced: 0, betsWon3: 0, betsWon2: 0, betsLost: 0,
              totalBet: 0, totalReturn: 0, busts: 0, peakBal: START_BALANCE, minBal: START_BALANCE,
              geneCorrect: [0,0,0], geneTotal: [0,0,0] };
let balHistory = [];

for (let round = 0; round < NUM_ROUNDS; round++) {
  if (balance <= 0) {
    // Free daily reset (as in game)
    balance = 100;
    stats.busts++;
  }

  // Create entities with random bijection of genotypes
  const genos = shuffle([...ALL_GENOS]);
  const ents = [];
  for (let i = 0; i < NUM_ENTITIES; i++) {
    const x = Math.floor(rng()*GRID), y = Math.floor(rng()*GRID);
    // ensure no overlap (simple retry)
    let ex=x, ey=y, tries=0;
    while (entAt(ents,ex,ey) && tries<50) { ex=Math.floor(rng()*GRID); ey=Math.floor(rng()*GRID); tries++; }
    ents.push({ id:i, x:ex, y:ey, px:ex, py:ey, geno:genos[i], name:NAMES[i],
                obs:[0,0,0], chances:[0,0,0] });
  }
  const food = [];

  // Human watches some ticks
  const watchTicks = humanWatchTicks();
  for (let t = 1; t <= watchTicks; t++) {
    if (food.length===0) spawnFood(ents, food);
    if (t%3===0) spawnFood(ents, food);
    doTick(ents, food, t);
  }

  // Human decides multiplier at this tick
  const mult = Math.max(1.25, 6.0 - watchTicks * 0.25);

  // Human picks targets and bets
  const targets = humanPickTargets(ents);
  const bets = [];
  for (const ent of targets) {
    const amt = humanBetSize(balance);
    if (amt > balance || amt <= 0) continue;
    const guess = humanGuess(ent);
    bets.push({ entId: ent.id, guess, amount: amt, mult });
    balance -= amt;
    stats.totalBet += amt;
    stats.betsPlaced++;
  }

  // Run remaining ticks
  for (let t = watchTicks+1; t <= MAX_TICKS; t++) {
    doTick(ents, food, t);
  }

  // Resolve bets
  for (const b of bets) {
    const e = ents.find(en => en.id === b.entId);
    const correct = e.geno.reduce((s,v,i) => s + (v === b.guess[i] ? 1 : 0), 0);
    // Track per-gene accuracy
    for (let g = 0; g < 3; g++) {
      stats.geneTotal[g]++;
      if (b.guess[g] === e.geno[g]) stats.geneCorrect[g]++;
    }
    if (correct === 3) {
      const payout = Math.round(b.amount * b.mult);
      balance += payout; stats.totalReturn += payout; stats.betsWon3++;
    } else if (correct === 2) {
      const payout = Math.round(b.amount * 0.3);
      balance += payout; stats.totalReturn += payout; stats.betsWon2++;
    } else {
      stats.betsLost++;
    }
  }

  stats.rounds++;
  if (balance > stats.peakBal) stats.peakBal = balance;
  if (balance < stats.minBal) stats.minBal = balance;
  if (round % 1000 === 0) balHistory.push({ round, balance });
}

// ========== REPORT ==========
console.log('\n═══════════════════════════════════════');
console.log('  HUMAN-SIM RESULTS (' + NUM_ROUNDS + ' rounds)');
console.log('═══════════════════════════════════════');
console.log(`Start balance:  ${START_BALANCE}⭐`);
console.log(`Final balance:  ${balance}⭐`);
console.log(`Peak / Min:     ${stats.peakBal}⭐ / ${stats.minBal}⭐`);
console.log(`Busts (resets):  ${stats.busts}`);
console.log('');
console.log(`Bets placed:    ${stats.betsPlaced}`);
console.log(`  3/3 wins:     ${stats.betsWon3} (${(100*stats.betsWon3/stats.betsPlaced).toFixed(1)}%)`);
console.log(`  2/3 partial:  ${stats.betsWon2} (${(100*stats.betsWon2/stats.betsPlaced).toFixed(1)}%)`);
console.log(`  0-1/3 lost:   ${stats.betsLost} (${(100*stats.betsLost/stats.betsPlaced).toFixed(1)}%)`);
console.log('');
console.log(`Total wagered:  ${stats.totalBet}⭐`);
console.log(`Total returned: ${stats.totalReturn}⭐`);
console.log(`House edge:     ${(100*(1 - stats.totalReturn/stats.totalBet)).toFixed(2)}%`);
console.log('');
console.log('Per-gene accuracy (human eye):');
const gNames = ['Aggression','Herding  ','Greed    '];
for (let g = 0; g < 3; g++) {
  const pct = (100*stats.geneCorrect[g]/stats.geneTotal[g]).toFixed(1);
  console.log(`  ${gNames[g]}: ${pct}% (${stats.geneCorrect[g]}/${stats.geneTotal[g]})`);
}
console.log('');
console.log('Balance every 1000 rounds:');
balHistory.push({ round: NUM_ROUNDS, balance });
for (const h of balHistory) {
  const bar = '█'.repeat(Math.min(50, Math.max(0, Math.round(h.balance/20))));
  console.log(`  R${String(h.round).padStart(5)}: ${String(h.balance).padStart(6)}⭐ ${bar}`);
}
console.log('═══════════════════════════════════════\n');
