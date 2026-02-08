// Pure calculation functions — no DOM access
// Used by app.js in the browser and imported by Vitest for testing

function computeStats(rounds) {
    if (rounds.length === 0) {
        return { avgScore: null, fairwayPct: null, girPct: null, avgPutts: null, scramblingPct: null, feetOfPuttsMade: null, avgFirstPuttDist: null };
    }

    const totalScores = rounds.map(r => r.totalScore);
    const avgScore = parseFloat((totalScores.reduce((a, b) => a + b, 0) / totalScores.length).toFixed(1));

    let totalFairways = 0, fairwayOpportunities = 0;
    let totalGir = 0, girOpportunities = 0;
    let totalPutts = 0;
    let scramblingSuccess = 0, scramblingOpportunities = 0;
    let totalFeetOfPuttsMade = 0, holesWithMadePuttDist = 0;
    let totalFirstPuttDist = 0, holesWithFirstPuttDist = 0;

    rounds.forEach(round => {
        round.holes.forEach(hole => {
            if (hole.par > 3 && hole.fairwayDirection) {
                fairwayOpportunities++;
                if (hole.fairwayHit) totalFairways++;
            }

            if (hole.approachResult) {
                girOpportunities++;
                if (hole.gir) totalGir++;
            }

            totalPutts += hole.putts || 0;

            if (hole.approachResult && !hole.gir) {
                scramblingOpportunities++;
                if (hole.score <= hole.par) {
                    scramblingSuccess++;
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
        });
    });

    return {
        avgScore,
        fairwayPct: fairwayOpportunities > 0 ? Math.round((totalFairways / fairwayOpportunities) * 100) : null,
        girPct: girOpportunities > 0 ? Math.round((totalGir / girOpportunities) * 100) : null,
        avgPutts: parseFloat((totalPutts / rounds.length).toFixed(1)),
        scramblingPct: scramblingOpportunities > 0 ? Math.round((scramblingSuccess / scramblingOpportunities) * 100) : null,
        feetOfPuttsMade: holesWithMadePuttDist > 0 ? totalFeetOfPuttsMade : null,
        avgFirstPuttDist: holesWithFirstPuttDist > 0 ? parseFloat((totalFirstPuttDist / holesWithFirstPuttDist).toFixed(1)) : null
    };
}

function computeHandicap(rounds) {
    const eligible = rounds.filter(r => r.courseRating && r.slopeRating);
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
    const feetOfPuttsMade = round.holes.reduce((sum, h) => {
        if (h.puttDistances && h.puttDistances.length > 0) {
            const lastDist = h.puttDistances[h.puttDistances.length - 1];
            return sum + (lastDist || 0);
        }
        return sum;
    }, 0);

    return { totalPar, diff, diffStr, putts, fairways, fairwayTotal, girs, feetOfPuttsMade };
}

// Export for Vitest (ignored in browser)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { computeStats, computeHandicap, filterRounds, buildRoundSummary };
}
