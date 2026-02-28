// sus.genes Strategy Simulator v1.0
// Run: node strategy_sim.js
// Analyzes optimal betting strategies through Monte Carlo simulation

const GRID = 6, NUM_ENTITIES = 8, MAX_TICKS = 20;
const PROB_HI = 0.7, PROB_LO = 0.3;
const ALL_GENOS = [[0,0,0],[0,0,1],[0,1,0],[0,1,1],[1,0,0],[1,0,1],[1,1,0],[1,1,1]];
const GENE_LABELS = ['A','H','G'];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function currentMult(tick) { return Math.max(1.25, 6.0 - tick * 0.25); }

// ============ GAME ENGINE (headless) ============
class Game {
  constructor() { this.reset(); }

  reset() {
    this.tick = 0;
    this.food = [];
    this.entities = [];
    const pos = shuffle([...Array(GRID*GRID)].map((_,i) => ({x:i%GRID, y:Math.floor(i/GRID)})));
    const genos = shuffle(ALL_GENOS.map(g => [...g]));
    for (let i = 0; i < NUM_ENTITIES; i++) {
      this.entities.push({
        id: i, x: pos[i].x, y: pos[i].y, geno: genos[i],
        obs: [0,0,0], chances: [0,0,0]
      });
    }
  }

  entAt(x, y) { return this.entities.find(e => e.x === x && e.y === y); }
  foodIdx(x, y) { return this.food.findIndex(f => f.x === x && f.y === y); }

  getAdj4(x, y) {
    const r = [];
    for (const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
      const nx = x+dx, ny = y+dy;
      if (nx >= 0 && nx < GRID && ny >= 0 && ny < GRID) r.push({x:nx,y:ny});
    }
    return r;
  }

  spawnFood() {
    for (let t = 0; t < 30; t++) {
      const x = Math.floor(Math.random()*GRID), y = Math.floor(Math.random()*GRID);
      if (!this.entAt(x,y) && this.foodIdx(x,y) < 0) { this.food.push({x,y}); return; }
    }
  }

  findGroup(e) {
    let best = null, bc = 0;
    for (let gx = 0; gx < GRID-1; gx++) for (let gy = 0; gy < GRID-1; gy++) {
      let c = 0;
      for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) {
        const o = this.entAt(gx+dx, gy+dy);
        if (o && o !== e) c++;
      }
      if (c > bc) { bc = c; best = {x: gx+0.5, y: gy+0.5}; }
    }
    return bc >= 2 ? best : null;
  }

  findNearestFood(e) {
    if (!this.food.length) return null;
    let best = null, bd = 999;
    for (const f of this.food) {
      const d = Math.abs(e.x-f.x) + Math.abs(e.y-f.y);
      if (d < bd) { bd = d; best = f; }
    }
    return best;
  }

  moveToward(e, tx, ty) {
    const dx = tx-e.x, dy = ty-e.y, c = [];
    if (dx > 0) c.push({x:e.x+1, y:e.y}); if (dx < 0) c.push({x:e.x-1, y:e.y});
    if (dy > 0) c.push({x:e.x, y:e.y+1}); if (dy < 0) c.push({x:e.x, y:e.y-1});
    const v = c.filter(p => p.x>=0 && p.x<GRID && p.y>=0 && p.y<GRID && !this.entAt(p.x,p.y));
    return v.length ? v[Math.floor(Math.random()*v.length)] : null;
  }

  randomMove(e) {
    const a = this.getAdj4(e.x, e.y).filter(c => !this.entAt(c.x, c.y));
    return a.length ? a[Math.floor(Math.random()*a.length)] : null;
  }

  doTick() {
    if (this.tick >= MAX_TICKS) return;
    this.tick++;
    if (this.food.length === 0) this.spawnFood();
    if (this.tick % 3 === 0) this.spawnFood();
    const shuffled = shuffle(this.entities);

    for (const e of shuffled) {
      const pA = e.geno[0] ? PROB_HI : PROB_LO;
      const pH = e.geno[1] ? PROB_HI : PROB_LO;
      const pG = e.geno[2] ? PROB_HI : PROB_LO;
      let acted = false;

      const actions = shuffle([
        { gene: 0, fn: () => {
          const nb = this.getAdj4(e.x,e.y).map(c=>this.entAt(c.x,c.y)).filter(Boolean);
          if (!nb.length) return false; e.chances[0]++;
          if (Math.random() < pA) {
            const t = nb[Math.floor(Math.random()*nb.length)];
            const ox = e.x, oy = e.y;
            e.x = t.x; e.y = t.y; t.x = ox; t.y = oy;
            e.obs[0]++; return true;
          }
          return false;
        }},
        { gene: 1, fn: () => {
          const g = this.findGroup(e); if (!g) return false; e.chances[1]++;
          if (Math.random() < pH) {
            const m = this.moveToward(e, Math.round(g.x), Math.round(g.y));
            if (m) { e.x = m.x; e.y = m.y; e.obs[1]++; return true; }
          }
          return false;
        }},
        { gene: 2, fn: () => {
          const nf = this.findNearestFood(e); if (!nf) return false; e.chances[2]++;
          if (Math.random() < pG) {
            const m = this.moveToward(e, nf.x, nf.y);
            if (m) { e.x = m.x; e.y = m.y; e.obs[2]++; return true; }
          }
          return false;
        }}
      ]);

      for (const a of actions) { if (a.fn()) { acted = true; break; } }
      if (!acted) { const m = this.randomMove(e); if (m) { e.x = m.x; e.y = m.y; } }
      const fi = this.foodIdx(e.x, e.y);
      if (fi >= 0) this.food.splice(fi, 1);
    }
  }

  runToTick(n) { while (this.tick < n && this.tick < MAX_TICKS) this.doTick(); }
  runAll() { this.runToTick(MAX_TICKS); }
}

// ============ BAYESIAN INFERENCE ============
// Given obs[g] successes out of chances[g] trials,
// what's P(gene=+)?
// Prior: uniform (0.5 each since bijection assigns all 8 genotypes)
// Likelihood: Binomial(obs | chances, p) where p=0.7 or 0.3

function binomLogLik(k, n, p) {
  if (n === 0) return 0;
  if (p === 0) return k === 0 ? 0 : -Infinity;
  if (p === 1) return k === n ? 0 : -Infinity;
  return k * Math.log(p) + (n - k) * Math.log(1 - p);
}

function posteriorPlus(obs_g, chances_g) {
  // P(gene=+ | data) ∝ P(data | gene=+) * P(gene=+)
  // Prior P(+) = 0.5 (uniform)
  if (chances_g === 0) return 0.5; // no data
  const llPlus = binomLogLik(obs_g, chances_g, PROB_HI);
  const llMinus = binomLogLik(obs_g, chances_g, PROB_LO);
  // Softmax
  const maxLL = Math.max(llPlus, llMinus);
  const pPlus = Math.exp(llPlus - maxLL);
  const pMinus = Math.exp(llMinus - maxLL);
  return pPlus / (pPlus + pMinus);
}

// Predict best guess for each gene: + if posterior > 0.5, else -
function bayesianGuess(entity) {
  return entity.geno.map((_, g) => {
    const p = posteriorPlus(entity.obs[g], entity.chances[g]);
    return p >= 0.5 ? 1 : 0;
  });
}

// Confidence = product of individual gene confidences
function bayesianConfidence(entity) {
  return entity.geno.map((_, g) => {
    const p = posteriorPlus(entity.obs[g], entity.chances[g]);
    return Math.max(p, 1 - p); // confidence in the chosen direction
  });
}

// ============ STRATEGY FUNCTIONS ============

// Strategy 1: "Bayesian at tick T" — bet on entity with highest confidence at fixed tick
function strategyFixedTick(game, betTick, betAmount) {
  game.runToTick(betTick);
  const mult = currentMult(betTick);
  
  // Find entity with highest confidence
  let bestEnt = null, bestConf = 0;
  for (const e of game.entities) {
    const confs = bayesianConfidence(e);
    const totalConf = confs[0] * confs[1] * confs[2]; // joint confidence
    if (totalConf > bestConf) { bestConf = totalConf; bestEnt = e; }
  }
  
  if (!bestEnt) return { profit: 0, correct: 0 };
  const guess = bayesianGuess(bestEnt);
  
  // Run to end, check result
  game.runAll();
  const correct = bestEnt.geno.reduce((s, v, i) => s + (v === guess[i] ? 1 : 0), 0);
  let payout = 0;
  if (correct === 3) payout = Math.round(betAmount * mult);
  else if (correct === 2) payout = Math.round(betAmount * 0.3);
  
  return { profit: payout - betAmount, correct, confidence: bestConf, mult };
}

// Strategy 2: "Multi-bet" — bet on N entities above confidence threshold
function strategyMultiBet(game, betTick, betAmount, maxBets, confThreshold) {
  game.runToTick(betTick);
  const mult = currentMult(betTick);
  
  const ranked = game.entities.map(e => {
    const confs = bayesianConfidence(e);
    return { ent: e, conf: confs[0] * confs[1] * confs[2], guess: bayesianGuess(e) };
  }).sort((a, b) => b.conf - a.conf);
  
  let totalProfit = 0, betsPlaced = 0;
  for (const r of ranked) {
    if (betsPlaced >= maxBets) break;
    if (r.conf < confThreshold) break;
    betsPlaced++;
    game.runAll(); // idempotent after first call
    const correct = r.ent.geno.reduce((s, v, i) => s + (v === r.guess[i] ? 1 : 0), 0);
    let payout = 0;
    if (correct === 3) payout = Math.round(betAmount * mult);
    else if (correct === 2) payout = Math.round(betAmount * 0.3);
    totalProfit += payout - betAmount;
  }
  
  return { profit: totalProfit, betsPlaced, mult };
}

// Strategy 3: "Adaptive" — observe until confidence threshold, then bet
function strategyAdaptive(game, betAmount, confTarget) {
  let betTick = -1;
  for (let t = 1; t <= MAX_TICKS; t++) {
    game.runToTick(t);
    // Check if any entity has high enough confidence
    for (const e of game.entities) {
      const confs = bayesianConfidence(e);
      const jointConf = confs[0] * confs[1] * confs[2];
      if (jointConf >= confTarget) {
        betTick = t;
        break;
      }
    }
    if (betTick >= 0) break;
  }
  
  if (betTick < 0) betTick = MAX_TICKS; // forced bet at end
  const mult = currentMult(betTick);
  
  // Find best entity at betTick
  let bestEnt = null, bestConf = 0;
  for (const e of game.entities) {
    const confs = bayesianConfidence(e);
    const totalConf = confs[0] * confs[1] * confs[2];
    if (totalConf > bestConf) { bestConf = totalConf; bestEnt = e; }
  }
  
  const guess = bayesianGuess(bestEnt);
  game.runAll();
  const correct = bestEnt.geno.reduce((s, v, i) => s + (v === guess[i] ? 1 : 0), 0);
  let payout = 0;
  if (correct === 3) payout = Math.round(betAmount * mult);
  else if (correct === 2) payout = Math.round(betAmount * 0.3);
  
  return { profit: payout - betAmount, correct, betTick, mult, confidence: bestConf };
}

// ============ SIMULATION RUNNER ============
const N = 50000; // rounds per test
const BET_AMOUNT = 10;

console.log('=== sus.genes Strategy Simulator v1.0 ===');
console.log(`Simulating ${N} rounds per strategy...\n`);

// --- Test 1: Gene observability analysis ---
console.log('━━━ TEST 1: GENE OBSERVABILITY ━━━');
console.log('How often does each gene get a chance to express?\n');

let geneChances = [0,0,0], geneObs = [0,0,0], totalEnts = 0;
for (let r = 0; r < 10000; r++) {
  const g = new Game();
  g.runAll();
  for (const e of g.entities) {
    for (let gi = 0; gi < 3; gi++) {
      geneChances[gi] += e.chances[gi];
      geneObs[gi] += e.obs[gi];
    }
    totalEnts++;
  }
}
for (let gi = 0; gi < 3; gi++) {
  const avgChances = (geneChances[gi] / totalEnts).toFixed(1);
  const avgObs = (geneObs[gi] / totalEnts).toFixed(1);
  const obsRate = (geneObs[gi] / geneChances[gi] * 100).toFixed(1);
  console.log(`  ${GENE_LABELS[gi]}: avg ${avgChances} chances, ${avgObs} observed actions (${obsRate}% rate)`);
}

// --- Test 2: Bayesian accuracy by tick ---
console.log('\n━━━ TEST 2: BAYESIAN ACCURACY BY TICK ━━━');
console.log('Per-gene and joint accuracy at each tick\n');

console.log('Tick | mult  |  A%   H%   G%  | 3/3%  2/3%  EV/10⭐');
console.log('-----+-------+----------------+---------------------');

for (let t = 1; t <= MAX_TICKS; t++) {
  const mult = currentMult(t);
  let geneCorrect = [0,0,0], joint3 = 0, joint2 = 0, totalTests = 0;

  for (let r = 0; r < N; r++) {
    const g = new Game();
    g.runToTick(t);
    // Test best entity
    let bestEnt = null, bestConf = 0;
    for (const e of g.entities) {
      const confs = bayesianConfidence(e);
      const c = confs[0] * confs[1] * confs[2];
      if (c > bestConf) { bestConf = c; bestEnt = e; }
    }
    if (!bestEnt) continue;
    const guess = bayesianGuess(bestEnt);
    g.runAll(); // ensure full simulation
    
    let correct = 0;
    for (let gi = 0; gi < 3; gi++) {
      if (bestEnt.geno[gi] === guess[gi]) { geneCorrect[gi]++; correct++; }
    }
    if (correct === 3) joint3++;
    if (correct >= 2) joint2++;
    totalTests++;
  }

  const aP = (geneCorrect[0]/totalTests*100).toFixed(1);
  const hP = (geneCorrect[1]/totalTests*100).toFixed(1);
  const gP = (geneCorrect[2]/totalTests*100).toFixed(1);
  const j3 = (joint3/totalTests*100).toFixed(1);
  const j2 = ((joint2-joint3)/totalTests*100).toFixed(1); // exactly 2/3
  // EV = P(3/3)*mult*bet + P(2/3)*0.3*bet - bet
  const ev = (joint3/totalTests * mult * BET_AMOUNT + 
              (joint2-joint3)/totalTests * 0.3 * BET_AMOUNT - BET_AMOUNT).toFixed(2);
  console.log(`  ${String(t).padStart(2)} | ×${mult.toFixed(2)} | ${aP.padStart(5)} ${hP.padStart(5)} ${gP.padStart(5)} | ${j3.padStart(5)} ${j2.padStart(5)}  ${ev.padStart(6)}`);
}

// --- Test 3: Fixed tick strategies ---
console.log('\n━━━ TEST 3: FIXED-TICK STRATEGY (best entity, 10⭐ bet) ━━━\n');
console.log('Tick | AvgProfit | Win% | AvgMult | Profit/1000rounds');
console.log('-----+-----------+------+---------+------------------');

for (let t = 1; t <= MAX_TICKS; t += 1) {
  let totalProfit = 0, wins = 0;
  for (let r = 0; r < N; r++) {
    const g = new Game();
    const res = strategyFixedTick(g, t, BET_AMOUNT);
    totalProfit += res.profit;
    if (res.profit > 0) wins++;
  }
  const avgProfit = (totalProfit / N).toFixed(2);
  const winPct = (wins / N * 100).toFixed(1);
  const per1000 = (totalProfit / N * 1000).toFixed(0);
  console.log(`  ${String(t).padStart(2)} | ${avgProfit.padStart(9)} | ${winPct.padStart(4)}% | ×${currentMult(t).toFixed(2)} | ${per1000.padStart(6)}`);
}

// --- Test 4: Multi-bet strategy ---
console.log('\n━━━ TEST 4: MULTI-BET STRATEGY (tick 10, 10⭐ each) ━━━\n');
console.log('MaxBets | ConfThresh | AvgProfit | AvgBets | Profit/1000');
console.log('--------+------------+-----------+---------+------------');

for (const maxBets of [1, 2, 3, 4]) {
  for (const confThresh of [0.3, 0.4, 0.5, 0.6]) {
    let totalProfit = 0, totalBets = 0;
    for (let r = 0; r < N; r++) {
      const g = new Game();
      const res = strategyMultiBet(g, 10, BET_AMOUNT, maxBets, confThresh);
      totalProfit += res.profit;
      totalBets += res.betsPlaced;
    }
    const avgProfit = (totalProfit / N).toFixed(2);
    const avgBets = (totalBets / N).toFixed(1);
    const per1000 = (totalProfit / N * 1000).toFixed(0);
    console.log(`    ${maxBets}   |    ${confThresh.toFixed(1)}     | ${avgProfit.padStart(9)} |   ${avgBets.padStart(3)}   | ${per1000.padStart(6)}`);
  }
}

// --- Test 5: Adaptive strategy ---
console.log('\n━━━ TEST 5: ADAPTIVE STRATEGY (bet when confidence reaches target) ━━━\n');
console.log('ConfTarget | AvgTick | AvgMult | AvgProfit | Win% | Profit/1000');
console.log('-----------+---------+---------+-----------+------+------------');

for (const confTarget of [0.3, 0.4, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8]) {
  let totalProfit = 0, totalTick = 0, wins = 0;
  for (let r = 0; r < N; r++) {
    const g = new Game();
    const res = strategyAdaptive(g, BET_AMOUNT, confTarget);
    totalProfit += res.profit;
    totalTick += res.betTick;
    if (res.profit > 0) wins++;
  }
  const avgProfit = (totalProfit / N).toFixed(2);
  const avgTick = (totalTick / N).toFixed(1);
  const avgMult = currentMult(Math.round(totalTick / N)).toFixed(2);
  const winPct = (wins / N * 100).toFixed(1);
  const per1000 = (totalProfit / N * 1000).toFixed(0);
  console.log(`   ${confTarget.toFixed(2)}    |  ${avgTick.padStart(4)}   | ×${avgMult} | ${avgProfit.padStart(9)} | ${winPct.padStart(4)}% | ${per1000.padStart(6)}`);
}

// --- Test 6: Observation quality ---
console.log('\n━━━ TEST 6: SIGNAL QUALITY PER GENE ━━━');
console.log('At tick 10: how distinguishable are + vs - for each gene?\n');

let genePlusObs = [[],[],[]], geneMinusObs = [[],[],[]];
for (let r = 0; r < 20000; r++) {
  const g = new Game();
  g.runToTick(10);
  for (const e of g.entities) {
    for (let gi = 0; gi < 3; gi++) {
      const rate = e.chances[gi] > 0 ? e.obs[gi] / e.chances[gi] : -1;
      if (rate < 0) continue;
      if (e.geno[gi] === 1) genePlusObs[gi].push(rate);
      else geneMinusObs[gi].push(rate);
    }
  }
}

for (let gi = 0; gi < 3; gi++) {
  const pAvg = genePlusObs[gi].length ? (genePlusObs[gi].reduce((a,b)=>a+b,0)/genePlusObs[gi].length).toFixed(3) : 'N/A';
  const mAvg = geneMinusObs[gi].length ? (geneMinusObs[gi].reduce((a,b)=>a+b,0)/geneMinusObs[gi].length).toFixed(3) : 'N/A';
  const pStd = genePlusObs[gi].length > 1 ? Math.sqrt(genePlusObs[gi].reduce((s,v)=>s+(v-pAvg)**2,0)/(genePlusObs[gi].length-1)).toFixed(3) : 'N/A';
  const mStd = geneMinusObs[gi].length > 1 ? Math.sqrt(geneMinusObs[gi].reduce((s,v)=>s+(v-mAvg)**2,0)/(geneMinusObs[gi].length-1)).toFixed(3) : 'N/A';
  console.log(`  ${GENE_LABELS[gi]}: + rate=${pAvg}±${pStd} (n=${genePlusObs[gi].length}), - rate=${mAvg}±${mStd} (n=${geneMinusObs[gi].length})`);
  console.log(`     separation: ${(Math.abs(pAvg-mAvg)).toFixed(3)}`);
}

console.log('\n━━━ DONE ━━━');
