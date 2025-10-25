// security-script.js (Page-Specific JavaScript for Security/Main Page)
/**
 * Update Clock
 */
function updateClock() {
    const now = new Date();
    const clockEl = document.getElementById('clock');
    const dateEl = document.getElementById('date');
    clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    dateEl.textContent = now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Handle Entry
 */
async function handleEntry(e) {
    e.preventDefault();
    const enrollInput = document.getElementById('enrollment-input');
    const entryBtn = document.getElementById('submit-entry');
    const entryMsg = document.getElementById('entry-message');
    const enroll = enrollInput.value.trim();
    if (!enroll) return;

    entryBtn.disabled = true;
    entryBtn.innerHTML = '<div class="spinner" style="width: 1rem; height: 1rem; border-width: 2px;"></div>';

    try {
        const data = await api('/entry', {
            method: 'POST',
            body: JSON.stringify({ enrollment_number: enroll })
        });
        
        const studentName = data.logWithUser.student_id.name;
        const status = data.logWithUser.status ? 'IN' : 'OUT';
        
        entryMsg.innerHTML = `<span class="text-2xl font-bold ${status === 'IN' ? 'text-green-600' : 'text-blue-600'}">Welcome, ${studentName}! (Logged ${status})</span>`;
        enrollInput.value = '';

    } catch (err) {
        entryMsg.innerHTML = `<span class="text-2xl font-bold text-red-600">${err.message}</span>`;
    } finally {
        entryBtn.disabled = false;
        entryBtn.innerHTML = '<i class="fas fa-arrow-right"></i>';
        setTimeout(() => entryMsg.innerHTML = '', 4000);
    }
}

// Initialization
document.addEventListener('DOMContentLoaded', function() {
    // Update Nav
    updateNav();

    // Clock
    setInterval(updateClock, 1000);
    updateClock();

    // Entry Listeners
    const entryBtn = document.getElementById('submit-entry');
    const enrollInput = document.getElementById('enrollment-input');
    entryBtn.addEventListener('click', handleEntry);
    enrollInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleEntry(e);
    });

    // Logout Listener
    const navLogout = document.getElementById('nav-logout');
    if (navLogout) {
        navLogout.addEventListener('click', (e) => {
            e.preventDefault();
            handleLogout();
        });
    }
});