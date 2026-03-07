document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('assign-form');
    const messageBox = document.getElementById('assign-message');
    const submitButton = document.getElementById('assign-button');

    function getCookie(name) {
        const cookieValue = `; ${document.cookie}`;
        const parts = cookieValue.split(`; ${name}=`);

        if (parts.length === 2) {
            return parts.pop().split(';').shift();
        }

        return null;
    }

    function showMessage(text, isSuccess) {
        messageBox.textContent = text;
        messageBox.classList.remove('hidden', 'bg-green-100', 'text-green-800', 'bg-red-100', 'text-red-800');

        if (isSuccess) {
            messageBox.classList.add('bg-green-100', 'text-green-800');
        } else {
            messageBox.classList.add('bg-red-100', 'text-red-800');
        }
    }

    form.addEventListener('submit', async function (event) {
        event.preventDefault();

        const moderatorUsername = document.getElementById('moderator-username').value.trim();
        const officeName = document.getElementById('office-name').value.trim();
        const token = localStorage.getItem('access');
        const csrfToken = getCookie('csrftoken');

        if (!token) {
            showMessage('You are not logged in. Please log in again.', false);
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = 'Assigning...';

        try {
            const response = await fetch('/api/admin/assign-moderator/', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'X-CSRFToken': csrfToken || ''
                },
                body: JSON.stringify({
                    moderator_username: moderatorUsername,
                    office_name: officeName
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to assign moderator.');
            }

            showMessage(data.message || 'Moderator assigned successfully.', true);
            form.reset();
        } catch (error) {
            showMessage(error.message, false);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Assign Moderator';
        }
    });
});
