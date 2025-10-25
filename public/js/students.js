// students-script.js (Page-Specific JavaScript for Student Management Page)
const G_TOKEN = localStorage.getItem('adminToken');
if (!G_TOKEN) {
    window.location.href = 'login.html';
}

/**
 * Render Student Table
 */
function renderStudentTable(students, container) {
    if (students.length === 0) {
        container.innerHTML = '<tr><td colspan="6" class="empty-cell">No students found.</td></tr>';
        return;
    }
    container.innerHTML = students.map(s => `
        <tr>
            <td class="name-cell">${s.name}</td>
            <td class="data-cell">${s.enrollment_number}</td>
            <td class="data-cell">${s.department}</td>
            <td class="data-cell">${s.batch}</td>
            <td class="data-cell">${s.semester}</td>
            <td class="actions-cell">
                <button class="delete-btn" data-enroll="${s.enrollment_number}">
                    <i class="fas fa-trash-alt"></i> Delete
                </button>
            </td>
        </tr>
    `).join('');
}

/**
 * Handle Add Student
 */
async function handleAddStudent(e) {
    e.preventDefault();
    const addStudentMsg = document.getElementById('add-student-msg');
    const data = {
        name: document.getElementById('add-name').value,
        enrollment_number: document.getElementById('add-enroll').value,
        department: document.getElementById('add-dept').value,
        batch: document.getElementById('add-batch').value,
        semester: parseInt(document.getElementById('add-sem').value),
        mor_shift: document.getElementById('add-shift').value === 'true',
        section: document.getElementById('add-section').value || undefined,
        phone_no: document.getElementById('add-phone').value || undefined,
        address: document.getElementById('add-address').value || undefined,
    };

    try {
        await api('/student', { method: 'POST', body: JSON.stringify(data) }, true);
        showMessage(addStudentMsg, 'Student added successfully!');
        document.getElementById('add-student-form').reset();
    } catch (err) {
        showMessage(addStudentMsg, err.message, true);
    }
}

/**
 * Handle Bulk Add
 */
async function handleBulkAdd(e) {
    e.preventDefault();
    const bulkAddMsg = document.getElementById('bulk-add-msg');
    const fileInput = document.getElementById('csv-file');
    if (!fileInput.files || fileInput.files.length === 0) {
        showMessage(bulkAddMsg, 'Please select a CSV file.', true);
        return;
    }
    
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    
    bulkAddMsg.textContent = 'Uploading...';
    bulkAddMsg.className = 'text-blue-600';

    try {
        const res = await fetch(`http://localhost:5000/student/bulk`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${G_TOKEN}` },
            body: formData
        });
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || 'Bulk upload failed');

        const msg = `Success: ${data.success}, Failed: ${data.failed}.`;
        showMessage(bulkAddMsg, msg, data.failed > 0);
        if (data.errors && data.errors.length > 0) {
            console.error('Bulk add errors:', data.errors);
            alert(`Upload errors occurred. Check console (F12) for details.\nFirst error: ${data.errors[0].error}`);
        }
        document.getElementById('bulk-add-form').reset();
        
    } catch (err) {
        showMessage(bulkAddMsg, err.message, true);
    }
}

/**
 * Handle Search Enroll
 */
async function handleSearchEnroll() {
    const searchEnrollInput = document.getElementById('search-enroll');
    const studentListBody = document.getElementById('student-list-body');
    const studentListCount = document.getElementById('student-list-count');
    const searchEnrollMsg = document.getElementById('search-enroll-msg');
    const enroll = searchEnrollInput.value.trim();
    if (!enroll) return;
    
    studentListBody.innerHTML = '<tr><td colspan="6" class="loading-cell"><div class="spinner mx-auto"></div></td></tr>';
    studentListCount.textContent = '';
    searchEnrollMsg.textContent = '';

    try {
        const data = await api(`/student/${enroll}`, {}, true);
        renderStudentTable([data.student], studentListBody);
        studentListCount.textContent = 'Showing 1 student.';
    } catch (err) {
        studentListBody.innerHTML = `<tr><td colspan="6" class="error-cell">Error: ${err.message}</td></tr>`;
        studentListCount.textContent = 'Showing 0 students.';
    }
}

/**
 * Handle Filter Students
 */
async function handleFilterStudents(e) {
    e.preventDefault();
    
    const studentListBody = document.getElementById('student-list-body');
    const studentListCount = document.getElementById('student-list-count');
    
    const params = new URLSearchParams();
    if (document.getElementById('filter-search').value) params.append('search', document.getElementById('filter-search').value);
    if (document.getElementById('filter-dept').value) params.append('department', document.getElementById('filter-dept').value);
    if (document.getElementById('filter-batch').value) params.append('batch', document.getElementById('filter-batch').value);
    if (document.getElementById('filter-sem').value) params.append('semester', document.getElementById('filter-sem').value);
    if (document.getElementById('filter-section').value) params.append('section', document.getElementById('filter-section').value);
    if (document.getElementById('filter-shift').value) params.append('shift', document.getElementById('filter-shift').value);
    
    params.append('limit', '100');
    
    studentListBody.innerHTML = '<tr><td colspan="6" class="loading-cell"><div class="spinner mx-auto"></div></td></tr>';
    studentListCount.textContent = 'Searching...';

    try {
        const data = await api(`/student?${params.toString()}`, {}, true);
        renderStudentTable(data.students, studentListBody);
        studentListCount.textContent = `Showing ${data.count} students.`;
    } catch (err) {
        studentListBody.innerHTML = `<tr><td colspan="6" class="error-cell">Error: ${err.message}</td></tr>`;
        studentListCount.textContent = 'Showing 0 students.';
    }
}

/**
 * Handle Delete Student
 */
async function handleDeleteStudent(e) {
    if (!e.target.closest('.delete-btn')) return;
    
    const btn = e.target.closest('.delete-btn');
    const enroll = btn.dataset.enroll;
    
    if (!confirm(`Are you sure you want to delete student ${enroll}? This cannot be undone.`)) {
        return;
    }

    try {
        await api(`/student/${enroll}`, { method: 'DELETE' }, true);
        // Refresh current filter
        handleFilterStudents(new Event('submit'));
    } catch (err) {
        alert(`Error: ${err.message}`);
    }
}

// Initialization
document.addEventListener('DOMContentLoaded', function() {
    // Update Nav
    updateNav();

    // Student Mgmt Listeners
    document.getElementById('add-student-form').addEventListener('submit', handleAddStudent);
    document.getElementById('bulk-add-form').addEventListener('submit', handleBulkAdd);
    document.getElementById('search-enroll-btn').addEventListener('click', handleSearchEnroll);
    document.getElementById('search-enroll').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearchEnroll();
    });
    document.getElementById('filter-form').addEventListener('submit', handleFilterStudents);
    document.getElementById('student-list-body').addEventListener('click', handleDeleteStudent);

    // Initial Setup
    const studentListBody = document.getElementById('student-list-body');
    const studentListCount = document.getElementById('student-list-count');
    studentListBody.innerHTML = '<tr><td colspan="6" class="empty-cell">Filter students to see results.</td></tr>';
    studentListCount.textContent = 'Showing 0 students.';

    // Logout Listener
    const navLogout = document.getElementById('nav-logout');
    navLogout.addEventListener('click', (e) => {
        e.preventDefault();
        handleLogout();
    });
});