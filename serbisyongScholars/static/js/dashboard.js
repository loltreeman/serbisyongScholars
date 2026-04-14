const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/login";
};

const announcementCategoryStyles = {
    GENERAL: {
        bg: '#dbeafe',
        border: '#bfdbfe',
        badge: '#3b82f6',
        text: '#1e3a8a',
        label: 'General'
    },
    URGENT: {
        bg: '#fee2e2',
        border: '#fecaca',
        badge: '#ef4444',
        text: '#7f1d1d',
        label: 'Urgent'
    },
    VOLUNTEER: {
        bg: '#d1fae5',
        border: '#a7f3d0',
        badge: '#10b981',
        text: '#064e3b',
        label: 'Volunteer Work'
    },
    OPPORTUNITY: {
        bg: '#fef3c7',
        border: '#fde68a',
        badge: '#f59e0b',
        text: '#78350f',
        label: 'Scholarship Opportunity'
    },
    FOODSTUBS: {
        bg: '#ffedd5',
        border: '#fdba74',
        badge: '#f97316',
        text: '#9a3412',
        label: 'Food Stubs'
    }
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
                    '<div class="empty-state">Failed to load dashboard.</div>';
            }
            return;
        }

        const data = await res.json();

        userNameEl.textContent = data.name || username;
        metaEl.textContent = `${data.student_id || "N/A"} • ${
            data.is_dormer ? "Dormer" : "Non-Dormer"
        } • ${data.program || "Loyola Schools"}`;

        const rendered = parseFloat(data.rendered_hours) || 0;
        const required = parseFloat(data.required_hours) || 15;
        const percentage = Math.min((rendered / required) * 100, 100).toFixed(
            1
        );
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

        if (!data.service_logs || data.service_logs.length === 0) {
            logsContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📭</div>
            <div>No service hours recorded yet.</div>
          </div>`;
        } else {
            let html =
                '<table><thead><tr><th>Date</th><th>Activity</th><th>Office</th><th style="text-align: right;">Hours</th><th style="text-align: center;">Status</th></tr></thead><tbody>';
            data.service_logs.forEach((log) => {
                const status = log.status || "Approved";
                const statusClass =
                    status === "Approved"
                        ? "status-approved"
                        : "status-pending";
                html += `
            <tr>
              <td>${log.date}</td>
              <td>${log.activity}</td>
              <td>${log.office}</td>
              <td style="text-align: right; font-weight: 600;">${log.hours}</td>
              <td style="text-align: center;"><span class="status-badge ${statusClass}">${status}</span></td>
            </tr>`;
            });
            html += "</tbody></table>";
            logsContainer.innerHTML = html;
        }
    } catch (err) {
        console.error("Dashboard Load Error:", err);
        logsContainer.innerHTML =
            '<div class="empty-state">Connection Error</div>';
    }
}

async function loadAnnouncements() {
    const container = document.getElementById('announcements-container');
    
    try {
        const accessToken = localStorage.getItem('access');
        const response = await fetch('/api/announcements/', {
            headers: accessToken
                ? { Authorization: `Bearer ${accessToken}` }
                : {},
        });

        if (!response.ok) {
            throw new Error('Failed to fetch announcements');
        }

        const announcements = await response.json();

        if (!announcements || announcements.length === 0) {
            container.innerHTML = '<p class="text-slate-400 text-xs text-center py-4">No recent announcements.</p>';
            return;
        }

        const recentAnnouncements = announcements.slice(0, 2);
        
        container.innerHTML = recentAnnouncements.map(item => {
    const style = announcementCategoryStyles[item.category] || announcementCategoryStyles['GENERAL'];
    
    return `
        <a href="/api/announcements/${item.id}/" 
           class="block p-4 rounded-xl transition hover:shadow-md"
           style="background-color: ${style.bg}; border: 1px solid ${style.border};">
            <span class="text-white text-[10px] font-bold px-2 py-1 rounded uppercase mb-2 inline-block"
                  style="background-color: ${style.badge};">
                ${style.label}
            </span>
            <div class="font-bold text-sm mb-1" style="color: ${style.text};">
                ${item.title}
            </div>
            <p class="text-xs leading-relaxed opacity-80 line-clamp-2" style="color: ${style.text};">
                ${item.content.substring(0, 100)}${item.content.length > 100 ? '...' : ''}
            </p>
            <span class="text-xs font-bold mt-2 inline-block hover:underline" style="color: ${style.badge};">
                Read More
            </span>
        </a>
    `;
}).join('');


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

    /**
 * Load recent vouchers for dashboard widget
 */
async function loadVouchersWidget() {
    const container = document.getElementById('vouchers-widget-container');
    
    if (!container) return; // Widget not on this page
    
    try {
        const response = await fetch('/api/vouchers/', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access')}`
            }
        });
        
        const vouchers = await response.json();

        if (!vouchers || vouchers.length === 0) {
            container.innerHTML = '<p class="text-slate-400 text-xs text-center py-4">No vouchers available.</p>';
            return;
        }

        // Show only first 2 vouchers
        const recentVouchers = vouchers.slice(0, 2);
        
        const categoryColors = {
            'FOODSTUB': { bg: '#fef3c7', border: '#fde68a', badge: '#f59e0b', text: '#78350f' },
            'ENTERTAINMENT': { bg: '#e9d5ff', border: '#d8b4fe', badge: '#a855f7', text: '#581c87' },
            'TRANSPORT': { bg: '#dbeafe', border: '#bfdbfe', badge: '#3b82f6', text: '#1e3a8a' },
            'WELLNESS': { bg: '#d1fae5', border: '#a7f3d0', badge: '#10b981', text: '#064e3b' },
            'ACADEMIC': { bg: '#fee2e2', border: '#fecaca', badge: '#ef4444', text: '#7f1d1d' },
        };

        container.innerHTML = recentVouchers.map(voucher => {
            const colors = categoryColors[voucher.category] || categoryColors['FOODSTUB'];
            const percentage = ((voucher.total_slots - voucher.remaining_slots) / voucher.total_slots * 100).toFixed(0);
            
            return `
                <a href="/api/vouchers-page/" 
                class="block p-4 rounded-xl transition hover:shadow-md"
                style="background-color: ${colors.bg}; border: 1px solid ${colors.border};">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-white text-[10px] font-bold px-2 py-1 rounded uppercase"
                            style="background-color: ${colors.badge};">
                            ${voucher.category.replace('FOODSTUB', 'Food Stub')}
                        </span>
                        <span class="text-xs font-bold" style="color: ${colors.text};">
                            ${voucher.remaining_slots} slots left
                        </span>
                    </div>
                    <div class="font-bold text-sm mb-1" style="color: ${colors.text};">
                        ${voucher.title}
                    </div>
                    <p class="text-xs mb-2" style="color: ${colors.text};">
                        ${voucher.provider}
                    </p>
                    <div class="w-full h-2 bg-white bg-opacity-50 rounded-full overflow-hidden">
                        <div class="h-full transition-all" 
                            style="width: ${percentage}%; background-color: ${colors.badge};"></div>
                    </div>
                </a>
            `;
        }).join('');

    } catch (error) {
        console.error('Error fetching vouchers:', error);
        container.innerHTML = '<p class="text-red-400 text-xs">Failed to load vouchers.</p>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    load(); 
    loadAnnouncements();
    loadVouchersWidget();  
});



