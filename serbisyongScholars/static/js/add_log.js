function getCookie(name) {
    const cookieValue = `; ${document.cookie}`;
    const parts = cookieValue.split(`; ${name}=`);
    if (parts.length === 2) {
        return parts.pop().split(';').shift();
    }
    return null;
}

async function submitLog() {
    clearErrors();
    hideMessages();

    const studentId = document.getElementById('student-id').value.trim();
    const dateRendered = document.getElementById('date-rendered').value;
    const hours = document.getElementById('hours').value;
    const office = document.getElementById('office').value.trim();
    const activity = document.getElementById('activity').value.trim();

    let hasErrors = false;

    // check for input errors
    if (!studentId) {
        showFieldError('student-id-error', 'Student ID is required.');
        hasErrors = true;
    } else if (studentId.length !== 6) {
        showFieldError('student-id-error', 'Student ID must be exactly 6 characters.');
        hasErrors = true;
    }

    if (!dateRendered) {
        showFieldError('date-error', 'Date is required.');
        hasErrors = true;
    }

    if (!hours) {
        showFieldError('hours-error', 'Number of hours is required.');
        hasErrors = true;
    } else if (parseFloat(hours) < 0.5) {
        showFieldError('hours-error', 'Minimum is 0.5 hours.');
        hasErrors = true;
    } else if (parseFloat(hours) > 24) {
        showFieldError('hours-error', 'A single log cannot exceed 24 hours.');
        hasErrors = true;
    }

    if (!office) {
        showFieldError('office-error', 'Office is required.');
        hasErrors = true;
    }

    if (!activity) {
        showFieldError('activity-error', 'Activity description is required.');
        hasErrors = true;
    }

    if (hasErrors) return;

    // Disable button while submitting
    setLoading(true);

    try {
        const response = await fetch('/api/logs/create/', {
        method: 'POST',
        credentials: 'same-origin',
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

        const data = await response.json();

        if (response.ok) {
            showMessage('Service log added successfully!', true);
            setTimeout(() => {
                resetForm();
            }, 2000);
        } else {
            const errorMessages = Object.values(data).flat().join(' ');
            showMessage(errorMessages || 'Failed to add service log.', false);
        }
    } catch (err) {
        console.error('Submit error:', err);
        showError('Connection error. Please try again.');
    } finally {
        setLoading(false);
    }
}

// reset entry form
function resetForm() {
    document.getElementById('student-id').value = '';
    document.getElementById('date-rendered').value = '';
    document.getElementById('hours').value = '';
    document.getElementById('office').value = '';
    document.getElementById('activity').value = '';
    clearErrors();
    hideMessages();
}

function showFieldError(elementId, message) {
    const el = document.getElementById(elementId);
    el.textContent = message;
    el.classList.remove('hidden');
}

function clearErrors() {
    ['student-id-error', 'date-error', 'hours-error', 'office-error', 'activity-error'].forEach(id => {
        const el = document.getElementById(id);
        el.textContent = '';
        el.classList.add('hidden');
    });
}

// show successful log or error in inputs
function showMessage(text, isSuccess) {
    const messageBox = document.getElementById('success-message');
    const errorBox = document.getElementById('error-message');
    
    if (isSuccess) {
        messageBox.classList.remove('hidden');
        errorBox.classList.add('hidden');
    } else {
        errorBox.classList.remove('hidden');
        messageBox.classList.add('hidden');
        document.getElementById('error-text').textContent = text;
    }
}

function hideMessages() {
    document.getElementById('success-message').classList.add('hidden');
    document.getElementById('error-message').classList.add('hidden');
}

function setLoading(isLoading) {
    const btn = document.getElementById('submit-btn');
    btn.disabled = isLoading;
    btn.textContent = isLoading ? 'Submitting...' : 'Add Service Log';
    btn.classList.toggle('opacity-60', isLoading);
}