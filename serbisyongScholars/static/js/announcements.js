let allAnnouncements = [];
let currentFilter = 'all';
let editingAnnouncementId = null;
const CATEGORY_INFO = {
    GENERAL: {
        label: 'General',
        bgColor: 'bg-blue-100',
        textColor: 'text-blue-800'
    },
    URGENT: {
        label: 'Urgent',
        bgColor: 'bg-red-100',
        textColor: 'text-red-800'
    },
    VOLUNTEER: {
        label: 'Volunteer Work',
        bgColor: 'bg-green-100',
        textColor: 'text-green-800'
    },
    OPPORTUNITY: {
        label: 'Scholarship Opportunity',
        bgColor: 'bg-yellow-100',
        textColor: 'text-yellow-800'
    },
    FOODSTUBS: {
        label: 'Food Stubs',
        bgColor: 'bg-orange-100',
        textColor: 'text-orange-800'
    }
};

// Load announcements on page load
document.addEventListener('DOMContentLoaded', async function() {
    bindCategoryFilters();
    bindSearchFilter();
    await syncCurrentUser();
    await loadAnnouncements();
});

function bindSearchFilter() {
    const searchInput = document.getElementById('search-announcements');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            applyCurrentFilter();
        });
    }
}

/**
 * Apply the trusted server role to the page state
 */
function applyUserRole(userRole) {
    const createBtn = document.getElementById('admin-controls');
    const buttonText = createBtn?.querySelector('button');

    if (!createBtn || !buttonText) {
        return;
    }

    if (userRole === 'ADMIN' || userRole === 'MODERATOR') {
        createBtn.classList.remove('hidden');

        if (userRole === 'MODERATOR') {
            buttonText.textContent = '➕ Submit Announcement for Approval';
            return;
        }

        buttonText.textContent = '➕ Create New Announcement';
        return;
    }

    createBtn.classList.add('hidden');
    buttonText.textContent = '➕ Create New Announcement';
}

async function syncCurrentUser() {
    const accessToken = localStorage.getItem('access');
    if (!accessToken) {
        applyUserRole(null);
        return;
    }

    try {
        const response = await fetch('/api/auth/me/', {
            credentials: 'same-origin'
        });

        if (!response.ok) {
            throw new Error('Failed to fetch current user');
        }

        const user = await response.json();
        localStorage.setItem('userRole', user.role || '');
        localStorage.setItem('loggedInUsername', user.username || '');
        localStorage.setItem('officeName', user.office_name || '');
        localStorage.setItem('isOaaMod', user.is_oaa_mod ? 'true' : 'false');
        applyUserRole(user.role);
    } catch (error) {
        console.error('Error syncing current user:', error);
        localStorage.removeItem('userRole');
        localStorage.removeItem('loggedInUsername');
        localStorage.removeItem('officeName');
        localStorage.removeItem('isOaaMod');
        applyUserRole(null);
    }
}

/**
 * Fetch all announcements from API
 */
async function loadAnnouncements() {
    try {
        const response = await fetch('/api/announcements/', {
            credentials: 'same-origin'
        });
        
        if (!response.ok) throw new Error('Failed to load announcements');
        
        const data = await response.json();
        allAnnouncements = data;
        
        applyCurrentFilter();
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('announcements-container').innerHTML = `
            <div class="text-center py-12">
                <p class="text-red-500 text-lg">Failed to load announcements. Please try again.</p>
            </div>
        `;
    }
}

/**
 * Render announcements to the page
 */
function renderAnnouncements(announcements) {
    const container = document.getElementById('announcements-container');
    const requestsSection = document.getElementById('requests-section');
    
    if (!container) return;
    
    container.innerHTML = '';
    
    const liveAnnouncements = announcements.filter(a => a.status === 'APPROVED');
    const requestAnnouncements = announcements.filter(a => a.status === 'PENDING' || a.status === 'REJECTED');
    
    const userRole = localStorage.getItem('userRole');
    
    if (requestsSection) {
        // Show section if there are pending/rejected items and user is ADMIN or MODERATOR
        if (requestAnnouncements.length > 0 && (userRole === 'ADMIN' || userRole === 'MODERATOR')) {
            requestsSection.classList.remove('hidden');
            
            const titleEl = document.getElementById('requests-section-title');
            const descEl = document.getElementById('requests-section-desc');
            
            if (titleEl && descEl) {
                if (userRole === 'MODERATOR') {
                    titleEl.textContent = 'My Announcements';
                    descEl.textContent = 'Manage your office announcements and check their approval status.';
                } else {
                    titleEl.textContent = 'Announcement Requests';
                    descEl.textContent = 'Review, approve, or reject announcements submitted by office moderators.';
                }
            }
        } else {
            requestsSection.classList.add('hidden');
        }
    }
    
    // Handle Live Section
    if (liveAnnouncements.length === 0) {
        const categoryLabel = currentFilter === 'all'
            ? 'announcements'
            : `${getCategoryInfo(currentFilter).label.toLowerCase()} announcements`;
        container.innerHTML = `
            <div class="text-center py-12 bg-white rounded-lg border-2 border-dashed border-slate-200">
                <p class="text-slate-500">No approved ${categoryLabel} found.</p>
            </div>
        `;
        return;
    }
    
    liveAnnouncements.forEach(announcement => {
        const card = createAnnouncementCard(announcement);
        container.appendChild(card);
    });
}

/**
 * Create announcement card HTML
 */
function createAnnouncementCard(announcement) {
    const div = document.createElement('div');
    div.className = 'announcement-card';
    
    const categoryInfo = getCategoryInfo(
        announcement.category,
        announcement.category_label
    );
    const date = new Date(announcement.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    const userRole = localStorage.getItem('userRole');
    const currentUser = localStorage.getItem('loggedInUsername') || '';
    
    // Determine if we should show status badge
    let showStatusBadge = false;
    if (userRole === 'ADMIN') {
        showStatusBadge = true;
    } else if (userRole === 'MODERATOR') {
        const isAuthor = announcement.author_username && announcement.author_username.toLowerCase() === currentUser.toLowerCase();
        if (isAuthor) showStatusBadge = true;
    }
    
    // Actions (icons in top right)
    let showActions = false;
    if (userRole === 'ADMIN') {
        showActions = true;
    } else if (userRole === 'MODERATOR' && announcement.author_username && announcement.author_username.toLowerCase() === currentUser.toLowerCase()) {
        showActions = true;
    }
    
    div.innerHTML = `
        <div class="flex items-start justify-between mb-3">
            <div class="flex items-center gap-2 flex-wrap">
                <span class="announcement-category">
                    ${categoryInfo.label}
                </span>
                ${showStatusBadge ? `
                    <span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider
                        ${announcement.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 
                          announcement.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-red-100 text-red-800'}">
                        ${announcement.status}
                    </span>
                ` : ''}
            </div>
            <div class="flex items-center gap-4 flex-shrink-0">
                <span class="announcement-date">${date}</span>
                ${showActions ? `
                    <div class="flex items-center gap-2">
                        <button onclick="event.stopPropagation(); editAnnouncement(${announcement.id})" 
                                class="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                        </button>
                        <button onclick="event.stopPropagation(); deleteAnnouncement(${announcement.id})" 
                                class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                ` : ''}
            </div>
        </div>
        
        <div class="cursor-pointer" onclick="window.location.href = '/announcements/${announcement.id}/'">
            <h3 class="announcement-title">
                ${announcement.title}
            </h3>
            
            <p class="announcement-content">
                ${announcement.content}
            </p>
            
            <div class="flex items-center justify-between mt-4">
                <p class="text-xs text-slate-500">
                    Posted by <span class="font-semibold">${announcement.author_name || 'OAA Administrator'}</span>
                </p>
                ${announcement.external_link ? `
                    <a href="${announcement.external_link}" target="_blank" onclick="event.stopPropagation()" class="text-xs font-bold text-blue-600 hover:underline">Link →</a>
                ` : ''}
            </div>
        </div>
        
        ${announcement.rejection_reason && announcement.status === 'REJECTED' ? `
            <div class="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg">
                <p class="text-xs text-red-800"><strong>Note:</strong> ${announcement.rejection_reason}</p>
            </div>
        ` : ''}
    `;
    
    return div;
}
/**
 * Get category styling info
 */
function getCategoryInfo(category, fallbackLabel = null) {
    const categoryInfo = CATEGORY_INFO[category] || CATEGORY_INFO.GENERAL;

    if (!fallbackLabel) {
        return categoryInfo;
    }

    return {
        ...categoryInfo,
        label: fallbackLabel
    };
}

function bindCategoryFilters() {
    document.querySelectorAll('.category-btn').forEach((button) => {
        button.addEventListener('click', () => {
            filterByCategory(button.dataset.category);
        });
    });
}

function setActiveCategoryButton(category) {
    document.querySelectorAll('.category-btn').forEach((button) => {
        const isActive = button.dataset.category === category;
        button.classList.toggle('bg-blue-600', isActive);
        button.classList.toggle('text-white', isActive);
        button.classList.toggle('bg-gray-200', !isActive);
    });
}

function applyCurrentFilter() {
    let filteredAnnouncements = allAnnouncements;

    // Filter by category
    if (currentFilter !== 'all') {
        filteredAnnouncements = allAnnouncements.filter(
            (announcement) => announcement.category === currentFilter
        );
    }

    // Filter by search term
    const searchTerm = document.getElementById('search-announcements')?.value.toLowerCase().trim();
    if (searchTerm) {
        filteredAnnouncements = filteredAnnouncements.filter(a => 
            a.title.toLowerCase().includes(searchTerm) || 
            a.content.toLowerCase().includes(searchTerm)
        );
    }

    setActiveCategoryButton(currentFilter);
    renderAnnouncements(filteredAnnouncements);
}

/**
 * Filter announcements by category
 */
function filterByCategory(category) {
    currentFilter = category;
    applyCurrentFilter();
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
                'X-CSRFToken': csrftoken
            },
            credentials: 'same-origin',
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
    const announcement = allAnnouncements.find(a => a.id === parseInt(id));
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
                'X-CSRFToken': csrftoken
            },
            credentials: 'same-origin',
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

/**
 * Approve announcement (ADMIN only)
 */
async function approveAnnouncement(id) {
    if (!confirm('Approve this announcement and make it visible to all scholars?')) {
        return;
    }
    
    try {
        const csrftoken = getCookie('csrftoken');
        
        const response = await fetch(`/api/announcements/${id}/approve/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken
            },
            credentials: 'same-origin',
            body: JSON.stringify({ action: 'approve' })
        });
        
        if (response.ok) {
            showSuccessToast('Announcement approved!');
            loadAnnouncements(); 
        } else {
            const errorData = await response.json();
            alert('Failed to approve: ' + (errorData.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error approving announcement');
    }
}

/**
 * Reject announcement with reason (ADMIN only)
 */
async function rejectAnnouncementWithReason(id) {
    const reason = prompt('Please provide a rejection reason (optional):');
    
    // User clicked cancel
    if (reason === null) {
        return;
    }
    
    try {
        const csrftoken = getCookie('csrftoken');
        
        const response = await fetch(`/api/announcements/${id}/approve/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken
            },
            credentials: 'same-origin',
            body: JSON.stringify({ 
                action: 'reject',
                rejection_reason: reason || 'No reason provided'
            })
        });
        
        if (response.ok) {
            showSuccessToast('Announcement rejected');
            loadAnnouncements(); 
        } else {
            const errorData = await response.json();
            alert('Failed to reject: ' + (errorData.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error rejecting announcement');
    }
}

/**
 * Show success toast notification
 */
function showSuccessToast(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg z-50 flex items-center gap-3';
    toast.innerHTML = `
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span class="font-semibold">${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Update DOMContentLoaded to include approve/reject buttons
document.addEventListener('DOMContentLoaded', () => {
    const editBtn = document.getElementById('editBtn');
    const deleteBtn = document.getElementById('deleteBtn');
    const approveBtn = document.getElementById('approveBtn');
    const rejectBtn = document.getElementById('rejectBtn');
    const editForm = document.getElementById('edit-form');

    if (editBtn) {
        editBtn.addEventListener('click', () => {
            const id = editBtn.getAttribute('data-id');
            editAnnouncement(id);
        });
    }
    
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            const id = deleteBtn.getAttribute('data-id');
            deleteAnnouncement(id);
        });
    }
    
    if (approveBtn) {
        approveBtn.addEventListener('click', () => {
            const id = approveBtn.getAttribute('data-id');
            approveAnnouncement(id);
        });
    }
    
    if (rejectBtn) {
        rejectBtn.addEventListener('click', () => {
            const id = rejectBtn.getAttribute('data-id');
            rejectAnnouncementWithReason(id);
        });
    }
    
    if (editForm) {
        editForm.addEventListener('submit', handleEditSubmit);
    }
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeEditModal();
        }
    });
});
