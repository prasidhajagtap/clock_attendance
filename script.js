// --- CONFIGURATION ---
const SUPABASE_URL = 'https://svhbqvcabbzrxvndxtjm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2aGJxdmNhYmJ6cnh2bmR4dGptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMTA0MjksImV4cCI6MjA5MDc4NjQyOX0.lYIsM5zN4uGKbP79avcKR_EaAlP5tu2N688OgZI6wZA';
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
const validateName     = (str) => /^[a-zA-Z\s]*$/.test(str);
const validateID       = (str) => /^[0-9]*$/.test(str);
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
// FIX 1: Added timeout:12000 to geolocation options — without it the browser
//         waits forever for a high-accuracy GPS fix, making the button appear frozen.
// FIX 2: Added loading state so the user sees "Checking Location…" instead of
//         a button that looks completely unresponsive.
// FIX 3: Added navigator.geolocation existence check (undefined on plain HTTP).
// FIX 4: Specific error messages for permission-denied vs timed-out scenarios.
document.getElementById('btn-start').addEventListener('click', async () => {
    const nameInput = document.getElementById('user-name').value.trim();
    const idInput   = document.getElementById('poornata-id').value.trim();

    if (!validateName(nameInput) || nameInput === '') {
        alert('Enter a valid Name (Alphabets & Spaces only).');
        return;
    }
    if (!validateID(idInput) || idInput === '') {
        alert('Enter a valid Poornata ID (Numbers only).');
        return;
    }

    if (!navigator.geolocation) {
        alert('Geolocation is not supported by this browser. Please use a modern browser over HTTPS.');
        return;
    }

    const btn = document.getElementById('btn-start');
    btn.disabled    = true;
    btn.textContent = 'Checking Location\u2026';

    try {
        await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout:            12000,   // KEY FIX: prevents infinite hang
                maximumAge:         0
            });
        });
    } catch (err) {
        btn.disabled    = false;
        btn.textContent = 'Start Day';
        if (err.code === 1) {
            alert('Location access is required. Please enable it in your browser settings and try again.');
        } else if (err.code === 3) {
            alert('Location request timed out. Please check your GPS/network signal and try again.');
        } else {
            alert('Could not get your location. Please try again.');
        }
        return;
    }

    btn.disabled    = false;
    btn.textContent = 'Start Day';

    currentUser.name = nameInput;
    currentUser.id   = idInput;
    saveState();
    showMainUI();
});

function showMainUI() {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('main-section').classList.remove('hidden');
    document.getElementById('welcome-note').innerText = `Welcome, ${currentUser.name}!`;
    document.getElementById('display-id').innerText   = currentUser.id;

    if (currentUser.isClockedIn) {
        updateUIAfterClockIn();
        if (currentUser.clockOut) {
            document.getElementById('clock-out-group').classList.add('hidden');
            document.getElementById('btn-submit-day').classList.remove('hidden');
        }
    }
}

// --- CLOCK IN ---
document.getElementById('btn-clock-in').addEventListener('click', async () => {
    const locName = document.getElementById('in-location-name').value.trim();
    if (!validateLocation(locName) || locName === '') {
        alert('Provide a valid location name (Max 60 chars, no special characters).');
        return;
    }

    const btn = document.getElementById('btn-clock-in');
    btn.disabled    = true;
    btn.textContent = 'Getting Location\u2026';

    const coords = await getPreciseCoords();

    btn.disabled    = false;
    btn.textContent = 'Clock In';

    if (!coords) return;

    currentUser.clockIn       = new Date().toISOString();
    currentUser.clockInCoords = coords;
    currentUser.clockInLoc    = locName;
    currentUser.isClockedIn   = true;

    updateUIAfterClockIn();
    saveState();
});

// --- CLOCK OUT ---
document.getElementById('btn-clock-out').addEventListener('click', async () => {
    const locName = document.getElementById('out-location-name').value.trim();
    if (!validateLocation(locName) || locName === '') {
        alert('Provide a valid location name.');
        return;
    }

    const btn = document.getElementById('btn-clock-out');
    btn.disabled    = true;
    btn.textContent = 'Getting Location\u2026';

    const coords = await getPreciseCoords();

    btn.disabled    = false;
    btn.textContent = 'Clock Out';

    if (!coords) return;

    currentUser.clockOut       = new Date().toISOString();
    currentUser.clockOutCoords = coords;
    currentUser.clockOutLoc    = locName;

    clearInterval(timerInterval);
    document.getElementById('clock-out-group').classList.add('hidden');
    document.getElementById('btn-submit-day').classList.remove('hidden');
    saveState();
});

// --- SUBMIT DAY ---
// FIX 5: The original code registered this listener TWICE (identical duplicate block
//         starting at line 150 of the old file). Every click fired two Supabase inserts.
//         The duplicate has been removed — only ONE listener here now.
document.getElementById('btn-submit-day').addEventListener('click', async () => {
    const btn = document.getElementById('btn-submit-day');
    btn.disabled    = true;
    btn.textContent = 'Submitting\u2026';

    const { error } = await _supabase
        .from('attendance')
        .insert([{
            user_name:               currentUser.name,
            employee_id:             currentUser.id,
            clock_in_time:           currentUser.clockIn,
            clock_in_coords:         currentUser.clockInCoords,
            clock_in_location_name:  currentUser.clockInLoc,
            clock_out_time:          currentUser.clockOut,
            clock_out_coords:        currentUser.clockOutCoords,
            clock_out_location_name: currentUser.clockOutLoc,
            status:                  'completed'
        }]);

    if (!error) {
        alert('Submission Successful!');
        localStorage.removeItem('seamex_user');
        location.reload();
    } else {
        console.error('Supabase Error:', error);
        btn.disabled    = false;
        btn.textContent = 'Submit the Day';
        alert('Submission failed: ' + error.message);
    }
});

// --- UTILS ---
// FIX 6: Added timeout:12000 here too — getPreciseCoords had the same infinite-hang
//         risk during Clock In and Clock Out.
async function getPreciseCoords() {
    return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
            (pos) => resolve(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`),
            (err) => {
                if (err.code === 3) {
                    alert('Location request timed out. Please check your GPS/network and try again.');
                } else {
                    alert('Location access denied. Please enable it in your browser settings.');
                }
                resolve(null);
            },
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
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
