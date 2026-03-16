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

function showSuccessToast(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg z-50 flex items-center gap-3';
    toast.style.animation = 'slideIn 0.3s ease-out';
    toast.innerHTML = `
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span class="font-semibold">${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function editAnnouncement(id) {
    document.getElementById('edit-modal').classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.add('hidden');
}

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
            body: JSON.stringify({ id: parseInt(id) })
        });
        
        if (response.ok) {
            showSuccessToast('Announcement deleted successfully!');
            setTimeout(() => {
                window.location.href = '/api/announcements-page/';
            }, 1000);
        } else {
            const errorData = await response.json();
            alert('Failed to delete: ' + (errorData.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error deleting announcement: ' + error.message);
    }
}

/* Handle edit form submission */
async function handleEditSubmit(event) {
    event.preventDefault();
    
    const announcementId = document.getElementById('editBtn').getAttribute('data-id');
    
    const data = {
        id: parseInt(announcementId),
        title: document.getElementById('edit-title').value,
        category: document.getElementById('edit-category').value,
        content: document.getElementById('edit-content').value,
        external_link: document.getElementById('edit-link').value || null
    };
    
    try {
        const csrftoken = getCookie('csrftoken');
        
        const response = await fetch('/api/announcements/', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('access')}`,
                'X-CSRFToken': csrftoken
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            showSuccessToast('Announcement updated successfully!');
            setTimeout(() => {
                location.reload();
            }, 1000);
        } else {
            const errorData = await response.json();
            alert('Failed to update: ' + (errorData.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error updating announcement: ' + error.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const editBtn = document.getElementById('editBtn');
    const deleteBtn = document.getElementById('deleteBtn');
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
    
    if (editForm) {
        editForm.addEventListener('submit', handleEditSubmit);
    }
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeEditModal();
        }
    });
});