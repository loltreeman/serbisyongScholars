let allAnnouncements = [];
let currentStatus = 'PENDING';

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

async function parseActionResponse(response) {
    try {
        return await response.json();
    } catch (_error) {
        return {};
    }
}

async function loadAnnouncements() {
    try {
        const response = await fetch('/api/announcements/', {
            credentials: 'same-origin'
        });
        
        allAnnouncements = await response.json();
        filterByStatus(currentStatus);
    } catch (error) {
        console.error('Error loading announcements:', error);
    }
}

function filterByStatus(status) {
    currentStatus = status;
    
    document.querySelectorAll('.status-tab').forEach(tab => {
        tab.classList.remove('border-blue-600', 'text-blue-600');
        tab.classList.add('text-gray-500');
        if(tab.textContent.trim().toUpperCase() === status.toUpperCase()) {
            tab.classList.add('border-blue-600', 'text-blue-600');
            tab.classList.remove('text-gray-500');
        }
    });
    
    let filtered = allAnnouncements.filter(a => a.status === status);

    // If moderator, only show their own announcements
    const userRole = localStorage.getItem('userRole');
    const currentUser = localStorage.getItem('loggedInUsername') || '';
    if (userRole === 'MODERATOR') {
        filtered = filtered.filter(a => a.author_username && a.author_username.toLowerCase() === currentUser.toLowerCase());
    }

    // Apply search filter
    const searchTerm = document.getElementById('search-manage-announcements')?.value.toLowerCase().trim();
    if (searchTerm) {
        filtered = filtered.filter(a => 
            a.title.toLowerCase().includes(searchTerm) || 
            a.content.toLowerCase().includes(searchTerm)
        );
    }

    renderAnnouncements(filtered);
}

function renderAnnouncements(announcements) {
    const container = document.getElementById('announcements-container');
    // Get role from localStorage (ensure you saved it during login!)
    const userRole = localStorage.getItem('userRole');

    if (announcements.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-500 py-8">No ${currentStatus.toLowerCase()} announcements</p>`;
        return;
    }
    
    container.innerHTML = announcements.map(a => {
        let tagColor = 'yellow';
        if (a.status === 'APPROVED') tagColor = 'green';
        if (a.status === 'REJECTED') tagColor = 'red';

        return `
        <div class="bg-white rounded-lg shadow p-6">
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h3 class="text-xl font-bold">${a.title}</h3>
                    <p class="text-sm text-gray-500">By ${a.author_name} • ${new Date(a.created_at).toLocaleDateString()}</p>
                </div>
                <span class="px-3 py-1 rounded-full text-xs font-bold bg-${tagColor}-100 text-${tagColor}-800">
                    ${a.status_display}
                </span>
            </div>
            <p class="text-gray-700 mb-4">${a.content}</p>
            
            ${(userRole === 'ADMIN' && a.status === 'PENDING') ? `
                <div class="flex gap-2">
                    <button onclick="approveAnnouncement(${a.id})" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Approve</button>
                    <button onclick="rejectAnnouncement(${a.id})" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Reject</button>
                </div>
            ` : ''}

            ${(userRole === 'MODERATOR' && a.status === 'PENDING') ? `
                <p class="text-sm italic text-amber-600 font-medium">Under review by OAA Admins</p>
            ` : ''}
        </div>
    `}).join('');
}

async function approveAnnouncement(id) {
    if (!confirm('Approve this announcement?')) return;
    
    try {
        const csrfToken = getCookie('csrftoken');
        const response = await fetch(`/api/announcements/${id}/approve/`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('access')}`,
                'X-CSRFToken': csrfToken || ''
            },
            body: JSON.stringify({ action: 'approve' })
        });

        const data = await parseActionResponse(response);

        if (!response.ok) {
            throw new Error(data.error || data.message || 'Failed to approve announcement');
        }

        alert(data.message || 'Announcement approved!');
        loadAnnouncements();
    } catch (error) {
        console.error('Error:', error);
        alert(error.message || 'Failed to approve announcement');
    }
}

async function rejectAnnouncement(id) {
    const reason = prompt('Rejection reason (optional):');
    if (reason === null) return;
    
    try {
        const csrfToken = getCookie('csrftoken');
        const response = await fetch(`/api/announcements/${id}/approve/`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('access')}`,
                'X-CSRFToken': csrfToken || ''
            },
            body: JSON.stringify({
                action: 'reject',
                rejection_reason: reason || ''
            })
        });

        const data = await parseActionResponse(response);

        if (!response.ok) {
            throw new Error(data.error || data.message || 'Failed to reject announcement');
        }

        alert(data.message || 'Announcement rejected');
        loadAnnouncements();
    } catch (error) {
        console.error('Error:', error);
        alert(error.message || 'Failed to reject announcement');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadAnnouncements();
    
    const userRole = localStorage.getItem('userRole');
    if (userRole === 'MODERATOR') {
        const titleEl = document.getElementById('page-title');
        if (titleEl) titleEl.textContent = 'My Announcements';
    }
    
    const searchInput = document.getElementById('search-manage-announcements');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            filterByStatus(currentStatus);
        });
    }
});
