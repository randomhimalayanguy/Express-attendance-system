// analytics-script.js (Page-Specific JavaScript for Analytics Page)
const G_TOKEN = localStorage.getItem('adminToken');
if (!G_TOKEN) {
    window.location.href = 'login.html';
}

/**
 * Load Analytics Data
 */
async function loadAnalytics() {
    const tbody = document.getElementById('analytics-table-body');
    const dateEl = document.getElementById('analytics-date');
    const countEl = document.getElementById('total-inside-count');

    tbody.innerHTML = '<tr><td colspan="4" class="loading-cell"><div class="spinner mx-auto"></div></td></tr>';
    dateEl.textContent = new Date().toLocaleDateString([], { dateStyle: 'full' });
    countEl.textContent = '...';

    try {
        const data = await api('/analytics', {}, true);
        
        countEl.textContent = data.totalInside;
        
        if (data.studentsInside.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">No students are currently inside.</td></tr>';
            return;
        }

        tbody.innerHTML = data.studentsInside.map(s => `
            <tr>
                <td class="name-cell">${s.name}</td>
                <td class="data-cell">${s.dept}</td>
                <td class="data-cell">${s.batch}</td>
                <td class="data-cell">${s.semester}</td>
            </tr>
        `).join('');

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="4" class="error-cell">Error: ${err.message}</td></tr>`;
    }
}

// Initialization
document.addEventListener('DOMContentLoaded', function() {
    // Update Nav
    updateNav();

    // Load Analytics
    loadAnalytics();

    // Logout Listener
    const navLogout = document.getElementById('nav-logout');
    navLogout.addEventListener('click', (e) => {
        e.preventDefault();
        handleLogout();
    });
});