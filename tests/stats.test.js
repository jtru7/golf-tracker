import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { computeStats, computeHandicap, filterRounds, buildRoundSummary, reorderArray, GOAL_DEFS, getGoalStatus, TREND_KPIS, computeTrendData, computeMovingAverage } = require('../js/stats.js');

// Helper: create a minimal hole object
function makeHole(overrides = {}) {
    return {
        number: 1,
        par: 4,
        score: 4,
        putts: 2,
        penalties: 0,
        fairwayHit: true,
        fairwayDirection: 'hit',
        gir: true,
        approachResult: 'gir',
        bunker: false,
        ...overrides
    };
}

// Helper: create a minimal round object
function makeRound(overrides = {}) {
    return {
        id: '1',
        courseId: 'c1',
        courseName: 'Test Course',
        numHoles: 9,
        date: '2025-06-15',
        tees: 'middle',
        courseRating: 35.5,
        slopeRating: 113,
        totalScore: 40,
        holes: [
            makeHole({ number: 1, par: 4, score: 5, putts: 2, fairwayHit: true, fairwayDirection: 'hit', gir: false, approachResult: 'short' }),
            makeHole({ number: 2, par: 3, score: 3, putts: 1, fairwayHit: false, fairwayDirection: null, gir: true, approachResult: 'gir' }),
            makeHole({ number: 3, par: 5, score: 5, putts: 2, fairwayHit: false, fairwayDirection: 'left', gir: true, approachResult: 'gir' }),
            makeHole({ number: 4, par: 4, score: 4, putts: 2, fairwayHit: true, fairwayDirection: 'hit', gir: true, approachResult: 'gir' }),
            makeHole({ number: 5, par: 4, score: 5, putts: 3, fairwayHit: false, fairwayDirection: 'right', gir: false, approachResult: 'right' }),
            makeHole({ number: 6, par: 3, score: 4, putts: 2, fairwayHit: false, fairwayDirection: null, gir: false, approachResult: 'long' }),
            makeHole({ number: 7, par: 4, score: 4, putts: 1, fairwayHit: true, fairwayDirection: 'hit', gir: true, approachResult: 'gir' }),
            makeHole({ number: 8, par: 5, score: 6, putts: 2, fairwayHit: false, fairwayDirection: 'left', gir: false, approachResult: 'short' }),
            makeHole({ number: 9, par: 4, score: 4, putts: 2, fairwayHit: true, fairwayDirection: 'hit', gir: true, approachResult: 'gir' }),
        ],
        ...overrides
    };
}

// ─── computeStats ───────────────────────────────────────────

describe('computeStats', () => {
    it('returns nulls for empty rounds array', () => {
        const stats = computeStats([]);
        expect(stats.avgScore).toBeNull();
        expect(stats.fairwayPct).toBeNull();
        expect(stats.girPct).toBeNull();
        expect(stats.avgPutts).toBeNull();
        expect(stats.scramblingPct).toBeNull();
        expect(stats.sandSavePct).toBeNull();
        expect(stats.feetOfPuttsMade).toBeNull();
        expect(stats.avgFirstPuttDist).toBeNull();
    });

    it('calculates correct average score', () => {
        const rounds = [
            makeRound({ totalScore: 40 }),
            makeRound({ totalScore: 38 }),
        ];
        const stats = computeStats(rounds);
        expect(stats.avgScore).toBe(39);
    });

    it('calculates fairway percentage (non-par-3 only)', () => {
        // In the default round: holes 1,3,4,5,7,8,9 are non-par-3 (par 4 or 5) with fairwayDirection set
        // Holes 1,4,7,9 have fairwayHit=true (4 out of 7)
        const rounds = [makeRound()];
        const stats = computeStats(rounds);
        expect(stats.fairwayPct).toBe(Math.round((4 / 7) * 100)); // 57%
    });

    it('calculates GIR percentage', () => {
        // All 9 holes have approachResult set
        // Holes 2,3,4,7,9 have gir=true (5 out of 9)
        const rounds = [makeRound()];
        const stats = computeStats(rounds);
        expect(stats.girPct).toBe(Math.round((5 / 9) * 100)); // 56%
    });

    it('calculates average putts per round', () => {
        // Total putts: 2+1+2+2+3+2+1+2+2 = 17
        const rounds = [makeRound()];
        const stats = computeStats(rounds);
        expect(stats.avgPutts).toBe(17);
    });

    it('calculates scrambling percentage', () => {
        // Missed GIR holes: 1 (score 5, par 4 — no), 5 (score 5, par 4 — no), 6 (score 4, par 3 — no), 8 (score 6, par 5 — no)
        // Scrambling = 0 out of 4
        const rounds = [makeRound()];
        const stats = computeStats(rounds);
        expect(stats.scramblingPct).toBe(0);
    });

    it('counts scrambling success when score <= par on missed GIR', () => {
        const round = makeRound();
        // Make hole 1 a scramble success: missed GIR but score = par
        round.holes[0].score = 4; // par 4, missed GIR, score = par
        round.totalScore = 39;
        const stats = computeStats([round]);
        // Now 1 out of 4 missed-GIR holes scrambled
        expect(stats.scramblingPct).toBe(25);
    });

    it('returns null sandSavePct when no bunker holes exist', () => {
        const rounds = [makeRound()]; // default holes have bunker: false
        const stats = computeStats(rounds);
        expect(stats.sandSavePct).toBeNull();
    });

    it('calculates sand save percentage', () => {
        const round = makeRound();
        // Hole 1: bunker, score 5, par 4 — no save
        round.holes[0].bunker = true;
        // Hole 3: bunker, score 5, par 5 — save (score <= par)
        round.holes[2].bunker = true;
        // Hole 5: bunker, score 5, par 4 — no save
        round.holes[4].bunker = true;
        const stats = computeStats([round]);
        expect(stats.sandSavePct).toBe(33); // 1/3 = 33%
    });

    it('handles legacy sandSave field for backward compat', () => {
        const round = makeRound();
        round.holes[0].sandSave = true; // old field
        round.holes[0].score = 4; // par 4, score 4 — save
        delete round.holes[0].bunker;
        const stats = computeStats([round]);
        expect(stats.sandSavePct).toBe(100); // 1/1
    });

    it('returns null putt distance stats when no puttDistances exist', () => {
        const rounds = [makeRound()];
        const stats = computeStats(rounds);
        expect(stats.feetOfPuttsMade).toBeNull();
        expect(stats.avgFirstPuttDist).toBeNull();
    });

    it('calculates feetOfPuttsMade from last putt distance in each hole', () => {
        const round = makeRound();
        round.holes[0].puttDistances = [25, 4];    // 2 putts, made=4ft
        round.holes[1].puttDistances = [8];         // 1 putt, made=8ft
        round.holes[2].puttDistances = [30, 6, 2];  // 3 putts, made=2ft
        const stats = computeStats([round]);
        expect(stats.feetOfPuttsMade).toBe(14); // 4 + 8 + 2
    });

    it('calculates avgFirstPuttDist from first putt distance across holes', () => {
        const round = makeRound();
        round.holes[0].puttDistances = [25, 4];    // first=25
        round.holes[1].puttDistances = [8];         // first=8
        round.holes[2].puttDistances = [30, 6, 2];  // first=30
        const stats = computeStats([round]);
        expect(stats.avgFirstPuttDist).toBe(21); // (25 + 8 + 30) / 3
    });

    it('skips null distances in puttDistances arrays', () => {
        const round = makeRound();
        round.holes[0].puttDistances = [null, 4];   // first=null (skip), made=4
        round.holes[1].puttDistances = [8];          // first=8, made=8
        round.holes[2].puttDistances = [30, null];   // first=30, made=null (skip)
        const stats = computeStats([round]);
        expect(stats.feetOfPuttsMade).toBe(12); // 4 + 8
        expect(stats.avgFirstPuttDist).toBe(19); // (8 + 30) / 2
    });

    it('handles empty puttDistances array (chip-in)', () => {
        const round = makeRound();
        round.holes[0].puttDistances = []; // chip-in
        round.holes[1].puttDistances = [5]; // 1 putt
        const stats = computeStats([round]);
        expect(stats.feetOfPuttsMade).toBe(5);
        expect(stats.avgFirstPuttDist).toBe(5);
    });

    // ─── Fairway Distribution ──────────────────────────────────

    it('calculates fairway distribution (L/Hit/R)', () => {
        // Default round: 7 fairway opportunities (non-par-3 with fairwayDirection)
        // Hit: 4 (holes 1,4,7,9), Left: 2 (holes 3,8), Right: 1 (hole 5)
        const stats = computeStats([makeRound()]);
        expect(stats.fairwayDist).toEqual({
            left: Math.round((2 / 7) * 100),   // 29%
            hit: Math.round((4 / 7) * 100),    // 57%
            right: Math.round((1 / 7) * 100)   // 14%
        });
    });

    it('returns null fairwayDist with no fairway opportunities', () => {
        const round = makeRound();
        round.holes = round.holes.map(h => ({ ...h, par: 3, fairwayDirection: null, fairwayHit: false }));
        const stats = computeStats([round]);
        expect(stats.fairwayDist).toBeNull();
    });

    // ─── Approach Distribution ─────────────────────────────────

    it('calculates approach distribution', () => {
        // Default round: 9 approach opportunities
        // gir: 5 (holes 2,3,4,7,9), short: 2 (holes 1,8), long: 1 (hole 6), right: 1 (hole 5), left: 0
        const stats = computeStats([makeRound()]);
        expect(stats.approachDist).toEqual({
            gir: Math.round((5 / 9) * 100),    // 56%
            long: Math.round((1 / 9) * 100),   // 11%
            short: Math.round((2 / 9) * 100),  // 22%
            left: 0,
            right: Math.round((1 / 9) * 100)   // 11%
        });
    });

    // ─── Putting Breakdown ─────────────────────────────────────

    it('calculates putting breakdown (1/2/3/3+)', () => {
        // Default round: 9 holes with putts
        // 1-putt: 2 (holes 2,7), 2-putt: 6 (holes 1,3,4,6,8,9), 3-putt: 1 (hole 5), 3+: 0
        const stats = computeStats([makeRound()]);
        expect(stats.puttingBreakdown).toEqual({
            onePutt: Math.round((2 / 9) * 100),   // 22%
            twoPutt: Math.round((6 / 9) * 100),   // 67%
            threePutt: Math.round((1 / 9) * 100),  // 11%
            threePlus: 0
        });
    });

    it('handles 4+ putt hole in putting breakdown', () => {
        const round = makeRound();
        round.holes[0].putts = 4; // 4-putt
        const stats = computeStats([round]);
        expect(stats.puttingBreakdown.threePlus).toBe(Math.round((1 / 9) * 100)); // 11%
    });

    // ─── Per-9 Normalized Stats ────────────────────────────────

    it('calculates puttsPer9 for a 9-hole round', () => {
        // Default: 17 putts over 9 holes → 17 / 9 * 9 = 17.0
        const stats = computeStats([makeRound()]);
        expect(stats.puttsPer9).toBe(17);
    });

    it('calculates puttsPer9 for an 18-hole round', () => {
        const round = makeRound();
        // Double the holes to simulate 18
        round.holes = [...round.holes, ...round.holes.map((h, i) => ({ ...h, number: i + 10 }))];
        round.numHoles = 18;
        // 34 putts over 18 holes → 34 / 18 * 9 = 17.0
        const stats = computeStats([round]);
        expect(stats.puttsPer9).toBe(17);
    });

    it('calculates penaltiesPer9', () => {
        const round = makeRound();
        round.holes[0].penalties = 1;
        round.holes[4].penalties = 2;
        // 3 penalties over 9 holes → 3 / 9 * 9 = 3.0
        const stats = computeStats([round]);
        expect(stats.penaltiesPer9).toBe(3);
    });

    it('calculates feetMadePer9', () => {
        const round = makeRound();
        round.holes[0].puttDistances = [20, 4];  // made=4
        round.holes[1].puttDistances = [8];       // made=8
        round.holes[2].puttDistances = [30, 6];   // made=6
        // 18 feet over 9 holes → 18 / 9 * 9 = 18.0
        const stats = computeStats([round]);
        expect(stats.feetMadePer9).toBe(18);
    });

    // ─── Par Conversion ────────────────────────────────────────

    it('calculates par conversion percentage', () => {
        // Default round: 5 GIR holes (2,3,4,7,9), all score ≤ par → 100%
        const stats = computeStats([makeRound()]);
        expect(stats.parConversionPct).toBe(100);
    });

    it('calculates par conversion with mixed results', () => {
        const round = makeRound();
        // Hole 4 (gir=true, par=4): change score to 5 → missed conversion
        round.holes[3].score = 5;
        round.totalScore = 41;
        const stats = computeStats([round]);
        // 4 of 5 GIR holes converted
        expect(stats.parConversionPct).toBe(80);
    });

    it('returns null parConversionPct with no GIR holes', () => {
        const round = makeRound();
        round.holes = round.holes.map(h => ({ ...h, gir: false, approachResult: 'short' }));
        const stats = computeStats([round]);
        expect(stats.parConversionPct).toBeNull();
    });

    // ─── Bogey Avoidance ───────────────────────────────────────

    it('calculates bogey avoidance percentage', () => {
        // Default round: holes at par or better: 2(3≤3), 3(5≤5), 4(4≤4), 7(4≤4), 9(4≤4) = 5 of 9
        const stats = computeStats([makeRound()]);
        expect(stats.bogeyAvoidancePct).toBe(Math.round((5 / 9) * 100)); // 56%
    });

    // ─── Bounce-back Rate ──────────────────────────────────────

    it('calculates bounce-back rate (par or better after bogey+)', () => {
        // Default: bogey holes are 1(+1), 5(+1), 6(+1), 8(+1)
        // After hole 1 → hole 2 (par) = bounce-back ✓
        // After hole 5 → hole 6 (bogey) = no bounce-back
        // After hole 6 → hole 7 (par) = bounce-back ✓
        // After hole 8 → hole 9 (par) = bounce-back ✓
        // 3 of 4 = 75%
        const stats = computeStats([makeRound()]);
        expect(stats.bounceBackRate).toBe(75);
    });

    it('detects bounce-back success with birdie', () => {
        const round = makeRound();
        // Hole 2 (after bogey on hole 1): make it a birdie
        round.holes[1].score = 2; // par 3, score 2 = birdie
        round.totalScore = 39;
        const stats = computeStats([round]);
        // Still 3 of 4 (birdie counts too)
        expect(stats.bounceBackRate).toBe(75);
    });

    it('does not count bogey after bogey as bounce-back', () => {
        const round = makeRound();
        // After hole 5 (bogey) → hole 6 is also bogey = not a bounce-back
        // Confirm hole 6 is bogey (score 4, par 3 = +1)
        expect(round.holes[5].score).toBe(4);
        expect(round.holes[5].par).toBe(3);
        const stats = computeStats([round]);
        // 3 of 4 — the one miss is hole 5→6
        expect(stats.bounceBackRate).toBe(75);
    });

    it('returns null bounceBackRate when no bogey+ holes', () => {
        const round = makeRound();
        // Make all holes par or better
        round.holes = round.holes.map(h => ({ ...h, score: h.par }));
        const stats = computeStats([round]);
        expect(stats.bounceBackRate).toBeNull();
    });

    // ─── Scoring by Par Type ───────────────────────────────────

    it('calculates scoring averages by par type', () => {
        // Default round:
        // Par 3s: holes 2(3), 6(4) → avg 3.5, vsPar +0.5
        // Par 4s: holes 1(5), 4(4), 5(5), 7(4), 9(4) → avg 4.4, vsPar +0.4
        // Par 5s: holes 3(5), 8(6) → avg 5.5, vsPar +0.5
        const stats = computeStats([makeRound()]);
        expect(stats.scoringByPar.par3.avg).toBe(3.5);
        expect(stats.scoringByPar.par3.vsPar).toBe(0.5);
        expect(stats.scoringByPar.par4.avg).toBe(4.4);
        expect(stats.scoringByPar.par4.vsPar).toBe(0.4);
        expect(stats.scoringByPar.par5.avg).toBe(5.5);
        expect(stats.scoringByPar.par5.vsPar).toBe(0.5);
    });

    it('returns null for missing par types', () => {
        const round = makeRound();
        round.holes = round.holes.map(h => ({ ...h, par: 4 }));
        const stats = computeStats([round]);
        expect(stats.scoringByPar.par3).toBeNull();
        expect(stats.scoringByPar.par4).not.toBeNull();
        expect(stats.scoringByPar.par5).toBeNull();
    });

    // ─── Scoring Distribution ──────────────────────────────────

    it('calculates scoring distribution', () => {
        // Default round:
        // Eagle+: 0, Birdie: 0, Par: 5 (holes 2,3,4,7,9), Bogey: 4 (holes 1,5,6,8), Double: 0, Triple+: 0
        const stats = computeStats([makeRound()]);
        const dist = stats.scoringDistribution;
        expect(dist.eagle).toBe(0);
        expect(dist.birdie).toBe(0);
        expect(dist.par).toBe(5);
        expect(dist.bogey).toBe(4);
        expect(dist.double).toBe(0);
        expect(dist.triple).toBe(0);
        expect(dist.total).toBe(9);
        expect(dist.parPct).toBe(Math.round((5 / 9) * 100)); // 56%
    });

    it('counts eagles and birdies in distribution', () => {
        const round = makeRound();
        round.holes[0].score = 2; // par 4 → eagle (-2)
        round.holes[1].score = 2; // par 3 → birdie (-1)
        const stats = computeStats([round]);
        expect(stats.scoringDistribution.eagle).toBe(1);
        expect(stats.scoringDistribution.birdie).toBe(1);
    });

    // ─── Putt Make Rate by Distance ─────────────────────────────

    it('classifies a made putt into correct bucket', () => {
        const round = makeRound();
        round.holes[0].puttDistances = [4]; // 1-putt from 4ft → 3-6ft bucket, made
        const stats = computeStats([round]);
        const bucket = stats.puttMakeRate.find(b => b.label === '3-6 ft');
        expect(bucket.attempts).toBe(1);
        expect(bucket.made).toBe(1);
        expect(bucket.pct).toBe(100);
    });

    it('classifies missed and made putts into separate buckets', () => {
        const round = makeRound();
        round.holes[0].puttDistances = [20, 4]; // miss from 20ft, make from 4ft
        const stats = computeStats([round]);
        const long = stats.puttMakeRate.find(b => b.label === '20+ ft');
        expect(long.attempts).toBe(1);
        expect(long.made).toBe(0);
        expect(long.pct).toBe(0);
        const short = stats.puttMakeRate.find(b => b.label === '3-6 ft');
        expect(short.attempts).toBe(1);
        expect(short.made).toBe(1);
    });

    it('accumulates across multiple holes', () => {
        const round = makeRound();
        round.holes[0].puttDistances = [8];  // make from 8ft → 6-10 bucket
        round.holes[1].puttDistances = [7];  // make from 7ft → 6-10 bucket
        round.holes[2].puttDistances = [9, 2]; // miss 9ft, make 2ft
        const stats = computeStats([round]);
        const mid = stats.puttMakeRate.find(b => b.label === '6-10 ft');
        expect(mid.attempts).toBe(3); // 8ft + 7ft + 9ft
        expect(mid.made).toBe(2);     // 8ft + 7ft
        expect(mid.pct).toBe(67);
        const tap = stats.puttMakeRate.find(b => b.label === 'Inside 3 ft');
        expect(tap.attempts).toBe(1);
        expect(tap.made).toBe(1);
    });

    it('returns null puttMakeRate when no puttDistances data', () => {
        const round = makeRound(); // no puttDistances on any hole by default
        const stats = computeStats([round]);
        expect(stats.puttMakeRate).toBeNull();
    });

    it('skips null distances in puttDistances array', () => {
        const round = makeRound();
        round.holes[0].puttDistances = [null, 3]; // null missed putt, make from 3ft
        const stats = computeStats([round]);
        const bucket = stats.puttMakeRate.find(b => b.label === '3-6 ft');
        expect(bucket.attempts).toBe(1);
        expect(bucket.made).toBe(1);
    });

    it('handles boundary: 3ft goes into 3-6 bucket', () => {
        const round = makeRound();
        round.holes[0].puttDistances = [3]; // exactly 3ft → 3-6 bucket
        const stats = computeStats([round]);
        expect(stats.puttMakeRate.find(b => b.label === 'Inside 3 ft').attempts).toBe(0);
        expect(stats.puttMakeRate.find(b => b.label === '3-6 ft').attempts).toBe(1);
    });

    it('handles boundary: 20ft goes into 20+ bucket', () => {
        const round = makeRound();
        round.holes[0].puttDistances = [20]; // exactly 20ft → 20+ bucket
        const stats = computeStats([round]);
        expect(stats.puttMakeRate.find(b => b.label === '15-20 ft').attempts).toBe(0);
        expect(stats.puttMakeRate.find(b => b.label === '20+ ft').attempts).toBe(1);
    });

    it('chip-in (empty puttDistances) does not affect buckets', () => {
        const round = makeRound();
        round.holes[0].puttDistances = [];
        round.holes[1].puttDistances = [5]; // one real putt
        const stats = computeStats([round]);
        const total = stats.puttMakeRate.reduce((sum, b) => sum + b.attempts, 0);
        expect(total).toBe(1);
    });

    // ─── Lag Putting ────────────────────────────────────────────

    it('counts 3-putt avoidance on lag putts', () => {
        const round = makeRound();
        round.holes[0].puttDistances = [25, 3]; // lag from 25ft, leave 3ft, 2 putts → avoided
        round.holes[0].putts = 2;
        round.holes[1].puttDistances = [30, 8, 1]; // lag from 30ft, 3 putts → NOT avoided
        round.holes[1].putts = 3;
        const stats = computeStats([round]);
        expect(stats.lagPutt3PuttAvoidPct).toBe(50); // 1 of 2
        expect(stats.lagPuttCount).toBe(2);
    });

    it('calculates avg lag leave distance', () => {
        const round = makeRound();
        round.holes[0].puttDistances = [25, 4]; // leave = 4ft
        round.holes[0].putts = 2;
        round.holes[1].puttDistances = [30, 6]; // leave = 6ft
        round.holes[1].putts = 2;
        const stats = computeStats([round]);
        expect(stats.lagPuttAvgLeave).toBe(5.0); // (4 + 6) / 2
    });

    it('ignores holes where first putt < 20ft for lag stats', () => {
        const round = makeRound();
        round.holes[0].puttDistances = [15, 3]; // NOT a lag putt
        round.holes[0].putts = 2;
        round.holes[1].puttDistances = [22, 4]; // lag putt
        round.holes[1].putts = 2;
        const stats = computeStats([round]);
        expect(stats.lagPuttCount).toBe(1);
        expect(stats.lagPuttAvgLeave).toBe(4.0);
    });

    it('returns null lag stats when no lag putt opportunities', () => {
        const round = makeRound();
        round.holes[0].puttDistances = [10, 3]; // not a lag putt
        round.holes[0].putts = 2;
        const stats = computeStats([round]);
        expect(stats.lagPutt3PuttAvoidPct).toBeNull();
        expect(stats.lagPuttAvgLeave).toBeNull();
        expect(stats.lagPuttCount).toBe(0);
    });

    it('edge: first putt exactly 20ft counts as lag putt', () => {
        const round = makeRound();
        round.holes[0].puttDistances = [20, 2]; // exactly 20ft → lag
        round.holes[0].putts = 2;
        const stats = computeStats([round]);
        expect(stats.lagPuttCount).toBe(1);
        expect(stats.lagPutt3PuttAvoidPct).toBe(100);
        expect(stats.lagPuttAvgLeave).toBe(2.0);
    });

    it('handles lag putt with 1 putt (made from 20+)', () => {
        const round = makeRound();
        round.holes[0].puttDistances = [25]; // made from 25ft, 1 putt
        round.holes[0].putts = 1;
        const stats = computeStats([round]);
        expect(stats.lagPuttCount).toBe(1);
        expect(stats.lagPutt3PuttAvoidPct).toBe(100);
        expect(stats.lagPuttAvgLeave).toBeNull(); // no second putt to measure
    });
});

// ─── computeHandicap ────────────────────────────────────────

describe('computeHandicap', () => {
    it('returns null with fewer than 3 rounds', () => {
        expect(computeHandicap([])).toBeNull();
        expect(computeHandicap([makeRound()])).toBeNull();
        expect(computeHandicap([makeRound(), makeRound()])).toBeNull();
    });

    it('returns null if rounds lack courseRating or slopeRating', () => {
        const rounds = [
            makeRound({ courseRating: null, slopeRating: 113 }),
            makeRound({ courseRating: 35.5, slopeRating: null }),
            makeRound({ courseRating: null, slopeRating: null }),
        ];
        expect(computeHandicap(rounds)).toBeNull();
    });

    it('calculates handicap with 3 rounds (uses 1 best differential)', () => {
        // differential = ((totalScore - courseRating) * 113) / slopeRating
        // Round 1: ((40 - 35.5) * 113) / 113 = 4.5
        // Round 2: ((38 - 35.5) * 113) / 113 = 2.5
        // Round 3: ((42 - 35.5) * 113) / 113 = 6.5
        // Best 1: 2.5 × 0.96 = 2.4
        const rounds = [
            makeRound({ id: '1', totalScore: 40, courseRating: 35.5, slopeRating: 113 }),
            makeRound({ id: '2', totalScore: 38, courseRating: 35.5, slopeRating: 113 }),
            makeRound({ id: '3', totalScore: 42, courseRating: 35.5, slopeRating: 113 }),
        ];
        expect(computeHandicap(rounds)).toBe(2.4);
    });

    it('uses 2 best differentials with 4-5 rounds', () => {
        const rounds = [
            makeRound({ id: '1', totalScore: 40, courseRating: 35.5, slopeRating: 113 }),
            makeRound({ id: '2', totalScore: 38, courseRating: 35.5, slopeRating: 113 }),
            makeRound({ id: '3', totalScore: 42, courseRating: 35.5, slopeRating: 113 }),
            makeRound({ id: '4', totalScore: 39, courseRating: 35.5, slopeRating: 113 }),
        ];
        // Differentials: 4.5, 2.5, 6.5, 3.5 → sorted: 2.5, 3.5, 4.5, 6.5
        // Best 2: (2.5 + 3.5) / 2 × 0.96 = 2.88
        expect(computeHandicap(rounds)).toBe(2.9);
    });

    it('excludes casual rounds from handicap', () => {
        const rounds = [
            makeRound({ id: '1', totalScore: 40, courseRating: 35.5, slopeRating: 113, roundType: 'normal' }),
            makeRound({ id: '2', totalScore: 38, courseRating: 35.5, slopeRating: 113, roundType: 'normal' }),
            makeRound({ id: '3', totalScore: 42, courseRating: 35.5, slopeRating: 113, roundType: 'normal' }),
            makeRound({ id: '4', totalScore: 30, courseRating: 35.5, slopeRating: 113, roundType: 'casual' }),
        ];
        // Casual round (id 4) should be ignored — same result as 3 normal rounds
        // Best 1 of 3: diff 2.5 × 0.96 = 2.4
        expect(computeHandicap(rounds)).toBe(2.4);
    });

    it('excludes scramble rounds from handicap', () => {
        const rounds = [
            makeRound({ id: '1', totalScore: 40, courseRating: 35.5, slopeRating: 113, roundType: 'normal' }),
            makeRound({ id: '2', totalScore: 38, courseRating: 35.5, slopeRating: 113, roundType: 'normal' }),
            makeRound({ id: '3', totalScore: 42, courseRating: 35.5, slopeRating: 113, roundType: 'scramble' }),
        ];
        // Only 2 eligible rounds — not enough
        expect(computeHandicap(rounds)).toBeNull();
    });

    it('includes league rounds in handicap', () => {
        const rounds = [
            makeRound({ id: '1', totalScore: 40, courseRating: 35.5, slopeRating: 113, roundType: 'league' }),
            makeRound({ id: '2', totalScore: 38, courseRating: 35.5, slopeRating: 113, roundType: 'league' }),
            makeRound({ id: '3', totalScore: 42, courseRating: 35.5, slopeRating: 113, roundType: 'normal' }),
        ];
        // All 3 eligible — same as 3 normal rounds
        expect(computeHandicap(rounds)).toBe(2.4);
    });

    it('treats rounds without roundType as normal (backward compat)', () => {
        const rounds = [
            makeRound({ id: '1', totalScore: 40, courseRating: 35.5, slopeRating: 113 }),
            makeRound({ id: '2', totalScore: 38, courseRating: 35.5, slopeRating: 113 }),
            makeRound({ id: '3', totalScore: 42, courseRating: 35.5, slopeRating: 113 }),
        ];
        // No roundType field → treated as 'normal' → eligible
        expect(computeHandicap(rounds)).toBe(2.4);
    });

    it('applies correct differential formula with different slope', () => {
        const rounds = [
            makeRound({ id: '1', totalScore: 85, courseRating: 72.0, slopeRating: 130 }),
            makeRound({ id: '2', totalScore: 82, courseRating: 72.0, slopeRating: 130 }),
            makeRound({ id: '3', totalScore: 88, courseRating: 72.0, slopeRating: 130 }),
        ];
        // differential = ((score - 72) * 113) / 130
        // R1: (13 * 113) / 130 = 11.3
        // R2: (10 * 113) / 130 = 8.692...
        // R3: (16 * 113) / 130 = 13.907...
        // Best 1: 8.692... × 0.96 = 8.3...
        const result = computeHandicap(rounds);
        expect(result).toBeCloseTo(8.3, 0);
    });
});

// ─── filterRounds ───────────────────────────────────────────

describe('filterRounds', () => {
    const rounds = [
        makeRound({ id: '1', date: '2025-01-10' }),
        makeRound({ id: '2', date: '2025-03-15' }),
        makeRound({ id: '3', date: '2025-06-20' }),
        makeRound({ id: '4', date: '2025-09-05' }),
        makeRound({ id: '5', date: '2025-12-01' }),
    ];

    it('returns all rounds sorted by date (newest first) when no filters', () => {
        const result = filterRounds(rounds);
        expect(result).toHaveLength(5);
        expect(result[0].id).toBe('5');
        expect(result[4].id).toBe('1');
    });

    it('filters by start date', () => {
        const result = filterRounds(rounds, { startDate: '2025-06-01' });
        expect(result).toHaveLength(3);
        expect(result.every(r => r.date >= '2025-06-01')).toBe(true);
    });

    it('filters by end date', () => {
        const result = filterRounds(rounds, { endDate: '2025-06-30' });
        expect(result).toHaveLength(3);
        expect(result.every(r => r.date <= '2025-06-30')).toBe(true);
    });

    it('filters by date range', () => {
        const result = filterRounds(rounds, { startDate: '2025-03-01', endDate: '2025-09-30' });
        expect(result).toHaveLength(3);
        expect(result.map(r => r.id)).toEqual(['4', '3', '2']);
    });

    it('limits to N most recent rounds', () => {
        const result = filterRounds(rounds, { count: '3' });
        expect(result).toHaveLength(3);
        expect(result.map(r => r.id)).toEqual(['5', '4', '3']);
    });

    it('passes through count="all" without limiting', () => {
        const result = filterRounds(rounds, { count: 'all' });
        expect(result).toHaveLength(5);
    });

    it('combines date and count filters', () => {
        const result = filterRounds(rounds, { startDate: '2025-01-01', count: '2' });
        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('5');
        expect(result[1].id).toBe('4');
    });

    it('does not mutate the original array', () => {
        const original = [...rounds];
        filterRounds(rounds, { count: '2' });
        expect(rounds).toEqual(original);
    });

    // ─── Course filter ───────────────────────────────────────

    it('filters by courseId', () => {
        const mixed = [
            makeRound({ id: 'a', courseId: 'c1', date: '2025-01-10' }),
            makeRound({ id: 'b', courseId: 'c2', date: '2025-02-10' }),
            makeRound({ id: 'c', courseId: 'c1', date: '2025-03-10' }),
        ];
        const result = filterRounds(mixed, { courseId: 'c1' });
        expect(result).toHaveLength(2);
        expect(result.every(r => r.courseId === 'c1')).toBe(true);
    });

    it('passes through courseId="all" without filtering', () => {
        const mixed = [
            makeRound({ id: 'a', courseId: 'c1', date: '2025-01-10' }),
            makeRound({ id: 'b', courseId: 'c2', date: '2025-02-10' }),
        ];
        const result = filterRounds(mixed, { courseId: 'all' });
        expect(result).toHaveLength(2);
    });

    // ─── Round type filter ───────────────────────────────────

    it('filters by roundType', () => {
        const mixed = [
            makeRound({ id: 'a', roundType: 'normal', date: '2025-01-10' }),
            makeRound({ id: 'b', roundType: 'league', date: '2025-02-10' }),
            makeRound({ id: 'c', roundType: 'normal', date: '2025-03-10' }),
        ];
        const result = filterRounds(mixed, { roundType: 'league' });
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('b');
    });

    it('treats missing roundType as "normal"', () => {
        const mixed = [
            makeRound({ id: 'a', date: '2025-01-10' }), // no roundType → defaults to normal
            makeRound({ id: 'b', roundType: 'league', date: '2025-02-10' }),
        ];
        const result = filterRounds(mixed, { roundType: 'normal' });
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('a');
    });

    it('passes through roundType="all" without filtering', () => {
        const mixed = [
            makeRound({ id: 'a', roundType: 'normal', date: '2025-01-10' }),
            makeRound({ id: 'b', roundType: 'league', date: '2025-02-10' }),
        ];
        const result = filterRounds(mixed, { roundType: 'all' });
        expect(result).toHaveLength(2);
    });

    it('combines courseId and roundType filters', () => {
        const mixed = [
            makeRound({ id: 'a', courseId: 'c1', roundType: 'normal', date: '2025-01-10' }),
            makeRound({ id: 'b', courseId: 'c1', roundType: 'league', date: '2025-02-10' }),
            makeRound({ id: 'c', courseId: 'c2', roundType: 'league', date: '2025-03-10' }),
            makeRound({ id: 'd', courseId: 'c2', roundType: 'normal', date: '2025-04-10' }),
        ];
        const result = filterRounds(mixed, { courseId: 'c1', roundType: 'league' });
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('b');
    });

    it('combines courseId, roundType, and count', () => {
        const mixed = [
            makeRound({ id: 'a', courseId: 'c1', roundType: 'league', date: '2025-01-10' }),
            makeRound({ id: 'b', courseId: 'c1', roundType: 'league', date: '2025-02-10' }),
            makeRound({ id: 'c', courseId: 'c1', roundType: 'league', date: '2025-03-10' }),
        ];
        const result = filterRounds(mixed, { courseId: 'c1', roundType: 'league', count: '2' });
        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('c'); // most recent first
        expect(result[1].id).toBe('b');
    });
});

// ─── buildRoundSummary ──────────────────────────────────────

describe('buildRoundSummary', () => {
    it('calculates total par from holes', () => {
        const round = makeRound();
        const summary = buildRoundSummary(round);
        // Par: 4+3+5+4+4+3+4+5+4 = 36
        expect(summary.totalPar).toBe(36);
    });

    it('calculates score difference', () => {
        const round = makeRound({ totalScore: 40 });
        const summary = buildRoundSummary(round);
        expect(summary.diff).toBe(4); // 40 - 36
        expect(summary.diffStr).toBe('+4');
    });

    it('shows "E" for even par', () => {
        const round = makeRound({ totalScore: 36 });
        const summary = buildRoundSummary(round);
        expect(summary.diff).toBe(0);
        expect(summary.diffStr).toBe('E');
    });

    it('shows negative number for under par', () => {
        const round = makeRound({ totalScore: 34 });
        const summary = buildRoundSummary(round);
        expect(summary.diff).toBe(-2);
        expect(summary.diffStr).toBe('-2');
    });

    it('counts total putts', () => {
        const round = makeRound();
        const summary = buildRoundSummary(round);
        // Putts: 2+1+2+2+3+2+1+2+2 = 17
        expect(summary.putts).toBe(17);
    });

    it('counts fairways hit (non-par-3 with fairwayHit)', () => {
        const round = makeRound();
        const summary = buildRoundSummary(round);
        expect(summary.fairways).toBe(4); // holes 1,4,7,9
        expect(summary.fairwayTotal).toBe(7); // 7 non-par-3 holes with fairwayDirection
    });

    it('counts GIRs', () => {
        const round = makeRound();
        const summary = buildRoundSummary(round);
        expect(summary.girs).toBe(5); // holes 2,3,4,7,9
    });

    it('calculates feetOfPuttsMade for a round', () => {
        const round = makeRound();
        round.holes[0].puttDistances = [20, 3];  // made=3
        round.holes[6].puttDistances = [15];      // made=15
        const summary = buildRoundSummary(round);
        expect(summary.feetOfPuttsMade).toBe(18); // 3 + 15
    });

    it('returns 0 feetOfPuttsMade when no puttDistances exist', () => {
        const round = makeRound();
        const summary = buildRoundSummary(round);
        expect(summary.feetOfPuttsMade).toBe(0);
    });

    it('counts bunker holes and sand saves', () => {
        const round = makeRound();
        round.holes[0].bunker = true; // score 5, par 4 — no save
        round.holes[1].bunker = true; // score 3, par 3 — save
        const summary = buildRoundSummary(round);
        expect(summary.bunkerHoles).toBe(2);
        expect(summary.sandSaves).toBe(1);
    });

    it('returns 0 bunkerHoles when no bunkers', () => {
        const round = makeRound();
        const summary = buildRoundSummary(round);
        expect(summary.bunkerHoles).toBe(0);
        expect(summary.sandSaves).toBe(0);
    });
});

// ─── reorderArray ──────────────────────────────────────────

describe('reorderArray', () => {
    it('moves item forward (lower index to higher)', () => {
        const arr = ['A', 'B', 'C', 'D'];
        reorderArray(arr, 0, 2);
        expect(arr).toEqual(['B', 'C', 'A', 'D']);
    });

    it('moves item backward (higher index to lower)', () => {
        const arr = ['A', 'B', 'C', 'D'];
        reorderArray(arr, 3, 1);
        expect(arr).toEqual(['A', 'D', 'B', 'C']);
    });

    it('no-ops when fromIdx equals toIdx', () => {
        const arr = ['A', 'B', 'C'];
        reorderArray(arr, 1, 1);
        expect(arr).toEqual(['A', 'B', 'C']);
    });

    it('no-ops when index is out of bounds', () => {
        const arr = ['A', 'B', 'C'];
        reorderArray(arr, -1, 2);
        expect(arr).toEqual(['A', 'B', 'C']);
        reorderArray(arr, 0, 5);
        expect(arr).toEqual(['A', 'B', 'C']);
    });

    it('handles moving first to last', () => {
        const arr = ['A', 'B', 'C', 'D'];
        reorderArray(arr, 0, 3);
        expect(arr).toEqual(['B', 'C', 'D', 'A']);
    });

    it('handles moving last to first', () => {
        const arr = ['A', 'B', 'C', 'D'];
        reorderArray(arr, 3, 0);
        expect(arr).toEqual(['D', 'A', 'B', 'C']);
    });

    it('preserves array length', () => {
        const arr = ['A', 'B', 'C', 'D', 'E'];
        reorderArray(arr, 1, 4);
        expect(arr).toHaveLength(5);
    });

    it('works with single-element array', () => {
        const arr = ['A'];
        reorderArray(arr, 0, 0);
        expect(arr).toEqual(['A']);
    });
});

// ─── getGoalStatus ─────────────────────────────────────────

describe('getGoalStatus', () => {
    // Higher-is-better
    it('returns far-above when well above goal (higher)', () => {
        expect(getGoalStatus(75, 60, 'higher', 10)).toBe('far-above');
    });

    it('returns above when at or above goal (higher)', () => {
        expect(getGoalStatus(63, 60, 'higher', 10)).toBe('above');
    });

    it('returns above when exactly at goal (higher)', () => {
        expect(getGoalStatus(60, 60, 'higher', 10)).toBe('above');
    });

    it('returns below when slightly below goal (higher)', () => {
        expect(getGoalStatus(55, 60, 'higher', 10)).toBe('below');
    });

    it('returns far-below when well below goal (higher)', () => {
        expect(getGoalStatus(40, 60, 'higher', 10)).toBe('far-below');
    });

    it('edge: exactly at target - buffer is below (higher)', () => {
        expect(getGoalStatus(50, 60, 'higher', 10)).toBe('below');
    });

    it('edge: exactly at target + buffer is far-above (higher)', () => {
        expect(getGoalStatus(70, 60, 'higher', 10)).toBe('far-above');
    });

    // Lower-is-better
    it('returns far-above when well below goal (lower)', () => {
        expect(getGoalStatus(13, 16, 'lower', 2)).toBe('far-above');
    });

    it('returns above when at or below goal (lower)', () => {
        expect(getGoalStatus(15.5, 16, 'lower', 2)).toBe('above');
    });

    it('returns below when slightly above goal (lower)', () => {
        expect(getGoalStatus(17, 16, 'lower', 2)).toBe('below');
    });

    it('returns far-below when well above goal (lower)', () => {
        expect(getGoalStatus(19, 16, 'lower', 2)).toBe('far-below');
    });

    // Null handling
    it('returns null when value is null', () => {
        expect(getGoalStatus(null, 60, 'higher', 10)).toBeNull();
    });

    it('returns null when target is null', () => {
        expect(getGoalStatus(55, null, 'higher', 10)).toBeNull();
    });

    it('returns null when value is undefined', () => {
        expect(getGoalStatus(undefined, 60, 'higher', 10)).toBeNull();
    });
});

// ─── GOAL_DEFS ─────────────────────────────────────────────

describe('GOAL_DEFS', () => {
    it('has definitions for all 16 goal-eligible KPIs', () => {
        expect(Object.keys(GOAL_DEFS)).toHaveLength(16);
    });

    it('all entries have required fields', () => {
        for (const [key, def] of Object.entries(GOAL_DEFS)) {
            expect(def).toHaveProperty('direction');
            expect(def).toHaveProperty('buffer');
            expect(def).toHaveProperty('label');
            expect(def).toHaveProperty('unit');
            expect(['higher', 'lower']).toContain(def.direction);
            expect(def.buffer).toBeGreaterThan(0);
        }
    });
});

// ─── computeTrendData ───────────────────────────────────────

describe('computeTrendData', () => {
    it('returns empty array for no rounds', () => {
        expect(computeTrendData([], 'avgScore')).toEqual([]);
        expect(computeTrendData(null, 'avgScore')).toEqual([]);
    });

    it('returns empty array for invalid kpiKey', () => {
        expect(computeTrendData([makeRound()], 'bogusKey')).toEqual([]);
    });

    it('returns per-round avgScore sorted oldest-first', () => {
        const rounds = [
            makeRound({ id: '2', date: '2025-07-01', totalScore: 42 }),
            makeRound({ id: '1', date: '2025-06-15', totalScore: 40 }),
        ];
        const result = computeTrendData(rounds, 'avgScore');
        expect(result).toHaveLength(2);
        expect(result[0].date).toBe('2025-06-15');
        expect(result[0].value).toBe(40);
        expect(result[1].date).toBe('2025-07-01');
        expect(result[1].value).toBe(42);
    });

    it('returns per-round puttsPer9', () => {
        const round = makeRound({ date: '2025-06-15' });
        // Default holes: putts 2,1,2,2,3,2,1,2,2 = 17 total, 9 holes → 17/9*9 = 17.0
        const result = computeTrendData([round], 'puttsPer9');
        expect(result).toHaveLength(1);
        expect(result[0].value).toBe(17);
    });

    it('returns per-round fairwayPct', () => {
        const round = makeRound({ date: '2025-06-15' });
        // Default: 7 non-par-3 holes, 4 fairways hit → 57%
        const result = computeTrendData([round], 'fairwayPct');
        expect(result).toHaveLength(1);
        expect(result[0].value).toBe(57);
    });

    it('returns null for fairway on par-3-only round', () => {
        const par3Round = makeRound({
            date: '2025-06-15',
            numHoles: 1,
            holes: [makeHole({ number: 1, par: 3, score: 3, fairwayHit: false, fairwayDirection: null })],
            totalScore: 3
        });
        const result = computeTrendData([par3Round], 'fairwayPct');
        expect(result[0].value).toBeNull();
    });

    it('computes rolling handicap trend', () => {
        const rounds = [
            makeRound({ id: '1', date: '2025-06-01', totalScore: 40, courseRating: 35.5, slopeRating: 113 }),
            makeRound({ id: '2', date: '2025-06-08', totalScore: 42, courseRating: 35.5, slopeRating: 113 }),
            makeRound({ id: '3', date: '2025-06-15', totalScore: 38, courseRating: 35.5, slopeRating: 113 }),
        ];
        const result = computeTrendData(rounds, 'handicap');
        expect(result).toHaveLength(3);
        // First two: < 3 eligible → null
        expect(result[0].value).toBeNull();
        expect(result[1].value).toBeNull();
        // Third: 3 eligible → real number
        expect(result[2].value).not.toBeNull();
        expect(typeof result[2].value).toBe('number');
    });

    it('TREND_KPIS has 6 entries', () => {
        expect(Object.keys(TREND_KPIS)).toHaveLength(6);
    });
});

// ─── computeMovingAverage ───────────────────────────────────

describe('computeMovingAverage', () => {
    it('returns empty array for empty input', () => {
        expect(computeMovingAverage([], 5)).toEqual([]);
    });

    it('handles single data point', () => {
        const data = [{ date: '2025-06-15', value: 40 }];
        const result = computeMovingAverage(data, 5);
        expect(result).toHaveLength(1);
        expect(result[0].value).toBe(40);
    });

    it('computes correct moving average with window of 3', () => {
        const data = [
            { date: '2025-06-01', value: 40 },
            { date: '2025-06-08', value: 42 },
            { date: '2025-06-15', value: 38 },
            { date: '2025-06-22', value: 44 },
        ];
        const result = computeMovingAverage(data, 3);
        expect(result[0].value).toBe(40);       // [40] → 40
        expect(result[1].value).toBe(41);        // [42, 40] → 41
        expect(result[2].value).toBe(40);        // [38, 42, 40] → 40
        expect(result[3].value).toBe(41.3);      // [44, 38, 42] → 41.33 → 41.3
    });

    it('skips null values in window', () => {
        const data = [
            { date: '2025-06-01', value: 40 },
            { date: '2025-06-08', value: null },
            { date: '2025-06-15', value: 38 },
        ];
        const result = computeMovingAverage(data, 3);
        // idx 2: finds 38 (idx2), skips null (idx1), finds 40 (idx0) → (38+40)/2 = 39
        expect(result[2].value).toBe(39);
    });

    it('returns null for all-null input', () => {
        const data = [
            { date: '2025-06-01', value: null },
            { date: '2025-06-08', value: null },
        ];
        const result = computeMovingAverage(data, 5);
        expect(result[0].value).toBeNull();
        expect(result[1].value).toBeNull();
    });

    it('defaults to window of 5', () => {
        const data = Array.from({ length: 7 }, (_, i) => ({ date: `2025-06-${String(i + 1).padStart(2, '0')}`, value: 10 * (i + 1) }));
        // values: 10, 20, 30, 40, 50, 60, 70
        const result = computeMovingAverage(data);
        // idx 4: [50, 40, 30, 20, 10] → 30
        expect(result[4].value).toBe(30);
        // idx 6: [70, 60, 50, 40, 30] → 50
        expect(result[6].value).toBe(50);
    });
});
