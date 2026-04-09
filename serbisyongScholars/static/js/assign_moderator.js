document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('assign-form');
    const messageBox = document.getElementById('assign-message');
    const submitButton = document.getElementById('assign-button');
    const userSearch = document.getElementById('user-search');
    const userDropdown = document.getElementById('user-dropdown');
    const hiddenUsername = document.getElementById('moderator-username');
    const selectedCard = document.getElementById('selected-user-card');
    const selectedName = document.getElementById('selected-name');
    const selectedUsername = document.getElementById('selected-username');
    const selectedEmail = document.getElementById('selected-email');
    const selectedRole = document.getElementById('selected-role');
    const clearUser = document.getElementById('clear-user');
    const demoteButton = document.getElementById('demote-button');

    // Office Management Elements
    const officeSelect = document.getElementById('office-name');
    const officeModal = document.getElementById('office-modal');
    const openOfficeMgmt = document.getElementById('open-office-mgmt');
    const closeOfficeModal = document.getElementById('close-office-modal');
    const officeListContainer = document.getElementById('office-list-container');
    const newOfficeInput = document.getElementById('new-office-name');
    const addOfficeBtn = document.getElementById('add-office-btn');

    let debounceTimer = null;

    // Initial load
    loadOffices();

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
        
        if (isSuccess) {
            setTimeout(() => {
                messageBox.classList.add('hidden');
            }, 5000);
        }
    }

    // --- Office Management Logic ---
    async function loadOffices() {
        const token = localStorage.getItem('access');
        try {
            const resp = await fetch('/api/offices/', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const offices = await resp.json();
            
            // Populate select dropdown
            const currentVal = officeSelect.value;
            officeSelect.innerHTML = '<option value="">Select an office</option>';
            offices.forEach(office => {
                const opt = document.createElement('option');
                opt.value = office.name;
                opt.textContent = office.name;
                officeSelect.appendChild(opt);
            });
            if (currentVal) officeSelect.value = currentVal;

            // Update management list
            renderOfficeList(offices);
        } catch (err) {
            console.error('Error loading offices:', err);
        }
    }

    function renderOfficeList(offices) {
        if (!offices.length) {
            officeListContainer.innerHTML = '<p class="text-xs text-gray-500 text-center py-4">No offices defined yet.</p>';
            return;
        }

        officeListContainer.innerHTML = '';
        offices.forEach(office => {
            const div = document.createElement('div');
            div.className = 'flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-100 group';
            div.innerHTML = `
                <span class="text-sm font-medium text-gray-700 office-name-text">${office.name}</span>
                <div class="flex gap-2">
                    <button type="button" class="edit-office text-blue-600 hover:text-blue-800 p-1" data-id="${office.id}" data-name="${office.name}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    <button type="button" class="delete-office text-red-600 hover:text-red-800 p-1" data-id="${office.id}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                </div>
            `;
            officeListContainer.appendChild(div);
        });

        // Add event listeners to buttons
        officeListContainer.querySelectorAll('.edit-office').forEach(btn => {
            btn.onclick = () => editOffice(btn.dataset.id, btn.dataset.name);
        });
        officeListContainer.querySelectorAll('.delete-office').forEach(btn => {
            btn.onclick = () => deleteOffice(btn.dataset.id);
        });
    }

    openOfficeMgmt.onclick = () => officeModal.classList.remove('hidden');
    closeOfficeModal.onclick = () => officeModal.classList.add('hidden');

    addOfficeBtn.onclick = async () => {
        const name = newOfficeInput.value.trim();
        if (!name) return;
        
        const token = localStorage.getItem('access');
        const csrf = getCookie('csrftoken');
        
        try {
            const resp = await fetch('/api/offices/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'X-CSRFToken': csrf || ''
                },
                body: JSON.stringify({ name })
            });

            if (resp.ok) {
                newOfficeInput.value = '';
                loadOffices();
            } else {
                const data = await resp.json();
                alert(data.error || 'Failed to add office');
            }
        } catch (err) {
            console.error('Error adding office:', err);
        }
    };

    async function editOffice(id, currentName) {
        const newName = prompt('Enter new name for "' + currentName + '":', currentName);
        if (!newName || newName === currentName) return;

        const token = localStorage.getItem('access');
        const csrf = getCookie('csrftoken');
        
        try {
            const resp = await fetch(`/api/offices/${id}/`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'X-CSRFToken': csrf || ''
                },
                body: JSON.stringify({ name: newName })
            });

            if (resp.ok) {
                loadOffices();
            } else {
                const data = await resp.json();
                alert(data.error || 'Failed to update office');
            }
        } catch (err) {
            console.error('Error updating office:', err);
        }
    }

    async function deleteOffice(id) {
        if (!confirm('Are you sure you want to delete this office? History logs will remain unchanged.')) return;

        const token = localStorage.getItem('access');
        const csrf = getCookie('csrftoken');
        
        try {
            const resp = await fetch(`/api/offices/${id}/`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-CSRFToken': csrf || ''
                }
            });

            if (resp.ok) {
                loadOffices();
            } else {
                const data = await resp.json();
                alert(data.error || 'Failed to delete office');
            }
        } catch (err) {
            console.error('Error deleting office:', err);
        }
    }

    // --- Demotion Logic ---
    demoteButton.addEventListener('click', async function() {
        const username = hiddenUsername.value;
        if (!username) return;

        if (!confirm(`Are you sure you want to demote @${username} back to Scholar?`)) return;

        const token = localStorage.getItem('access');
        const csrf = getCookie('csrftoken');
        
        try {
            const resp = await fetch('/api/admin/remove-moderator/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'X-CSRFToken': csrf || ''
                },
                body: JSON.stringify({ username })
            });

            const data = await resp.json();
            if (resp.ok) {
                showMessage(data.message, true);
                clearSelection();
            } else {
                showMessage(data.error || 'Failed to demote user', false);
            }
        } catch (err) {
            console.error('Demote error:', err);
            showMessage('Connection error', false);
        }
    });

    // --- Search & Assign Logic ---
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

        // Show demote button only if user is a moderator
        if (user.role === 'MODERATOR') {
            demoteButton.classList.remove('hidden');
            submitButton.textContent = 'Update Office Only';
        } else {
            demoteButton.classList.add('hidden');
            submitButton.textContent = 'Assign Moderator';
        }
    }

    function clearSelection() {
        hiddenUsername.value = '';
        selectedCard.classList.add('hidden');
        userSearch.classList.remove('hidden');
        userSearch.value = '';
        userSearch.focus();
        submitButton.textContent = 'Assign Moderator';
    }

    clearUser.addEventListener('click', clearSelection);

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
        const officeName = officeSelect.value;
        const token = localStorage.getItem('access');
        const csrfToken = getCookie('csrftoken');

        if (!moderatorUsername) {
            showMessage('Please select a user from the dropdown.', false);
            return;
        }

        if (!officeName) {
            showMessage('Please select an office.', false);
            return;
        }

        submitButton.disabled = true;
        const originalText = submitButton.textContent;
        submitButton.textContent = 'Processing...';

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
                throw new Error(data.error || 'Failed to process request.');
            }

            showMessage(data.message || 'Action completed successfully.', true);
            clearSelection();
        } catch (error) {
            showMessage(error.message, false);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = originalText;
        }
    });
});

