// Global state
let appData = {
    courses: [],
    rounds: [],
    settings: {
        webAppUrl: ''
    }
};

let editingCourseId = null;
let editingRoundId = null;

// Initialize app
function init() {
    loadFromLocalStorage();

    // Apply theme early to avoid flash of wrong theme
    applyTheme(appData.settings.theme || 'light');

    // Normalize IDs to strings (Google Sheets converts numeric strings to numbers)
    appData.courses.forEach(c => { c.id = String(c.id); });
    appData.rounds.forEach(r => { r.id = String(r.id); r.courseId = String(r.courseId); });

    // Auto-migrate courses missing tees structure (e.g., corrupted by old Google Sheets sync)
    let migrated = false;
    appData.courses.forEach(course => {
        if (!course.tees) {
            course.tees = {
                red:   { enabled: false, rating: null, slope: null, totalYardage: null, yardages: [], handicaps: [] },
                white: { enabled: true, rating: course.rating || null, slope: course.slope || null, totalYardage: course.totalYardage || null, yardages: [], handicaps: [] },
                blue:  { enabled: false, rating: null, slope: null, totalYardage: null, yardages: [], handicaps: [] }
            };
            migrated = true;
        }
    });
    if (migrated) saveToLocalStorage();

    // Add TEST course if it doesn't exist
    if (!appData.courses.find(c => c.name === 'TRU TEST Course')) {
        const testCourse = {
            id: 'test-course-001',
            name: 'TRU TEST Course',
            location: 'Rexburg, ID',
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
                { number: 9, par: 4 }
            ],
            tees: {
                red: { enabled: false, rating: null, slope: null, totalYardage: null, yardages: [] },
                white: {
                    enabled: true,
                    rating: 35.5,
                    slope: 113,
                    totalYardage: 3200,
                    yardages: [380, 165, 520, 390, 350, 180, 410, 495, 310]
                },
                blue: { enabled: false, rating: null, slope: null, totalYardage: null, yardages: [] }
            }
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

    // Reset edit state when navigating away from new-round
    if (viewName !== 'new-round') {
        resetRoundForm();
    }

    if (viewName === 'dashboard') {
        renderDashboard();
    } else if (viewName === 'new-round') {
        if (appData.courses.length === 0 && !editingRoundId) {
            document.getElementById('holeInputs').innerHTML = `
                <div class="empty-state">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="currentColor"><path d="M8,52 Q20,38 32,44 Q44,50 56,36" stroke="currentColor" stroke-width="3" fill="none" opacity="0.3"/><rect x="44" y="20" width="3" height="22" rx="1.5"/><polygon points="47,20 60,26 47,32"/><circle cx="20" cy="46" r="3" opacity="0.3"/></svg>
                    <h3>Add a course first</h3>
                    <p>Before you can log a round, you need to set up at least one course with hole details.</p>
                    <button class="empty-state-cta" onclick="document.querySelectorAll('nav button')[2].click()">Go to Courses</button>
                </div>
            `;
        }
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
        migrateCourses();
        migrateRounds();
    }
}

function migrateCourses() {
    let changed = false;
    appData.courses.forEach(course => {
        // Migrate old format (course.rating, course.slope, holes[].yardage) → tees.white
        if (!course.tees && (course.rating || course.slope || (course.holes.length > 0 && course.holes[0].yardage !== undefined))) {
            course.tees = {
                red: { enabled: false, rating: null, slope: null, totalYardage: null, yardages: [] },
                white: {
                    enabled: true,
                    rating: course.rating || null,
                    slope: course.slope || null,
                    totalYardage: course.totalYardage || 0,
                    yardages: course.holes.map(h => h.yardage || 0)
                },
                blue: { enabled: false, rating: null, slope: null, totalYardage: null, yardages: [] }
            };
            // Clean up old fields
            delete course.rating;
            delete course.slope;
            delete course.totalYardage;
            course.holes.forEach(h => delete h.yardage);
            changed = true;
        }
    });
    if (changed) saveToLocalStorage();
}

function migrateRounds() {
    let changed = false;
    appData.rounds.forEach(round => {
        round.holes.forEach(hole => {
            if ('sandSave' in hole) {
                hole.bunker = hole.sandSave;
                delete hole.sandSave;
                changed = true;
            }
        });
    });
    if (changed) saveToLocalStorage();
}

// Course management
const TEE_COLORS = ['red', 'white', 'blue'];
const TEE_LABELS = { red: 'Red', white: 'White', blue: 'Blue' };

function showAddCourseModal() {
    editingCourseId = null;
    document.getElementById('courseModalTitle').textContent = 'Add New Course';
    document.getElementById('courseName').value = '';
    document.getElementById('courseLocation').value = '';
    document.getElementById('courseHoles').value = '18';

    // Reset tee checkboxes and fields
    TEE_COLORS.forEach(color => {
        document.getElementById(`teeEnabled${capitalize(color)}`).checked = false;
        document.getElementById(`teeFields${capitalize(color)}`).classList.remove('active');
        document.getElementById(`teeRating${capitalize(color)}`).value = '';
        document.getElementById(`teeSlope${capitalize(color)}`).value = '';
        document.getElementById(`teeYardage${capitalize(color)}`).value = '';
    });

    renderCourseHoleInputs();
    document.getElementById('courseModal').classList.add('active');
}

function closeCourseModal() {
    document.getElementById('courseModal').classList.remove('active');
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function getEnabledTees() {
    return TEE_COLORS.filter(color => document.getElementById(`teeEnabled${capitalize(color)}`).checked);
}

function onTeeToggle() {
    TEE_COLORS.forEach(color => {
        const enabled = document.getElementById(`teeEnabled${capitalize(color)}`).checked;
        const fields = document.getElementById(`teeFields${capitalize(color)}`);
        if (enabled) {
            fields.classList.add('active');
        } else {
            fields.classList.remove('active');
        }
    });
    renderCourseHoleInputs();
}

function renderCourseHoleInputs() {
    const container = document.getElementById('courseHoleInputs');
    const numHoles = parseInt(document.getElementById('courseHoles').value) || 18;
    const enabledTees = getEnabledTees();

    // Build table header
    let headerCols = '<th>Hole</th><th>Par</th>';
    enabledTees.forEach(color => {
        headerCols += `<th class="tee-header-${color}">${TEE_LABELS[color]} Yds</th>`;
        headerCols += `<th class="tee-header-${color}">${TEE_LABELS[color]} Hcp</th>`;
    });

    // Build table rows
    let rows = '';
    for (let i = 1; i <= numHoles; i++) {
        // Preserve existing values if they exist
        const existingPar = document.getElementById(`holePar${i}`)?.value;
        const parVal = existingPar !== undefined && existingPar !== '' ? existingPar : '4';

        let teeCells = '';
        enabledTees.forEach(color => {
            const existingYd = document.getElementById(`holeYards${color}${i}`)?.value || '';
            const existingHcp = document.getElementById(`holeHcp${color}${i}`)?.value || '';
            teeCells += `<td><input type="number" id="holeYards${color}${i}" placeholder="Yds" value="${existingYd}" min="50" max="700"></td>`;
            teeCells += `<td><input type="number" id="holeHcp${color}${i}" placeholder="Hcp" value="${existingHcp}" min="1" max="${numHoles}"></td>`;
        });

        rows += `<tr>
            <td class="hole-num-col">${i}</td>
            <td><input type="number" id="holePar${i}" placeholder="Par" min="3" max="6" value="${parVal}"></td>
            ${teeCells}
        </tr>`;
    }

    if (enabledTees.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--text-light);">
                Select at least one tee set above to enter hole details
            </div>`;
        return;
    }

    container.innerHTML = `
        <table class="hole-setup-table">
            <thead><tr>${headerCols}</tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
}

function updateHoleInputs() {
    renderCourseHoleInputs();
}

function saveCourse() {
    const numHoles = parseInt(document.getElementById('courseHoles').value) || 18;
    const enabledTees = getEnabledTees();
    const courseName = document.getElementById('courseName').value.trim();
    const errors = [];

    // Validate course name
    if (!courseName) {
        errors.push('Course name is required.');
    }

    // Validate at least one tee enabled
    if (enabledTees.length === 0) {
        errors.push('Please enable at least one tee set.');
    }

    // Validate tee data for enabled tees
    enabledTees.forEach(color => {
        const cap = capitalize(color);
        const label = TEE_LABELS[color];
        const rating = parseFloat(document.getElementById(`teeRating${cap}`).value);
        const slope = parseInt(document.getElementById(`teeSlope${cap}`).value);
        const yardage = parseInt(document.getElementById(`teeYardage${cap}`).value);

        if (rating && (rating < 55 || rating > 80)) {
            errors.push(`${label} rating should be between 55 and 80.`);
        }
        if (slope && (slope < 55 || slope > 155)) {
            errors.push(`${label} slope should be between 55 and 155.`);
        }
        if (yardage && yardage < 0) {
            errors.push(`${label} yardage must be positive.`);
        }
    });

    // Validate hole pars
    for (let i = 1; i <= numHoles; i++) {
        const par = parseInt(document.getElementById(`holePar${i}`).value);
        if (par && (par < 3 || par > 5)) {
            errors.push(`Hole ${i} par must be 3, 4, or 5.`);
            break; // One message is enough
        }
    }

    if (errors.length > 0) {
        showAlert('courseModalAlert', errors.join('<br>'), 'error');
        return;
    }

    // Build tees object
    const tees = {};
    TEE_COLORS.forEach(color => {
        const cap = capitalize(color);
        const enabled = document.getElementById(`teeEnabled${cap}`).checked;
        if (enabled) {
            const yardages = [];
            const handicaps = [];
            for (let i = 1; i <= numHoles; i++) {
                yardages.push(parseInt(document.getElementById(`holeYards${color}${i}`).value) || 0);
                handicaps.push(parseInt(document.getElementById(`holeHcp${color}${i}`).value) || 0);
            }
            tees[color] = {
                enabled: true,
                rating: parseFloat(document.getElementById(`teeRating${cap}`).value) || null,
                slope: parseInt(document.getElementById(`teeSlope${cap}`).value) || null,
                totalYardage: parseInt(document.getElementById(`teeYardage${cap}`).value) || 0,
                yardages: yardages,
                handicaps: handicaps
            };
        } else {
            tees[color] = { enabled: false, rating: null, slope: null, totalYardage: null, yardages: [], handicaps: [] };
        }
    });

    // Build holes (par only, shared across tees)
    const holes = [];
    for (let i = 1; i <= numHoles; i++) {
        holes.push({
            number: i,
            par: parseInt(document.getElementById(`holePar${i}`).value) || 4
        });
    }

    const course = {
        id: editingCourseId || Date.now().toString(),
        name: courseName,
        location: document.getElementById('courseLocation').value,
        numHoles: numHoles,
        holes: holes,
        tees: tees
    };

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

    // Set tee checkboxes and fields
    TEE_COLORS.forEach(color => {
        const cap = capitalize(color);
        const tee = course.tees && course.tees[color];
        const enabled = tee && tee.enabled;
        document.getElementById(`teeEnabled${cap}`).checked = enabled;
        if (enabled) {
            document.getElementById(`teeFields${cap}`).classList.add('active');
            document.getElementById(`teeRating${cap}`).value = tee.rating || '';
            document.getElementById(`teeSlope${cap}`).value = tee.slope || '';
            document.getElementById(`teeYardage${cap}`).value = tee.totalYardage || '';
        } else {
            document.getElementById(`teeFields${cap}`).classList.remove('active');
            document.getElementById(`teeRating${cap}`).value = '';
            document.getElementById(`teeSlope${cap}`).value = '';
            document.getElementById(`teeYardage${cap}`).value = '';
        }
    });

    // Render hole table, then populate values
    renderCourseHoleInputs();

    course.holes.forEach((hole, i) => {
        document.getElementById(`holePar${i+1}`).value = hole.par;
    });

    // Populate per-tee yardages and handicaps
    TEE_COLORS.forEach(color => {
        const tee = course.tees && course.tees[color];
        if (tee && tee.enabled) {
            if (tee.yardages) {
                tee.yardages.forEach((yd, i) => {
                    const input = document.getElementById(`holeYards${color}${i+1}`);
                    if (input) input.value = yd || '';
                });
            }
            if (tee.handicaps) {
                tee.handicaps.forEach((hcp, i) => {
                    const input = document.getElementById(`holeHcp${color}${i+1}`);
                    if (input) input.value = hcp || '';
                });
            }
        }
    });

    document.getElementById('courseModal').classList.add('active');
}

async function deleteCourse(courseId) {
    const course = appData.courses.find(c => c.id === courseId);
    const name = course ? course.name : 'this course';
    const confirmed = await showConfirmDialog({
        title: 'Delete Course',
        message: `"${name}" and its hole data will be permanently removed. Rounds played here will keep their scores.`,
        confirmText: 'Delete Course',
        icon: '\uD83D\uDDD1\uFE0F'
    });
    if (confirmed) {
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
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="currentColor"><path d="M8,52 Q20,38 32,44 Q44,50 56,36" stroke="currentColor" stroke-width="3" fill="none" opacity="0.3"/><rect x="44" y="20" width="3" height="22" rx="1.5"/><polygon points="47,20 60,26 47,32"/><circle cx="20" cy="46" r="3" opacity="0.3"/></svg>
                <h3>No courses yet</h3>
                <p>Add your home course to get started. You can add hole details, multiple tee sets, and more.</p>
                <button class="empty-state-cta" onclick="showAddCourseModal()">Add Your First Course</button>
            </div>
        `;
        return;
    }

    container.innerHTML = appData.courses.map((course, idx) => {
        const numHoles = course.numHoles || course.holes.length;
        const totalPar = course.holes.reduce((sum, h) => sum + h.par, 0);

        // Build tee summary
        let teeInfo = '';
        if (course.tees) {
            const teeStrings = TEE_COLORS
                .filter(c => course.tees[c] && course.tees[c].enabled)
                .map(c => {
                    const t = course.tees[c];
                    return `<span class="tee-dot tee-dot-${c}" style="display:inline-block;width:10px;height:10px;vertical-align:middle;margin-right:2px;"></span>${TEE_LABELS[c]} ${t.totalYardage || '?'}y (${t.rating || '?'}/${t.slope || '?'})`;
                });
            teeInfo = teeStrings.join(' &bull; ');
        } else {
            teeInfo = `${course.totalYardage || '?'} yards &bull; Rating: ${course.rating || '?'} &bull; Slope: ${course.slope || '?'}`;
        }

        return `
        <div class="course-item course-item-clickable" draggable="true" data-course-idx="${idx}" onclick="viewCourseDetail('${course.id}')">
            <div class="drag-handle" title="Drag to reorder">&#x2630;</div>
            <div class="course-info">
                <h3>${course.name}</h3>
                <div class="course-details">
                    ${course.location} &bull; ${numHoles} Holes &bull; Par ${totalPar}
                </div>
                <div class="course-details" style="margin-top: 4px;">
                    ${teeInfo}
                </div>
            </div>
            <div class="course-actions">
                <button class="btn-small btn-edit" onclick="event.stopPropagation(); editCourse('${course.id}')">Edit</button>
                <button class="btn-small btn-delete" onclick="event.stopPropagation(); deleteCourse('${course.id}')">Delete</button>
            </div>
        </div>
    `}).join('');

    // Wire up drag-and-drop reordering
    initCourseDragDrop();
}

function reorderCourses(fromIdx, toIdx) {
    reorderArray(appData.courses, fromIdx, toIdx);
    saveToLocalStorage();
}

function initCourseDragDrop() {
    const container = document.getElementById('courseList');
    const items = container.querySelectorAll('.course-item[draggable]');
    let dragIdx = null;

    // Prevent browser default drop on the container (avoids nesting)
    container.addEventListener('dragover', (e) => { e.preventDefault(); });
    container.addEventListener('drop', (e) => { e.preventDefault(); });

    items.forEach(item => {
        item.addEventListener('dragstart', (e) => {
            dragIdx = parseInt(item.dataset.courseIdx);
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', '');
        });

        item.addEventListener('dragend', () => {
            // Always re-render to guarantee a clean DOM
            renderCourseList();
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            const targetIdx = parseInt(item.dataset.courseIdx);
            if (targetIdx !== dragIdx) {
                container.querySelectorAll('.course-item').forEach(el => el.classList.remove('drag-over'));
                item.classList.add('drag-over');
            }
        });

        item.addEventListener('dragleave', () => {
            item.classList.remove('drag-over');
        });

        item.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const targetIdx = parseInt(item.dataset.courseIdx);
            if (dragIdx !== null && dragIdx !== targetIdx) {
                reorderCourses(dragIdx, targetIdx);
            }
            // dragend will fire next and re-render
        });
    });
}

function loadCourseSelect() {
    const select = document.getElementById('courseSelect');
    select.innerHTML = '<option value="">Select a course...</option>' +
        appData.courses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    loadCourseFilter();
}

function loadCourseData() {
    const courseId = document.getElementById('courseSelect').value;
    if (!courseId) {
        document.getElementById('holeInputs').innerHTML = '';
        document.getElementById('teesPlayed').innerHTML = '<option value="">Select tees...</option>';
        return;
    }

    const course = appData.courses.find(c => c.id === courseId);
    if (!course) return;

    // Populate tees dropdown with enabled tees
    const teesSelect = document.getElementById('teesPlayed');
    if (course.tees) {
        const enabledTees = TEE_COLORS.filter(c => course.tees[c] && course.tees[c].enabled);
        teesSelect.innerHTML = enabledTees.map((color, i) =>
            `<option value="${color}" ${i === 0 ? 'selected' : ''}>${TEE_LABELS[color]}</option>`
        ).join('');
    } else {
        // Legacy course — single tee option
        teesSelect.innerHTML = '<option value="white" selected>White</option>';
    }

    renderHoleCards(course);
}

const HANDICAP_ELIGIBLE_TYPES = ['normal', 'league', 'match_play'];
const ROUND_TYPE_LABELS = { normal: 'Normal', league: 'League Match', match_play: 'Match Play', casual: 'Casual', scramble: 'Scramble' };
const MATCH_PLAY_TYPES = ['league', 'match_play'];

function onRoundTypeChange() {
    const roundType = document.getElementById('roundType').value;
    const note = document.getElementById('roundTypeNote');
    if (HANDICAP_ELIGIBLE_TYPES.includes(roundType)) {
        note.textContent = 'Counts toward handicap';
        note.classList.remove('no-handicap');
    } else {
        note.textContent = 'Does not count toward handicap';
        note.classList.add('no-handicap');
    }

    // Show/hide match play W/D/L toggles
    const isMatchType = MATCH_PLAY_TYPES.includes(roundType);
    document.querySelectorAll('.match-toggle-row').forEach(row => {
        row.style.display = isMatchType ? '' : 'none';
        if (!isMatchType) {
            // Clear match selections when switching away
            row.querySelectorAll('.toggle-btn.active').forEach(btn => btn.classList.remove('active'));
        }
    });
}

function onTeeSelectChange() {
    const courseId = document.getElementById('courseSelect').value;
    if (!courseId) return;
    const course = appData.courses.find(c => c.id === courseId);
    if (!course) return;
    renderHoleCards(course);
}

function renderHoleCards(course) {
    const selectedTee = document.getElementById('teesPlayed').value;
    const teeData = course.tees && course.tees[selectedTee];

    const container = document.getElementById('holeInputs');
    container.innerHTML = course.holes.map((hole, idx) => {
        const yardage = teeData && teeData.yardages && teeData.yardages[idx] ? teeData.yardages[idx] : (hole.yardage || '?');
        const hcp = teeData && teeData.handicaps && teeData.handicaps[idx] ? teeData.handicaps[idx] : null;
        const hcpStr = hcp ? ` &bull; Hcp ${hcp}` : '';
        const isPar3 = hole.par === 3;

        return `
        <div class="hole-card">
            <div class="hole-header">
                <div class="hole-number">Hole ${hole.number}</div>
                <div class="hole-par">Par ${hole.par} &bull; ${yardage}y${hcpStr}</div>
            </div>
            <div class="match-toggle-row" data-hole="${hole.number}" style="display: none;">
                <div class="button-group" data-hole="${hole.number}" data-type="match">
                    <button type="button" class="toggle-btn match-win" data-value="win" onclick="selectToggle(${hole.number}, 'match', 'win')">W</button>
                    <button type="button" class="toggle-btn match-draw" data-value="draw" onclick="selectToggle(${hole.number}, 'match', 'draw')">D</button>
                    <button type="button" class="toggle-btn match-loss" data-value="loss" onclick="selectToggle(${hole.number}, 'match', 'loss')">L</button>
                </div>
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

                <!-- Putts and Bunker Row -->
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 8px; align-items: end;">
                    <div>
                        <label style="font-size: 0.75rem; margin-bottom: 3px; display: block; color: var(--text-dark); font-weight: 600;">Putts</label>
                        <input type="number" id="putts${hole.number}" placeholder="Putts" min="0" max="10" style="width: 100%; padding: 8px;" oninput="renderPuttDistances(${hole.number})">
                    </div>
                    <div style="padding-bottom: 6px;">
                        <label class="checkbox-label" style="font-size: 0.75rem;">
                            <input type="checkbox" id="bunker${hole.number}">
                            Bunker
                        </label>
                    </div>
                </div>
                <div id="puttDistContainer${hole.number}" class="putt-dist-container"></div>
            </div>
        </div>
    `}).join('');
}

function renderPuttDistances(holeNumber) {
    const container = document.getElementById(`puttDistContainer${holeNumber}`);
    const numPutts = parseInt(document.getElementById(`putts${holeNumber}`).value) || 0;

    if (numPutts === 0) {
        container.innerHTML = '';
        return;
    }

    let html = '<div class="putt-dist-row">';
    for (let p = 1; p <= numPutts; p++) {
        const isMade = (p === numPutts);
        const colorClass = isMade ? 'putt-dist-made' : 'putt-dist-missed';
        html += `
            <div class="putt-dist-input-wrapper">
                <input type="number" id="puttDist${holeNumber}_${p}"
                       class="putt-dist-input ${colorClass}"
                       placeholder="${p}" min="1" max="150">
                <span class="putt-dist-suffix">ft</span>
            </div>
        `;
    }
    html += '</div>';
    container.innerHTML = html;
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
        showAlert('roundAlert', 'Please select a course.', 'error');
        return;
    }

    const roundDate = document.getElementById('roundDate').value;
    if (!roundDate) {
        showAlert('roundAlert', 'Please select a date.', 'error');
        return;
    }

    const course = appData.courses.find(c => c.id === courseId);
    const numHoles = course.numHoles || course.holes.length;
    const holes = [];
    let totalScore = 0;
    const errors = [];

    for (let i = 1; i <= numHoles; i++) {
        const score = parseInt(document.getElementById(`score${i}`).value);
        if (!score) {
            showAlert('roundAlert', `Please enter score for hole ${i}.`, 'error');
            return;
        }

        if (score < 1 || score > 15) {
            errors.push(`Hole ${i}: score ${score} seems unlikely (expected 1-15).`);
        }

        const putts = parseInt(document.getElementById(`putts${i}`).value) || 0;
        if (putts > score) {
            errors.push(`Hole ${i}: putts (${putts}) can't exceed score (${score}).`);
        }
        if (putts < 0) {
            errors.push(`Hole ${i}: putts can't be negative.`);
        }

        const penalties = parseInt(document.getElementById(`penalties${i}`).value) || 0;
        if (penalties < 0) {
            errors.push(`Hole ${i}: penalties can't be negative.`);
        }

        // Validate putt distances are positive
        const numPutts = putts;
        for (let p = 1; p <= numPutts; p++) {
            const distInput = document.getElementById(`puttDist${i}_${p}`);
            if (distInput && distInput.value !== '') {
                const dist = parseInt(distInput.value);
                if (dist < 0) {
                    errors.push(`Hole ${i}: putt distance can't be negative.`);
                    break;
                }
            }
        }

        if (errors.length > 0) break; // Stop at first hole with errors

        // Get fairway selection
        const fairwayGroup = document.querySelector(`.button-group[data-hole="${i}"][data-type="fairway"]`);
        const fairwayBtn = fairwayGroup ? fairwayGroup.querySelector('.toggle-btn.active') : null;
        const fairwayValue = fairwayBtn ? fairwayBtn.dataset.value : null;

        // Get approach selection
        const approachGroup = document.querySelector(`.button-group[data-hole="${i}"][data-type="approach"]`);
        const approachBtn = approachGroup ? approachGroup.querySelector('.toggle-btn.active') : null;
        const approachValue = approachBtn ? approachBtn.dataset.value : null;

        // Get match play result
        const matchGroup = document.querySelector(`.button-group[data-hole="${i}"][data-type="match"]`);
        const matchBtn = matchGroup ? matchGroup.querySelector('.toggle-btn.active') : null;
        const matchResult = matchBtn ? matchBtn.dataset.value : null;

        totalScore += score;
        holes.push({
            number: i,
            par: course.holes[i-1].par,
            score: score,
            putts: putts,
            puttDistances: (() => {
                const distances = [];
                for (let p = 1; p <= numPutts; p++) {
                    const distInput = document.getElementById(`puttDist${i}_${p}`);
                    if (distInput && distInput.value !== '') {
                        distances.push(parseInt(distInput.value));
                    } else {
                        distances.push(null);
                    }
                }
                return distances;
            })(),
            penalties: penalties,
            fairwayHit: fairwayValue === 'hit',
            fairwayDirection: fairwayValue, // 'left', 'hit', 'right', or null
            gir: approachValue === 'gir',
            approachResult: approachValue, // 'gir', 'long', 'short', 'left', 'right', or null
            bunker: document.getElementById(`bunker${i}`).checked,
            matchResult: matchResult
        });
    }

    if (errors.length > 0) {
        showAlert('roundAlert', errors.join('<br>'), 'error');
        return;
    }

    // Get rating/slope from selected tee
    const selectedTee = document.getElementById('teesPlayed').value;
    let courseRating = null;
    let slopeRating = null;
    if (course.tees && course.tees[selectedTee]) {
        courseRating = course.tees[selectedTee].rating;
        slopeRating = course.tees[selectedTee].slope;
    } else {
        // Legacy course fallback
        courseRating = course.rating || null;
        slopeRating = course.slope || null;
    }

    const round = {
        id: editingRoundId || Date.now().toString(),
        courseId: courseId,
        courseName: course.name,
        numHoles: numHoles,
        date: document.getElementById('roundDate').value,
        tees: selectedTee,
        roundType: document.getElementById('roundType').value,
        courseRating: courseRating,
        slopeRating: slopeRating,
        totalScore: totalScore,
        holes: holes
    };

    if (editingRoundId) {
        const index = appData.rounds.findIndex(r => r.id === editingRoundId);
        appData.rounds[index] = round;
    } else {
        appData.rounds.push(round);
    }

    saveToLocalStorage();
    syncToGoogleSheets();

    const msg = editingRoundId ? 'Round updated successfully!' : 'Round saved successfully!';
    resetRoundForm();
    showAlert('roundAlert', msg, 'success');
    setTimeout(() => {
        showView('dashboard');
        document.querySelector('nav button').click();
    }, 1500);
}

// Dashboard rendering
function renderDashboard() {
    const rounds = getFilteredRounds();

    if (rounds.length === 0) {
        document.getElementById('dashboardContent').innerHTML = '';
        if (appData.courses.length === 0) {
            document.getElementById('roundsList').innerHTML = `
                <div class="empty-state">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="currentColor"><rect x="30" y="8" width="3" height="48" rx="1.5"/><polygon points="33,8 54,17 33,26"/><ellipse cx="31" cy="56" rx="14" ry="4" opacity="0.3"/></svg>
                    <h3>Welcome to Golf Stats Tracker</h3>
                    <p>Start by adding a course, then log your first round to see your stats come to life.</p>
                    <button class="empty-state-cta" onclick="document.querySelectorAll('nav button')[2].click()">Add Your First Course</button>
                </div>
            `;
        } else {
            document.getElementById('roundsList').innerHTML = `
                <div class="empty-state">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="currentColor"><rect x="30" y="8" width="3" height="48" rx="1.5"/><polygon points="33,8 54,17 33,26"/><ellipse cx="31" cy="56" rx="14" ry="4" opacity="0.3"/></svg>
                    <h3>No rounds recorded yet</h3>
                    <p>You have ${appData.courses.length} course${appData.courses.length !== 1 ? 's' : ''} set up. Log your first round to start tracking your game.</p>
                    <button class="empty-state-cta" onclick="document.querySelectorAll('nav button')[1].click()">Log a Round</button>
                </div>
            `;
        }
        return;
    }

    const stats = computeStats(rounds);
    const handicap = computeHandicap(appData.rounds);

    const pct = (v) => v !== null ? v + '%' : '--';
    const val = (v) => v ?? '--';

    // Helper: build a distribution bar from segments [{cls, pct, label}]
    function distBar(segments) {
        const segs = segments.filter(s => s.pct > 0);
        if (segs.length === 0) return '<div class="dist-bar"><div class="dist-segment" style="flex:1;background:var(--cream);color:var(--text-light);">No data</div></div>';
        return '<div class="dist-bar">' + segs.map(s =>
            `<div class="dist-segment ${s.cls}" style="flex:${s.pct}">${s.pct >= 8 ? s.label : ''}</div>`
        ).join('') + '</div>';
    }

    // Helper: legend items
    function distLegend(items) {
        return '<div class="dist-legend">' + items.map(i =>
            `<div class="dist-legend-item"><span class="dist-legend-dot ${i.cls}"></span>${i.label}: ${i.value}%</div>`
        ).join('') + '</div>';
    }

    // Helper: vs-par styling
    function vsParStr(vsPar) {
        if (vsPar === null || vsPar === undefined) return '';
        const cls = vsPar > 0 ? 'vs-over' : vsPar < 0 ? 'vs-under' : 'vs-even';
        const sign = vsPar > 0 ? '+' : '';
        return `<span class="${cls}">${sign}${vsPar}</span>`;
    }

    // Helper: goal badge + color class for a KPI
    function goalBadge(key, value) {
        const goals = appData.settings.goals || {};
        const goal = goals[key];
        const def = GOAL_DEFS[key];
        if (!goal || goal.target === undefined || goal.target === null || !def) return { cls: '', badge: '' };
        const buffer = goal.buffer !== undefined ? goal.buffer : def.buffer;
        const status = getGoalStatus(value, goal.target, def.direction, buffer);
        if (!status) return { cls: '', badge: '' };
        const cls = 'goal-' + status;
        const badge = `<div class="stat-goal">Goal: ${goal.target}${def.unit}</div>`;
        return { cls, badge };
    }

    // ── Section 1: Overview ──
    const asGoal = goalBadge('avgScore', stats.avgScore);
    const baGoal = goalBadge('bogeyAvoidancePct', stats.bogeyAvoidancePct);
    const overviewHtml = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Handicap Index ${trendIcon('handicap')}</div>
                <div class="stat-value">${val(handicap)}</div>
                <div class="stat-subtext">USGA Formula</div>
            </div>
            <div class="stat-card ${asGoal.cls}">
                <div class="stat-label">Avg Score ${trendIcon('avgScore')}</div>
                <div class="stat-value">${val(stats.avgScore)}</div>
                <div class="stat-subtext">Per round</div>
                ${asGoal.badge}
            </div>
            <div class="stat-card ${baGoal.cls}">
                <div class="stat-label">Bogey Avoidance</div>
                <div class="stat-value">${pct(stats.bogeyAvoidancePct)}</div>
                <div class="stat-subtext">Par or better</div>
                ${baGoal.badge}
            </div>
        </div>`;

    // ── Section 2: Off the Tee ──
    const fwy = stats.fairwayDist;
    const fwyBar = fwy ? distBar([
        { cls: 'seg-fairway-left', pct: fwy.left, label: `L ${fwy.left}%` },
        { cls: 'seg-fairway-hit', pct: fwy.hit, label: `Hit ${fwy.hit}%` },
        { cls: 'seg-fairway-right', pct: fwy.right, label: `R ${fwy.right}%` }
    ]) : '<div class="dist-bar"><div class="dist-segment" style="flex:1;background:var(--cream);color:var(--text-light);">No data</div></div>';
    const fwyLegend = fwy ? distLegend([
        { cls: 'seg-fairway-left', label: 'Left', value: fwy.left },
        { cls: 'seg-fairway-hit', label: 'Hit', value: fwy.hit },
        { cls: 'seg-fairway-right', label: 'Right', value: fwy.right }
    ]) : '';
    const fwyGoal = goalBadge('fairwayPct', stats.fairwayPct);
    const offTheTeeHtml = `
        <div class="dashboard-section">
            <h3>Off the Tee</h3>
            <div class="section-stats" style="margin-bottom:15px;">
                <div class="section-stat ${fwyGoal.cls}">
                    <div class="section-stat-value">${pct(stats.fairwayPct)}</div>
                    <div class="section-stat-label">Fairways Hit ${trendIcon('fairwayPct')}</div>
                    ${fwyGoal.badge}
                </div>
            </div>
            ${fwyBar}
            ${fwyLegend}
        </div>`;

    // ── Section 3: Approach Play ──
    const app = stats.approachDist;
    const appBar = app ? distBar([
        { cls: 'seg-approach-gir', pct: app.gir, label: `GIR ${app.gir}%` },
        { cls: 'seg-approach-long', pct: app.long, label: `Long ${app.long}%` },
        { cls: 'seg-approach-short', pct: app.short, label: `Short ${app.short}%` },
        { cls: 'seg-approach-left', pct: app.left, label: `Left ${app.left}%` },
        { cls: 'seg-approach-right', pct: app.right, label: `Right ${app.right}%` }
    ]) : '<div class="dist-bar"><div class="dist-segment" style="flex:1;background:var(--cream);color:var(--text-light);">No data</div></div>';
    const appLegend = app ? distLegend([
        { cls: 'seg-approach-gir', label: 'GIR', value: app.gir },
        { cls: 'seg-approach-long', label: 'Long', value: app.long },
        { cls: 'seg-approach-short', label: 'Short', value: app.short },
        { cls: 'seg-approach-left', label: 'Left', value: app.left },
        { cls: 'seg-approach-right', label: 'Right', value: app.right }
    ]) : '';
    const girGoal = goalBadge('girPct', stats.girPct);
    const proxGoal = goalBadge('avgFirstPuttDist', stats.avgFirstPuttDist);
    const scrGoal = goalBadge('scramblingPct', stats.scramblingPct);
    const ssGoal = goalBadge('sandSavePct', stats.sandSavePct);
    const approachHtml = `
        <div class="dashboard-section">
            <h3>Approach Play</h3>
            <div class="section-stats" style="margin-bottom:15px;">
                <div class="section-stat ${girGoal.cls}">
                    <div class="section-stat-value">${pct(stats.girPct)}</div>
                    <div class="section-stat-label">Greens in Reg ${trendIcon('girPct')}</div>
                    ${girGoal.badge}
                </div>
                <div class="section-stat ${proxGoal.cls}">
                    <div class="section-stat-value">${val(stats.avgFirstPuttDist)}${stats.avgFirstPuttDist !== null ? ' ft' : ''}</div>
                    <div class="section-stat-label">Avg Proximity</div>
                    ${proxGoal.badge}
                </div>
                <div class="section-stat ${scrGoal.cls}">
                    <div class="section-stat-value">${pct(stats.scramblingPct)}</div>
                    <div class="section-stat-label">Scrambling ${trendIcon('scramblingPct')}</div>
                    ${scrGoal.badge}
                </div>
                <div class="section-stat ${ssGoal.cls}">
                    <div class="section-stat-value">${pct(stats.sandSavePct)}</div>
                    <div class="section-stat-label">Sand Save</div>
                    ${ssGoal.badge}
                </div>
            </div>
            ${appBar}
            ${appLegend}
        </div>`;

    // ── Section 4: Putting ──
    const pb = stats.puttingBreakdown;
    const pbBar = pb ? distBar([
        { cls: 'seg-putt-1', pct: pb.onePutt, label: `1-putt ${pb.onePutt}%` },
        { cls: 'seg-putt-2', pct: pb.twoPutt, label: `2-putt ${pb.twoPutt}%` },
        { cls: 'seg-putt-3', pct: pb.threePutt, label: `3-putt ${pb.threePutt}%` },
        { cls: 'seg-putt-3plus', pct: pb.threePlus, label: `3+ ${pb.threePlus}%` }
    ]) : '<div class="dist-bar"><div class="dist-segment" style="flex:1;background:var(--cream);color:var(--text-light);">No data</div></div>';
    const pbLegend = pb ? distLegend([
        { cls: 'seg-putt-1', label: '1-putt', value: pb.onePutt },
        { cls: 'seg-putt-2', label: '2-putt', value: pb.twoPutt },
        { cls: 'seg-putt-3', label: '3-putt', value: pb.threePutt },
        { cls: 'seg-putt-3plus', label: '3+', value: pb.threePlus }
    ]) : '';
    const putGoal = goalBadge('puttsPer9', stats.puttsPer9);
    const ftGoal = goalBadge('feetMadePer9', stats.feetMadePer9);
    const pcGoal = goalBadge('parConversionPct', stats.parConversionPct);
    const lagAvoidGoal = goalBadge('lagPutt3PuttAvoidPct', stats.lagPutt3PuttAvoidPct);
    const lagHtml = stats.lagPutt3PuttAvoidPct !== null ? `
            <div class="putting-subheader">Lag Putting (20+ ft)${stats.lagPuttCount ? ` <span style="font-size:0.75rem;font-weight:400;color:var(--text-light);">${stats.lagPuttCount} putts</span>` : ''}</div>
            <div class="section-stats" style="margin-bottom:15px;">
                <div class="section-stat ${lagAvoidGoal.cls}">
                    <div class="section-stat-value">${pct(stats.lagPutt3PuttAvoidPct)}</div>
                    <div class="section-stat-label">3-Putt Avoidance</div>
                    ${lagAvoidGoal.badge}
                </div>
                <div class="section-stat">
                    <div class="section-stat-value">${val(stats.lagPuttAvgLeave)}${stats.lagPuttAvgLeave !== null ? ' ft' : ''}</div>
                    <div class="section-stat-label">Avg Lag Leave</div>
                </div>
            </div>` : '';
    const makeRateHtml = stats.puttMakeRate ? `
            <div class="putting-subheader">Make Rate by Distance</div>
            <table class="putt-rate-table">
                <thead><tr><th>Range</th><th>Putts</th><th>Made</th><th>Make %</th></tr></thead>
                <tbody>
                    ${stats.puttMakeRate.map(b => `<tr>
                        <td class="rate-label">${b.label}</td>
                        <td class="rate-count">${b.attempts}</td>
                        <td class="rate-count">${b.made}</td>
                        <td class="rate-pct">${b.attempts > 0 ? b.pct + '%' : '—'}</td>
                    </tr>`).join('')}
                </tbody>
            </table>` : '';
    const puttingHtml = `
        <div class="dashboard-section">
            <h3>Putting</h3>
            <div class="section-stats" style="margin-bottom:15px;">
                <div class="section-stat ${putGoal.cls}">
                    <div class="section-stat-value">${val(stats.puttsPer9)}</div>
                    <div class="section-stat-label">Putts / 9 ${trendIcon('puttsPer9')}</div>
                    ${putGoal.badge}
                </div>
                <div class="section-stat ${ftGoal.cls}">
                    <div class="section-stat-value">${val(stats.feetMadePer9)}${stats.feetMadePer9 !== null ? ' ft' : ''}</div>
                    <div class="section-stat-label">Ft Made / 9</div>
                    ${ftGoal.badge}
                </div>
                <div class="section-stat ${pcGoal.cls}">
                    <div class="section-stat-value">${pct(stats.parConversionPct)}</div>
                    <div class="section-stat-label">Par Conversion</div>
                    ${pcGoal.badge}
                </div>
            </div>
            ${pbBar}
            ${pbLegend}
            ${lagHtml}
            ${makeRateHtml}
        </div>`;

    // ── Section 5: Scoring ──
    const sbp = stats.scoringByPar;
    const p3Goal = sbp && sbp.par3 ? goalBadge('scoringAvgPar3', sbp.par3.avg) : { cls: '', badge: '' };
    const p4Goal = sbp && sbp.par4 ? goalBadge('scoringAvgPar4', sbp.par4.avg) : { cls: '', badge: '' };
    const p5Goal = sbp && sbp.par5 ? goalBadge('scoringAvgPar5', sbp.par5.avg) : { cls: '', badge: '' };
    const parScoringHtml = sbp ? `
        <div class="par-scoring-grid">
            ${sbp.par3 ? `<div class="par-scoring-card ${p3Goal.cls}">
                <div class="par-scoring-type">Par 3</div>
                <div class="par-scoring-avg">${sbp.par3.avg}</div>
                <div class="par-scoring-vs">${vsParStr(sbp.par3.vsPar)}</div>
                ${p3Goal.badge}
            </div>` : ''}
            ${sbp.par4 ? `<div class="par-scoring-card ${p4Goal.cls}">
                <div class="par-scoring-type">Par 4</div>
                <div class="par-scoring-avg">${sbp.par4.avg}</div>
                <div class="par-scoring-vs">${vsParStr(sbp.par4.vsPar)}</div>
                ${p4Goal.badge}
            </div>` : ''}
            ${sbp.par5 ? `<div class="par-scoring-card ${p5Goal.cls}">
                <div class="par-scoring-type">Par 5</div>
                <div class="par-scoring-avg">${sbp.par5.avg}</div>
                <div class="par-scoring-vs">${vsParStr(sbp.par5.vsPar)}</div>
                ${p5Goal.badge}
            </div>` : ''}
        </div>` : '';

    const sd = stats.scoringDistribution;
    const sdBar = sd ? distBar([
        { cls: 'seg-score-eagle', pct: sd.eaglePct, label: `Eagle ${sd.eaglePct}%` },
        { cls: 'seg-score-birdie', pct: sd.birdiePct, label: `Birdie ${sd.birdiePct}%` },
        { cls: 'seg-score-par', pct: sd.parPct, label: `Par ${sd.parPct}%` },
        { cls: 'seg-score-bogey', pct: sd.bogeyPct, label: `Bogey ${sd.bogeyPct}%` },
        { cls: 'seg-score-double', pct: sd.doublePct, label: `Dbl ${sd.doublePct}%` },
        { cls: 'seg-score-triple', pct: sd.triplePct, label: `3+ ${sd.triplePct}%` }
    ]) : '';
    const sdLegend = sd ? distLegend([
        { cls: 'seg-score-eagle', label: 'Eagle+', value: sd.eaglePct },
        { cls: 'seg-score-birdie', label: 'Birdie', value: sd.birdiePct },
        { cls: 'seg-score-par', label: 'Par', value: sd.parPct },
        { cls: 'seg-score-bogey', label: 'Bogey', value: sd.bogeyPct },
        { cls: 'seg-score-double', label: 'Double', value: sd.doublePct },
        { cls: 'seg-score-triple', label: 'Triple+', value: sd.triplePct }
    ]) : '';

    const bbGoal = goalBadge('bounceBackRate', stats.bounceBackRate);
    const penGoal = goalBadge('penaltiesPer9', stats.penaltiesPer9);
    const scoringHtml = `
        <div class="dashboard-section">
            <h3>Scoring</h3>
            ${parScoringHtml}
            ${sd ? '<div style="margin-top:15px;font-size:0.85rem;font-weight:600;color:var(--text-light);text-transform:uppercase;letter-spacing:0.5px;">Distribution</div>' : ''}
            ${sdBar}
            ${sdLegend}
            <div class="section-stats" style="margin-top:15px;">
                <div class="section-stat ${bbGoal.cls}">
                    <div class="section-stat-value">${pct(stats.bounceBackRate)}</div>
                    <div class="section-stat-label">Bounce-back</div>
                    ${bbGoal.badge}
                </div>
                <div class="section-stat">
                    <div class="section-stat-value">${sd ? sd.birdie : '—'}</div>
                    <div class="section-stat-label">Total Birdies</div>
                </div>
                <div class="section-stat ${penGoal.cls}">
                    <div class="section-stat-value">${val(stats.penaltiesPer9)}</div>
                    <div class="section-stat-label">Penalties / 9</div>
                    ${penGoal.badge}
                </div>
            </div>
        </div>`;

    // ── Section 6: Match Play (only if data exists) ──
    const matchStats = computeMatchPlayStats(rounds);
    const matchPlayHtml = matchStats.matchesPlayed > 0 ? `
        <div class="dashboard-section">
            <h3>Match Play</h3>
            <div class="section-stats">
                <div class="section-stat">
                    <div class="section-stat-value">${matchStats.matchesPlayed}</div>
                    <div class="section-stat-label">Matches</div>
                </div>
                <div class="section-stat">
                    <div class="section-stat-value">${matchStats.pointsPer9}</div>
                    <div class="section-stat-label">Points / 9</div>
                </div>
                <div class="section-stat">
                    <div class="section-stat-value">${matchStats.winPct}%</div>
                    <div class="section-stat-label">Hole Win %</div>
                </div>
            </div>
            <div style="margin-top:15px;font-size:0.85rem;font-weight:600;color:var(--text-light);text-transform:uppercase;letter-spacing:0.5px;">W / D / L Distribution</div>
            ${distBar([
                { cls: 'seg-match-win', pct: matchStats.winPct, label: 'Win ' + matchStats.winPct + '%' },
                { cls: 'seg-match-draw', pct: matchStats.drawPct, label: 'Draw ' + matchStats.drawPct + '%' },
                { cls: 'seg-match-loss', pct: matchStats.lossPct, label: 'Loss ' + matchStats.lossPct + '%' }
            ])}
            ${distLegend([
                { cls: 'seg-match-win', label: 'Win', value: matchStats.winPct },
                { cls: 'seg-match-draw', label: 'Draw', value: matchStats.drawPct },
                { cls: 'seg-match-loss', label: 'Loss', value: matchStats.lossPct }
            ])}
            <div class="section-stats" style="margin-top:15px;">
                <div class="section-stat">
                    <div class="section-stat-value">${matchStats.holesWon}</div>
                    <div class="section-stat-label">Holes Won</div>
                </div>
                <div class="section-stat">
                    <div class="section-stat-value">${matchStats.holesDrawn}</div>
                    <div class="section-stat-label">Holes Drawn</div>
                </div>
                <div class="section-stat">
                    <div class="section-stat-value">${matchStats.holesLost}</div>
                    <div class="section-stat-label">Holes Lost</div>
                </div>
            </div>
            <div class="section-stats" style="margin-top:10px;">
                <div class="section-stat">
                    <div class="section-stat-value">${matchStats.totalPoints}</div>
                    <div class="section-stat-label">Total Points</div>
                </div>
                <div class="section-stat">
                    <div class="section-stat-value">${matchStats.avgPointsPerMatch}</div>
                    <div class="section-stat-label">Avg Pts / Match</div>
                </div>
            </div>
        </div>` : '';

    document.getElementById('dashboardContent').innerHTML =
        overviewHtml + offTheTeeHtml + approachHtml + puttingHtml + scoringHtml + matchPlayHtml;

    // Render rounds list (last 20 on dashboard)
    const sortedRounds = [...rounds].sort((a, b) => new Date(b.date) - new Date(a.date));
    const recentRounds = sortedRounds.slice(0, 20);
    const viewAllBtn = sortedRounds.length > 20
        ? `<div style="text-align:center; margin-top:15px;">
               <button class="secondary" onclick="viewAllRounds()">View All Rounds (${sortedRounds.length})</button>
           </div>`
        : '';
    document.getElementById('roundsList').innerHTML = recentRounds.map(round => renderRoundItem(round)).join('') + viewAllBtn;
}

function renderRoundItem(round) {
    const summary = buildRoundSummary(round);
    return `
        <div class="round-item" onclick="viewRound('${round.id}')">
            <div class="round-header">
                <div>
                    <div class="round-course">${round.courseName}</div>
                    <div class="round-date">${new Date(round.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                </div>
                <div class="round-score">${round.totalScore} <span style="font-size: 1rem; color: var(--text-light);">(${summary.diffStr})</span></div>
            </div>
            <div class="round-stats">
                <div class="round-stat">
                    <div class="round-stat-label">Putts</div>
                    <div class="round-stat-value">${summary.putts}</div>
                </div>
                <div class="round-stat">
                    <div class="round-stat-label">Fairways</div>
                    <div class="round-stat-value">${summary.fairways}/${summary.fairwayTotal}</div>
                </div>
                <div class="round-stat">
                    <div class="round-stat-label">GIR</div>
                    <div class="round-stat-value">${summary.girs}/${round.numHoles || round.holes.length}</div>
                </div>
                <div class="round-stat">
                    <div class="round-stat-label">Tees</div>
                    <div class="round-stat-value">${round.tees ? capitalize(round.tees) : 'N/A'}</div>
                </div>
                <div class="round-stat">
                    <div class="round-stat-label">Type</div>
                    <div class="round-stat-value">${ROUND_TYPE_LABELS[round.roundType] || ROUND_TYPE_LABELS[round.roundType || 'normal']}</div>
                </div>
            </div>
        </div>`;
}

function getFilteredRounds() {
    const startDate = document.getElementById('filterStartDate').value;
    const endDate = document.getElementById('filterEndDate').value;
    const count = document.getElementById('filterRounds').value;
    const courseId = document.getElementById('filterCourse').value;
    const roundType = document.getElementById('filterRoundType').value;

    return filterRounds(appData.rounds, { startDate, endDate, count, courseId, roundType });
}

function loadCourseFilter() {
    const select = document.getElementById('filterCourse');
    const current = select.value;
    select.innerHTML = '<option value="all">All Courses</option>' +
        appData.courses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    // Preserve selection if the course still exists
    if (current && select.querySelector(`option[value="${current}"]`)) {
        select.value = current;
    }
}

function applyFilters() {
    renderDashboard();
}

function viewRound(roundId) {
    const round = appData.rounds.find(r => r.id === roundId);
    if (!round) return;

    const summary = buildRoundSummary(round);

    // Header
    document.getElementById('roundModalTitle').textContent = round.courseName;
    const roundTypeLabel = ROUND_TYPE_LABELS[round.roundType] || ROUND_TYPE_LABELS[round.roundType || 'normal'];
    document.getElementById('roundModalDate').textContent =
        new Date(round.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) +
        (round.tees ? ` \u2022 ${capitalize(round.tees)} tees` : '') +
        ` \u2022 ${roundTypeLabel}`;

    // Summary stats
    const summaryHtml = `
        <div class="round-detail-summary">
            <div class="round-stat">
                <div class="round-stat-label">Score</div>
                <div class="round-stat-value">${round.totalScore} (${summary.diffStr})</div>
            </div>
            <div class="round-stat">
                <div class="round-stat-label">Putts</div>
                <div class="round-stat-value">${summary.putts}</div>
            </div>
            <div class="round-stat">
                <div class="round-stat-label">Fairways</div>
                <div class="round-stat-value">${summary.fairways}/${summary.fairwayTotal}</div>
            </div>
            <div class="round-stat">
                <div class="round-stat-label">GIR</div>
                <div class="round-stat-value">${summary.girs}/${round.holes.length}</div>
            </div>
            <div class="round-stat">
                <div class="round-stat-label">Ft Putts Made</div>
                <div class="round-stat-value">${summary.feetOfPuttsMade || '--'}</div>
            </div>
            <div class="round-stat">
                <div class="round-stat-label">Sand Saves</div>
                <div class="round-stat-value">${summary.bunkerHoles > 0 ? summary.sandSaves + '/' + summary.bunkerHoles : '--'}</div>
            </div>
        </div>
    `;

    // Build horizontal scorecard(s)
    const numHoles = round.holes.length;
    const is18 = numHoles > 9;
    let scorecardHtml = '';

    if (is18) {
        scorecardHtml = buildScorecardTable(round.holes.slice(0, 9), 'Out') +
                        buildScorecardTable(round.holes.slice(9, 18), 'In');
    } else {
        scorecardHtml = buildScorecardTable(round.holes, 'Total');
    }

    // Grand total for 18-hole rounds
    if (is18) {
        scorecardHtml += `<div style="text-align: right; font-weight: 700; font-size: 1rem; color: var(--forest-green); margin-top: 5px;">
            Total: ${round.totalScore} (Par ${summary.totalPar})
        </div>`;
    }

    document.getElementById('roundModalBody').innerHTML = summaryHtml + scorecardHtml;

    // Wire edit and delete buttons
    document.getElementById('editRoundBtn').onclick = () => editRound(roundId);
    document.getElementById('deleteRoundBtn').onclick = () => deleteRound(roundId);

    document.getElementById('roundModal').classList.add('active');
}

function buildScorecardTable(holes, label) {
    const totalPar = holes.reduce((sum, h) => sum + h.par, 0);
    const totalScore = holes.reduce((sum, h) => sum + h.score, 0);
    const totalPutts = holes.reduce((sum, h) => sum + (h.putts || 0), 0);

    // Hole number row
    const holeRow = holes.map(h => `<th class="hole-num-cell">${h.number}</th>`).join('') +
        `<th class="col-total">${label}</th>`;

    // Par row
    const parRow = holes.map(h => `<td>${h.par}</td>`).join('') +
        `<td class="col-total">${totalPar}</td>`;

    // Score row with shapes
    const scoreRow = holes.map(h => {
        const diff = h.score - h.par;
        let cls = 'score-par';
        if (diff <= -2) cls = 'score-eagle';
        else if (diff === -1) cls = 'score-birdie';
        else if (diff === 1) cls = 'score-bogey';
        else if (diff >= 2) cls = 'score-double';
        return `<td class="score-cell ${cls}"><span class="score-shape">${h.score}</span></td>`;
    }).join('') + `<td class="col-total">${totalScore}</td>`;

    // Putts row
    const puttsRow = holes.map(h => `<td>${h.putts || 0}</td>`).join('') +
        `<td class="col-total">${totalPutts}</td>`;

    // Fairway row
    const fwyRow = holes.map(h => {
        if (h.par <= 3) return '<td>-</td>';
        if (!h.fairwayDirection) return '<td>-</td>';
        if (h.fairwayHit) return '<td><span class="fairway-hit">\u2713</span></td>';
        const arrows = { left: '\u2190', right: '\u2192' };
        return `<td><span class="fairway-miss">${arrows[h.fairwayDirection] || '\u2717'}</span></td>`;
    }).join('') + '<td class="col-total"></td>';

    // GIR row
    const girRow = holes.map(h => {
        if (!h.approachResult) return '<td>-</td>';
        if (h.gir) return '<td><span class="fairway-hit">\u2713</span></td>';
        const arrows = { long: '\u2191', short: '\u2193', left: '\u2190', right: '\u2192' };
        return `<td><span class="fairway-miss">${arrows[h.approachResult] || '\u2717'}</span></td>`;
    }).join('') + '<td class="col-total"></td>';

    return `
        <div style="overflow-x: auto; margin-bottom: 15px;">
        <table class="scorecard">
            <tr><td class="row-label">Hole</td>${holeRow}</tr>
            <tr><td class="row-label">Par</td>${parRow}</tr>
            <tr><td class="row-label">Score</td>${scoreRow}</tr>
            <tr><td class="row-label">Putts</td>${puttsRow}</tr>
            <tr><td class="row-label">FWY</td>${fwyRow}</tr>
            <tr><td class="row-label">GIR</td>${girRow}</tr>
        </table>
        </div>
    `;
}

function closeRoundModal() {
    document.getElementById('roundModal').classList.remove('active');
}

// All Rounds Modal
function viewAllRounds() {
    const sortedRounds = [...appData.rounds].sort((a, b) => new Date(b.date) - new Date(a.date));
    document.getElementById('allRoundsTitle').textContent = `All Rounds (${sortedRounds.length})`;
    document.getElementById('allRoundsBody').innerHTML =
        `<div class="rounds-list">${sortedRounds.map(round => renderRoundItem(round)).join('')}</div>`;
    document.getElementById('allRoundsModal').classList.add('active');
}

function closeAllRoundsModal() {
    document.getElementById('allRoundsModal').classList.remove('active');
}

// Trend Chart Modal
let trendChartInstance = null;

function trendIcon(kpiKey) {
    return `<button class="trend-icon-btn" onclick="event.stopPropagation(); viewTrendModal('${kpiKey}')" title="View trend">
        <svg class="trend-icon" viewBox="0 0 20 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="1,14 6,9 10,11 19,2"/>
            <polyline points="14,2 19,2 19,7"/>
        </svg>
    </button>`;
}

function viewTrendModal(kpiKey) {
    const def = TREND_KPIS[kpiKey];
    if (!def) return;

    const rounds = kpiKey === 'handicap' ? appData.rounds : getFilteredRounds();
    const trendData = computeTrendData(rounds, kpiKey);
    const maData = computeMovingAverage(trendData, 5);

    // Combine and filter to points where raw data exists
    const chartPoints = trendData
        .map((d, i) => ({ date: d.date, raw: d.value, ma: maData[i].value }))
        .filter(p => p.raw !== null);

    document.getElementById('trendModalTitle').textContent = def.label + ' Trend';

    if (chartPoints.length < 2) {
        document.getElementById('trendModalBody').innerHTML =
            '<div style="text-align:center;padding:40px;color:var(--text-light);">Not enough data for a trend chart (need at least 2 rounds with data).</div>';
        document.getElementById('trendModal').classList.add('active');
        return;
    }

    const formatDate = (iso) => {
        const d = new Date(iso + 'T12:00:00');
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
    };

    // Rebuild canvas for clean chart
    document.getElementById('trendModalBody').innerHTML = '<canvas id="trendChart"></canvas>';
    const canvas = document.getElementById('trendChart');

    if (trendChartInstance) {
        trendChartInstance.destroy();
        trendChartInstance = null;
    }

    // Show modal first so canvas has dimensions
    document.getElementById('trendModal').classList.add('active');

    requestAnimationFrame(() => {
        // Read theme-aware colors from CSS variables
        const cs = getComputedStyle(document.documentElement);
        const chartBlue = cs.getPropertyValue('--blue').trim();
        const chartGreen = cs.getPropertyValue('--forest-green').trim();
        const chartWhite = cs.getPropertyValue('--white').trim();
        const textColor = cs.getPropertyValue('--text-light').trim();
        const gridColor = cs.getPropertyValue('--border').trim();

        trendChartInstance = new Chart(canvas, {
            type: 'line',
            data: {
                labels: chartPoints.map(p => formatDate(p.date)),
                datasets: [
                    {
                        label: def.label,
                        data: chartPoints.map(p => p.raw),
                        borderColor: chartBlue,
                        backgroundColor: chartBlue + '1a',
                        borderWidth: 1.5,
                        pointRadius: 4,
                        pointBackgroundColor: chartBlue,
                        pointBorderColor: chartWhite,
                        pointBorderWidth: 1.5,
                        tension: 0,
                        fill: false,
                        order: 2
                    },
                    {
                        label: '5-Round Avg',
                        data: chartPoints.map(p => p.ma),
                        borderColor: chartGreen,
                        backgroundColor: 'transparent',
                        borderWidth: 3,
                        pointRadius: 0,
                        tension: 0.3,
                        fill: false,
                        spanGaps: true,
                        order: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ctx.dataset.label + ': ' + ctx.parsed.y + def.unit
                        }
                    },
                    legend: {
                        display: true,
                        position: 'top',
                        labels: { usePointStyle: true, font: { family: 'Montserrat', size: 12 }, color: textColor }
                    }
                },
                scales: {
                    x: {
                        ticks: { maxRotation: 45, font: { family: 'Montserrat', size: 11 }, color: textColor },
                        grid: { display: false }
                    },
                    y: {
                        ticks: { font: { family: 'Montserrat', size: 11 }, color: textColor },
                        grid: { color: gridColor }
                    }
                }
            }
        });
    });
}

function closeTrendModal() {
    document.getElementById('trendModal').classList.remove('active');
    if (trendChartInstance) {
        trendChartInstance.destroy();
        trendChartInstance = null;
    }
}

// Course Detail Modal
function viewCourseDetail(courseId) {
    const course = appData.courses.find(c => c.id === courseId);
    if (!course) return;

    const stats = computeCourseStats(courseId, appData.rounds, course);

    // Header
    const numHoles = course.numHoles || course.holes.length;
    document.getElementById('courseDetailTitle').textContent = course.name;
    document.getElementById('courseDetailSubtitle').textContent =
        `${course.location || 'Unknown'} \u2022 ${numHoles} Holes \u2022 Par ${stats.totalPar}`;

    const pct = (v) => v !== null ? v + '%' : '--';
    const val = (v) => v ?? '--';

    function vsParStr(vsPar) {
        if (vsPar === null || vsPar === undefined) return '--';
        const cls = vsPar > 0 ? 'vs-over' : vsPar < 0 ? 'vs-under' : 'vs-even';
        const sign = vsPar > 0 ? '+' : '';
        return `<span class="${cls}">${sign}${vsPar}</span>`;
    }

    // Section 1: Overview
    const bestStr = stats.bestRound
        ? `${stats.bestRound.score} <span class="stat-subtext">(${new Date(stats.bestRound.date + 'T00:00').toLocaleDateString()})</span>`
        : '--';
    const worstStr = stats.worstRound
        ? `${stats.worstRound.score} <span class="stat-subtext">(${new Date(stats.worstRound.date + 'T00:00').toLocaleDateString()})</span>`
        : '--';

    const overviewHtml = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Rounds Played</div>
                <div class="stat-value">${stats.roundsPlayed}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Avg Score</div>
                <div class="stat-value">${val(stats.avgScore)}</div>
                <div class="stat-subtext">${vsParStr(stats.vsPar)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Best Round</div>
                <div class="stat-value">${bestStr}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Worst Round</div>
                <div class="stat-value">${worstStr}</div>
            </div>
        </div>`;

    // Section 2: Course Performance KPIs
    const cs = stats.courseStats;
    const courseKpisHtml = stats.roundsPlayed > 0 ? `
        <div class="dashboard-section">
            <h3>Course Performance</h3>
            <div class="section-stats">
                <div class="section-stat">
                    <div class="section-stat-value">${pct(cs.fairwayPct)}</div>
                    <div class="section-stat-label">Fairways</div>
                </div>
                <div class="section-stat">
                    <div class="section-stat-value">${pct(cs.girPct)}</div>
                    <div class="section-stat-label">GIR</div>
                </div>
                <div class="section-stat">
                    <div class="section-stat-value">${val(cs.puttsPer9)}</div>
                    <div class="section-stat-label">Putts / 9</div>
                </div>
                <div class="section-stat">
                    <div class="section-stat-value">${pct(cs.scramblingPct)}</div>
                    <div class="section-stat-label">Scrambling</div>
                </div>
                <div class="section-stat">
                    <div class="section-stat-value">${pct(cs.sandSavePct)}</div>
                    <div class="section-stat-label">Sand Save</div>
                </div>
                <div class="section-stat">
                    <div class="section-stat-value">${pct(cs.bogeyAvoidancePct)}</div>
                    <div class="section-stat-label">Bogey Avoid</div>
                </div>
                <div class="section-stat">
                    <div class="section-stat-value">${pct(cs.bounceBackRate)}</div>
                    <div class="section-stat-label">Bounce-back</div>
                </div>
                <div class="section-stat">
                    <div class="section-stat-value">${val(cs.penaltiesPer9)}</div>
                    <div class="section-stat-label">Penalties / 9</div>
                </div>
            </div>
        </div>` : '';

    // Section 3: Hardest/Easiest Holes
    let difficultyHtml = '';
    if (stats.hardestHoles.length > 0) {
        difficultyHtml = `
        <div class="dashboard-section">
            <h3>Hole Difficulty</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div>
                    <div style="font-size: 0.8rem; font-weight: 700; color: var(--red); text-transform: uppercase; margin-bottom: 8px;">Hardest</div>
                    ${stats.hardestHoles.map((h, i) => `
                        <div class="difficulty-item difficulty-hard">
                            <span class="difficulty-rank">#${i + 1}</span>
                            <span class="difficulty-hole">Hole ${h.holeNumber}</span>
                            <span class="difficulty-par">Par ${h.par}</span>
                            <span class="difficulty-vs">${vsParStr(h.vsPar)}</span>
                            <span class="difficulty-avg">${h.scoringAvg}</span>
                        </div>
                    `).join('')}
                </div>
                <div>
                    <div style="font-size: 0.8rem; font-weight: 700; color: var(--fairway-green); text-transform: uppercase; margin-bottom: 8px;">Easiest</div>
                    ${stats.easiestHoles.map((h, i) => `
                        <div class="difficulty-item difficulty-easy">
                            <span class="difficulty-rank">#${i + 1}</span>
                            <span class="difficulty-hole">Hole ${h.holeNumber}</span>
                            <span class="difficulty-par">Par ${h.par}</span>
                            <span class="difficulty-vs">${vsParStr(h.vsPar)}</span>
                            <span class="difficulty-avg">${h.scoringAvg}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>`;
    }

    // Section 4: Hole-by-Hole Breakdown
    function distBarSm(segments) {
        const segs = segments.filter(s => s.pct > 0);
        if (segs.length === 0) return '<div class="dist-bar dist-bar-sm"><div class="dist-segment" style="flex:1;background:var(--cream);color:var(--text-light);">--</div></div>';
        return '<div class="dist-bar dist-bar-sm">' + segs.map(s =>
            `<div class="dist-segment ${s.cls}" style="flex:${s.pct}" title="${s.label}">${s.pct >= 15 ? s.pct + '%' : ''}</div>`
        ).join('') + '</div>';
    }

    const missArrow = { left: '\u2190', right: '\u2192', long: '\u2191', short: '\u2193' };

    const holeTableRows = stats.holeStats.map(h => {
        const d = h.distribution;
        const scoringDistBar = d.total > 0 ? distBarSm([
            { cls: 'seg-score-eagle', pct: d.eaglePct, label: `Eagle ${d.eaglePct}%` },
            { cls: 'seg-score-birdie', pct: d.birdiePct, label: `Birdie ${d.birdiePct}%` },
            { cls: 'seg-score-par', pct: d.parPct, label: `Par ${d.parPct}%` },
            { cls: 'seg-score-bogey', pct: d.bogeyPct, label: `Bogey ${d.bogeyPct}%` },
            { cls: 'seg-score-double', pct: d.doublePct, label: `Dbl ${d.doublePct}%` },
            { cls: 'seg-score-triple', pct: d.triplePct, label: `3+ ${d.triplePct}%` }
        ]) : '--';

        const fwyStr = h.par <= 3 ? '-' : pct(h.fairwayPct);
        const fwyMiss = h.fairwayMissDir ? `<span class="miss-dir">${missArrow[h.fairwayMissDir] || ''}</span>` : '';
        const girStr = pct(h.girPct);
        const girMiss = h.girMissDir ? `<span class="miss-dir">${missArrow[h.girMissDir] || ''}</span>` : '';

        return `
        <tr>
            <td class="hole-num-col">${h.holeNumber}</td>
            <td>${h.par}</td>
            <td class="hole-stat-avg">${val(h.scoringAvg)}</td>
            <td>${vsParStr(h.vsPar)}</td>
            <td class="hole-stat-distbar">${scoringDistBar}</td>
            <td>${fwyStr} ${fwyMiss}</td>
            <td>${girStr} ${girMiss}</td>
            <td>${val(h.avgPutts)}</td>
        </tr>`;
    }).join('');

    const holeTableHtml = stats.roundsPlayed > 0 ? `
        <div class="dashboard-section">
            <h3>Hole-by-Hole Breakdown</h3>
            <div style="overflow-x: auto;">
                <table class="hole-stats-table">
                    <thead>
                        <tr>
                            <th>Hole</th>
                            <th>Par</th>
                            <th>Avg</th>
                            <th>vs Par</th>
                            <th>Distribution</th>
                            <th>FWY</th>
                            <th>GIR</th>
                            <th>Putts</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${holeTableRows}
                    </tbody>
                </table>
            </div>
        </div>` : `
        <div class="empty-state">
            <h3>No rounds recorded</h3>
            <p>Play this course and log a round to see hole-level stats</p>
        </div>`;

    document.getElementById('courseDetailBody').innerHTML =
        overviewHtml + courseKpisHtml + difficultyHtml + holeTableHtml;

    // Wire edit button
    document.getElementById('courseDetailEditBtn').onclick = () => {
        closeCourseDetailModal();
        editCourse(courseId);
    };

    document.getElementById('courseDetailModal').classList.add('active');
}

function closeCourseDetailModal() {
    document.getElementById('courseDetailModal').classList.remove('active');
}

async function deleteRound(roundId) {
    const round = appData.rounds.find(r => r.id === roundId);
    const label = round ? `${round.courseName} on ${round.date}` : 'this round';
    const confirmed = await showConfirmDialog({
        title: 'Delete Round',
        message: `${label} will be permanently removed. This cannot be undone.`,
        confirmText: 'Delete Round',
        icon: '\uD83D\uDDD1\uFE0F'
    });
    if (confirmed) {
        appData.rounds = appData.rounds.filter(r => r.id !== roundId);
        saveToLocalStorage();
        syncToGoogleSheets();
        closeRoundModal();
        renderDashboard();
    }
}

function editRound(roundId) {
    const round = appData.rounds.find(r => r.id === roundId);
    if (!round) return;

    editingRoundId = roundId;
    closeRoundModal();

    // Update form UI for edit mode
    document.getElementById('roundFormTitle').textContent = 'Edit Round';
    document.getElementById('saveRoundBtn').textContent = 'Update Round';

    // Switch to new-round view
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    document.getElementById('new-round').classList.add('active');
    document.querySelectorAll('nav button')[1].classList.add('active');

    // Pre-populate course
    document.getElementById('courseSelect').value = round.courseId;
    loadCourseData();

    // Pre-populate tees (after loadCourseData populates the dropdown)
    document.getElementById('teesPlayed').value = round.tees;

    // Pre-populate date and round type
    document.getElementById('roundDate').value = round.date;
    document.getElementById('roundType').value = round.roundType || 'normal';
    onRoundTypeChange();

    // Re-render hole cards with correct tee
    const course = appData.courses.find(c => c.id === round.courseId);
    if (course) renderHoleCards(course);

    // Show/hide match toggles now that hole cards exist
    onRoundTypeChange();

    // Pre-populate each hole's data
    round.holes.forEach(hole => {
        const n = hole.number;

        // Score, putts, penalties
        document.getElementById(`score${n}`).value = hole.score;
        document.getElementById(`putts${n}`).value = hole.putts || 0;
        document.getElementById(`penalties${n}`).value = hole.penalties || 0;
        updatePenaltyStyle(n);

        // Bunker checkbox
        document.getElementById(`bunker${n}`).checked = hole.bunker || false;

        // Fairway toggle
        if (hole.fairwayDirection) {
            selectToggle(n, 'fairway', hole.fairwayDirection);
        }

        // Approach toggle
        if (hole.approachResult) {
            selectToggle(n, 'approach', hole.approachResult);
        }

        // Match result toggle
        if (hole.matchResult) {
            selectToggle(n, 'match', hole.matchResult);
        }

        // Putt distances
        if (hole.putts > 0) {
            renderPuttDistances(n);
            if (hole.puttDistances) {
                hole.puttDistances.forEach((dist, idx) => {
                    const input = document.getElementById(`puttDist${n}_${idx + 1}`);
                    if (input && dist !== null && dist !== undefined) {
                        input.value = dist;
                    }
                });
            }
        }
    });
}

function resetRoundForm() {
    if (editingRoundId) {
        editingRoundId = null;
        document.getElementById('roundFormTitle').textContent = 'Log New Round';
        document.getElementById('saveRoundBtn').textContent = 'Save Round';
    }
}

// Alert helper
function showAlert(containerId, message, type) {
    const container = document.getElementById(containerId);
    container.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
    setTimeout(() => { container.innerHTML = ''; }, 5000);
}

function showConfirmDialog({ title, message, confirmText, icon }) {
    return new Promise(resolve => {
        const modal = document.getElementById('confirmModal');
        document.getElementById('confirmIcon').textContent = icon || '\u26A0\uFE0F';
        document.getElementById('confirmTitle').textContent = title || 'Are you sure?';
        document.getElementById('confirmMessage').textContent = message || '';
        document.getElementById('confirmOkBtn').textContent = confirmText || 'Delete';
        modal.classList.add('active');

        const okBtn = document.getElementById('confirmOkBtn');
        const cancelBtn = document.getElementById('confirmCancelBtn');

        function cleanup(result) {
            modal.classList.remove('active');
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
            resolve(result);
        }
        function onOk() { cleanup(true); }
        function onCancel() { cleanup(false); }

        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
    });
}

// Theme management
function applyTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
    // Update selector if it exists
    const sel = document.getElementById('themeSelect');
    if (sel) sel.value = theme || 'light';
}

function changeTheme() {
    const theme = document.getElementById('themeSelect').value;
    appData.settings.theme = theme;
    applyTheme(theme);
    saveToLocalStorage();
}

// Settings management
function saveSettings() {
    const url = document.getElementById('webAppUrl').value.trim();
    if (url && !url.startsWith('https://')) {
        showAlert('settingsAlert', 'Web App URL must start with https://', 'error');
        return;
    }
    appData.settings.webAppUrl = url;
    saveToLocalStorage();
    showAlert('settingsAlert', 'Settings saved successfully!', 'success');
}

function loadSettings() {
    document.getElementById('webAppUrl').value = appData.settings.webAppUrl || '';
    document.getElementById('themeSelect').value = appData.settings.theme || 'light';
    renderGoalsForm();
}

function renderGoalsForm() {
    const goals = appData.settings.goals || {};
    const grid = document.getElementById('goalsGrid');
    grid.innerHTML = Object.entries(GOAL_DEFS).map(([key, def]) => {
        const goal = goals[key] || {};
        const targetVal = goal.target !== undefined && goal.target !== null ? goal.target : '';
        const bufferVal = goal.buffer !== undefined ? goal.buffer : def.buffer;
        return `
        <div class="goal-input-group">
            <label>${def.label}</label>
            <div class="goal-input-row">
                <span>Target</span>
                <input type="number" id="goalTarget_${key}" value="${targetVal}" placeholder="e.g. ${def.direction === 'higher' ? '60' : '16'}" step="any">
                <span>Threshold</span>
                <input type="number" id="goalBuffer_${key}" value="${bufferVal}" step="any">
            </div>
        </div>`;
    }).join('');
}

function saveGoals() {
    const goals = {};
    const errors = [];
    Object.entries(GOAL_DEFS).forEach(([key, def]) => {
        const targetInput = document.getElementById(`goalTarget_${key}`);
        const bufferInput = document.getElementById(`goalBuffer_${key}`);
        const target = targetInput.value.trim();
        const buffer = bufferInput.value.trim();
        if (target !== '') {
            const targetNum = parseFloat(target);
            const bufferNum = buffer !== '' ? parseFloat(buffer) : def.buffer;
            if (isNaN(targetNum)) {
                errors.push(`${def.label}: target must be a number.`);
            } else if (buffer !== '' && (isNaN(bufferNum) || bufferNum < 0)) {
                errors.push(`${def.label}: threshold must be a positive number.`);
            } else {
                goals[key] = { target: targetNum, buffer: bufferNum };
            }
        }
    });
    if (errors.length > 0) {
        showAlert('goalsAlert', errors.join('<br>'), 'error');
        return;
    }
    appData.settings.goals = goals;
    saveToLocalStorage();
    showAlert('goalsAlert', 'Goals saved!', 'success');
}

async function testConnection() {
    if (!appData.settings.webAppUrl) {
        showAlert('settingsAlert', 'Please enter your Apps Script Web App URL', 'error');
        return;
    }
    try {
        const response = await fetch(appData.settings.webAppUrl);
        const result = await response.json();
        if (result.success) {
            const c = result.data.courses ? result.data.courses.length : 0;
            const r = result.data.rounds ? result.data.rounds.length : 0;
            showAlert('settingsAlert', `Connected! Sheet has ${c} course(s) and ${r} round(s).`, 'success');
        } else {
            showAlert('settingsAlert', 'Connection failed: ' + result.error, 'error');
        }
    } catch (error) {
        showAlert('settingsAlert', 'Connection failed: ' + error.message, 'error');
    }
}

// Google Sheets sync via Apps Script web app
async function syncToGoogleSheets() {
    if (!appData.settings.webAppUrl) return;

    try {
        const response = await fetch(appData.settings.webAppUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                courses: appData.courses,
                rounds: appData.rounds
            })
        });

        const result = await response.json();
        if (!result.success) {
            console.log('Google Sheets sync failed:', result.error);
        }
    } catch (error) {
        console.log('Google Sheets sync failed:', error);
    }
}

async function syncFromGoogleSheets() {
    if (!appData.settings.webAppUrl) return;

    try {
        const response = await fetch(appData.settings.webAppUrl);
        const result = await response.json();

        if (!result.success) {
            showAlert('settingsAlert', 'Sync failed: ' + result.error, 'error');
            return;
        }

        if (result.data.courses && result.data.courses.length > 0) {
            appData.courses = result.data.courses;
        }
        if (result.data.rounds && result.data.rounds.length > 0) {
            appData.rounds = result.data.rounds;
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

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);

            // Validate structure
            if (!data.courses || !Array.isArray(data.courses)) {
                showAlert('importAlert', 'Invalid file: missing courses array.', 'error');
                return;
            }
            if (!data.rounds || !Array.isArray(data.rounds)) {
                showAlert('importAlert', 'Invalid file: missing rounds array.', 'error');
                return;
            }

            const courseCount = data.courses.length;
            const roundCount = data.rounds.length;

            const confirmed = await showConfirmDialog({
                title: 'Import Data',
                message: `This will replace ALL current data with ${courseCount} course(s) and ${roundCount} round(s). Current data will be lost.`,
                confirmText: 'Import',
                icon: '\uD83D\uDCE5'
            });
            if (!confirmed) return;

            appData.courses = data.courses;
            appData.rounds = data.rounds;
            if (data.settings) {
                appData.settings = { ...appData.settings, ...data.settings };
            }

            saveToLocalStorage();
            renderCourseList();
            loadCourseSelect();
            renderDashboard();
            renderGoalsForm();
            showAlert('importAlert', `Imported ${courseCount} course(s) and ${roundCount} round(s) successfully.`, 'success');
        } catch (err) {
            showAlert('importAlert', 'Failed to parse file. Make sure it is a valid JSON export.', 'error');
        }
    };
    reader.readAsText(file);

    // Reset file input so the same file can be re-imported
    event.target.value = '';
}

async function clearAllData() {
    const confirmed = await showConfirmDialog({
        title: 'Clear All Data',
        message: 'This will permanently delete ALL courses and rounds. This cannot be undone.',
        confirmText: 'Clear Everything',
        icon: '\u26A0\uFE0F'
    });
    if (confirmed) {
        appData = { courses: [], rounds: [], settings: appData.settings };
        saveToLocalStorage();
        renderCourseList();
        loadCourseSelect();
        renderDashboard();
        showAlert('settingsAlert', 'All data has been cleared.', 'success');
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);
