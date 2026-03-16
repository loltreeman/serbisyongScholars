let allAnnouncements = [];
let currentFilter = 'all';

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
    div.className = 'bg-white rounded-lg shadow hover:shadow-lg transition p-6';
    
    const categoryInfo = getCategoryInfo(announcement.category);
    const date = new Date(announcement.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    div.innerHTML = `
        <div class="flex items-start justify-between mb-3">
            <span class="px-3 py-1 rounded-full text-sm font-semibold ${categoryInfo.bgColor} ${categoryInfo.textColor}">
                ${categoryInfo.emoji} ${categoryInfo.label}
            </span>
            <span class="text-sm text-gray-500">${date}</span>
        </div>
        
        <h3 class="text-xl font-bold text-gray-900 mb-2">
            ${announcement.title}
        </h3>
        
        <p class="text-gray-600 mb-4 whitespace-pre-line">
            ${announcement.content}
        </p>
        
        ${announcement.external_link ? `
            <a href="${announcement.external_link}" target="_blank" 
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
 * Handle form submission
 */
document.getElementById('announcement-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const data = {
        title: document.getElementById('announcement-title').value,
        category: document.getElementById('announcement-category').value,
        content: document.getElementById('announcement-content').value,
        external_link: document.getElementById('announcement-link').value || null
    };
    
    try {
        const response = await fetch('/api/announcements/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('access')}`  
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Error creating announcement:', errorData);
            throw new Error(errorData.error || 'Failed to create announcement');
        }
        
        alert('Announcement posted successfully!');
        closeCreateModal();
        loadAnnouncements(); 
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to post announcement: ' + error.message);
    }
});
