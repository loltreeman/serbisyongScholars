let allAnnouncements = [];
let currentFilter = 'all';
let editingAnnouncementId = null;

// Load announcements on page load
document.addEventListener('DOMContentLoaded', function() {
    loadAnnouncements();
    checkUserRole();
});

/**
 * Check if user is admin to show create button
 */
function checkUserRole() {
    const userRole = localStorage.getItem('userRole');
    if (userRole === 'ADMIN') {
        document.getElementById('admin-controls').classList.remove('hidden');
    }
}

/**
 * Fetch all announcements from API
 */
async function loadAnnouncements() {
    try {
        const response = await fetch('/api/announcements/', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access')}`  
            }
        });
        
        if (!response.ok) throw new Error('Failed to load announcements');
        
        const data = await response.json();
        allAnnouncements = data;
        
        renderAnnouncements(allAnnouncements);
    } catch (error) {
        console.error('Error:', error);
        showError('Failed to load announcements');
    }
}

/**
 * Render announcements to the page
 */
function renderAnnouncements(announcements) {
    const container = document.getElementById('announcements-container');
    
    if (!announcements || announcements.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <p class="text-gray-500 text-lg">No announcements yet</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    announcements.forEach(announcement => {
        const card = createAnnouncementCard(announcement);
        container.appendChild(card);
    });
}

/**
 * Create announcement card HTML
 */
function createAnnouncementCard(announcement) {
    const div = document.createElement('div');
    div.className = 'bg-white rounded-lg shadow hover:shadow-lg transition p-6 cursor-pointer';
    div.onclick = () => window.location.href = `/api/announcements/${announcement.id}/`;  // ← Add this
    
    const categoryInfo = getCategoryInfo(announcement.category);
    const date = new Date(announcement.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    const userRole = localStorage.getItem('userRole');
    
    div.innerHTML = `
        <div class="flex items-start justify-between mb-3">
            <span class="px-3 py-1 rounded-full text-sm font-semibold ${categoryInfo.bgColor} ${categoryInfo.textColor}">
                ${categoryInfo.label}
            </span>
            <div class="flex items-center gap-2">
                <span class="text-sm text-gray-500">${date}</span>
                ${userRole === 'ADMIN' ? `
                    <button onclick="event.stopPropagation(); editAnnouncement(${announcement.id})" 
                            class="text-blue-600 hover:text-blue-800 text-sm font-medium ml-2">
                        Edit
                    </button>
                    <button onclick="event.stopPropagation(); deleteAnnouncement(${announcement.id})" 
                            class="text-red-600 hover:text-red-800 text-sm font-medium">
                        Delete
                    </button>
                ` : ''}
            </div>
        </div>
        
        <h3 class="text-xl font-bold text-gray-900 mb-2">
            ${announcement.title}
        </h3>
        
        <p class="text-gray-600 mb-4 line-clamp-3">
            ${announcement.content}
        </p>
        
        ${announcement.external_link ? `
            <a href="${announcement.external_link}" 
               target="_blank" 
               onclick="event.stopPropagation()"
               class="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium">
                Learn More →
            </a>
        ` : ''}
        
        <div class="mt-4 pt-4 border-t border-gray-200">
            <p class="text-sm text-gray-500">
                Posted by ${announcement.author_name || 'OAA'}
            </p>
        </div>
    `;
    
    return div;
}

/**
 * Get category styling info
 */
function getCategoryInfo(category) {
    const categories = {
        'URGENT': {
            label: 'Urgent',
            bgColor: 'bg-red-100',
            textColor: 'text-red-800'
        },
        'VOLUNTEER': {
            label: 'Volunteer Work',
            bgColor: 'bg-green-100',
            textColor: 'text-green-800'
        },
        'OPPORTUNITY': {
            label: 'Opportunity',
            bgColor: 'bg-yellow-100',
            textColor: 'text-yellow-800'
        },
        'FOOD STUBS': {
            label: 'Food Stubs',
            bgColor: 'bg-orange-100',
            textColor: 'text-orange-800'
        },
        'GENERAL': {
            label: 'General',
            bgColor: 'bg-blue-100',
            textColor: 'text-blue-800'
        }
    };
    
    return categories[category] || categories['GENERAL'];
}

/**
 * Filter announcements by category
 */
function filterByCategory(category) {
    currentFilter = category;
    
    // Update button styles
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('bg-gray-200');
    });
    event.target.classList.remove('bg-gray-200');
    event.target.classList.add('bg-blue-600', 'text-white');
    
    // Filter announcements
    let filtered = allAnnouncements;
    if (category !== 'all') {
        filtered = allAnnouncements.filter(a => a.category === category);
    }
    
    renderAnnouncements(filtered);
}

/**
 * Open create announcement modal
 */
function openCreateModal() {
    document.getElementById('announcement-modal').classList.remove('hidden');
    document.getElementById('announcement-form').reset();
}

/**
 * Close create announcement modal
 */
function closeCreateModal() {
    document.getElementById('announcement-modal').classList.add('hidden');
}

/**
 * Get CSRF token from cookie
 */
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

/**
 * Handle form submission (create or update)
 */
document.getElementById('announcement-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const data = {
        title: document.getElementById('announcement-title').value,
        category: document.getElementById('announcement-category').value,
        content: document.getElementById('announcement-content').value,
        external_link: document.getElementById('announcement-link').value || null
    };
    
    // If editing, add the ID
    if (editingAnnouncementId) {
        data.id = editingAnnouncementId;
    }
    
    try {
        const csrftoken = getCookie('csrftoken');
        const method = editingAnnouncementId ? 'PUT' : 'POST';
        
        const response = await fetch('/api/announcements/', {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('access')}`,
                'X-CSRFToken': csrftoken
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || errorData.detail || 'Failed to save announcement');
        }
        
        const successMessage = editingAnnouncementId ? 'updated' : 'posted';
        alert(`Announcement ${successMessage} successfully!`); 
        closeCreateModal();
        loadAnnouncements();
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to save announcement: ' + error.message);
    }
});


/**
 * Edit announcement
 */
function editAnnouncement(id) {
    const announcement = allAnnouncements.find(a => a.id === id);
    if (!announcement) return;
    
    editingAnnouncementId = id;
    
    document.getElementById('announcement-title').value = announcement.title;
    document.getElementById('announcement-category').value = announcement.category;
    document.getElementById('announcement-content').value = announcement.content;
    document.getElementById('announcement-link').value = announcement.external_link || '';
    document.getElementById('modal-title').textContent = 'Edit Announcement';
    document.getElementById('announcement-modal').classList.remove('hidden');
}

/**
 * Delete announcement
 */
async function deleteAnnouncement(id) {
    if (!confirm('Are you sure you want to delete this announcement?')) {
        return;
    }
    
    try {
        const csrftoken = getCookie('csrftoken');
        
        const response = await fetch('/api/announcements/', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('access')}`,
                'X-CSRFToken': csrftoken
            },
            body: JSON.stringify({ id })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete announcement');
        }
        
        alert('Announcement deleted successfully!');
        loadAnnouncements();
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to delete announcement: ' + error.message);
    }
}

/**
 * Open create announcement modal
 */
function openCreateModal() {
    editingAnnouncementId = null;  
    document.getElementById('announcement-modal').classList.remove('hidden');
    document.getElementById('announcement-form').reset();
    document.getElementById('modal-title').textContent = 'Create Announcement';  
}