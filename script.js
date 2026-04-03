// --- CONFIGURATION ---
const SUPABASE_URL = 'https://svhbqvcabbzrxvndxtjm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2aGJxdmNhYmJ6cnh2bmR4dGptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMTA0MjksImV4cCI6MjA5MDc4NjQyOX0.lYIsM5zN4uGKbP79avcKR_EaAlP5tu2N688OgZI6wZA';
// FIX: Use a different name for the variable to avoid the "already declared" error
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- STATE ---
let currentUser = { 
    name: '', 
    id: '', 
    clockIn: null, 
    isClockedIn: false, 
    clockInCoords: '', 
    clockInLoc: '', 
    clockOut: null, 
    clockOutCoords: '', 
    clockOutLoc: '' 
};
let timerInterval;

// --- VALIDATION ---
const validateName = (str) => /^[a-zA-Z\s]*$/.test(str);
const validateID = (str) => /^[0-9]*$/.test(str);
const validateLocation = (str) => /^[a-zA-Z0-9\s]*$/.test(str) && str.length <= 60;

// --- INITIALIZATION ---
window.onload = () => {
    const saved = localStorage.getItem('seamex_user');
    if (saved) {
        currentUser = JSON.parse(saved);
        showMainUI();
    }
};

// --- START DAY BUTTON ---
document.getElementById('btn-start').addEventListener('click', async () => {
    const nameInput = document.getElementById('user-name').value.trim();
    const idInput = document.getElementById('poornata-id').value.trim();

    // 1. Validations
    if (!validateName(nameInput) || nameInput === "") {
        alert("Enter a valid Name (Alphabets & Spaces only).");
        return;
    }
    if (!validateID(idInput) || idInput === "") {
        alert("Enter a valid Poornata ID (Numbers only).");
        return;
    }

    // 2. Location Permission Prompt
    try {
        await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
        });
    } catch (err) {
        alert("Location access is required for Geo-Attendance. Please enable it in your browser settings.");
        return; 
    }

    // 3. Success -> Proceed
    currentUser.name = nameInput;
    currentUser.id = idInput;
    saveState();
    showMainUI();
});

function showMainUI() {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('main-section').classList.remove('hidden');
    document.getElementById('welcome-note').innerText = `Welcome, ${currentUser.name}!`;
    document.getElementById('display-id').innerText = currentUser.id;
    
    if (currentUser.isClockedIn) {
        updateUIAfterClockIn();
        if (currentUser.clockOut) {
            // If they already clocked out but haven't submitted
            document.getElementById('clock-out-group').classList.add('hidden');
            document.getElementById('btn-submit-day').classList.remove('hidden');
        }
    }
}

// --- CLOCK IN ---
document.getElementById('btn-clock-in').addEventListener('click', async () => {
    const locName = document.getElementById('in-location-name').value.trim();
    if (!validateLocation(locName) || locName === "") {
        alert("Provide a valid location name (Max 60 chars, no special characters).");
        return;
    }

    const coords = await getPreciseCoords();
    if (!coords) return;

    currentUser.clockIn = new Date().toISOString();
    currentUser.clockInCoords = coords;
    currentUser.clockInLoc = locName;
    currentUser.isClockedIn = true;
    
    updateUIAfterClockIn();
    saveState();
});

// --- CLOCK OUT ---
document.getElementById('btn-clock-out').addEventListener('click', async () => {
    const locName = document.getElementById('out-location-name').value.trim();
    if (!validateLocation(locName) || locName === "") {
        alert("Provide a valid location name.");
        return;
    }

    const coords = await getPreciseCoords();
    if (!coords) return;

    currentUser.clockOut = new Date().toISOString();
    currentUser.clockOutCoords = coords;
    currentUser.clockOutLoc = locName;
    
    clearInterval(timerInterval);
    document.getElementById('clock-out-group').classList.add('hidden');
    document.getElementById('btn-submit-day').classList.remove('hidden');
    saveState();
});

// --- SUBMIT ---
document.getElementById('btn-submit-day').addEventListener('click', async () => {
    const { error } = await _supabase
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
        alert("Submission Successful!");
        localStorage.removeItem('seamex_user');
        location.reload();
    } else {
        alert("Error: " + error.message);
    }
});

// --- UTILS ---
async function getPreciseCoords() {
    return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
            (pos) => resolve(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`),
            () => { alert("Position access denied."); resolve(null); },
            { enableHighAccuracy: true }
        );
    });
}

function updateUIAfterClockIn() {
    document.getElementById('clock-in-group').classList.add('hidden');
    document.getElementById('clock-out-group').classList.remove('hidden');
    document.getElementById('clock-in-info').innerText = `In: ${new Date(currentUser.clockIn).toLocaleTimeString()}`;
    startTimer();
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        const diff = new Date() - new Date(currentUser.clockIn);
        const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
        const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        document.getElementById('timer-display').innerText = `Shift Duration: ${h}:${m}:${s}`;
    }, 1000);
}

function saveState() {
    localStorage.setItem('seamex_user', JSON.stringify(currentUser));
}
