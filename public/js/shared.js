// shared.js (Common JavaScript for All Pages)
/**
 * Generic fetch wrapper
 */
async function api(endpoint, options = {}, auth = false) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    const G_TOKEN = localStorage.getItem('adminToken');
    if (auth && G_TOKEN) {
        headers['Authorization'] = `Bearer ${G_TOKEN}`;
    }

    try {
        const res = await fetch(`http://localhost:5000${endpoint}`, { ...options, headers });
        const data = await res.json();

        if (!res.ok) {
            if (res.status === 409 && data.error && data.error.includes("Cannot Authenticate")) {
                handleLogout();
            }
            throw new Error(data.error || 'API Error');
        }
        return data;

    } catch (err) {
        console.error(`API Error at ${endpoint}:`, err);
        throw err;
    }
}

/**
 * Update Navigation
 */
function updateNav() {
    const G_TOKEN = localStorage.getItem('adminToken');
    const navLogin = document.getElementById('nav-login');
    const navAnalytics = document.getElementById('nav-analytics');
    const navStudents = document.getElementById('nav-students');
    const navLogout = document.getElementById('nav-logout');

    if (navLogin && navAnalytics && navStudents && navLogout) {
        if (G_TOKEN) {
            navLogin.classList.add('hidden');
            navAnalytics.classList.remove('hidden');
            navStudents.classList.remove('hidden');
            navLogout.classList.remove('hidden');
        } else {
            navLogin.classList.remove('hidden');
            navAnalytics.classList.add('hidden');
            navStudents.classList.add('hidden');
            navLogout.classList.add('hidden');
        }
    }
}

/**
 * Handle Logout
 */
function handleLogout() {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    updateNav();
    window.location.href = 'index.html';
}

/**
 * Show Message (for login and other pages)
 */
function showMessage(el, text, isError = false) {
    el.textContent = text;
    el.className = isError ? 'text-red-600 animate-pulse' : '';
    setTimeout(() => el.textContent = '', 3000);
}