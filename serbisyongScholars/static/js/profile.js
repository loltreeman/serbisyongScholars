// profile.js handles loading and (optionally) editing a user's profile

const loggedInUsername = localStorage.getItem("loggedInUsername");
const container = document.getElementById("profile-container");

// Allow visiting another user's profile by query parameter
const params = new URLSearchParams(window.location.search);
const usernameParam = params.get('username');
const studentIdParam = params.get('student_id');

// Global state for current data
let currentProfileData = null;
let isEditMode = false;

function getCookie(name) {
    const cookieValue = `; ${document.cookie}`;
    const parts = cookieValue.split(`; ${name}=`);
    if (parts.length === 2) {
        return parts.pop().split(';').shift();
    }
    return null;
}

async function loadProfile() {
    try {
        let apiUrl;
        if (studentIdParam) {
            apiUrl = `/api/profile/?student_id=${encodeURIComponent(studentIdParam)}`;
        } else if (usernameParam) {
            apiUrl = `/api/profile/?username=${encodeURIComponent(usernameParam)}`;
        } else {
            // Default to self-lookup
            apiUrl = `/api/profile/?me=true`;
        }

        const res = await fetch(apiUrl, {
            credentials: 'same-origin'
        });

        if (!res.ok) {
            container.innerHTML = '<div class="empty-state p-6 text-center text-slate-500">Profile not found or access denied.</div>';
            return;
        }

        currentProfileData = await res.json();
        renderProfile(currentProfileData);
        attachDirtyListeners();
    } catch (err) {
        container.innerHTML = '<div class="empty-state p-6 text-center text-red-500">❌ Connection Error</div>';
    }
}

function attachDirtyListeners() {
    const watchIds = ['edit-first-name', 'edit-last-name', 'edit-email', 'edit-username',
                      'edit-school', 'edit-program-course', 'edit-grant', 'edit-role'];
    watchIds.forEach(id => {
        const el = document.getElementById(id);
        el?.addEventListener('input', markDirty);
        el?.addEventListener('change', markDirty);
    });
}

function markDirty() {
    const wrapper = document.getElementById('save-btn-wrapper');
    if (wrapper) wrapper.classList.remove('hidden');
}

function enterEditMode() {
    isEditMode = true;
    renderProfile(currentProfileData);
    attachDirtyListeners();
}

function exitEditMode() {
    isEditMode = false;
    renderProfile(currentProfileData);
}

// Change dormer status (as an ADMIN account)
async function toggleDormer(studentId, currentStatus) {
    const statusEl = document.getElementById('dormer-status');
    const toggleBtn = document.getElementById('dormer-toggle');
    const badge = document.getElementById('dormer-badge');

    if (statusEl) {
        statusEl.textContent = 'Saving...';
        statusEl.className = 'text-xs font-medium text-slate-500';
    }
    if (toggleBtn) toggleBtn.disabled = true;

    try {
        const res = await fetch('/api/scholar/update-dormer/', {
            method: 'PATCH',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken') || ''
            },
            body: JSON.stringify({
                student_id: studentId,
                is_dormer: !currentStatus
            })
        });

        if (res.ok) {
            const newStatus = !currentStatus;
            if (badge) {
                badge.textContent = newStatus ? 'Dormer (15 hrs)' : 'Non-Dormer (10 hrs)';
                badge.className = 'inline-block bg-indigo-100 text-indigo-800 text-xs font-bold px-2 py-1 rounded-md';
            }
            if (toggleBtn) {
                toggleBtn.textContent = `Switch to ${newStatus ? 'Non-Dormer' : 'Dormer'}`;
                toggleBtn.onclick = () => toggleDormer(studentId, newStatus);
            }
            if (statusEl) {
                statusEl.textContent = 'Updated successfully.';
                statusEl.className = 'text-xs font-medium text-emerald-600';
                setTimeout(() => { statusEl.textContent = ''; }, 3000);
            }
            // Reload progress data if visible
            loadProfile(); 
        } else {
            const data = await res.json();
            if (statusEl) {
                statusEl.textContent = data.error || 'Update failed.';
                statusEl.className = 'text-xs font-medium text-red-600';
            }
        }
    } catch (err) {
        if (statusEl) {
            statusEl.textContent = 'Connection error.';
            statusEl.className = 'text-xs font-medium text-red-600';
        }
    } finally {
        if (toggleBtn) toggleBtn.disabled = false;
    }
}

function renderProfile(data) {
    const isScholar = data.role === 'SCHOLAR';
    const isOwnProfile = data.username === VIEWER_USERNAME;
    const isAdmin = VIEWER_ROLE === 'ADMIN';
    // Any user can edit their own profile; admins can edit anyone's
    const canEdit = isAdmin || isOwnProfile;
    // Admin can edit ALL fields; non-admins editing their own get limited fields
    const canEditAllFields = isAdmin;

    let html = `
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
            <div class="bg-[#0f172a] p-6 text-white flex justify-between items-center">
                <div>
                    <h2 class="text-xl font-bold">${data.name}</h2>
                    ${isEditMode && canEdit ? `
                        <div class="mt-2">
                            <label class="block text-[10px] font-bold text-slate-400 uppercase">Edit Username</label>
                            <input type="text" id="edit-username" value="${data.username || ''}"
                                class="bg-slate-800 text-white border border-slate-700 rounded-lg px-2 py-1 text-sm focus:ring-yellow-500 focus:border-yellow-500">
                        </div>
                    ` : `
                        <p class="text-slate-300 text-sm">@${data.username}</p>
                    `}
                </div>
                <div class="flex items-center gap-4">
                    <span class="bg-[#eab308] text-[#422006] text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">${data.role}</span>
                    
                    ${canEdit ? `
                        <button type="button" onclick="${isEditMode ? 'exitEditMode()' : 'enterEditMode()'}" 
                            class="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition" 
                            title="${isEditMode ? 'Cancel' : 'Edit Profile'}">
                            ${isEditMode ? `
                                <svg class="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            ` : `
                                <svg class="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                            `}
                        </button>
                    ` : ''}
                </div>
            </div>

            <div class="p-6">
                <form id="profile-edit-form" onsubmit="event.preventDefault(); handleSave();" class="space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <!-- Basic Info Section -->
                        <div class="space-y-4">
                            <h3 class="text-sm font-bold text-slate-400 uppercase tracking-widest border-b pb-1">Basic Information</h3>
                            
                            <div>
                                <label class="block text-xs font-bold text-slate-500 mb-1 uppercase">First Name</label>
                                ${isEditMode ? `
                                    <input type="text" id="edit-first-name" value="${data.first_name || ''}" 
                                        class="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:ring-blue-500 focus:border-blue-500">
                                ` : `
                                    <p class="p-2.5 bg-slate-50 rounded-lg text-slate-700 font-medium">${data.first_name || '—'}</p>
                                `}
                            </div>

                            <div>
                                <label class="block text-xs font-bold text-slate-500 mb-1 uppercase">Last Name</label>
                                ${isEditMode ? `
                                    <input type="text" id="edit-last-name" value="${data.last_name || ''}" 
                                        class="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:ring-blue-500 focus:border-blue-500">
                                ` : `
                                    <p class="p-2.5 bg-slate-50 rounded-lg text-slate-700 font-medium">${data.last_name || '—'}</p>
                                `}
                            </div>

                            <div>
                                <label class="block text-xs font-bold text-slate-500 mb-1 uppercase">Email Address</label>
                                ${isEditMode && canEditAllFields ? `
                                    <input type="email" id="edit-email" value="${data.email || ''}" 
                                        class="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:ring-blue-500 focus:border-blue-500">
                                ` : `
                                    <p class="p-2.5 bg-slate-50 rounded-lg text-slate-700 font-medium">${data.email || '—'}</p>
                                    ${isEditMode ? '<p class="text-[10px] text-slate-400 mt-1">Email can only be changed by an Admin.</p>' : ''}
                                `}
                            </div>
                        </div>

                        <!-- Role Specific Info -->
                        <div class="space-y-4">
                            <h3 class="text-sm font-bold text-slate-400 uppercase tracking-widest border-b pb-1">Role Configuration</h3>
                            
                            ${isScholar ? `
                                <div>
                                    <label class="block text-xs font-bold text-slate-500 mb-1 uppercase">Student ID</label>
                                    <p class="p-2.5 bg-slate-50 rounded-lg text-slate-700 font-medium">${data.student_id || 'N/A'}</p>
                                </div>

                                <div>
                                    <label class="block text-xs font-bold text-slate-500 mb-1 uppercase">School</label>
                                    ${isEditMode ? `
                                        <select id="edit-school"
                                            class="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:ring-blue-500 focus:border-blue-500">
                                            <option value="">Select School</option>
                                            <option value="SOSE" ${data.school === 'SOSE' ? 'selected' : ''}>School of Science and Engineering</option>
                                            <option value="SOH" ${data.school === 'SOH' ? 'selected' : ''}>School of Humanities</option>
                                            <option value="JGSOM" ${data.school === 'JGSOM' ? 'selected' : ''}>John Gokongwei School of Management</option>
                                            <option value="RGLSOSS" ${data.school === 'RGLSOSS' ? 'selected' : ''}>School of Social Sciences</option>
                                            <option value="GBSEALD" ${data.school === 'GBSEALD' ? 'selected' : ''}>School of Education</option>
                                        </select>
                                    ` : `
                                        <p class="p-2.5 bg-slate-50 rounded-lg text-slate-700 font-medium">${data.school || '—'}</p>
                                    `}
                                </div>

                                <div>
                                    <label class="block text-xs font-bold text-slate-500 mb-1 uppercase">Program / Course</label>
                                    ${isEditMode ? `
                                        <input type="text" id="edit-program-course" value="${data.course_department || ''}" 
                                            class="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:ring-blue-500 focus:border-blue-500">
                                    ` : `
                                        <p class="p-2.5 bg-slate-50 rounded-lg text-slate-700 font-medium">${data.course_department || '—'}</p>
                                    `}
                                </div>

                                <div>
                                    <label class="block text-xs font-bold text-slate-500 mb-1 uppercase">Grant Type</label>
                                    ${isEditMode && isAdmin ? `
                                        <input type="text" id="edit-grant" value="${data.grant_type || ''}" 
                                            class="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:ring-blue-500 focus:border-blue-500">
                                    ` : `
                                        <p class="p-2.5 bg-slate-50 rounded-lg text-slate-700 font-medium">${data.grant_type || '—'}</p>
                                    `}
                                </div>
                            ` : `
                                <div>
                                    <label class="block text-xs font-bold text-slate-500 mb-1 uppercase">Assigned Office / Department</label>
                                    <p class="p-2.5 bg-slate-50 rounded-lg text-slate-700 font-medium">${data.role === 'ADMIN' ? 'OAA' : (data.office_name || 'Unassigned')}</p>
                                </div>
                            `}

                            ${isEditMode && isAdmin && !isOwnProfile ? `
                                <div>
                                    <label class="block text-xs font-bold text-slate-500 mb-1 uppercase">User Role</label>
                                    <select id="edit-role" class="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:ring-blue-500 focus:border-blue-500">
                                        <option value="SCHOLAR" ${data.role === 'SCHOLAR' ? 'selected' : ''}>Scholar</option>
                                        <option value="MODERATOR" ${data.role === 'MODERATOR' ? 'selected' : ''}>Moderator</option>
                                        <option value="ADMIN" ${data.role === 'ADMIN' ? 'selected' : ''}>Admin</option>
                                    </select>
                                </div>
                            ` : ''}

                            ${isScholar ? `
                                <div>
                                    <label class="block text-xs font-bold text-slate-500 mb-1 uppercase">Status Settings</label>
                                    <div class="flex items-center gap-3">
                                        <span id="dormer-badge" class="bg-indigo-50 text-indigo-700 text-xs font-bold px-2.5 py-1.5 rounded-lg">
                                            ${data.is_dormer ? 'Dormer (15 hrs)' : 'Non-Dormer (10 hrs)'}
                                        </span>
                                        ${isAdmin ? `
                                            <button type="button" id="dormer-toggle" onclick="toggleDormer('${data.student_id}', ${data.is_dormer})"
                                                class="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition">
                                                Switch Status
                                            </button>
                                        ` : ''}
                                    </div>
                                    <span id="dormer-status" class="text-[10px] mt-1 block"></span>
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    ${isEditMode ? `
                        <div id="save-btn-wrapper" class="pt-6 border-t flex flex-col items-end gap-3">
                            <button type="submit" id="save-btn" 
                                class="bg-[#0f172a] hover:bg-slate-800 text-white font-bold py-2.5 px-8 rounded-lg shadow-sm transition">
                                Save Profile Changes
                            </button>
                            <span id="save-status" class="text-xs font-bold"></span>
                        </div>
                    ` : ''}
                </form>
            </div>
        </div>
    `;

    // Service Hours Summary for scholars
    if (isScholar) {
        const rendered = data.total_hours_rendered || 0;
        const required = data.required_hours || 10;
        const carryOver = data.carry_over_hours || 0;
        const remaining = Math.max(required - rendered, 0);
        const percentage = Math.min((rendered / required) * 100, 100).toFixed(0);

        html += `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <p class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Hours Rendered</p>
                    <p class="text-3xl font-black text-slate-900">${rendered}</p>
                </div>
                <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <p class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Target Hours</p>
                    <p class="text-3xl font-black text-slate-900">${required}</p>
                </div>
                <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <p class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Carry Over</p>
                    <p class="text-3xl font-black text-green-600">${carryOver}</p>
                </div>
            </div>

            <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-sm font-bold text-slate-400 uppercase tracking-widest">Completion Progress</h3>
                    <span class="text-sm font-black text-slate-900">${percentage}%</span>
                </div>
                <div class="w-full bg-slate-100 rounded-full h-4">
                    <div class="bg-[#0f172a] h-4 rounded-full transition-all duration-500" style="width: ${percentage}%"></div>
                </div>
                <p class="text-xs font-medium text-slate-500 mt-3">${remaining} hours remaining for this period.</p>
            </div>
        `;

        if (data.service_logs && data.service_logs.length > 0) {
            html += `
                <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div class="p-6 border-b">
                        <h3 class="text-sm font-bold text-slate-400 uppercase tracking-widest">Service Log History</h3>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm text-left">
                            <thead class="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                                <tr>
                                    <th class="px-6 py-3">Date</th>
                                    <th class="px-6 py-3">Activity</th>
                                    <th class="px-6 py-3">Office</th>
                                    <th class="px-6 py-3 text-center">Hours</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y">
            `;
            data.service_logs.forEach(log => {
                html += `
                    <tr>
                        <td class="px-6 py-4 font-medium">${log.date}</td>
                        <td class="px-6 py-4 text-slate-600">${log.activity}</td>
                        <td class="px-6 py-4 text-slate-600">${log.office}</td>
                        <td class="px-6 py-4 text-center">
                            <span class="bg-slate-100 text-slate-800 px-2 py-1 rounded font-bold">${log.hours}h</span>
                        </td>
                    </tr>
                `;
            });
            html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }
    }

    container.innerHTML = html;
}

async function handleSave() {
    const saveBtn = document.getElementById('save-btn');
    const statusEl = document.getElementById('save-status');
    
    if (saveBtn) saveBtn.disabled = true;
    if (statusEl) {
        statusEl.textContent = 'Synchronizing...';
        statusEl.className = "text-xs font-bold text-slate-500";
    }

    const payload = {
        username: currentProfileData.username,
        first_name: document.getElementById('edit-first-name')?.value || currentProfileData.first_name,
        last_name: document.getElementById('edit-last-name')?.value || currentProfileData.last_name,
        email: document.getElementById('edit-email')?.value || currentProfileData.email,
    };

    const newUsernameEl = document.getElementById('edit-username');
    if (newUsernameEl && newUsernameEl.value !== currentProfileData.username) {
        payload.new_username = newUsernameEl.value.trim();
    }

    // Conditional payloads
    if (document.getElementById('edit-school')) payload.school = document.getElementById('edit-school').value;
    if (document.getElementById('edit-program-course')) payload.program_course = document.getElementById('edit-program-course').value;
    if (document.getElementById('edit-grant')) payload.grant_type = document.getElementById('edit-grant').value;
    if (document.getElementById('edit-role')) payload.role = document.getElementById('edit-role').value;

    try {
        const res = await fetch('/api/profile/', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken') || ''
            },
            credentials: 'same-origin',
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (res.ok) {
            if (statusEl) {
                statusEl.textContent = '✓ Profile secured.';
                statusEl.className = "text-xs font-bold text-emerald-600";
            }
            setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 3000);
            
            // Re-render with local data for immediate feedback, then reload properly
            currentProfileData = { ...currentProfileData, ...payload };
            currentProfileData.name = `${payload.first_name} ${payload.last_name}`;
            currentProfileData.course_department = payload.program_course;
            currentProfileData.grant_type = payload.grant_type;
            
            if (payload.new_username) {
                currentProfileData.username = payload.new_username;
                // If editing self, update localStorage
                if (VIEWER_USERNAME === currentProfileData.username) {
                    localStorage.setItem("loggedInUsername", payload.new_username);
                }
            }
            
            exitEditMode();
            
            // Re-hide button and re-attach listeners
            const wrapper = document.getElementById('save-btn-wrapper');
            if (wrapper) wrapper.classList.add('hidden');
            attachDirtyListeners();
        } else {
            if (statusEl) {
                statusEl.textContent = '✕ ' + (data.error || data.message || 'Update rejected');
                statusEl.className = "text-xs font-bold text-red-600";
            }
        }
    } catch (err) {
        if (statusEl) {
            statusEl.textContent = '✕ Connection loss.';
            statusEl.className = "text-xs font-bold text-red-600";
        }
    } finally {
        if (saveBtn) saveBtn.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    loadProfile();
});

// Navigation / Utility
document.getElementById("logout")?.addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "/login";
});

document.getElementById("logout-mobile")?.addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "/login";
});