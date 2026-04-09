// Execute initialization
(function() {
    console.log('Add Log script starting...');
    
    // Safety check: if no token, the API will fail anyway, so redirect to login
    if (!localStorage.getItem('access')) {
        console.warn('No access token found, redirecting to login...');
        window.location.href = '/login/';
        return;
    }

    // Setup initialization on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();

function initialize() {
    console.log('Initializing Add Log page features...');
    loadOffices();
    setupStudentIdListener();
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

async function loadOffices() {
    const officeSelect = document.getElementById('office');
    if (!officeSelect) return;

    const token = localStorage.getItem('access');
    const userRole = localStorage.getItem('userRole');
    
    console.log('Fetching offices...');

    try {
        const response = await fetch('/api/offices/', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const offices = await response.json();
        console.log('Offices loaded:', offices);

        officeSelect.innerHTML = '<option value="">Select an office</option>';
        offices.forEach(office => {
            const option = document.createElement('option');
            option.value = office.name;
            option.textContent = office.name;
            officeSelect.appendChild(option);
        });

        // Special handling for Moderators
        if (userRole === 'MODERATOR') {
            await lockModeratorOffice(officeSelect, token);
        }
    } catch (err) {
        console.error('loadOffices failed:', err);
        officeSelect.innerHTML = '<option value="">Error loading offices. Refresh page.</option>';
    }
}

async function lockModeratorOffice(officeSelect, token) {
    const loggedInUsername = localStorage.getItem('loggedInUsername');
    if (!loggedInUsername) return;

    try {
        const response = await fetch(`/api/profile/?username=${loggedInUsername}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const profile = await response.json();
            if (profile.assigned_office) {
                officeSelect.value = profile.assigned_office;
                officeSelect.disabled = true;
                console.log('Locked to office:', profile.assigned_office);
            }
        }
    } catch (err) {
        console.error('lockModeratorOffice failed:', err);
    }
}

function setupStudentIdListener() {
    const studentIdInput = document.getElementById('student-id');
    const previewPane = document.getElementById('scholar-preview');
    if (!studentIdInput || !previewPane) {
        console.warn('Student ID input or Preview pane element missing from DOM');
        return;
    }

    let debounceTimer;
    
    const onInput = () => {
        const studentId = studentIdInput.value.trim();
        clearTimeout(debounceTimer);
        
        if (studentId.length === 6) {
            previewPane.classList.remove('hidden');
            // Show loading state in preview
            document.getElementById('preview-name').textContent = 'Searching...';
            document.getElementById('preview-program').textContent = 'Please wait...';
            
            debounceTimer = setTimeout(() => fetchScholarPreview(studentId), 300);
        } else {
            previewPane.classList.add('hidden');
        }
    };

    studentIdInput.addEventListener('input', onInput);
    if (studentIdInput.value.length === 6) onInput();
}

async function fetchScholarPreview(studentId) {
    const nameEl = document.getElementById('preview-name');
    const programEl = document.getElementById('preview-program');
    const renderedEl = document.getElementById('preview-rendered');
    const requiredEl = document.getElementById('preview-required');
    const initialsEl = document.getElementById('preview-initials');
    const token = localStorage.getItem('access');
    const submitBtn = document.getElementById('submit-btn');

    try {
        const response = await fetch(`/api/profile/?student_id=${studentId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Scholar not found');

        const data = await response.json();
        
        nameEl.textContent = data.name || 'Unknown Name';
        programEl.textContent = data.course_department || 'No Program Info';
        
        // Block encoding for Moderators
        if (data.role === 'MODERATOR') {
            nameEl.textContent += ' (MODERATOR)';
            nameEl.classList.add('text-red-600');
            programEl.textContent = 'User is currently a Moderator. Hours cannot be encoded.';
            programEl.classList.add('text-red-500', 'font-bold');
            if (submitBtn) submitBtn.disabled = true;
            renderedEl.textContent = 'N/A';
            requiredEl.textContent = 'N/A';
            showFieldError('student-id-error', 'Cannot encode hours for a Moderator.');
        } else {
            nameEl.classList.remove('text-red-600');
            programEl.classList.remove('text-red-500', 'font-bold');
            if (submitBtn) submitBtn.disabled = false;
            renderedEl.textContent = `${data.total_hours_rendered || 0} hrs`;
            requiredEl.textContent = `${data.required_hours || 0} hrs`;
            document.getElementById('student-id-error').classList.add('hidden');
        }
        
        // Robust initials extraction
        const nameParts = (data.name || 'S').trim().split(/\s+/);
        let initials = '?';
        if (nameParts.length >= 2) {
            initials = (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
        } else if (nameParts.length === 1 && nameParts[0].length > 0) {
            initials = nameParts[0][0].toUpperCase();
        }
        initialsEl.textContent = initials;
    } catch (err) {
        console.error('Scholar lookup failed:', err);
        nameEl.textContent = 'Scholar Not Found';
        programEl.textContent = 'Double check the Student ID';
        initialsEl.textContent = '??';
        renderedEl.textContent = '---';
        requiredEl.textContent = '---';
        if (submitBtn) submitBtn.disabled = false;
    }
}

async function submitLog() {
    clearErrors();
    hideMessages();

    const studentId = document.getElementById('student-id').value.trim();
    const dateRendered = document.getElementById('date-rendered').value;
    const hours = document.getElementById('hours').value;
    const officeSelect = document.getElementById('office');
    const office = officeSelect.value;
    const activity = document.getElementById('activity').value.trim();

    let valid = true;

    if (!studentId || studentId.length !== 6) {
        showFieldError('student-id-error', 'Valid 6-digit Student ID required.');
        valid = false;
    }
    if (!dateRendered) {
        showFieldError('date-error', 'Date is required.');
        valid = false;
    }
    if (!hours || parseFloat(hours) <= 0) {
        showFieldError('hours-error', 'Hours must be greater than 0.');
        valid = false;
    }
    if (!office) {
        showFieldError('office-error', 'Please select an office.');
        valid = false;
    }
    if (!activity) {
        showFieldError('activity-error', 'Description is required.');
        valid = false;
    }

    if (!valid) return;

    setLoading(true);

    try {
        const response = await fetch('/api/logs/create/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('access')}`,
                'X-CSRFToken': getCookie('csrftoken') || ''
            },
            body: JSON.stringify({
                student_id: studentId,
                date_rendered: dateRendered,
                hours: parseFloat(hours),
                office_name: office,
                activity_description: activity
            })
        });

        const result = await response.json();

        if (response.ok) {
            showMessage('Service log added successfully!', true);
            setTimeout(clearForm, 2000);
        } else {
            const msg = typeof result === 'object' ? Object.values(result).flat().join(' ') : 'Error adding log';
            showMessage(msg, false);
        }
    } catch (err) {
        console.error('Submission failed:', err);
        showMessage('Connection error. Please try again.', false);
    } finally {
        setLoading(false);
    }
}

function clearForm() {
    document.getElementById('student-id').value = '';
    document.getElementById('date-rendered').value = '';
    document.getElementById('hours').value = '';
    document.getElementById('office').value = '';
    document.getElementById('activity').value = '';
    
    const preview = document.getElementById('scholar-preview');
    if (preview) preview.classList.add('hidden');
    
    clearErrors();
    hideMessages();
}

// Helpers
function showFieldError(id, msg) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = msg;
        el.classList.remove('hidden');
    }
}

function clearErrors() {
    ['student-id-error', 'date-error', 'hours-error', 'office-error', 'activity-error'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
}

function showMessage(text, isSuccess) {
    const successBox = document.getElementById('success-message');
    const errorBox = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    
    if (isSuccess) {
        successBox.classList.remove('hidden');
        errorBox.classList.add('hidden');
    } else {
        errorBox.classList.remove('hidden');
        successBox.classList.add('hidden');
        if (errorText) errorText.textContent = text;
    }
}

function hideMessages() {
    document.getElementById('success-message').classList.add('hidden');
    document.getElementById('error-message').classList.add('hidden');
}

function setLoading(loading) {
    const btn = document.getElementById('submit-btn');
    if (!btn) return;
    btn.disabled = loading;
    btn.textContent = loading ? 'Processing...' : 'Add Service Log';
}

// Make globally available for onclick
window.submitLog = submitLog;
window.clearForm = clearForm;