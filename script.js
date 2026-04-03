// --- CONFIGURATION ---
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- STATE MANAGEMENT ---
let currentUser = { name: '', id: '', clockIn: null, isClockedIn: false };
let timerInterval;

// --- DOM ELEMENTS ---
const authSection = document.getElementById('auth-section');
const mainSection = document.getElementById('main-section');
const btnStart = document.getElementById('btn-start');

// --- VALIDATION HELPERS ---
const validateName = (str) => /^[a-zA-Z\s]*$/.test(str);
const validateID = (str) => /^[0-9]*$/.test(str);
const validateLocation = (str) => /^[a-zA-Z0-9\s]*$/.test(str) && str.length <= 60;

// --- CORE LOGIC ---
btnStart.addEventListener('click', () => {
    const nameInput = document.getElementById('user-name').value;
    const idInput = document.getElementById('poornata-id').value;

    if (!validateName(nameInput) || nameInput.trim() === "") {
        alert("Please enter a valid Name (Alphabets only).");
        return;
    }
    if (!validateID(idInput) || idInput.trim() === "") {
        alert("Please enter a valid Poornata ID (Numbers only).");
        return;
    }

    currentUser.name = nameInput;
    currentUser.id = idInput;
    
    // Save to LocalStorage for persistence
    localStorage.setItem('seamex_user', JSON.stringify(currentUser));
    showMainUI();
});

function showMainUI() {
    authSection.classList.add('hidden');
    mainSection.classList.remove('hidden');
    document.getElementById('welcome-note').innerText = `Welcome, ${currentUser.name}!`;
    document.getElementById('display-id').innerText = currentUser.id;
    
    checkExistingSession();
}

// Get precise coordinates
function getCoords() {
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            (pos) => resolve(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`),
            (err) => { alert("Please allow location access."); reject(err); },
            { enableHighAccuracy: true }
        );
    });
}

document.getElementById('btn-clock-in').addEventListener('click', async () => {
    const locName = document.getElementById('in-location-name').value;
    if (!validateLocation(locName)) {
        alert("Location name must be alphanumeric and max 60 chars.");
        return;
    }

    const coords = await getCoords();
    currentUser.clockIn = new Date().toISOString();
    currentUser.clockInCoords = coords;
    currentUser.clockInLoc = locName;
    currentUser.isClockedIn = true;
    
    updateUIAfterClockIn();
    saveState();
});

function updateUIAfterClockIn() {
    document.getElementById('clock-in-group').classList.add('hidden');
    document.getElementById('clock-out-group').classList.remove('hidden');
    document.getElementById('clock-in-info').innerText = `Clocked in at: ${new Date(currentUser.clockIn).toLocaleTimeString()}`;
    
    startTimer();
}

function startTimer() {
    timerInterval = setInterval(() => {
        const start = new Date(currentUser.clockIn);
        const now = new Date();
        const diff = new Date(now - start);
        const h = String(diff.getUTCHours()).padStart(2, '0');
        const m = String(diff.getUTCMinutes()).padStart(2, '0');
        const s = String(diff.getUTCSeconds()).padStart(2, '0');
        document.getElementById('timer-display').innerText = `Shift Duration: ${h}:${m}:${s}`;
    }, 1000);
}

document.getElementById('btn-clock-out').addEventListener('click', async () => {
    const locName = document.getElementById('out-location-name').value;
    if (!validateLocation(locName)) {
        alert("Invalid location name.");
        return;
    }

    const coords = await getCoords();
    currentUser.clockOut = new Date().toISOString();
    currentUser.clockOutCoords = coords;
    currentUser.clockOutLoc = locName;
    
    clearInterval(timerInterval);
    document.getElementById('btn-submit-day').classList.remove('hidden');
    saveState();
});

// Final Submission to Supabase
document.getElementById('btn-submit-day').addEventListener('click', async () => {
    const { data, error } = await supabase
        .from('attendance')
        .insert([{
            user_name: currentUser.name,
            employee_id: currentUser.id,
            clock_in_time: currentUser.clockIn,
            clock_in_coords: currentUser.clockInCoords,
            clock_in_location_name: currentUser.clockInLoc,
            clock_out_time: currentUser.clockOut,
            clock_out_coords: currentUser.clockOutCoords,
            clock_out_location_name: currentUser.clockOutLoc,
            status: 'completed'
        }]);

    if (!error) {
        alert("Day submitted successfully!");
        localStorage.removeItem('seamex_user');
        location.reload();
    } else {
        alert("Error: " + error.message);
    }
});

// Auto-submit at Midnight (if data exists)
setInterval(() => {
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() === 0) {
        if (currentUser.id) document.getElementById('btn-submit-day').click();
    }
}, 60000);

function saveState() {
    localStorage.setItem('seamex_user', JSON.stringify(currentUser));
}

function checkExistingSession() {
    const saved = localStorage.getItem('seamex_user');
    if (saved) {
        currentUser = JSON.parse(saved);
        if (currentUser.isClockedIn) updateUIAfterClockIn();
    }
}
