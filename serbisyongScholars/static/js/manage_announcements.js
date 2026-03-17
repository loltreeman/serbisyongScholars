let allAnnouncements = [];
let currentStatus = 'PENDING';

async function loadAnnouncements() {
    try {
        const response = await fetch('/api/announcements/', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access')}`
            }
        });
        
        allAnnouncements = await response.json();
        filterByStatus(currentStatus);
    } catch (error) {
        console.error('Error loading announcements:', error);
    }
}

function filterByStatus(status) {
    currentStatus = status;
    
    // Update UI Tabs
    document.querySelectorAll('.status-tab').forEach(tab => {
        tab.classList.remove('border-blue-600', 'text-blue-600');
        tab.classList.add('text-gray-500');
        // Find the tab that matches the text and highlight it
        if(tab.textContent.trim().toUpperCase() === status.toUpperCase()) {
            tab.classList.add('border-blue-600', 'text-blue-600');
            tab.classList.remove('text-gray-500');
        }
    });
    
    const filtered = allAnnouncements.filter(a => a.status === status);
    renderAnnouncements(filtered);
}

function renderAnnouncements(announcements) {
    const container = document.getElementById('announcements-container');
    
    if (announcements.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-500 py-8">No ${currentStatus.toLowerCase()} announcements</p>`;
        return;
    }
    
    container.innerHTML = announcements.map(a => `
        <div class="bg-white rounded-lg shadow p-6">
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h3 class="text-xl font-bold">${a.title}</h3>
                    <p class="text-sm text-gray-500">By ${a.author_name} • ${new Date(a.created_at).toLocaleDateString()}</p>
                </div>
                <span class="px-3 py-1 rounded-full text-xs font-bold bg-${a.status === 'APPROVED' ? 'green' : a.status === 'REJECTED' ? 'red' : 'yellow'}-100 text-${a.status === 'APPROVED' ? 'green' : a.status === 'REJECTED' ? 'red' : 'yellow'}-800">
                    ${a.status_display}
                </span>
            </div>
            <p class="text-gray-700 mb-4">${a.content}</p>
            
            ${a.status === 'PENDING' ? `
                <div class="flex gap-2">
                    <button onclick="approveAnnouncement(${a.id})" 
                            class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                        Approve
                    </button>
                    <button onclick="rejectAnnouncement(${a.id})" 
                            class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                        Reject
                    </button>
                </div>
            ` : ''}
            
            ${a.status === 'REJECTED' && a.rejection_reason ? `
                <div class="mt-4 p-4 bg-red-50 rounded border border-red-200">
                    <p class="text-sm text-red-800"><strong>Rejection Reason:</strong> ${a.rejection_reason}</p>
                </div>
            ` : ''}
        </div>
    `).join('');
}

async function approveAnnouncement(id) {
    if (!confirm('Approve this announcement?')) return;
    
    try {
        const response = await fetch(`/api/announcements/${id}/approve/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('access')}`
            },
            body: JSON.stringify({ action: 'approve' })
        });
        
        if (response.ok) {
            alert('Announcement approved!');
            loadAnnouncements();
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to approve announcement');
    }
}

async function rejectAnnouncement(id) {
    const reason = prompt('Rejection reason (optional):');
    
    try {
        const response = await fetch(`/api/announcements/${id}/approve/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('access')}`
            },
            body: JSON.stringify({ 
                action: 'reject',
                rejection_reason: reason || ''
            })
        });
        
        if (response.ok) {
            alert('Announcement rejected');
            loadAnnouncements();
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to reject announcement');
    }
}

document.addEventListener('DOMContentLoaded', loadAnnouncements);