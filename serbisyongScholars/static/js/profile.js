// profile.js handles loading and (optionally) editing a user's profile

const loggedInUsername = localStorage.getItem("loggedInUsername");
const currentUserRole = localStorage.getItem("userRole");
const container = document.getElementById("profile-container");

// allow visiting another user's profile by query parameter
const params = new URLSearchParams(window.location.search);
const username = params.get('username') || loggedInUsername;

if (!username) {
    container.innerHTML = '<div class="empty-state p-6 text-center text-slate-500">No user specified. Append ?username=... to the URL or log in.</div>';
}

async function loadProfile() {
    try {
        const res = await fetch(`/api/profile/?username=${encodeURIComponent(username)}`);

        if (!res.ok) {
            container.innerHTML = '<div class="empty-state p-6 text-center text-slate-500">Profile not found.</div>';
            return;
        }

        const data = await res.json();
        renderProfile(data);
    } catch (err) {
        console.error("Profile load error", err);
        container.innerHTML = '<div class="empty-state p-6 text-center text-red-500">❌ Connection Error</div>';
    }
}

function renderProfile(data) {
    // Math for the progress bar
    const rendered = data.hours_rendered || 0;
    const required = data.hours_required || 15; // Defaulting to 15 if not provided
    const overflow = data.overflow_hours || 0;
    const remaining = Math.max(required - rendered, 0);
    const percentage = Math.min((rendered / required) * 100, 100).toFixed(0);

    let html = `
        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-lg font-bold text-slate-800">User Details</h2>
                <button class="flex items-center gap-2 px-3 py-1.5 border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    Edit Profile
                </button>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
                <div>
                    <p class="text-xs text-slate-500 mb-1">Name</p>
                    <p class="font-semibold text-slate-900">${data.name || data.username}</p>
                </div>
                <div>
                    <p class="text-xs text-slate-500 mb-1">ID Number</p>
                    <p class="font-semibold text-slate-900">${data.student_id || 'N/A'}</p>
                </div>
                <div>
                    <p class="text-xs text-slate-500 mb-1">Email</p>
                    <p class="font-semibold text-slate-900">${data.email || 'user@student.ateneo.edu'}</p>
                </div>
                <div>
                    <p class="text-xs text-slate-500 mb-1">Role</p>
                    <span id="role-display" class="inline-block bg-[#eab308] text-white text-xs font-bold px-2 py-1 rounded-md">${data.role || 'Scholar'}</span>
                </div>
                <div>
                    <p class="text-xs text-slate-500 mb-1">Scholar Type</p>
                    <p class="font-semibold text-slate-900">${data.grant_type || 'Regular'}</p>
                </div>
                <div>
                    <p class="text-xs text-slate-500 mb-1">Dormer Status</p>
                    <p class="font-semibold text-slate-900">${data.dormer_status ? 'Yes' : 'No'}</p>
                </div>
            </div>
    `;

    // Admin Role Editor injection
    if (currentUserRole === 'ADMIN') {
        html += `
            <div class="mt-6 pt-6 border-t border-slate-100">
                <label class="block text-sm font-medium text-slate-700">Change Role (Admin Only)</label>
                <div class="flex items-center gap-3 mt-2">
                    <select id="role-select" class="block w-48 rounded-md border-gray-300 shadow-sm px-3 py-2 border">
                        <option value="SCHOLAR">Scholar</option>
                        <option value="MODERATOR">Moderator</option>
                        <option value="ADMIN">Admin</option>
                    </select>
                    <button id="save-btn" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition">Save</button>
                </div>
                <div id="save-status" class="text-sm mt-2 font-medium"></div>
            </div>
        `;
    }

    html += `</div>`; // Close Card 1

    // CARD 2: Service Hours Summary
    html += `
        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6">
            <div class="flex items-center gap-2 mb-6 text-slate-800">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"></path></svg>
                <h3 class="text-lg font-bold">Service Hours Summary</h3>
            </div>
            <div class="grid grid-cols-3 gap-4 text-center">
                <div>
                    <p class="text-3xl font-bold text-[#1e3a8a]">${rendered}</p>
                    <p class="text-xs text-slate-500 mt-1">Hours Rendered</p>
                </div>
                <div>
                    <p class="text-3xl font-bold text-slate-600">${required}</p>
                    <p class="text-xs text-slate-500 mt-1">Hours Required</p>
                </div>
                <div>
                    <p class="text-3xl font-bold text-green-600">${overflow}</p>
                    <p class="text-xs text-slate-500 mt-1">Overflow Hours</p>
                </div>
            </div>
        </div>
    `;

    // CARD 3: Service Hour Progress
    html += `
        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6">
            <div class="flex items-center gap-2 mb-6 text-slate-800">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                <h3 class="text-lg font-bold">Service Hour Progress</h3>
            </div>
            
            <div class="flex justify-between items-end mb-3">
                <div>
                    <p class="text-2xl font-bold text-slate-900">${rendered} / ${required} Hours</p>
                    <p class="text-sm text-slate-500">${remaining} hours remaining</p>
                </div>
                <div class="text-right">
                    <p class="text-2xl font-bold text-slate-900">${percentage}%</p>
                    <p class="text-sm text-slate-500">Complete</p>
                </div>
            </div>
            
            <div class="w-full bg-slate-100 rounded-full h-5 mb-3 flex overflow-hidden">
                <div class="bg-[#0f172a] h-5 rounded-r-full flex items-center justify-end px-2" style="width: ${percentage}%">
                    <span class="text-[10px] text-white font-bold">${rendered}h</span>
                </div>
            </div>
            
            <div class="flex items-center justify-center gap-2 text-xs text-slate-500 mt-4">
                <div class="w-4 h-3 bg-[#0f172a] rounded-sm"></div>
                <span>Required Hours</span>
            </div>
        </div>
    `;

    // CARD 4: Service History
    if (data.service_logs && data.service_logs.length > 0) {
        html += `
            <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 class="text-lg font-bold mb-4 text-slate-800">Service Hours History</h3>
                <div class="overflow-x-auto">
                    <table class="w-full text-sm text-left">
                        <thead class="text-slate-500 border-b border-slate-200">
                            <tr>
                                <th class="pb-3 font-medium">Date</th>
                                <th class="pb-3 font-medium">Activity</th>
                                <th class="pb-3 font-medium">Office</th>
                                <th class="pb-3 font-medium text-center">Hours</th>
                                <th class="pb-3 font-medium text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
        `;
        data.service_logs.forEach(log => {
            html += `
                <tr>
                    <td class="py-4 font-medium text-slate-900">${log.date}</td>
                    <td class="py-4 text-slate-700">${log.activity}</td>
                    <td class="py-4 text-slate-700">${log.office}</td>
                    <td class="py-4 text-center font-semibold text-slate-900">${log.hours}h</td>
                    <td class="py-4 text-center">
                        <span class="inline-flex items-center gap-1 bg-[#0f172a] text-white text-[11px] font-bold px-2 py-1 rounded-full">
                            <div class="w-3 h-3 bg-emerald-400 rounded-full flex items-center justify-center">
                                <svg class="w-2 h-2 text-[#0f172a]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                            </div>
                            ${log.status || 'Approved'}
                        </span>
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

    container.innerHTML = html;

    if (currentUserRole === 'ADMIN') {
        document.getElementById('role-select').value = data.role;
        document.getElementById('save-btn').addEventListener('click', handleSave);
    }
}

async function handleSave() {
    const newRole = document.getElementById('role-select').value;
    const statusEl = document.getElementById('save-status');
    statusEl.textContent = 'Saving...';
    statusEl.className = "text-sm mt-2 font-medium text-slate-500";

    try {
        const res = await fetch('/api/profile/', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('access')}`
            },
            body: JSON.stringify({ username, role: newRole })
        });
        const data = await res.json();
        if (res.ok) {
            statusEl.textContent = 'Saved successfully.';
            statusEl.className = "text-sm mt-2 font-medium text-emerald-600";
            document.getElementById('role-display').textContent = newRole;
        } else {
            statusEl.textContent = data.error || data.message || 'Update failed.';
            statusEl.className = "text-sm mt-2 font-medium text-red-600";
        }
    } catch (err) {
        console.error('Save error', err);
        statusEl.textContent = 'Connection error.';
        statusEl.className = "text-sm mt-2 font-medium text-red-600";
    }
}

document.getElementById("logout").addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "/login";
});
document.getElementById("logout-mobile").addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "/login";
});

loadProfile();