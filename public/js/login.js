// login-script.js (Page-Specific JavaScript for Login Page)
/**
 * Handle Login
 */
async function handleLogin(e) {
    e.preventDefault();
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginMsg = document.getElementById('login-message');
    const username = usernameInput.value;
    const password = passwordInput.value;

    try {
        const data = await api('/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        
        localStorage.setItem('adminToken', data.token);
        localStorage.setItem('adminUser', JSON.stringify(data.userWithoutPassword));

        updateNav();
        document.getElementById('login-form').reset();
        loginMsg.textContent = '';
        window.location.href = 'analytics.html';

    } catch (err) {
        showMessage(loginMsg, err.message, true);
    }
}

// Initialization
document.addEventListener('DOMContentLoaded', function() {
    // Update Nav
    updateNav();

    // Check if already logged in
    const G_TOKEN = localStorage.getItem('adminToken');
    if (G_TOKEN) {
        window.location.href = 'analytics.html';
        return;
    }

    // Login Listener
    const loginForm = document.getElementById('login-form');
    loginForm.addEventListener('submit', handleLogin);

    // Logout Listener
    const navLogout = document.getElementById('nav-logout');
    if (navLogout) {
        navLogout.addEventListener('click', (e) => {
            e.preventDefault();
            handleLogout();
        });
    }
});