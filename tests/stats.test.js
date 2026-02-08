import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { computeStats, computeHandicap, filterRounds, buildRoundSummary } = require('../js/stats.js');

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
        sandSave: false,
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
});
