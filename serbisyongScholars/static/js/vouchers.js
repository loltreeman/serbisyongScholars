document.addEventListener('DOMContentLoaded', () => {
    fetchVouchers('all');

    if (USER_ROLE === 'SCHOLAR') {
        loadMyApplications();
    }

    if (CAN_MANAGE_APPLICATIONS) {
        loadApplicationsForMod();
        loadHistorySection();
        loadVoucherSubmissions(); // New: For tracking voucher proposals
    }
});

let allVouchers = [];
let allHistoryData = [];
let allVoucherSubs = []; // New: For voucher proposal history

async function fetchVouchers(category = 'all') {
    try {
        let url = '/api/vouchers/';
        const params = new URLSearchParams();
        if (category !== 'all') params.append('category', category);
        
        // For the main display, we usually want ACTIVE vouchers
        // But the backend now handles the filtering based on role
        if (params.toString()) url += `?${params.toString()}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access')}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error('Failed to fetch vouchers');

        allVouchers = await response.json();
        // The main view should only show ACTIVE (and FULL/EXPIRED) unless it's a history view
        // But for consistency with the UI, let's filter the main cards to NOT show REJECTED or PENDING
        // unless you are the creator or admin.
        renderVouchers(allVouchers.filter(v => v.status !== 'REJECTED' && v.status !== 'PENDING'));
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

    const canApply = USER_ROLE === 'SCHOLAR';

    vouchers.forEach(voucher => {
        const percentageLeft = (voucher.remaining_slots / voucher.total_slots) * 100;
        let badgeColor = percentageLeft > 20 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';

        const isCreator = voucher.created_by_username === CURRENT_USERNAME;
        const canEdit = IS_ADMIN || (CAN_EDIT_VOUCHER_GLOBAL && isCreator);
        const canDelete = IS_ADMIN || CAN_EDIT_VOUCHER_GLOBAL;

        const card = document.createElement('div');
        card.className = 'bg-white rounded-lg shadow-md overflow-hidden flex flex-col hover:shadow-lg transition-shadow duration-200';
        card.innerHTML = `
            ${voucher.image_url ? `<img src="${voucher.image_url}" alt="${voucher.title}" class="w-full h-48 object-cover">` : '<div class="w-full h-32 bg-indigo-50 flex items-center justify-center"><span class="text-indigo-500 text-4xl">🎟️</span></div>'}
            <div class="p-5 flex flex-col flex-grow">
                <div class="flex justify-between items-start mb-2">
                    <span class="text-[10px] uppercase border px-2 py-0.5 rounded font-bold tracking-wider text-gray-500">${voucher.category}</span>
                    <span class="text-xs font-bold px-2 py-1 rounded ${badgeColor}">${voucher.remaining_slots} left</span>
                </div>
                <h3 class="text-xl font-bold text-gray-900 mb-1">${voucher.title}</h3>
                <div class="flex items-center gap-1 text-xs text-gray-500 mb-3">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
                    <span>${voucher.provider}</span>
                </div>
                <p class="text-gray-600 text-sm mb-4 line-clamp-3">${voucher.description}</p>

                <div class="mt-auto pt-4 border-t border-gray-100">
                    <div class="flex justify-between items-center mb-4 text-xs">
                        <span class="text-gray-500">Expires: ${new Date(voucher.expiry_date).toLocaleDateString()}</span>
                        ${ (IS_ADMIN || CAN_EDIT_VOUCHER_GLOBAL) ? `<span class="bg-gray-100 px-1.5 py-0.5 rounded text-gray-400">By: ${voucher.created_by_name || 'System'}</span>` : ''}
                    </div>
                    
                    <div class="flex flex-col gap-2">
                        ${canApply
                            ? `<button onclick="applyForVoucher(${voucher.id})"
                                    class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition duration-150 shadow-sm">
                                Apply Now
                              </button>`
                            : ''
                        }

                        <div class="flex gap-2">
                            ${canEdit 
                                ? `<button onclick="openEditModal(${voucher.id})" class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold py-2 px-3 rounded-lg transition">EDIT</button>` 
                                : ''
                            }
                            ${canDelete
                                ? `<button onclick="deleteVoucher(${voucher.id})" class="flex-1 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold py-2 px-3 rounded-lg transition">DELETE</button>`
                                : ''
                            }
                        </div>
                        
                        ${!canApply && !canEdit && !canDelete ? `<div class="w-full text-center text-xs text-gray-400 py-2">Applications open to scholars only</div>` : ''}
                    </div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function filterByCategory(category, event) {
    document.querySelectorAll('.category-filter-btn').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('bg-gray-200', 'text-gray-800');
    });
    const target = event ? event.currentTarget : null;
    if (target) {
        target.classList.remove('bg-gray-200', 'text-gray-800');
        target.classList.add('bg-blue-600', 'text-white');
    }

    fetchVouchers(category);
}

async function applyForVoucher(voucherId) {
    if (!confirm('Are you sure you want to apply for this voucher?')) return;

    try {
        const response = await fetch(`/api/vouchers/${voucherId}/apply/`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access')}`,
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({ notes: "Standard application" })
        });

        const data = await response.json();

        if (response.ok) {
            showSuccessToast('Application submitted successfully!');
            fetchVouchers();
            loadMyApplications();
        } else {
            alert(data.error || 'Failed to apply for voucher');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while applying.');
    }
}

// Modal management
function openCreateModal() {
    document.getElementById('modal-title').innerText = 'Create New Voucher';
    document.getElementById('v-id').value = '';
    document.getElementById('voucher-form').reset();
    document.getElementById('voucher-modal').classList.remove('hidden');
}

async function openEditModal(voucherId) {
    const voucher = allVouchers.find(v => v.id === voucherId);
    if (!voucher) return;

    document.getElementById('modal-title').innerText = 'Edit Voucher';
    document.getElementById('v-id').value = voucher.id;
    document.getElementById('v-title').value = voucher.title;
    document.getElementById('v-desc').value = voucher.description;
    document.getElementById('v-category').value = voucher.category;
    document.getElementById('v-slots').value = voucher.total_slots;
    document.getElementById('v-provider').value = voucher.provider;
    document.getElementById('v-expiry').value = voucher.expiry_date;
    document.getElementById('v-image').value = voucher.image_url || '';

    document.getElementById('voucher-modal').classList.remove('hidden');
}

function closeVoucherModal() {
    document.getElementById('voucher-modal').classList.add('hidden');
}

async function handleVoucherSubmit(event, force = false) {
    event.preventDefault();

    const voucherId = document.getElementById('v-id').value;
    const isEdit = !!voucherId;

    const voucherData = {
        title: document.getElementById('v-title').value,
        description: document.getElementById('v-desc').value,
        category: document.getElementById('v-category').value,
        total_slots: parseInt(document.getElementById('v-slots').value),
        provider: document.getElementById('v-provider').value,
        expiry_date: document.getElementById('v-expiry').value,
        image_url: document.getElementById('v-image').value || null,
    };

    if (force) voucherData.force = true;

    try {
        const url = isEdit ? `/api/vouchers/${voucherId}/` : '/api/vouchers/';
        const method = isEdit ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access')}`,
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify(voucherData)
        });

        const data = await response.json();

        if (response.ok) {
            showSuccessToast(isEdit ? 'Voucher updated' : 'Voucher created');
            closeVoucherModal();
            closeSlotWarnModal();
            fetchVouchers();
        } else if (response.status === 409 && data.requires_confirmation) {
            showSlotWarnModal(data.error, voucherId);
        } else {
            alert(data.error || 'Operation failed');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

function showSlotWarnModal(message, voucherId) {
    document.getElementById('slot-warning-text').innerText = message;
    const btn = document.getElementById('force-update-btn');
    btn.onclick = () => handleVoucherSubmit({ preventDefault: () => {} }, true);
    document.getElementById('slot-warn-modal').classList.remove('hidden');
}

function closeSlotWarnModal() {
    document.getElementById('slot-warn-modal').classList.add('hidden');
}

// Delete logic
async function deleteVoucher(voucherId, force = false) {
    try {
        const url = `/api/vouchers/${voucherId}/${force ? '?force=true' : ''}`;
        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access')}`,
                'X-CSRFToken': getCookie('csrftoken')
            }
        });

        const data = await response.json();

        if (response.ok) {
            showSuccessToast('Voucher deleted');
            closeDeleteModal();
            fetchVouchers();
        } else if (response.status === 409 && data.requires_confirmation) {
            const warningText = `This voucher has ${data.pending_count} pending and ${data.approved_count} approved applications. Deleting it will permanently remove all these records.`;
            showDeleteConfirmModal(warningText, voucherId);
        } else {
            alert(data.error || 'Delete failed');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

function showDeleteConfirmModal(message, voucherId) {
    document.getElementById('delete-warning-text').innerText = message;
    const btn = document.getElementById('force-delete-btn');
    btn.onclick = () => deleteVoucher(voucherId, true);
    document.getElementById('delete-confirm-modal').classList.remove('hidden');
}

function closeDeleteModal() {
    document.getElementById('delete-confirm-modal').classList.add('hidden');
}

// Applications Management
async function loadMyApplications() {
    const container = document.getElementById('my-applications-container');
    if (!container) return;

    try {
        const response = await fetch('/api/vouchers/my-applications/', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('access')}` }
        });

        if (!response.ok) throw new Error('Fetch failed');

        let apps = await response.json();
        const filter = document.getElementById('my-history-status').value;
        if (filter !== 'all') {
            apps = apps.filter(a => a.status === filter);
        }

        renderMyApplications(apps);
    } catch (error) {
        container.innerHTML = 'Error loading applications';
    }
}

function renderMyApplications(applications) {
    const container = document.getElementById('my-applications-container');
    if (applications.length === 0) {
        container.innerHTML = '<p class="text-gray-500 py-4 text-center">No applications found with this status.</p>';
        return;
    }

    const statusColors = {
        'PENDING': 'bg-yellow-100 text-yellow-800 border-yellow-200',
        'APPROVED': 'bg-green-100 text-green-800 border-green-200',
        'REJECTED': 'bg-red-100 text-red-800 border-red-200',
        'CLAIMED': 'bg-blue-100 text-blue-800 border-blue-200'
    };

    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${applications.map(app => `
                <div class="border rounded-xl p-4 flex flex-col justify-between hover:bg-gray-50 transition">
                    <div class="mb-4">
                        <div class="flex justify-between items-start">
                            <h4 class="font-bold text-gray-900">${app.voucher_title}</h4>
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${statusColors[app.status]}">${app.status}</span>
                        </div>
                        <p class="text-xs text-gray-500 mt-1">Applied: ${new Date(app.applied_at).toLocaleDateString()}</p>
                    </div>
                    ${app.admin_notes ? `<div class="bg-gray-100 p-2 rounded text-[11px] text-gray-600 mb-2">Note: ${app.admin_notes}</div>` : ''}
                    <div class="text-[10px] text-gray-400">Voucher by ${app.voucher_created_by_name || 'System'}</div>
                </div>
            `).join('')}
        </div>
    `;
}

async function loadApplicationsForMod() {
    const container = document.getElementById('admin-applications-container');
    if (!container) return;

    try {
        const response = await fetch('/api/vouchers/applications/?status=PENDING', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('access')}` }
        });

        const apps = await response.json();
        renderPendingApplications(apps);
    } catch (error) {
        console.error(error);
    }
}

function renderPendingApplications(apps) {
    const container = document.getElementById('admin-applications-container');
    if (apps.length === 0) {
        container.innerHTML = '<div class="col-span-full py-8 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-gray-400"><p>All caught up! No pending reviews.</p></div>';
        return;
    }

    container.innerHTML = apps.map(app => `
        <div class="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <h4 class="font-bold text-gray-900 line-clamp-1">${app.voucher_title}</h4>
                    <span class="text-[10px] text-gray-500 uppercase font-bold">${app.voucher_category}</span>
                </div>
                <div class="text-right">
                    <p class="text-sm font-bold text-blue-600">${app.scholar_name}</p>
                    <p class="text-[10px] text-gray-400">${app.scholar_id}</p>
                </div>
            </div>
            
            <div class="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                ${IS_READONLY_MOD 
                    ? `<span class="italic text-xs text-gray-400">View only</span>`
                    : `
                    <button onclick="handleApplicationAction(${app.id}, 'approve')" class="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-2 rounded-lg transition shadow-sm">APPROVE</button>
                    <button onclick="handleApplicationAction(${app.id}, 'reject')" class="flex-1 bg-white border border-red-100 hover:bg-red-50 text-red-600 text-xs font-bold py-2 rounded-lg transition">REJECT</button>
                    `
                }
            </div>
        </div>
    `).join('');
}

async function handleApplicationAction(applicationId, action) {
    let notes = action === 'approve' ? 'Approved' : prompt('Reason for rejection:');
    if (action === 'reject' && notes === null) return;

    try {
        const response = await fetch(`/api/vouchers/applications/${applicationId}/approve/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('access')}`,
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({ action: action, admin_notes: notes || 'No additional notes' })
        });

        if (response.ok) {
            showSuccessToast(`Application ${action}d`);
            loadApplicationsForMod();
            loadHistorySection();
            fetchVouchers();
        }
    } catch (e) { console.error(e); }
}

// History logic
async function loadHistorySection() {
    try {
        const [approvedRes, rejectedRes] = await Promise.all([
            fetch('/api/vouchers/applications/?status=APPROVED', { headers: { 'Authorization': `Bearer ${localStorage.getItem('access')}` }}),
            fetch('/api/vouchers/applications/?status=REJECTED', { headers: { 'Authorization': `Bearer ${localStorage.getItem('access')}` }})
        ]);

        const approved = await approvedRes.json();
        const rejected = await rejectedRes.json();
        allHistoryData = [...approved, ...rejected].sort((a, b) => new Date(b.applied_at) - new Date(a.applied_at));
        applyHistoryFilters();
    } catch (error) {
        console.error('History load failed', error);
    }
}

function applyHistoryFilters() {
    const searchEl = document.getElementById('hist-search');
    const search = searchEl ? searchEl.value.toLowerCase() : '';
    const statusEl = document.getElementById('hist-status');
    const status = statusEl ? statusEl.value : 'all';
    const dateEl = document.getElementById('hist-date');
    const dateLimit = dateEl ? dateEl.value : '';

    const filtered = allHistoryData.filter(app => {
        const matchesSearch = !search || 
                             app.voucher_title.toLowerCase().includes(search) || 
                             app.scholar_name.toLowerCase().includes(search) || 
                             app.scholar_id.includes(search);
        const matchesStatus = status === 'all' || app.status === status;
        const matchesDate = !dateLimit || (app.applied_at && app.applied_at.startsWith(dateLimit));
        return matchesSearch && matchesStatus && matchesDate;
    });

    renderHistoryTable(filtered);
}

function renderHistoryTable(data) {
    const tbody = document.getElementById('history-table-body');
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-400">No matching records found.</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(app => `
        <tr class="hover:bg-gray-50 transition-colors">
            <td class="px-4 py-3 whitespace-nowrap">
                <div class="font-bold text-gray-900">${app.voucher_title}</div>
                <div class="text-[10px] text-gray-500 uppercase font-medium">${app.voucher_category}</div>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-xs text-blue-600 font-bold">
                ${app.scholar_name}
                <div class="text-[10px] text-gray-400 font-normal">${app.scholar_id}</div>
            </td>
            <td class="px-4 py-3 whitespace-nowrap">
                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${app.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                    ${app.status}
                </span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                ${new Date(app.applied_at).toLocaleDateString()}
            </td>
            <td class="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">
                ${app.admin_notes || '—'}
            </td>
        </tr>
    `).join('');
}

// ==========================================
// VOUCHER SUBMISSIONS (PROPOSALS) HANDLING
// ==========================================

async function loadVoucherSubmissions() {
    if (!CAN_MANAGE_APPLICATIONS) return;
    
    try {
        const statusFilter = document.getElementById('v-sub-status').value;
        
        // Always fetch ALL vouchers — we'll filter client-side for the proposals view
        const response = await fetch(`/api/vouchers/`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access')}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load submissions');
        
        const allVoucherData = await response.json();
        allVoucherSubs = allVoucherData;
        
        // Proposals table: admins see all, mods see only their own
        let filtered = IS_ADMIN ? allVoucherSubs : allVoucherSubs.filter(v => v.created_by_username === CURRENT_USERNAME);
        
        // Apply status filter from the dropdown
        if (statusFilter !== 'all') {
            filtered = filtered.filter(v => v.status === statusFilter);
        }
        
        renderVoucherSubmissions(filtered);
    } catch (error) {
        console.error('Error:', error);
    }
}

function renderVoucherSubmissions(subs) {
    const tableBody = document.getElementById('voucher-sub-table-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    if (subs.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="px-4 py-8 text-center text-gray-500">
                    No matching voucher proposals found.
                </td>
            </tr>
        `;
        return;
    }

    subs.forEach(v => {
        let statusBadge = v.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                         v.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                         v.status === 'REJECTED' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800';
                         
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-4 py-3">
                <div class="font-bold text-gray-900">${v.title}</div>
                <div class="text-[10px] text-gray-500">${v.category} | ${v.provider}</div>
            </td>
            <td class="px-4 py-3 text-gray-600 text-xs">${v.created_by_name}</td>
            <td class="px-4 py-3">
                <span class="px-2 py-0.5 rounded text-[10px] uppercase font-bold ${statusBadge}">${v.status_display}</span>
                ${v.rejection_reason ? `<div class="text-[10px] text-red-500 mt-1 italic">"${v.rejection_reason}"</div>` : ''}
            </td>
            <td class="px-4 py-3 text-gray-500 text-xs">${new Date(v.created_at).toLocaleDateString()}</td>
            <td class="px-4 py-3">
                ${IS_ADMIN && v.status === 'PENDING' 
                    ? `<div class="flex gap-2">
                        <button onclick="handleVoucherApproval(${v.id}, 'approve')" class="bg-green-600 text-white px-2 py-1 rounded text-[10px] font-bold hover:bg-green-700">APPROVE</button>
                        <button onclick="handleVoucherApproval(${v.id}, 'reject')" class="bg-white border border-red-200 text-red-600 px-2 py-1 rounded text-[10px] font-bold hover:bg-red-50">REJECT</button>
                      </div>`
                    : '<span class="text-gray-400 text-xs">No pending actions</span>'}
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function applyVoucherSubFilters() {
    const q = document.getElementById('v-sub-search').value.toLowerCase();
    const statusFilter = document.getElementById('v-sub-status').value;

    // Start with ownership filter (mods only see their own)
    let base = IS_ADMIN ? allVoucherSubs : allVoucherSubs.filter(v => v.created_by_username === CURRENT_USERNAME);

    // Apply status filter
    if (statusFilter !== 'all') {
        base = base.filter(v => v.status === statusFilter);
    }

    // Apply search filter
    const filtered = base.filter(v =>
        v.title.toLowerCase().includes(q) || v.provider.toLowerCase().includes(q)
    );
    renderVoucherSubmissions(filtered);
}

async function handleVoucherApproval(voucherId, action) {
    let rejection_reason = '';
    if (action === 'reject') {
        rejection_reason = prompt('Enter rejection reason (optional):') || '';
        if (rejection_reason === null) return;
    }

    try {
        const response = await fetch(`/api/vouchers/${voucherId}/approve/`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access')}`,
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({ action, rejection_reason })
        });

        if (!response.ok) throw new Error('Action failed');
        
        showSuccessToast(`Voucher proposal ${action}d`);
        loadVoucherSubmissions();
        fetchVouchers('all'); // Refresh main cards
    } catch (error) {
        alert(error.message);
    }
}

// Utility
function showSuccessToast(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed top-6 right-6 bg-gray-900 text-white px-6 py-4 rounded-2xl shadow-2xl z-[100] transition-all transform duration-300 flex items-center gap-3 border border-gray-700';
    toast.innerHTML = `
        <div class="bg-green-500 rounded-full p-1"><svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg></div>
        <span class="font-bold text-sm tracking-tight">${message}</span>
    `;
    document.body.appendChild(toast);
    setTimeout(() => { toast.classList.add('opacity-0', 'translate-y-2'); setTimeout(() => toast.remove(), 300); }, 3000);
}

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
