document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('assign-form');
    const messageBox = document.getElementById('assign-message');
    const submitButton = document.getElementById('assign-button');

    // Search / dropdown elements
    const userSearch = document.getElementById('user-search');
    const userDropdown = document.getElementById('user-dropdown');
    const hiddenUsername = document.getElementById('moderator-username');
    const selectedCard = document.getElementById('selected-user-card');
    const selectedName = document.getElementById('selected-name');
    const selectedUsername = document.getElementById('selected-username');
    const selectedEmail = document.getElementById('selected-email');
    const selectedRole = document.getElementById('selected-role');
    const clearUser = document.getElementById('clear-user');

    let debounceTimer = null;

    function getCookie(name) {
        const cookieValue = `; ${document.cookie}`;
        const parts = cookieValue.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    function showMessage(text, isSuccess) {
        messageBox.textContent = text;
        messageBox.classList.remove('hidden', 'bg-green-100', 'text-green-800', 'bg-red-100', 'text-red-800');
        messageBox.classList.add(isSuccess ? 'bg-green-100' : 'bg-red-100', isSuccess ? 'text-green-800' : 'text-red-800');
    }

    function closeDropdown() {
        userDropdown.innerHTML = '';
        userDropdown.classList.add('hidden');
    }

    function selectUser(user) {
        hiddenUsername.value = user.username;
        userSearch.value = '';
        closeDropdown();

        selectedName.textContent = `${user.first_name} ${user.last_name}`.trim() || user.username;
        selectedUsername.textContent = `@${user.username}`;
        selectedEmail.textContent = user.email;
        selectedRole.textContent = user.role;
        selectedCard.classList.remove('hidden');
        userSearch.classList.add('hidden');
    }

    clearUser.addEventListener('click', function () {
        hiddenUsername.value = '';
        selectedCard.classList.add('hidden');
        userSearch.classList.remove('hidden');
        userSearch.value = '';
        userSearch.focus();
    });

    userSearch.addEventListener('input', function () {
        const query = userSearch.value.trim();
        clearTimeout(debounceTimer);

        if (query.length < 2) {
            closeDropdown();
            return;
        }

        debounceTimer = setTimeout(async () => {
            const token = localStorage.getItem('access');
            if (!token) return;

            try {
                const resp = await fetch(`/api/admin/search-users/?q=${encodeURIComponent(query)}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const users = await resp.json();

                if (!Array.isArray(users) || !users.length) {
                    userDropdown.innerHTML = '<li class="px-4 py-2 text-sm text-gray-500">No users found.</li>';
                    userDropdown.classList.remove('hidden');
                    return;
                }

                userDropdown.innerHTML = '';
                users.forEach(user => {
                    const li = document.createElement('li');
                    li.className = 'px-4 py-2.5 cursor-pointer hover:bg-blue-50 flex flex-col gap-0.5';
                    li.innerHTML = `
                        <span class="font-medium text-gray-800">${user.first_name} ${user.last_name}</span>
                        <span class="text-xs text-gray-500">@${user.username} &bull; ${user.email} &bull; <span class="font-semibold text-blue-600">${user.role}</span></span>
                    `;
                    li.addEventListener('mousedown', function (e) {
                        e.preventDefault();
                        selectUser(user);
                    });
                    userDropdown.appendChild(li);
                });
                userDropdown.classList.remove('hidden');
            } catch (err) {
                closeDropdown();
            }
        }, 250);
    });

    userSearch.addEventListener('blur', function () {
        setTimeout(closeDropdown, 150);
    });

    form.addEventListener('submit', async function (event) {
        event.preventDefault();

        const moderatorUsername = hiddenUsername.value.trim();
        const officeName = document.getElementById('office-name').value.trim();
        const token = localStorage.getItem('access');
        const csrfToken = getCookie('csrftoken');

        if (!moderatorUsername) {
            showMessage('Please select a user from the dropdown.', false);
            return;
        }

        if (!officeName) {
            showMessage('Please enter an office name.', false);
            return;
        }

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
            hiddenUsername.value = '';
            selectedCard.classList.add('hidden');
            userSearch.classList.remove('hidden');
        } catch (error) {
            showMessage(error.message, false);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Assign Moderator';
        }
    });
});
