// profile.js handles loading and (optionally) editing a user's profile

const loggedInUsername = localStorage.getItem("loggedInUsername");
const currentUserRole = localStorage.getItem("userRole");
const container = document.getElementById("profile-container");

// Allow visiting another user's profile by query parameter
const params = new URLSearchParams(window.location.search);
const username = params.get('username');
const studentId = params.get('student_id');  // ← ADD THIS

// Use student_id OR username OR logged in user
const profileIdentifier = studentId || username || loggedInUsername;

if (!profileIdentifier) {
    container.innerHTML = '<div class="empty-state p-6 text-center text-slate-500">No user specified. Please log in or provide username/student_id.</div>';
}

async function loadProfile() {
    try {
        // Build API URL based on what parameter we have
        let apiUrl;
        if (studentId) {
            apiUrl = `/api/profile/?student_id=${encodeURIComponent(studentId)}`;
        } else if (username) {
            apiUrl = `/api/profile/?username=${encodeURIComponent(username)}`;
        } else {
            apiUrl = `/api/profile/?username=${encodeURIComponent(loggedInUsername)}`;
        }

        const res = await fetch(apiUrl);

        if (!res.ok) {
            container.innerHTML = '<div class="empty-state p-6 text-center text-slate-500">Profile not found.</div>';
            return;
        }

        const data = await res.json();
        console.log('Profile data:', data); // Debug: see what API returns
        renderProfile(data);
    } catch (err) {
        console.error("Profile load error", err);
        container.innerHTML = '<div class="empty-state p-6 text-center text-red-500">❌ Connection Error</div>';
    }
}

function renderProfile(data) {
    const rendered = data.total_hours_rendered || 0;
    const required = data.required_hours || 10;
    const carryOver = data.carry_over_hours || 0;
    const remaining = Math.max(required - rendered, 0);
    const percentage = Math.min((rendered / required) * 100, 100).toFixed(0);

    let html = `
        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-lg font-bold text-slate-800">User Details</h2>
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
                    <p class="font-semibold text-slate-900">${data.email || 'N/A'}</p>
                </div>
                <div>
                    <p class="text-xs text-slate-500 mb-1">Role</p>
                    <span id="role-display" class="inline-block bg-[#eab308] text-white text-xs font-bold px-2 py-1 rounded-md">${data.role || 'Scholar'}</span>
                </div>
                <div>
                    <p class="text-xs text-slate-500 mb-1">Course/Department</p>
                    <p class="font-semibold text-slate-900">${data.course_department || 'N/A'}</p>
                </div>
                <div>
                    <p class="text-xs text-slate-500 mb-1">Grant Type</p>
                    <p class="font-semibold text-slate-900">${data.grant_type || 'N/A'}</p>
                </div>
            </div>
        </div>
    `;

    // Only show service hours for scholars
    if (data.role === 'SCHOLAR') {
        html += `
            <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6">
                <h3 class="text-lg font-bold mb-4">Service Hours Summary</h3>
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
                        <p class="text-3xl font-bold text-green-600">${carryOver}</p>
                        <p class="text-xs text-slate-500 mt-1">Carry Over Hours</p>
                    </div>
                </div>
            </div>

            <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6">
                <h3 class="text-lg font-bold mb-4">Service Hour Progress</h3>
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
                <div class="w-full bg-slate-100 rounded-full h-5 mb-3">
                    <div class="bg-[#0f172a] h-5 rounded-full" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;

        // Service logs table
        if (data.service_logs && data.service_logs.length > 0) {
            html += `
                <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 class="text-lg font-bold mb-4">Service Hours History</h3>
                    <table class="w-full">
                        <thead>
                            <tr class="border-b">
                                <th class="text-left pb-3">Date</th>
                                <th class="text-left pb-3">Activity</th>
                                <th class="text-left pb-3">Office</th>
                                <th class="text-center pb-3">Hours</th>
                                <th class="text-center pb-3">Status</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            data.service_logs.forEach(log => {
                html += `
                    <tr class="border-b">
                        <td class="py-3">${log.date}</td>
                        <td class="py-3">${log.activity}</td>
                        <td class="py-3">${log.office}</td>
                        <td class="py-3 text-center font-bold">${log.hours}h</td>
                        <td class="py-3 text-center">
                            <span class="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">
                                ${log.status}
                            </span>
                        </td>
                    </tr>
                `;
            });
            html += `
                        </tbody>
                    </table>
                </div>
            `;
        }
    }

    container.innerHTML = html;
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

document.addEventListener('DOMContentLoaded', function() {
    loadProfile();
});

document.getElementById("logout")?.addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "/login";
});

document.getElementById("logout-mobile")?.addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "/login";
});