// Global state
let appData = {
    courses: [],
    rounds: [],
    settings: {
        apiKey: '',
        spreadsheetId: ''
    }
};

let editingCourseId = null;

// Initialize app
function init() {
    loadFromLocalStorage();

    // Add TEST course if it doesn't exist
    if (!appData.courses.find(c => c.name === 'TRU TEST Course')) {
        const testCourse = {
            id: 'test-course-001',
            name: 'TRU TEST Course',
            location: 'Rexburg, ID',
            numHoles: 9,
            rating: 35.5,
            slope: 113,
            totalYardage: 3200,
            holes: [
                { number: 1, par: 4, yardage: 380 },
                { number: 2, par: 3, yardage: 165 },
                { number: 3, par: 5, yardage: 520 },
                { number: 4, par: 4, yardage: 390 },
                { number: 5, par: 4, yardage: 350 },
                { number: 6, par: 3, yardage: 180 },
                { number: 7, par: 4, yardage: 410 },
                { number: 8, par: 5, yardage: 495 },
                { number: 9, par: 4, yardage: 310 }
            ]
        };
        appData.courses.push(testCourse);
        saveToLocalStorage();
    }

    loadCourseSelect();
    renderCourseList();
    renderDashboard();

    // Set today's date as default
    document.getElementById('roundDate').value = new Date().toISOString().split('T')[0];
}

// View management
function showView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));

    document.getElementById(viewName).classList.add('active');
    event.target.classList.add('active');

    if (viewName === 'dashboard') {
        renderDashboard();
    } else if (viewName === 'courses') {
        renderCourseList();
    } else if (viewName === 'settings') {
        loadSettings();
    }
}

// Local storage functions
function saveToLocalStorage() {
    localStorage.setItem('golfTrackerData', JSON.stringify(appData));
}

function loadFromLocalStorage() {
    const stored = localStorage.getItem('golfTrackerData');
    if (stored) {
        appData = JSON.parse(stored);
    }
}

// Course management
function showAddCourseModal() {
    editingCourseId = null;
    document.getElementById('courseModalTitle').textContent = 'Add New Course';
    document.getElementById('courseName').value = '';
    document.getElementById('courseLocation').value = '';
    document.getElementById('courseHoles').value = '18';
    document.getElementById('courseRating').value = '';
    document.getElementById('slopeRating').value = '';
    document.getElementById('totalYardage').value = '';

    renderCourseHoleInputs();
    document.getElementById('courseModal').classList.add('active');
}

function closeCourseModal() {
    document.getElementById('courseModal').classList.remove('active');
}

function renderCourseHoleInputs() {
    const container = document.getElementById('courseHoleInputs');
    const numHoles = parseInt(document.getElementById('courseHoles').value) || 18;
    container.innerHTML = '';

    for (let i = 1; i <= numHoles; i++) {
        const holeDiv = document.createElement('div');
        holeDiv.innerHTML = `
            <label style="font-size: 0.85rem;">Hole ${i}</label>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <input type="number" id="holePar${i}" placeholder="Par" min="3" max="6" value="4" style="padding: 8px; font-size: 0.85rem;">
                <input type="number" id="holeYards${i}" placeholder="Yards" value="400" style="padding: 8px; font-size: 0.85rem;">
            </div>
        `;
        container.appendChild(holeDiv);
    }
}

function updateHoleInputs() {
    renderCourseHoleInputs();
}

function saveCourse() {
    const numHoles = parseInt(document.getElementById('courseHoles').value) || 18;
    const course = {
        id: editingCourseId || Date.now().toString(),
        name: document.getElementById('courseName').value,
        location: document.getElementById('courseLocation').value,
        numHoles: numHoles,
        rating: parseFloat(document.getElementById('courseRating').value) || 72,
        slope: parseInt(document.getElementById('slopeRating').value) || 113,
        totalYardage: parseInt(document.getElementById('totalYardage').value) || 0,
        holes: []
    };

    for (let i = 1; i <= numHoles; i++) {
        course.holes.push({
            number: i,
            par: parseInt(document.getElementById(`holePar${i}`).value) || 4,
            yardage: parseInt(document.getElementById(`holeYards${i}`).value) || 400
        });
    }

    if (editingCourseId) {
        const index = appData.courses.findIndex(c => c.id === editingCourseId);
        appData.courses[index] = course;
    } else {
        appData.courses.push(course);
    }

    saveToLocalStorage();
    syncToGoogleSheets();
    renderCourseList();
    loadCourseSelect();
    closeCourseModal();
}

function editCourse(courseId) {
    const course = appData.courses.find(c => c.id === courseId);
    if (!course) return;

    editingCourseId = courseId;
    document.getElementById('courseModalTitle').textContent = 'Edit Course';
    document.getElementById('courseName').value = course.name;
    document.getElementById('courseLocation').value = course.location;
    document.getElementById('courseHoles').value = course.numHoles || course.holes.length;
    document.getElementById('courseRating').value = course.rating;
    document.getElementById('slopeRating').value = course.slope;
    document.getElementById('totalYardage').value = course.totalYardage;

    renderCourseHoleInputs();

    course.holes.forEach((hole, i) => {
        document.getElementById(`holePar${i+1}`).value = hole.par;
        document.getElementById(`holeYards${i+1}`).value = hole.yardage;
    });

    document.getElementById('courseModal').classList.add('active');
}

function deleteCourse(courseId) {
    if (confirm('Are you sure you want to delete this course?')) {
        appData.courses = appData.courses.filter(c => c.id !== courseId);
        saveToLocalStorage();
        syncToGoogleSheets();
        renderCourseList();
        loadCourseSelect();
    }
}

function renderCourseList() {
    const container = document.getElementById('courseList');

    if (appData.courses.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No courses yet</h3>
                <p>Add your first course to start tracking rounds</p>
            </div>
        `;
        return;
    }

    container.innerHTML = appData.courses.map(course => {
        const numHoles = course.numHoles || course.holes.length;
        const totalPar = course.holes.reduce((sum, h) => sum + h.par, 0);
        return `
        <div class="course-item">
            <div class="course-info">
                <h3>${course.name}</h3>
                <div class="course-details">
                    ${course.location} • ${numHoles} Holes • Par ${totalPar} •
                    ${course.totalYardage} yards • Rating: ${course.rating} • Slope: ${course.slope}
                </div>
            </div>
            <div class="course-actions">
                <button class="btn-small btn-edit" onclick="editCourse('${course.id}')">Edit</button>
                <button class="btn-small btn-delete" onclick="deleteCourse('${course.id}')">Delete</button>
            </div>
        </div>
    `}).join('');
}

function loadCourseSelect() {
    const select = document.getElementById('courseSelect');
    select.innerHTML = '<option value="">Select a course...</option>' +
        appData.courses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

function loadCourseData() {
    const courseId = document.getElementById('courseSelect').value;
    if (!courseId) return;

    const course = appData.courses.find(c => c.id === courseId);
    if (!course) return;

    const container = document.getElementById('holeInputs');
    container.innerHTML = course.holes.map(hole => {
        const isPar3 = hole.par === 3;

        return `
        <div class="hole-card">
            <div class="hole-header">
                <div class="hole-number">Hole ${hole.number}</div>
                <div class="hole-par">Par ${hole.par} • ${hole.yardage}y</div>
            </div>
            <div class="hole-inputs">
                <!-- Score and Penalties Row -->
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 8px; margin-bottom: 10px;">
                    <div>
                        <label style="font-size: 0.75rem; margin-bottom: 3px; display: block; color: var(--text-dark); font-weight: 600;">Score</label>
                        <input type="number" id="score${hole.number}" placeholder="Score" min="1" max="12" style="width: 100%; padding: 8px;">
                    </div>
                    <div>
                        <label style="font-size: 0.75rem; margin-bottom: 3px; display: block; color: var(--text-dark); font-weight: 600;">Penalties</label>
                        <input type="number" id="penalties${hole.number}" placeholder="0" min="0" max="5" value="0" style="width: 100%; padding: 8px;" onchange="updatePenaltyStyle(${hole.number})" oninput="updatePenaltyStyle(${hole.number})">
                    </div>
                </div>

                <!-- Fairway and Approach Row -->
                <div style="display: grid; grid-template-columns: ${isPar3 ? '1fr' : '1fr 1fr'}; gap: 8px; margin-bottom: 10px;">
                    ${!isPar3 ? `
                    <div>
                        <label style="font-size: 0.75rem; margin-bottom: 4px; display: block; color: var(--text-dark); font-weight: 600;">Fairway</label>
                        <div class="button-group" data-hole="${hole.number}" data-type="fairway">
                            <button type="button" class="toggle-btn" data-value="left" onclick="selectToggle(${hole.number}, 'fairway', 'left')">
                                ←
                            </button>
                            <button type="button" class="toggle-btn" data-value="hit" onclick="selectToggle(${hole.number}, 'fairway', 'hit')">
                                ✓
                            </button>
                            <button type="button" class="toggle-btn" data-value="right" onclick="selectToggle(${hole.number}, 'fairway', 'right')">
                                →
                            </button>
                        </div>
                    </div>
                    ` : ''}
                    <div>
                        <label style="font-size: 0.75rem; margin-bottom: 4px; display: block; color: var(--text-dark); font-weight: 600;">Approach</label>
                        <div class="button-group approach-group" data-hole="${hole.number}" data-type="approach">
                            <button type="button" class="toggle-btn approach-up" data-value="long" onclick="selectToggle(${hole.number}, 'approach', 'long')">
                                ↑
                            </button>
                            <div style="display: flex; gap: 3px;">
                                <button type="button" class="toggle-btn" data-value="left" onclick="selectToggle(${hole.number}, 'approach', 'left')">
                                    ←
                                </button>
                                <button type="button" class="toggle-btn toggle-gir" data-value="gir" onclick="selectToggle(${hole.number}, 'approach', 'gir')">
                                    GIR
                                </button>
                                <button type="button" class="toggle-btn" data-value="right" onclick="selectToggle(${hole.number}, 'approach', 'right')">
                                    →
                                </button>
                            </div>
                            <button type="button" class="toggle-btn approach-down" data-value="short" onclick="selectToggle(${hole.number}, 'approach', 'short')">
                                ↓
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Putts and Sand Save Row -->
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 8px; align-items: end;">
                    <div>
                        <label style="font-size: 0.75rem; margin-bottom: 3px; display: block; color: var(--text-dark); font-weight: 600;">Putts</label>
                        <input type="number" id="putts${hole.number}" placeholder="Putts" min="0" max="10" style="width: 100%; padding: 8px;">
                    </div>
                    <div style="padding-bottom: 6px;">
                        <label class="checkbox-label" style="font-size: 0.75rem;">
                            <input type="checkbox" id="sandSave${hole.number}">
                            Sand
                        </label>
                    </div>
                </div>
            </div>
        </div>
    `}).join('');
}

// Toggle button selection
function selectToggle(holeNumber, type, value) {
    const group = document.querySelector(`.button-group[data-hole="${holeNumber}"][data-type="${type}"]`);
    if (!group) return;

    // Remove active class from all buttons in this group
    group.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('active', 'success'));

    // Add active class to clicked button
    const clickedBtn = group.querySelector(`[data-value="${value}"]`);
    if (clickedBtn) {
        clickedBtn.classList.add('active');

        // Add success class for fairway hit and GIR
        if (value === 'hit' || value === 'gir') {
            clickedBtn.classList.add('success');
        }
    }
}

// Update penalty input styling
function updatePenaltyStyle(holeNumber) {
    const input = document.getElementById(`penalties${holeNumber}`);
    const value = parseInt(input.value) || 0;

    if (value > 0) {
        input.classList.add('has-penalty');
    } else {
        input.classList.remove('has-penalty');
    }
}

// Round management
function saveRound() {
    const courseId = document.getElementById('courseSelect').value;
    if (!courseId) {
        showAlert('roundAlert', 'Please select a course', 'error');
        return;
    }

    const course = appData.courses.find(c => c.id === courseId);
    const numHoles = course.numHoles || course.holes.length;
    const holes = [];
    let totalScore = 0;

    for (let i = 1; i <= numHoles; i++) {
        const score = parseInt(document.getElementById(`score${i}`).value);
        if (!score) {
            showAlert('roundAlert', `Please enter score for hole ${i}`, 'error');
            return;
        }

        // Get fairway selection
        const fairwayGroup = document.querySelector(`.button-group[data-hole="${i}"][data-type="fairway"]`);
        const fairwayBtn = fairwayGroup ? fairwayGroup.querySelector('.toggle-btn.active') : null;
        const fairwayValue = fairwayBtn ? fairwayBtn.dataset.value : null;

        // Get approach selection
        const approachGroup = document.querySelector(`.button-group[data-hole="${i}"][data-type="approach"]`);
        const approachBtn = approachGroup ? approachGroup.querySelector('.toggle-btn.active') : null;
        const approachValue = approachBtn ? approachBtn.dataset.value : null;

        totalScore += score;
        holes.push({
            number: i,
            par: course.holes[i-1].par,
            score: score,
            putts: parseInt(document.getElementById(`putts${i}`).value) || 0,
            penalties: parseInt(document.getElementById(`penalties${i}`).value) || 0,
            fairwayHit: fairwayValue === 'hit',
            fairwayDirection: fairwayValue, // 'left', 'hit', 'right', or null
            gir: approachValue === 'gir',
            approachResult: approachValue, // 'gir', 'long', 'short', 'left', 'right', or null
            sandSave: document.getElementById(`sandSave${i}`).checked
        });
    }

    const round = {
        id: Date.now().toString(),
        courseId: courseId,
        courseName: course.name,
        numHoles: numHoles,
        date: document.getElementById('roundDate').value,
        tees: document.getElementById('teesPlayed').value,
        courseRating: course.rating,
        slopeRating: course.slope,
        totalScore: totalScore,
        holes: holes
    };

    appData.rounds.push(round);
    saveToLocalStorage();
    syncToGoogleSheets();

    showAlert('roundAlert', 'Round saved successfully!', 'success');
    setTimeout(() => {
        showView('dashboard');
        document.querySelector('nav button').click();
    }, 1500);
}

// Dashboard rendering
function renderDashboard() {
    const rounds = getFilteredRounds();

    if (rounds.length === 0) {
        document.getElementById('roundsList').innerHTML = `
            <div class="empty-state">
                <h3>No rounds recorded yet</h3>
                <p>Log your first round to see your stats</p>
            </div>
        `;
        return;
    }

    // Calculate stats
    const totalScores = rounds.map(r => r.totalScore);
    const avgScore = (totalScores.reduce((a, b) => a + b, 0) / totalScores.length).toFixed(1);

    let totalFairways = 0, fairwayOpportunities = 0;
    let totalGir = 0, girOpportunities = 0;
    let totalPutts = 0;
    let scramblingSuccess = 0, scramblingOpportunities = 0;

    rounds.forEach(round => {
        round.holes.forEach(hole => {
            // Fairway (only non-par-3)
            if (hole.par > 3 && hole.fairwayDirection) {
                fairwayOpportunities++;
                if (hole.fairwayHit) totalFairways++;
            }

            // GIR
            if (hole.approachResult) {
                girOpportunities++;
                if (hole.gir) totalGir++;
            }

            // Putts
            totalPutts += hole.putts || 0;

            // Scrambling (missed GIR but still made par or better)
            if (hole.approachResult && !hole.gir) {
                scramblingOpportunities++;
                if (hole.score <= hole.par) {
                    scramblingSuccess++;
                }
            }
        });
    });

    document.getElementById('avgScore').textContent = avgScore;
    document.getElementById('fairwayPct').textContent =
        fairwayOpportunities > 0 ? Math.round((totalFairways / fairwayOpportunities) * 100) + '%' : '--%';
    document.getElementById('girPct').textContent =
        girOpportunities > 0 ? Math.round((totalGir / girOpportunities) * 100) + '%' : '--%';
    document.getElementById('avgPutts').textContent =
        rounds.length > 0 ? (totalPutts / rounds.length).toFixed(1) : '--';
    document.getElementById('scramblingPct').textContent =
        scramblingOpportunities > 0 ? Math.round((scramblingSuccess / scramblingOpportunities) * 100) + '%' : '--%';

    // Calculate handicap
    calculateHandicap();

    // Render rounds list
    const sortedRounds = [...rounds].sort((a, b) => new Date(b.date) - new Date(a.date));
    document.getElementById('roundsList').innerHTML = sortedRounds.map(round => {
        const totalPar = round.holes.reduce((sum, h) => sum + h.par, 0);
        const diff = round.totalScore - totalPar;
        const diffStr = diff > 0 ? `+${diff}` : diff === 0 ? 'E' : diff.toString();
        const putts = round.holes.reduce((sum, h) => sum + (h.putts || 0), 0);
        const fairways = round.holes.filter(h => h.par > 3 && h.fairwayHit).length;
        const fairwayTotal = round.holes.filter(h => h.par > 3 && h.fairwayDirection).length;
        const girs = round.holes.filter(h => h.gir).length;

        return `
        <div class="round-item" onclick="viewRound('${round.id}')">
            <div class="round-header">
                <div>
                    <div class="round-course">${round.courseName}</div>
                    <div class="round-date">${new Date(round.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                </div>
                <div class="round-score">${round.totalScore} <span style="font-size: 1rem; color: var(--text-light);">(${diffStr})</span></div>
            </div>
            <div class="round-stats">
                <div class="round-stat">
                    <div class="round-stat-label">Putts</div>
                    <div class="round-stat-value">${putts}</div>
                </div>
                <div class="round-stat">
                    <div class="round-stat-label">Fairways</div>
                    <div class="round-stat-value">${fairways}/${fairwayTotal}</div>
                </div>
                <div class="round-stat">
                    <div class="round-stat-label">GIR</div>
                    <div class="round-stat-value">${girs}/${round.numHoles || round.holes.length}</div>
                </div>
                <div class="round-stat">
                    <div class="round-stat-label">Tees</div>
                    <div class="round-stat-value">${round.tees || 'N/A'}</div>
                </div>
            </div>
        </div>
    `}).join('');
}

function calculateHandicap() {
    const rounds = appData.rounds.filter(r => r.courseRating && r.slopeRating);
    if (rounds.length < 3) {
        document.getElementById('handicapValue').textContent = '--';
        return;
    }

    // Calculate differentials
    const differentials = rounds.map(r => {
        return ((r.totalScore - r.courseRating) * 113) / r.slopeRating;
    }).sort((a, b) => a - b);

    // Use best differentials based on number of rounds
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
    const handicap = (bestDiffs.reduce((a, b) => a + b, 0) / numToUse * 0.96).toFixed(1);

    document.getElementById('handicapValue').textContent = handicap;
}

function getFilteredRounds() {
    let rounds = [...appData.rounds];

    const startDate = document.getElementById('filterStartDate').value;
    const endDate = document.getElementById('filterEndDate').value;
    const filterCount = document.getElementById('filterRounds').value;

    if (startDate) {
        rounds = rounds.filter(r => r.date >= startDate);
    }
    if (endDate) {
        rounds = rounds.filter(r => r.date <= endDate);
    }

    rounds.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (filterCount !== 'all') {
        rounds = rounds.slice(0, parseInt(filterCount));
    }

    return rounds;
}

function applyFilters() {
    renderDashboard();
}

function viewRound(roundId) {
    const round = appData.rounds.find(r => r.id === roundId);
    if (!round) return;
    alert(`Round Details:\n\nCourse: ${round.courseName}\nDate: ${round.date}\nScore: ${round.totalScore}\nHoles: ${round.numHoles || round.holes.length}\n\nHole-by-hole:\n${round.holes.map(h => `H${h.number}: ${h.score} (Par ${h.par}) - ${h.putts} putts`).join('\n')}`);
}

// Alert helper
function showAlert(containerId, message, type) {
    const container = document.getElementById(containerId);
    container.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
    setTimeout(() => { container.innerHTML = ''; }, 5000);
}

// Settings management
function saveSettings() {
    appData.settings.apiKey = document.getElementById('apiKey').value;
    appData.settings.spreadsheetId = document.getElementById('spreadsheetId').value;
    saveToLocalStorage();
    showAlert('settingsAlert', 'Settings saved successfully!', 'success');
}

function loadSettings() {
    document.getElementById('apiKey').value = appData.settings.apiKey || '';
    document.getElementById('spreadsheetId').value = appData.settings.spreadsheetId || '';
}

function testConnection() {
    if (!appData.settings.apiKey || !appData.settings.spreadsheetId) {
        showAlert('settingsAlert', 'Please enter both API key and Spreadsheet ID', 'error');
        return;
    }
    syncFromGoogleSheets();
}

// Google Sheets sync
async function syncToGoogleSheets() {
    if (!appData.settings.apiKey || !appData.settings.spreadsheetId) return;

    try {
        const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${appData.settings.spreadsheetId}`;

        // Sync courses
        const courseRows = [['ID', 'Name', 'Location', 'Holes', 'Rating', 'Slope', 'Yardage', 'Hole Data']];
        appData.courses.forEach(c => {
            courseRows.push([c.id, c.name, c.location, c.numHoles, c.rating, c.slope, c.totalYardage, JSON.stringify(c.holes)]);
        });

        await fetch(`${sheetsUrl}/values/Courses!A:H?valueInputOption=RAW`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${appData.settings.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ values: courseRows })
        });

        // Sync rounds
        const roundRows = [['ID', 'Course ID', 'Course Name', 'Date', 'Tees', 'Score', 'Rating', 'Slope', 'Hole Data']];
        appData.rounds.forEach(r => {
            roundRows.push([r.id, r.courseId, r.courseName, r.date, r.tees, r.totalScore, r.courseRating, r.slopeRating, JSON.stringify(r.holes)]);
        });

        await fetch(`${sheetsUrl}/values/Rounds!A:I?valueInputOption=RAW`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${appData.settings.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ values: roundRows })
        });

    } catch (error) {
        console.log('Google Sheets sync failed:', error);
    }
}

async function syncFromGoogleSheets() {
    if (!appData.settings.apiKey || !appData.settings.spreadsheetId) return;

    try {
        const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${appData.settings.spreadsheetId}`;

        // Read courses
        const coursesRes = await fetch(`${sheetsUrl}/values/Courses!A:H?key=${appData.settings.apiKey}`);
        if (coursesRes.ok) {
            const coursesData = await coursesRes.json();
            if (coursesData.values && coursesData.values.length > 1) {
                appData.courses = coursesData.values.slice(1).map(row => ({
                    id: row[0],
                    name: row[1],
                    location: row[2],
                    numHoles: parseInt(row[3]),
                    rating: parseFloat(row[4]),
                    slope: parseInt(row[5]),
                    totalYardage: parseInt(row[6]),
                    holes: JSON.parse(row[7] || '[]')
                }));
            }
        }

        // Read rounds
        const roundsRes = await fetch(`${sheetsUrl}/values/Rounds!A:I?key=${appData.settings.apiKey}`);
        if (roundsRes.ok) {
            const roundsData = await roundsRes.json();
            if (roundsData.values && roundsData.values.length > 1) {
                appData.rounds = roundsData.values.slice(1).map(row => ({
                    id: row[0],
                    courseId: row[1],
                    courseName: row[2],
                    date: row[3],
                    tees: row[4],
                    totalScore: parseInt(row[5]),
                    courseRating: parseFloat(row[6]),
                    slopeRating: parseInt(row[7]),
                    holes: JSON.parse(row[8] || '[]')
                }));
            }
        }

        saveToLocalStorage();
        renderCourseList();
        loadCourseSelect();
        renderDashboard();
        showAlert('settingsAlert', 'Data synced from Google Sheets successfully!', 'success');

    } catch (error) {
        showAlert('settingsAlert', 'Failed to sync: ' + error.message, 'error');
    }
}

// Data management
function exportData() {
    const dataStr = JSON.stringify(appData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `golf-tracker-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function clearAllData() {
    if (confirm('Are you sure you want to clear ALL data? This cannot be undone.')) {
        if (confirm('This will delete all courses and rounds. Are you REALLY sure?')) {
            appData = { courses: [], rounds: [], settings: appData.settings };
            saveToLocalStorage();
            renderCourseList();
            loadCourseSelect();
            renderDashboard();
            showAlert('settingsAlert', 'All data has been cleared.', 'success');
        }
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);
