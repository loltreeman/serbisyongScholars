document.addEventListener('DOMContentLoaded', () => {
    fetchVouchers('all');
});

let allVouchers = [];

async function fetchVouchers(category = 'all') {
    try {
        // Build URL based on category
        let url = '/api/vouchers/';
        if (category !== 'all') {
            url += `?category=${category}`;
        }

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`, // Adjust based on your auth method
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error('Failed to fetch vouchers');
        
        allVouchers = await response.json();
        renderVouchers(allVouchers);
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('vouchers-container').innerHTML = `
            <div class="col-span-full text-center text-red-600 py-8">
                Failed to load vouchers. Please try again later.
            </div>
        `;
    }
}

function renderVouchers(vouchers) {
    const container = document.getElementById('vouchers-container');
    container.innerHTML = '';

    if (vouchers.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center text-gray-500 py-8">
                No vouchers available in this category right now.
            </div>
        `;
        return;
    }

    vouchers.forEach(voucher => {
        const percentageLeft = (voucher.remaining_slots / voucher.total_slots) * 100;
        let badgeColor = percentageLeft > 20 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
        
        const card = document.createElement('div');
        card.className = 'bg-white rounded-lg shadow-md overflow-hidden flex flex-col';
        card.innerHTML = `
            ${voucher.image_url ? `<img src="${voucher.image_url}" alt="${voucher.title}" class="w-full h-48 object-cover">` : '<div class="w-full h-32 bg-blue-100 flex items-center justify-center"><span class="text-blue-500 text-4xl">🎟️</span></div>'}
            <div class="p-5 flex flex-col flex-grow">
                <div class="flex justify-between items-start mb-2">
                    <span class="text-xs font-semibold px-2 py-1 bg-gray-100 rounded text-gray-600">${voucher.category}</span>
                    <span class="text-xs font-bold px-2 py-1 rounded ${badgeColor}">${voucher.remaining_slots} left</span>
                </div>
                <h3 class="text-xl font-bold text-gray-900 mb-1">${voucher.title}</h3>
                <p class="text-sm text-gray-500 mb-3">Provider: ${voucher.provider}</p>
                <p class="text-gray-600 text-sm mb-4 line-clamp-3">${voucher.description}</p>
                
                <div class="mt-auto pt-4 border-t border-gray-100">
                    <div class="flex justify-between items-center mb-4">
                        <span class="text-xs text-gray-500">Expires: ${new Date(voucher.expiry_date).toLocaleDateString()}</span>
                    </div>
                    <button onclick="applyForVoucher(${voucher.id})" 
                            class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition duration-150">
                        Apply Now
                    </button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function filterByCategory(category) {
    // Update active button styling
    document.querySelectorAll('.category-filter-btn').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('bg-gray-200', 'text-gray-800');
    });
    event.currentTarget.classList.remove('bg-gray-200', 'text-gray-800');
    event.currentTarget.classList.add('bg-blue-600', 'text-white');

    fetchVouchers(category);
}

async function applyForVoucher(voucherId) {
    if (!confirm('Are you sure you want to apply for this voucher?')) return;

    try {

        const response = await fetch(`/api/vouchers/${voucherId}/apply/`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({ notes: "Standard application" })
        });

        const data = await response.json();

        if (response.ok) {
            alert('Application submitted successfully!');
            fetchVouchers();
        } else {
            alert(data.error || 'Failed to apply for voucher');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while applying.');
    }
}

function openCreateModal() {
    document.getElementById('create-modal').classList.remove('hidden');
}

function closeCreateModal() {
    document.getElementById('create-modal').classList.add('hidden');
    document.getElementById('create-voucher-form').reset();
}

async function submitNewVoucher(event) {
    event.preventDefault(); // Prevent page reload
    
    // Gather form data
    const voucherData = {
        title: document.getElementById('v-title').value,
        description: document.getElementById('v-desc').value,
        category: document.getElementById('v-category').value,
        provider: document.getElementById('v-provider').value,
        total_slots: parseInt(document.getElementById('v-slots').value),
        expiry_date: document.getElementById('v-expiry').value,
        image_url: document.getElementById('v-image').value || null,
        status: 'ACTIVE' 
    };

    try {
        const response = await fetch('/api/vouchers/', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`, 
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken') 
            },
            body: JSON.stringify(voucherData)
        });


        if (response.ok) {
            alert('Voucher created successfully!');
            closeCreateModal();
            fetchVouchers();
        } else {
            const data = await response.json();
            console.error('Validation errors:', data);
            alert('Failed to create voucher. Check console for details.');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while creating the voucher.');
    }
}

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            // Does this cookie string begin with the name we want?
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

document.addEventListener('DOMContentLoaded', () => {
    fetchVouchers('all');
    fetchMyApplications(); // New call
});

async function fetchMyApplications() {
    try {
        const response = await fetch('/api/vouchers/my-applications/', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error('Failed to fetch applications');
        
        const applications = await response.json();
        renderMyApplications(applications);
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('my-applications-container').innerHTML = 'Failed to load applications.';
    }
}

function renderMyApplications(applications) {
    const container = document.getElementById('my-applications-container');
    if (!container) return;

    if (applications.length === 0) {
        container.innerHTML = '<p class="text-gray-500">You haven\'t applied for any vouchers yet.</p>';
        return;
    }

    let html = '<div class="space-y-4">';
    applications.forEach(app => {
        const statusColors = {
            'PENDING': 'bg-yellow-100 text-yellow-800',
            'APPROVED': 'bg-green-100 text-green-800',
            'REJECTED': 'bg-red-100 text-red-800',
            'CLAIMED': 'bg-blue-100 text-blue-800'
        };

        html += `
            <div class="border p-4 rounded-lg flex justify-between items-center">
                <div>
                    <h4 class="font-bold">${app.voucher_title}</h4>
                    <span class="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 bg-gray-100 rounded text-gray-500">
                        ${app.voucher_category}
                    </span>
                    <p class="text-sm text-gray-500">Applied on: ${new Date(app.applied_at).toLocaleDateString()}</p>
                </div>
                <span class="px-3 py-1 rounded-full text-xs font-semibold ${statusColors[app.status] || 'bg-gray-100'}">
                    ${app.status}
                </span>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}