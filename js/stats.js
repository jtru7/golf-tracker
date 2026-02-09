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
            scoringByPar: null, scoringDistribution: null
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
        }
    };
}

function computeHandicap(rounds) {
    const handicapTypes = ['normal', 'league'];
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

function filterRounds(rounds, { startDate, endDate, count } = {}) {
    let filtered = [...rounds];

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
                girPct: null, girMissDir: null, avgPutts: null
            })),
            hardestHoles: [], easiestHoles: []
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
                girPct: null, girMissDir: null, avgPutts: null
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
            fairwayPct, fairwayMissDir, girPct, girMissDir, avgPutts
        };
    });

    // Hardest/easiest holes (only those with data)
    const withData = holeStats.filter(h => h.vsPar !== null);
    const hardestHoles = [...withData].sort((a, b) => b.vsPar - a.vsPar).slice(0, 3);
    const easiestHoles = [...withData].sort((a, b) => a.vsPar - b.vsPar).slice(0, 3);

    return {
        roundsPlayed: courseRounds.length, avgScore, totalPar, vsPar,
        bestRound: { score: best.totalScore, date: best.date, id: best.id },
        worstRound: { score: worst.totalScore, date: worst.date, id: worst.id },
        courseStats, holeStats, hardestHoles, easiestHoles
    };
}

// Export for Vitest (ignored in browser)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { computeStats, computeHandicap, filterRounds, buildRoundSummary, computeCourseStats };
}
