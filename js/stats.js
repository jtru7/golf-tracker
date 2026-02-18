// Pure calculation functions — no DOM access
// Used by app.js in the browser and imported by Vitest for testing

function computeStats(rounds) {
    if (rounds.length === 0) {
        return {
            avgScore: null, fairwayPct: null, girPct: null, avgPutts: null,
            scramblingPct: null, sandSavePct: null, feetOfPuttsMade: null, avgFirstPuttDist: null,
            fairwayDist: null, approachDist: null, puttingBreakdown: null,
            puttsPer9: null, feetMadePer9: null, penaltiesPer9: null,
            parConversionPct: null, bogeyAvoidancePct: null, bounceBackRate: null,
            scoringByPar: null, scoringDistribution: null,
            puttMakeRate: null, lagPutt3PuttAvoidPct: null, lagPuttAvgLeave: null, lagPuttCount: 0
        };
    }

    const totalScores = rounds.map(r => r.totalScore);
    const avgScore = parseFloat((totalScores.reduce((a, b) => a + b, 0) / totalScores.length).toFixed(1));

    let totalFairways = 0, fairwayOpportunities = 0;
    let fairwayLeft = 0, fairwayRight = 0;
    let totalGir = 0, girOpportunities = 0;
    let approachLong = 0, approachShort = 0, approachLeft = 0, approachRight = 0;
    let totalPutts = 0, totalHoles = 0, totalPenalties = 0;
    let scramblingSuccess = 0, scramblingOpportunities = 0;
    let sandSaveSuccess = 0, sandSaveOpportunities = 0;
    let totalFeetOfPuttsMade = 0, holesWithMadePuttDist = 0;
    let totalFirstPuttDist = 0, holesWithFirstPuttDist = 0;
    let onePutt = 0, twoPutt = 0, threePutt = 0, threePlusPutt = 0, holesWithPutts = 0;
    let parConversionSuccess = 0;
    let bogeyAvoidanceCount = 0;
    let bounceBackOpps = 0, bounceBackSuccess = 0;
    let par3Total = 0, par3Count = 0, par4Total = 0, par4Count = 0, par5Total = 0, par5Count = 0;
    let eagleOrBetter = 0, birdies = 0, pars = 0, bogeys = 0, doubles = 0, triplePlus = 0;

    // Putt make rate by distance buckets
    const puttBuckets = [
        { label: 'Inside 3 ft', min: 0, max: 3, attempts: 0, made: 0 },
        { label: '3-6 ft',      min: 3, max: 6, attempts: 0, made: 0 },
        { label: '6-10 ft',     min: 6, max: 10, attempts: 0, made: 0 },
        { label: '10-15 ft',    min: 10, max: 15, attempts: 0, made: 0 },
        { label: '15-20 ft',    min: 15, max: 20, attempts: 0, made: 0 },
        { label: '20+ ft',      min: 20, max: Infinity, attempts: 0, made: 0 },
    ];
    let hasPuttDistData = false;

    // Lag putting (first putt >= 20 ft)
    let lagPuttOpportunities = 0, lagPuttNoThreePutt = 0;
    let totalLagLeave = 0, lagLeavesRecorded = 0;

    rounds.forEach(round => {
        const holes = round.holes;
        holes.forEach((hole, idx) => {
            totalHoles++;

            // Fairway tracking (non-par-3 only)
            if (hole.par > 3 && hole.fairwayDirection) {
                fairwayOpportunities++;
                if (hole.fairwayHit) totalFairways++;
                if (hole.fairwayDirection === 'left') fairwayLeft++;
                else if (hole.fairwayDirection === 'right') fairwayRight++;
            }

            // Approach tracking
            if (hole.approachResult) {
                girOpportunities++;
                if (hole.gir) totalGir++;
                else if (hole.approachResult === 'long') approachLong++;
                else if (hole.approachResult === 'short') approachShort++;
                else if (hole.approachResult === 'left') approachLeft++;
                else if (hole.approachResult === 'right') approachRight++;
            }

            // Putts
            const putts = hole.putts || 0;
            totalPutts += putts;
            if (putts > 0 || hole.approachResult) {
                holesWithPutts++;
                if (putts === 1) onePutt++;
                else if (putts === 2) twoPutt++;
                else if (putts === 3) threePutt++;
                else if (putts > 3) threePlusPutt++;
            }

            // Penalties
            totalPenalties += hole.penalties || 0;

            // Scrambling
            if (hole.approachResult && !hole.gir) {
                scramblingOpportunities++;
                if (hole.score <= hole.par) {
                    scramblingSuccess++;
                }
            }

            // Sand save
            if (hole.bunker || hole.sandSave) {
                sandSaveOpportunities++;
                if (hole.score <= hole.par) {
                    sandSaveSuccess++;
                }
            }

            // Putt distance stats
            if (hole.puttDistances && hole.puttDistances.length > 0) {
                const lastDist = hole.puttDistances[hole.puttDistances.length - 1];
                if (lastDist !== null && lastDist !== undefined) {
                    totalFeetOfPuttsMade += lastDist;
                    holesWithMadePuttDist++;
                }
                const firstDist = hole.puttDistances[0];
                if (firstDist !== null && firstDist !== undefined) {
                    totalFirstPuttDist += firstDist;
                    holesWithFirstPuttDist++;
                }

                // Putt make rate by distance
                hole.puttDistances.forEach((dist, pIdx) => {
                    if (dist === null || dist === undefined) return;
                    hasPuttDistData = true;
                    const bucket = puttBuckets.find(b => dist >= b.min && dist < b.max);
                    if (bucket) {
                        bucket.attempts++;
                        if (pIdx === hole.puttDistances.length - 1) bucket.made++;
                    }
                });

                // Lag putting (first putt >= 20 ft)
                if (firstDist !== null && firstDist !== undefined && firstDist >= 20) {
                    lagPuttOpportunities++;
                    if ((hole.putts || 0) <= 2) lagPuttNoThreePutt++;
                    if (hole.puttDistances.length >= 2) {
                        const secondDist = hole.puttDistances[1];
                        if (secondDist !== null && secondDist !== undefined) {
                            totalLagLeave += secondDist;
                            lagLeavesRecorded++;
                        }
                    }
                }
            }

            // Par conversion (GIR → par or better)
            if (hole.gir) {
                if (hole.score <= hole.par) parConversionSuccess++;
            }

            // Bogey avoidance
            if (hole.score <= hole.par) bogeyAvoidanceCount++;

            // Scoring by par type
            if (hole.par === 3) { par3Total += hole.score; par3Count++; }
            else if (hole.par === 4) { par4Total += hole.score; par4Count++; }
            else if (hole.par >= 5) { par5Total += hole.score; par5Count++; }

            // Scoring distribution
            const diff = hole.score - hole.par;
            if (diff <= -2) eagleOrBetter++;
            else if (diff === -1) birdies++;
            else if (diff === 0) pars++;
            else if (diff === 1) bogeys++;
            else if (diff === 2) doubles++;
            else triplePlus++;

            // Bounce-back: after bogey+, next hole par or better
            if (idx > 0) {
                const prev = holes[idx - 1];
                if (prev.score > prev.par) {
                    bounceBackOpps++;
                    if (hole.score <= hole.par) bounceBackSuccess++;
                }
            }
        });
    });

    return {
        avgScore,
        fairwayPct: fairwayOpportunities > 0 ? Math.round((totalFairways / fairwayOpportunities) * 100) : null,
        girPct: girOpportunities > 0 ? Math.round((totalGir / girOpportunities) * 100) : null,
        avgPutts: parseFloat((totalPutts / rounds.length).toFixed(1)),
        scramblingPct: scramblingOpportunities > 0 ? Math.round((scramblingSuccess / scramblingOpportunities) * 100) : null,
        sandSavePct: sandSaveOpportunities > 0 ? Math.round((sandSaveSuccess / sandSaveOpportunities) * 100) : null,
        feetOfPuttsMade: holesWithMadePuttDist > 0 ? totalFeetOfPuttsMade : null,
        avgFirstPuttDist: holesWithFirstPuttDist > 0 ? parseFloat((totalFirstPuttDist / holesWithFirstPuttDist).toFixed(1)) : null,

        // Fairway distribution (L/Hit/R percentages)
        fairwayDist: fairwayOpportunities > 0 ? {
            left: Math.round((fairwayLeft / fairwayOpportunities) * 100),
            hit: Math.round((totalFairways / fairwayOpportunities) * 100),
            right: Math.round((fairwayRight / fairwayOpportunities) * 100)
        } : null,

        // Approach distribution (GIR/Long/Short/Left/Right percentages)
        approachDist: girOpportunities > 0 ? {
            gir: Math.round((totalGir / girOpportunities) * 100),
            long: Math.round((approachLong / girOpportunities) * 100),
            short: Math.round((approachShort / girOpportunities) * 100),
            left: Math.round((approachLeft / girOpportunities) * 100),
            right: Math.round((approachRight / girOpportunities) * 100)
        } : null,

        // Putting breakdown (percentages)
        puttingBreakdown: holesWithPutts > 0 ? {
            onePutt: Math.round((onePutt / holesWithPutts) * 100),
            twoPutt: Math.round((twoPutt / holesWithPutts) * 100),
            threePutt: Math.round((threePutt / holesWithPutts) * 100),
            threePlus: Math.round((threePlusPutt / holesWithPutts) * 100)
        } : null,

        // Per-9 normalized stats
        puttsPer9: totalHoles > 0 ? parseFloat((totalPutts / totalHoles * 9).toFixed(1)) : null,
        feetMadePer9: holesWithMadePuttDist > 0 ? parseFloat((totalFeetOfPuttsMade / totalHoles * 9).toFixed(1)) : null,
        penaltiesPer9: totalHoles > 0 ? parseFloat((totalPenalties / totalHoles * 9).toFixed(1)) : null,

        // Par conversion (GIR → par or better)
        parConversionPct: totalGir > 0 ? Math.round((parConversionSuccess / totalGir) * 100) : null,

        // Bogey avoidance (score ≤ par / total holes)
        bogeyAvoidancePct: totalHoles > 0 ? Math.round((bogeyAvoidanceCount / totalHoles) * 100) : null,

        // Bounce-back rate (par or better after bogey+)
        bounceBackRate: bounceBackOpps > 0 ? Math.round((bounceBackSuccess / bounceBackOpps) * 100) : null,

        // Scoring by par type
        scoringByPar: {
            par3: par3Count > 0 ? { avg: parseFloat((par3Total / par3Count).toFixed(2)), vsPar: parseFloat(((par3Total / par3Count) - 3).toFixed(2)) } : null,
            par4: par4Count > 0 ? { avg: parseFloat((par4Total / par4Count).toFixed(2)), vsPar: parseFloat(((par4Total / par4Count) - 4).toFixed(2)) } : null,
            par5: par5Count > 0 ? { avg: parseFloat((par5Total / par5Count).toFixed(2)), vsPar: parseFloat(((par5Total / par5Count) - 5).toFixed(2)) } : null
        },

        // Scoring distribution (counts and percentages)
        scoringDistribution: {
            eagle: eagleOrBetter, birdie: birdies, par: pars,
            bogey: bogeys, double: doubles, triple: triplePlus,
            total: totalHoles,
            eaglePct: totalHoles > 0 ? Math.round((eagleOrBetter / totalHoles) * 100) : 0,
            birdiePct: totalHoles > 0 ? Math.round((birdies / totalHoles) * 100) : 0,
            parPct: totalHoles > 0 ? Math.round((pars / totalHoles) * 100) : 0,
            bogeyPct: totalHoles > 0 ? Math.round((bogeys / totalHoles) * 100) : 0,
            doublePct: totalHoles > 0 ? Math.round((doubles / totalHoles) * 100) : 0,
            triplePct: totalHoles > 0 ? Math.round((triplePlus / totalHoles) * 100) : 0
        },

        // Putt make rate by distance
        puttMakeRate: hasPuttDistData ? puttBuckets.map(b => ({
            label: b.label, attempts: b.attempts, made: b.made,
            pct: b.attempts > 0 ? Math.round((b.made / b.attempts) * 100) : 0
        })) : null,

        // Lag putting (first putt >= 20 ft)
        lagPutt3PuttAvoidPct: lagPuttOpportunities > 0 ? Math.round((lagPuttNoThreePutt / lagPuttOpportunities) * 100) : null,
        lagPuttAvgLeave: lagLeavesRecorded > 0 ? parseFloat((totalLagLeave / lagLeavesRecorded).toFixed(1)) : null,
        lagPuttCount: lagPuttOpportunities
    };
}

function computeHandicap(rounds) {
    const handicapTypes = ['normal', 'league', 'match_play'];
    const eligible = rounds.filter(r =>
        r.courseRating && r.slopeRating &&
        handicapTypes.includes(r.roundType || 'normal')
    );
    if (eligible.length < 3) return null;

    const differentials = eligible.map(r => {
        return ((r.totalScore - r.courseRating) * 113) / r.slopeRating;
    }).sort((a, b) => a - b);

    let numToUse;
    if (differentials.length >= 20) numToUse = 8;
    else if (differentials.length >= 17) numToUse = 7;
    else if (differentials.length >= 14) numToUse = 6;
    else if (differentials.length >= 11) numToUse = 5;
    else if (differentials.length >= 8) numToUse = 4;
    else if (differentials.length >= 6) numToUse = 3;
    else if (differentials.length >= 4) numToUse = 2;
    else numToUse = 1;

    const bestDiffs = differentials.slice(0, numToUse);
    return parseFloat((bestDiffs.reduce((a, b) => a + b, 0) / numToUse * 0.96).toFixed(1));
}

function filterRounds(rounds, { startDate, endDate, count, courseId, roundType } = {}) {
    let filtered = [...rounds];

    if (courseId && courseId !== 'all') {
        filtered = filtered.filter(r => r.courseId === courseId);
    }
    if (roundType && roundType !== 'all') {
        filtered = filtered.filter(r => (r.roundType || 'normal') === roundType);
    }
    if (startDate) {
        filtered = filtered.filter(r => r.date >= startDate);
    }
    if (endDate) {
        filtered = filtered.filter(r => r.date <= endDate);
    }

    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (count && count !== 'all') {
        filtered = filtered.slice(0, parseInt(count));
    }

    return filtered;
}

function buildRoundSummary(round) {
    const totalPar = round.holes.reduce((sum, h) => sum + h.par, 0);
    const diff = round.totalScore - totalPar;
    const diffStr = diff > 0 ? `+${diff}` : diff === 0 ? 'E' : diff.toString();
    const putts = round.holes.reduce((sum, h) => sum + (h.putts || 0), 0);
    const fairways = round.holes.filter(h => h.par > 3 && h.fairwayHit).length;
    const fairwayTotal = round.holes.filter(h => h.par > 3 && h.fairwayDirection).length;
    const girs = round.holes.filter(h => h.gir).length;
    const bunkerHoles = round.holes.filter(h => h.bunker || h.sandSave).length;
    const sandSaves = round.holes.filter(h => (h.bunker || h.sandSave) && h.score <= h.par).length;
    const feetOfPuttsMade = round.holes.reduce((sum, h) => {
        if (h.puttDistances && h.puttDistances.length > 0) {
            const lastDist = h.puttDistances[h.puttDistances.length - 1];
            return sum + (lastDist || 0);
        }
        return sum;
    }, 0);

    return { totalPar, diff, diffStr, putts, fairways, fairwayTotal, girs, bunkerHoles, sandSaves, feetOfPuttsMade };
}

function computeCourseStats(courseId, allRounds, course) {
    const courseRounds = allRounds.filter(r => r.courseId === courseId);
    const totalPar = course.holes.reduce((s, h) => s + h.par, 0);

    const emptyDist = {
        eagle: 0, birdie: 0, par: 0, bogey: 0, double: 0, triple: 0, total: 0,
        eaglePct: 0, birdiePct: 0, parPct: 0, bogeyPct: 0, doublePct: 0, triplePct: 0
    };

    if (courseRounds.length === 0) {
        return {
            roundsPlayed: 0, avgScore: null, totalPar, vsPar: null,
            bestRound: null, worstRound: null,
            courseStats: computeStats([]),
            holeStats: course.holes.map(h => ({
                holeNumber: h.number, par: h.par, scoringAvg: null, vsPar: null,
                roundsWithData: 0, distribution: { ...emptyDist },
                fairwayPct: null, fairwayMissDir: null,
                girPct: null, girMissDir: null, avgPutts: null,
                matchTotal: 0, matchWinPct: null, matchDrawPct: null, matchLossPct: null
            })),
            hardestHoles: [], easiestHoles: [],
            matchesPlayed: 0
        };
    }

    // Course-level aggregates
    const scores = courseRounds.map(r => r.totalScore);
    const avgScore = parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1));
    const vsPar = parseFloat((avgScore - totalPar).toFixed(1));

    // Best/worst (lowest score wins; tie-break by most recent date)
    const sorted = [...courseRounds].sort((a, b) => a.totalScore - b.totalScore || new Date(b.date) - new Date(a.date));
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];

    // Reuse computeStats for dashboard-style KPIs scoped to this course
    const courseStats = computeStats(courseRounds);

    // Per-hole aggregation
    const holeStats = course.holes.map(courseHole => {
        const holeNum = courseHole.number;
        const par = courseHole.par;

        const entries = [];
        courseRounds.forEach(round => {
            const h = round.holes.find(h => h.number === holeNum);
            if (h) entries.push(h);
        });

        if (entries.length === 0) {
            return {
                holeNumber: holeNum, par, scoringAvg: null, vsPar: null,
                roundsWithData: 0, distribution: { ...emptyDist },
                fairwayPct: null, fairwayMissDir: null,
                girPct: null, girMissDir: null, avgPutts: null,
                matchTotal: 0, matchWinPct: null, matchDrawPct: null, matchLossPct: null
            };
        }

        // Scoring average
        const totalScore = entries.reduce((s, h) => s + h.score, 0);
        const scoringAvg = parseFloat((totalScore / entries.length).toFixed(2));
        const holeVsPar = parseFloat((scoringAvg - par).toFixed(2));

        // Scoring distribution
        let eagle = 0, birdie = 0, pars = 0, bogey = 0, double = 0, triple = 0;
        entries.forEach(h => {
            const diff = h.score - par;
            if (diff <= -2) eagle++;
            else if (diff === -1) birdie++;
            else if (diff === 0) pars++;
            else if (diff === 1) bogey++;
            else if (diff === 2) double++;
            else triple++;
        });
        const total = entries.length;

        // Fairway (non-par-3 only)
        let fairwayPct = null;
        let fairwayMissDir = null;
        if (par > 3) {
            const fwyEntries = entries.filter(h => h.fairwayDirection);
            if (fwyEntries.length > 0) {
                const hits = fwyEntries.filter(h => h.fairwayHit).length;
                fairwayPct = Math.round((hits / fwyEntries.length) * 100);
                const misses = fwyEntries.filter(h => !h.fairwayHit);
                if (misses.length > 0) {
                    const leftCount = misses.filter(h => h.fairwayDirection === 'left').length;
                    const rightCount = misses.filter(h => h.fairwayDirection === 'right').length;
                    fairwayMissDir = leftCount >= rightCount ? 'left' : 'right';
                }
            }
        }

        // GIR
        let girPct = null;
        let girMissDir = null;
        const girEntries = entries.filter(h => h.approachResult);
        if (girEntries.length > 0) {
            const girHits = girEntries.filter(h => h.gir).length;
            girPct = Math.round((girHits / girEntries.length) * 100);
            const girMisses = girEntries.filter(h => !h.gir);
            if (girMisses.length > 0) {
                const counts = { long: 0, short: 0, left: 0, right: 0 };
                girMisses.forEach(h => { if (counts[h.approachResult] !== undefined) counts[h.approachResult]++; });
                const topMiss = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
                girMissDir = topMiss[1] > 0 ? topMiss[0] : null;
            }
        }

        // Average putts
        const totalPutts = entries.reduce((s, h) => s + (h.putts || 0), 0);
        const avgPutts = parseFloat((totalPutts / entries.length).toFixed(1));

        // Match play per-hole stats
        const matchEntries = entries.filter(h => h.matchResult);
        const matchTotal = matchEntries.length;
        let matchWins = 0, matchDraws = 0, matchLosses = 0;
        matchEntries.forEach(h => {
            if (h.matchResult === 'win') matchWins++;
            else if (h.matchResult === 'draw') matchDraws++;
            else if (h.matchResult === 'loss') matchLosses++;
        });

        return {
            holeNumber: holeNum, par, scoringAvg, vsPar: holeVsPar,
            roundsWithData: entries.length,
            distribution: {
                eagle, birdie, par: pars, bogey, double, triple, total,
                eaglePct: Math.round((eagle / total) * 100),
                birdiePct: Math.round((birdie / total) * 100),
                parPct: Math.round((pars / total) * 100),
                bogeyPct: Math.round((bogey / total) * 100),
                doublePct: Math.round((double / total) * 100),
                triplePct: Math.round((triple / total) * 100)
            },
            fairwayPct, fairwayMissDir, girPct, girMissDir, avgPutts,
            matchTotal,
            matchWinPct: matchTotal > 0 ? Math.round((matchWins / matchTotal) * 100) : null,
            matchDrawPct: matchTotal > 0 ? Math.round((matchDraws / matchTotal) * 100) : null,
            matchLossPct: matchTotal > 0 ? Math.round((matchLosses / matchTotal) * 100) : null
        };
    });

    // Hardest/easiest holes (only those with data)
    const withData = holeStats.filter(h => h.vsPar !== null);
    const hardestHoles = [...withData].sort((a, b) => b.vsPar - a.vsPar).slice(0, 3);
    const easiestHoles = [...withData].sort((a, b) => a.vsPar - b.vsPar).slice(0, 3);

    // Match play stats for this course
    const matchPlayTypes = ['league', 'match_play'];
    const matchRounds = courseRounds.filter(r => matchPlayTypes.includes(r.roundType) &&
        r.holes.some(h => h.matchResult));
    const matchesPlayed = matchRounds.length;

    return {
        roundsPlayed: courseRounds.length, avgScore, totalPar, vsPar,
        bestRound: { score: best.totalScore, date: best.date, id: best.id },
        worstRound: { score: worst.totalScore, date: worst.date, id: worst.id },
        courseStats, holeStats, hardestHoles, easiestHoles,
        matchesPlayed
    };
}

// Reorder an array in place: move item at fromIdx to toIdx
function reorderArray(arr, fromIdx, toIdx) {
    if (fromIdx < 0 || fromIdx >= arr.length || toIdx < 0 || toIdx >= arr.length || fromIdx === toIdx) return arr;
    const [moved] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, moved);
    return arr;
}

// KPI goal definitions: direction + default buffer for color thresholds
const GOAL_DEFS = {
    avgScore:          { direction: 'lower',  buffer: 5,   label: 'Avg Score', unit: '' },
    fairwayPct:        { direction: 'higher', buffer: 10,  label: 'Fairways Hit %', unit: '%' },
    girPct:            { direction: 'higher', buffer: 10,  label: 'GIR %', unit: '%' },
    avgFirstPuttDist:  { direction: 'lower',  buffer: 5,   label: 'Avg Proximity (ft)', unit: ' ft' },
    scramblingPct:     { direction: 'higher', buffer: 10,  label: 'Scrambling %', unit: '%' },
    sandSavePct:       { direction: 'higher', buffer: 10,  label: 'Sand Save %', unit: '%' },
    bogeyAvoidancePct: { direction: 'higher', buffer: 10,  label: 'Bogey Avoidance %', unit: '%' },
    parConversionPct:  { direction: 'higher', buffer: 10,  label: 'Par Conversion %', unit: '%' },
    bounceBackRate:    { direction: 'higher', buffer: 10,  label: 'Bounce-back %', unit: '%' },
    puttsPer9:         { direction: 'lower',  buffer: 2,   label: 'Putts / 9', unit: '' },
    feetMadePer9:      { direction: 'higher', buffer: 10,  label: 'Ft Made / 9', unit: ' ft' },
    penaltiesPer9:     { direction: 'lower',  buffer: 1,   label: 'Penalties / 9', unit: '' },
    scoringAvgPar3:    { direction: 'lower',  buffer: 0.5, label: 'Par 3 Scoring Avg', unit: '' },
    scoringAvgPar4:    { direction: 'lower',  buffer: 0.5, label: 'Par 4 Scoring Avg', unit: '' },
    scoringAvgPar5:    { direction: 'lower',  buffer: 0.5, label: 'Par 5 Scoring Avg', unit: '' },
    lagPutt3PuttAvoidPct: { direction: 'higher', buffer: 10, label: '3-Putt Avoidance (20+)', unit: '%' },
};

// Returns goal status: 'far-above' | 'above' | 'below' | 'far-below' | null
function getGoalStatus(value, target, direction, buffer) {
    if (value === null || value === undefined || target === null || target === undefined) return null;
    if (direction === 'higher') {
        if (value >= target + buffer) return 'far-above';
        if (value >= target) return 'above';
        if (value >= target - buffer) return 'below';
        return 'far-below';
    } else {
        if (value <= target - buffer) return 'far-above';
        if (value <= target) return 'above';
        if (value <= target + buffer) return 'below';
        return 'far-below';
    }
}

// Trendable KPI definitions
const TREND_KPIS = {
    avgScore:      { label: 'Score',         extract: (s) => s.avgScore,      unit: '',  decimals: 0 },
    puttsPer9:     { label: 'Putts / 9',     extract: (s) => s.puttsPer9,     unit: '',  decimals: 1 },
    fairwayPct:    { label: 'Fairway %',     extract: (s) => s.fairwayPct,    unit: '%', decimals: 0 },
    girPct:        { label: 'GIR %',         extract: (s) => s.girPct,        unit: '%', decimals: 0 },
    scramblingPct: { label: 'Scrambling %',  extract: (s) => s.scramblingPct, unit: '%', decimals: 0 },
    handicap:      { label: 'Handicap Index', extract: null,                  unit: '',  decimals: 1 },
};

// Compute per-round trend data for a given KPI.
// Returns [{ date, value }] sorted oldest-first. value is null when insufficient data.
function computeTrendData(allRounds, kpiKey) {
    if (!allRounds || allRounds.length === 0) return [];

    const sorted = [...allRounds].sort((a, b) => new Date(a.date) - new Date(b.date));

    if (kpiKey === 'handicap') {
        const results = [];
        for (let i = 0; i < sorted.length; i++) {
            const roundsUpToHere = sorted.slice(0, i + 1);
            const hcap = computeHandicap(roundsUpToHere);
            results.push({ date: sorted[i].date, value: hcap });
        }
        return results;
    }

    const def = TREND_KPIS[kpiKey];
    if (!def || !def.extract) return [];

    return sorted.map(round => {
        const stats = computeStats([round]);
        const value = def.extract(stats);
        return { date: round.date, value: (value === undefined || isNaN(value)) ? null : value };
    });
}

// Simple moving average over [{ date, value }]. Skips nulls. Allows partial windows.
function computeMovingAverage(data, window) {
    if (!data || data.length === 0) return [];
    if (!window) window = 5;
    return data.map((point, idx) => {
        const values = [];
        for (let j = idx; j >= 0 && values.length < window; j--) {
            if (data[j].value !== null && data[j].value !== undefined) values.push(data[j].value);
        }
        if (values.length === 0) return { date: point.date, value: null };
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        return { date: point.date, value: parseFloat(avg.toFixed(1)) };
    });
}

// ── Match Play Stats ─────────────────────────────────────────
function computeMatchPlayStats(rounds) {
    const result = {
        matchesPlayed: 0,
        totalPoints: 0,
        avgPointsPerMatch: 0,
        holesWon: 0,
        holesDrawn: 0,
        holesLost: 0,
        totalMatchHoles: 0,
        winPct: 0,
        drawPct: 0,
        lossPct: 0,
        pointsPer9: 0,
    };

    if (!rounds || rounds.length === 0) return result;

    const MATCH_POINTS = { win: 1, draw: 0.5, loss: 0 };

    rounds.forEach(round => {
        if (!round.holes) return;

        let roundHasMatch = false;
        let roundPoints = 0;
        let roundMatchHoles = 0;

        round.holes.forEach(hole => {
            if (hole.matchResult && MATCH_POINTS[hole.matchResult] !== undefined) {
                roundHasMatch = true;
                roundMatchHoles++;
                const pts = MATCH_POINTS[hole.matchResult];
                roundPoints += pts;
                if (hole.matchResult === 'win') result.holesWon++;
                else if (hole.matchResult === 'draw') result.holesDrawn++;
                else if (hole.matchResult === 'loss') result.holesLost++;
            }
        });

        if (roundHasMatch) {
            result.matchesPlayed++;
            result.totalPoints += roundPoints;
            result.totalMatchHoles += roundMatchHoles;
        }
    });

    if (result.matchesPlayed > 0) {
        result.avgPointsPerMatch = parseFloat((result.totalPoints / result.matchesPlayed).toFixed(1));
    }
    if (result.totalMatchHoles > 0) {
        result.winPct = parseFloat((result.holesWon / result.totalMatchHoles * 100).toFixed(1));
        result.drawPct = parseFloat((result.holesDrawn / result.totalMatchHoles * 100).toFixed(1));
        result.lossPct = parseFloat((result.holesLost / result.totalMatchHoles * 100).toFixed(1));
        result.pointsPer9 = parseFloat((result.totalPoints / result.totalMatchHoles * 9).toFixed(1));
    }

    return result;
}

// Export for Vitest (ignored in browser)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { computeStats, computeHandicap, filterRounds, buildRoundSummary, computeCourseStats, reorderArray, GOAL_DEFS, getGoalStatus, TREND_KPIS, computeTrendData, computeMovingAverage, computeMatchPlayStats };
}
