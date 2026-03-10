const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/login";
};

const username = localStorage.getItem("loggedInUsername");
if (!username || username === "null") {
    handleLogout(); 
}

const metaEl = document.getElementById("meta");
const userNameEl = document.getElementById("user-name");
const logsContainer = document.getElementById("logs-container");
const statRendered = document.getElementById("stat-rendered");
const statActivities = document.getElementById("stat-activities");
const statTotal = document.getElementById("stat-total");
const progressRendered = document.getElementById("progress-rendered");
const progressRequired = document.getElementById("progress-required");
const progressPercent = document.getElementById("progress-percent");
const progressBar = document.getElementById("progress-bar");
const hoursRemaining = document.getElementById("hours-remaining");

async function load() {
    try {
        const res = await fetch(
            `/api/scholar/dashboard/?username=${encodeURIComponent(username)}`
        );

        if (!res.ok) {
            if (res.status === 404) {
                logsContainer.innerHTML =
                    '<div class="empty-state">User profile not found.</div>';
            } else {
                logsContainer.innerHTML =
                    '<div class="empty-state">⚠️ Failed to load dashboard.</div>';
            }
            return;
        }

        const data = await res.json();

        // --- Rendering Logic for Stats ---
        userNameEl.textContent = data.name || username;
        metaEl.textContent = `${data.student_id || "N/A"} • ${
            data.is_dormer ? "Dormer" : "Non-Dormer"
        } • ${data.program || "Loyola Schools"}`;

        const rendered = parseFloat(data.rendered_hours) || 0;
        const required = parseFloat(data.required_hours) || 15;
        const percentage = Math.min((rendered / required) * 100, 100).toFixed(1);
        const remaining = Math.max(required - rendered, 0);
        const activities = data.service_logs ? data.service_logs.length : 0;

        statRendered.textContent = rendered;
        statActivities.textContent = activities;
        statTotal.textContent = rendered + "h";
        progressRendered.textContent = rendered;
        progressRequired.textContent = required;
        progressPercent.textContent = percentage + "%";
        progressBar.style.width = percentage + "%";
        hoursRemaining.textContent = remaining;

        if (percentage >= 100) {
            progressPercent.classList.add("complete");
            progressBar.classList.add("complete");
        }

        // --- Rendering Logic for Service Logs Table ---
        if (!data.service_logs || data.service_logs.length === 0) {
            logsContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📭</div>
            <div>No service hours recorded yet.</div>
          </div>`;
        } else {
            const userRole = localStorage.getItem("userRole"); //
            let html = `
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Activity</th>
                            <th>Office</th>
                            <th style="text-align: right;">Hours</th>
                            <th style="text-align: center;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>`;

            data.service_logs.forEach((log) => {
                // Calculate the 7-day window if created_at is provided by backend
                const createdAt = new Date(log.created_at);
                const now = new Date();
                const diffInDays = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
                const withinWindow = diffInDays <= 7;

                // Determine permission logic
                const canManage = (userRole === 'ADMIN' || (userRole === 'MODERATOR' && withinWindow));

                html += `
                    <tr>
                      <td>${log.date}</td>
                      <td>${log.activity}</td>
                      <td>${log.office}</td>
                      <td style="text-align: right; font-weight: 600;">${log.hours}</td>
                      <td style="text-align: center;">
                        ${canManage ? `
                            <button onclick="editLog(${log.id})" class="text-blue-600 hover:underline">Edit</button>
                            <button onclick="deleteLog(${log.id})" class="text-red-600 hover:underline ml-2">Delete</button>
                        ` : `
                            <span class="text-gray-400 italic text-xs">Locked</span>
                        `}
                      </td>
                    </tr>`;
            });

            html += "</tbody></table>";
            logsContainer.innerHTML = html;
        }
    } catch (err) {
        console.error("Dashboard Load Error:", err);
        logsContainer.innerHTML =
            '<div class="empty-state">❌ Connection Error</div>';
    }
}

async function loadAnnouncements() {
    const container = document.getElementById('announcements-container');
    
    try {
        const response = await fetch('/api/announcements/?limit=2'); // Fetch only the 2 latest
        const announcements = await response.json();

        if (announcements.length === 0) {
            container.innerHTML = '<p class="text-slate-400 text-xs text-center py-4">No recent announcements.</p>';
            return;
        }

        // Clear loading state and map through data
        container.innerHTML = announcements.map(item => `
            <div class="bg-amber-50 border border-amber-100 p-4 rounded-xl transition hover:shadow-md">
                <span class="bg-${item.tag_color || 'amber'}-500 text-white text-[10px] font-bold px-2 py-1 rounded uppercase mb-2 inline-block">
                    ${item.tag_name}
                </span>
                <div class="font-bold text-amber-900 text-sm mb-1">${item.title}</div>
                <p class="text-amber-800 text-xs leading-relaxed opacity-80 line-clamp-2">
                    ${item.content}
                </p>
                <a href="/announcements/${item.id}" class="text-amber-600 text-xs font-bold mt-2 inline-block hover:underline">Read More →</a>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error fetching announcements:', error);
        container.innerHTML = '<p class="text-red-400 text-xs">Failed to load announcements.</p>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    load(); 
    loadAnnouncements(); 
});

document.getElementById("logout").addEventListener("click", handleLogout);
document
    .getElementById("logout-mobile")
    .addEventListener("click", handleLogout);

load();
