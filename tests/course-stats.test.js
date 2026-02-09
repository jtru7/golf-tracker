import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { computeCourseStats } = require('../js/stats.js');

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

// Helper: create a minimal course object
function makeCourse(overrides = {}) {
    return {
        id: 'c1',
        name: 'Test Course',
        location: 'Test City, TS',
        numHoles: 9,
        holes: [
            { number: 1, par: 4 },
            { number: 2, par: 3 },
            { number: 3, par: 5 },
            { number: 4, par: 4 },
            { number: 5, par: 4 },
            { number: 6, par: 3 },
            { number: 7, par: 4 },
            { number: 8, par: 5 },
            { number: 9, par: 4 },
        ],
        tees: { white: { enabled: true, rating: 35.5, slope: 113, totalYardage: 3200 } },
        ...overrides
    };
}

// ─── computeCourseStats ─────────────────────────────────────

describe('computeCourseStats', () => {

    // ─── Edge Cases ──────────────────────────────────────────

    it('returns zero roundsPlayed and null stats when no rounds match', () => {
        const course = makeCourse();
        const result = computeCourseStats('c1', [], course);
        expect(result.roundsPlayed).toBe(0);
        expect(result.avgScore).toBeNull();
        expect(result.vsPar).toBeNull();
        expect(result.bestRound).toBeNull();
        expect(result.worstRound).toBeNull();
        expect(result.holeStats).toHaveLength(9);
        expect(result.holeStats[0].scoringAvg).toBeNull();
        expect(result.hardestHoles).toHaveLength(0);
        expect(result.easiestHoles).toHaveLength(0);
    });

    it('filters rounds to only matching courseId', () => {
        const course = makeCourse();
        const rounds = [
            makeRound({ id: 'r1', courseId: 'c1', totalScore: 40 }),
            makeRound({ id: 'r2', courseId: 'c2', totalScore: 50 }),
            makeRound({ id: 'r3', courseId: 'c1', totalScore: 38 }),
        ];
        const result = computeCourseStats('c1', rounds, course);
        expect(result.roundsPlayed).toBe(2);
        expect(result.avgScore).toBe(39);
    });

    it('includes all round types (casual, scramble, etc.)', () => {
        const course = makeCourse();
        const rounds = [
            makeRound({ id: 'r1', courseId: 'c1', totalScore: 40, roundType: 'normal' }),
            makeRound({ id: 'r2', courseId: 'c1', totalScore: 38, roundType: 'casual' }),
            makeRound({ id: 'r3', courseId: 'c1', totalScore: 42, roundType: 'scramble' }),
        ];
        const result = computeCourseStats('c1', rounds, course);
        expect(result.roundsPlayed).toBe(3);
        expect(result.avgScore).toBe(40);
    });

    // ─── Course-Level Stats ──────────────────────────────────

    it('calculates totalPar and vsPar correctly', () => {
        const course = makeCourse(); // totalPar = 36
        const rounds = [makeRound({ courseId: 'c1', totalScore: 40 })];
        const result = computeCourseStats('c1', rounds, course);
        expect(result.totalPar).toBe(36);
        expect(result.vsPar).toBe(4); // 40 - 36
    });

    it('identifies best and worst rounds with dates', () => {
        const course = makeCourse();
        const rounds = [
            makeRound({ id: 'r1', courseId: 'c1', totalScore: 40, date: '2025-06-01' }),
            makeRound({ id: 'r2', courseId: 'c1', totalScore: 34, date: '2025-06-15' }),
            makeRound({ id: 'r3', courseId: 'c1', totalScore: 45, date: '2025-07-01' }),
        ];
        const result = computeCourseStats('c1', rounds, course);
        expect(result.bestRound.score).toBe(34);
        expect(result.bestRound.date).toBe('2025-06-15');
        expect(result.worstRound.score).toBe(45);
        expect(result.worstRound.date).toBe('2025-07-01');
    });

    it('single round: best equals worst', () => {
        const course = makeCourse();
        const rounds = [makeRound({ id: 'r1', courseId: 'c1', totalScore: 40 })];
        const result = computeCourseStats('c1', rounds, course);
        expect(result.bestRound.score).toBe(40);
        expect(result.worstRound.score).toBe(40);
    });

    it('delegates to computeStats for courseStats', () => {
        const course = makeCourse();
        const rounds = [makeRound({ courseId: 'c1' })];
        const result = computeCourseStats('c1', rounds, course);
        expect(result.courseStats).toHaveProperty('fairwayPct');
        expect(result.courseStats).toHaveProperty('girPct');
        expect(result.courseStats).toHaveProperty('puttsPer9');
        expect(result.courseStats).toHaveProperty('scramblingPct');
    });

    // ─── Hole-Level Stats ────────────────────────────────────

    it('calculates per-hole scoring average and vsPar', () => {
        const course = makeCourse();
        const rounds = [makeRound({ courseId: 'c1' })];
        const result = computeCourseStats('c1', rounds, course);
        // Hole 1: par 4, score 5 → avg 5.0, vsPar +1.0
        expect(result.holeStats[0].scoringAvg).toBe(5);
        expect(result.holeStats[0].vsPar).toBe(1);
        // Hole 2: par 3, score 3 → avg 3.0, vsPar 0
        expect(result.holeStats[1].scoringAvg).toBe(3);
        expect(result.holeStats[1].vsPar).toBe(0);
    });

    it('calculates per-hole scoring distribution', () => {
        const course = makeCourse();
        const rounds = [makeRound({ courseId: 'c1' })];
        const result = computeCourseStats('c1', rounds, course);
        // Hole 1: score 5 on par 4 = bogey
        expect(result.holeStats[0].distribution.bogey).toBe(1);
        expect(result.holeStats[0].distribution.par).toBe(0);
        // Hole 2: score 3 on par 3 = par
        expect(result.holeStats[1].distribution.par).toBe(1);
    });

    it('calculates per-hole fairway percentage (null for par 3s)', () => {
        const course = makeCourse();
        const rounds = [makeRound({ courseId: 'c1' })];
        const result = computeCourseStats('c1', rounds, course);
        // Hole 1: par 4, fairwayHit=true → 100%
        expect(result.holeStats[0].fairwayPct).toBe(100);
        // Hole 2: par 3 → null
        expect(result.holeStats[1].fairwayPct).toBeNull();
    });

    it('identifies most common fairway miss direction', () => {
        const course = makeCourse();
        const r1 = makeRound({ id: 'r1', courseId: 'c1' });
        const r2 = makeRound({ id: 'r2', courseId: 'c1' });
        const r3 = makeRound({ id: 'r3', courseId: 'c1' });
        // Hole 3 (par 5): r1 miss left, r2 miss left, r3 miss right
        r1.holes[2].fairwayHit = false; r1.holes[2].fairwayDirection = 'left';
        r2.holes[2].fairwayHit = false; r2.holes[2].fairwayDirection = 'left';
        r3.holes[2].fairwayHit = false; r3.holes[2].fairwayDirection = 'right';
        const result = computeCourseStats('c1', [r1, r2, r3], course);
        expect(result.holeStats[2].fairwayMissDir).toBe('left');
    });

    it('calculates per-hole GIR percentage', () => {
        const course = makeCourse();
        const rounds = [makeRound({ courseId: 'c1' })];
        const result = computeCourseStats('c1', rounds, course);
        // Hole 4: gir=true → 100%
        expect(result.holeStats[3].girPct).toBe(100);
        // Hole 1: gir=false → 0%
        expect(result.holeStats[0].girPct).toBe(0);
    });

    it('identifies most common GIR miss direction', () => {
        const course = makeCourse();
        const r1 = makeRound({ id: 'r1', courseId: 'c1' });
        const r2 = makeRound({ id: 'r2', courseId: 'c1' });
        // Hole 1: both miss short
        r1.holes[0].gir = false; r1.holes[0].approachResult = 'short';
        r2.holes[0].gir = false; r2.holes[0].approachResult = 'short';
        const result = computeCourseStats('c1', [r1, r2], course);
        expect(result.holeStats[0].girMissDir).toBe('short');
    });

    it('calculates per-hole average putts', () => {
        const course = makeCourse();
        const rounds = [makeRound({ courseId: 'c1' })];
        const result = computeCourseStats('c1', rounds, course);
        // Hole 5: putts = 3
        expect(result.holeStats[4].avgPutts).toBe(3);
        // Hole 7: putts = 1
        expect(result.holeStats[6].avgPutts).toBe(1);
    });

    it('aggregates across multiple rounds for hole-level stats', () => {
        const course = makeCourse();
        const r1 = makeRound({ id: 'r1', courseId: 'c1' });
        const r2 = makeRound({ id: 'r2', courseId: 'c1' });
        r2.holes[0].score = 3; // Hole 1, par 4, birdie
        const result = computeCourseStats('c1', [r1, r2], course);
        // Hole 1: scores 5 and 3 → avg 4.0, vsPar 0
        expect(result.holeStats[0].scoringAvg).toBe(4);
        expect(result.holeStats[0].vsPar).toBe(0);
        expect(result.holeStats[0].roundsWithData).toBe(2);
    });

    // ─── Hardest/Easiest Ranking ─────────────────────────────

    it('ranks hardest holes by vsPar descending', () => {
        const course = makeCourse();
        const rounds = [makeRound({ courseId: 'c1' })];
        const result = computeCourseStats('c1', rounds, course);
        // Bogey holes (vsPar=+1): 1, 5, 6, 8 — top 3 returned
        expect(result.hardestHoles).toHaveLength(3);
        result.hardestHoles.forEach(h => {
            expect(h.vsPar).toBeGreaterThan(0);
        });
    });

    it('ranks easiest holes by vsPar ascending', () => {
        const course = makeCourse();
        const rounds = [makeRound({ courseId: 'c1' })];
        const result = computeCourseStats('c1', rounds, course);
        // Par holes (vsPar=0): 2, 3, 4, 7, 9 — top 3 returned
        expect(result.easiestHoles).toHaveLength(3);
        result.easiestHoles.forEach(h => {
            expect(h.vsPar).toBeLessThanOrEqual(0);
        });
    });
});
