document.addEventListener("DOMContentLoaded", function () {
    console.log("Admin Dashboard Initializing...");
    try {
        bindFilterControls();
        initSemesterManagement();
        loadScholars();
        loadPenaltyLogs();
    } catch (err) {
        console.error("Dashboard initialization failed:", err);
    }
});

function bindFilterControls() {
    const applyButton = document.getElementById("apply-filters");
    const resetButton = document.getElementById("reset-filters");
    const statusFilter = document.getElementById("filter-status");
    const schoolFilter = document.getElementById("filter-school");
    const searchInput = document.getElementById("search-input");
    const penalizedFilter = document.getElementById("filter-penalized");

    if (applyButton) applyButton.addEventListener("click", applyFilters);
    if (resetButton) resetButton.addEventListener("click", resetFilters);
    if (statusFilter) statusFilter.addEventListener("change", applyFilters);
    if (schoolFilter) schoolFilter.addEventListener("change", applyFilters);
    if (penalizedFilter) penalizedFilter.addEventListener("change", applyFilters);

    if (searchInput) {
        searchInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                applyFilters();
            }
        });
    }
}

function getCurrentFilters() {
    const statusEl = document.getElementById("filter-status");
    const schoolEl = document.getElementById("filter-school");
    const searchEl = document.getElementById("search-input");
    const penalizedEl = document.getElementById("filter-penalized");

    return {
        status: statusEl ? statusEl.value : "all",
        school: schoolEl ? schoolEl.value : "all",
        search: searchEl ? searchEl.value.trim() : "",
        penalizedOnly: penalizedEl ? penalizedEl.checked : false
    };
}

function buildQueryString(filters) {
    const params = new URLSearchParams();
    if (filters.status && filters.status !== "all") params.set("status", filters.status);
    if (filters.school && filters.school !== "all") params.set("school", filters.school);
    if (filters.search) params.set("search", filters.search);
    const query = params.toString();
    return query ? `?${query}` : "";
}

async function loadScholars(filters = getCurrentFilters()) {
    console.log("Loading scholars with filters:", filters);
    try {
        showLoading();
        const response = await fetch(`/api/admin/scholars/${buildQueryString(filters)}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem("access")}` },
        });

        if (!response.ok) throw new Error("Failed to load scholars");
        const data = await response.json();
        allScholars = data.scholars || [];
        
        if (filters.penalizedOnly) {
            allScholars = allScholars.filter(s => s.penalty_hours > 0);
        }

        updateStats(data);
        renderTable(allScholars);
        updateFilterSummary(data, filters);

        if (typeof Chart !== "undefined") createCharts(data);
        
        const lastUpdated = document.getElementById("last-updated");
        if (lastUpdated) lastUpdated.textContent = new Date().toLocaleTimeString();
    } catch (error) {
        console.error("Scholar load error:", error);
        showError("Failed to load scholars. Check your connection.");
    }
}

function updateFilterSummary(data, filters) {
    const summary = document.getElementById("filter-summary");
    if (!summary) return;

    const activeFilters = [];
    if (filters.status && filters.status !== "all") activeFilters.push(`status: ${formatStatusLabel(filters.status)}`);
    if (filters.school && filters.school !== "all") activeFilters.push(`school: ${filters.school}`);
    if (filters.search) activeFilters.push(`search: "${filters.search}"`);

    if (activeFilters.length === 0) {
        summary.textContent = `Showing all scholars (${data.total || 0})`;
        return;
    }
    summary.textContent = `Showing ${data.total || 0} scholar(s) filtered by ${activeFilters.join(", ")}`;
}

let activeSemesterId = null;

function initSemesterManagement() {
    loadSemesterSettings();
    initSemesterModal();
    initProcessPenalties();
}

async function loadSemesterSettings() {
    try {
        const response = await fetch('/api/admin/semester-settings/', {
            headers: { Authorization: `Bearer ${localStorage.getItem("access")}` },
        });
        if (response.ok) {
            const data = await response.json();
            const active = data.find(s => s.is_active);
            const infoDiv = document.getElementById('active-semester-info');
            if (active && infoDiv) {
                activeSemesterId = active.id;
                infoDiv.innerHTML = `
                    <span class="font-bold text-gray-900">${active.term_name}</span> 
                    (Deadline: <span class="text-rose-600 font-bold">${new Date(active.deadline_date).toLocaleDateString()}</span>)
                `;
            } else if (infoDiv) {
                infoDiv.textContent = "No active semester set. Please setup a new one.";
            }
        }
    } catch (error) {
        console.error("Failed to load semester settings:", error);
    }
}

function initSemesterModal() {
    const modal = document.getElementById('semester-modal');
    const openBtn = document.getElementById('open-semester-modal');
    const closeBtn = document.getElementById('close-semester-modal');
    const form = document.getElementById('semester-form');

    if (openBtn && modal) {
        openBtn.addEventListener("click", () => {
            console.log("Opening semester modal");
            modal.classList.remove('hidden');
        });
    }
    
    if (closeBtn && modal) {
        closeBtn.addEventListener("click", () => modal.classList.add('hidden'));
    }

    if (form && modal) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const payload = {
                term_name: formData.get('term_name'),
                start_date: formData.get('start_date'),
                end_date: formData.get('end_date'),
                deadline_date: formData.get('deadline_date'),
                is_active: form.elements['is_active'] ? form.elements['is_active'].checked : false
            };

            try {
                const response = await fetch('/api/admin/semester-settings/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCookie('csrftoken'),
                        Authorization: `Bearer ${localStorage.getItem("access")}`,
                    },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    modal.classList.add('hidden');
                    form.reset();
                    loadSemesterSettings();
                    alert("Semester created successfully!");
                } else {
                    const err = await response.json();
                    alert("Error: " + JSON.stringify(err));
                }
            } catch (error) {
                alert("Request failed.");
            }
        });
    }
}

function initProcessPenalties() {
    const btn = document.getElementById('process-deadlines-btn');
    if (btn) {
        btn.addEventListener("click", async () => {
            if (!activeSemesterId) {
                alert("Please select or create an active semester first.");
                return;
            }

            if (!confirm("CRITICAL ACTION: This will evaluate ALL scholars against the deadline. Violators will receive +50 hours penalty and their progress will reset for the new semester. Proceed?")) {
                return;
            }

            try {
                const response = await fetch('/api/admin/process-penalties/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCookie('csrftoken'),
                        Authorization: `Bearer ${localStorage.getItem("access")}`,
                    },
                    body: JSON.stringify({ semester_id: activeSemesterId })
                });

                const data = await response.json();
                if (response.ok) {
                    alert(`${data.message}`);
                    loadScholars(); 
                    loadPenaltyLogs();
                } else {
                    alert(`Action denied: ${data.error || JSON.stringify(data)}`);
                }
            } catch (error) {
                alert("Failed to process penalties.");
            }
        });
    }
}

/**
 * Get CSRF token from cookie
 */
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

function createMiniProgress(percentage) {
    const color = getProgressBarColor(percentage);
    return `
        <div class="flex items-center">
            <div class="w-24 bg-gray-200 rounded-full h-2 mr-2">
                <div class="${color} h-2 rounded-full" style="width: ${Math.min(
        percentage,
        100
    )}%"></div>
            </div>
            <span class="text-xs text-gray-600">${percentage}%</span>
        </div>
    `;
}

function updateStats(data) {
    document.getElementById("stat-total").textContent = data.total || 0;
    document.getElementById(
        "stat-completion"
    ).textContent = data.completion_rate
        ? `${data.completion_rate.toFixed(1)}%`
        : "0%";
    document.getElementById("stat-behind").textContent = data.behind || 0;
    document.getElementById("stat-average").textContent = data.average_hours
        ? `${data.average_hours.toFixed(1)}h`
        : "0h";
}

function renderTable(scholars) {
    const tbody = document.getElementById("scholar-table");

    if (!scholars || scholars.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="px-6 py-12 text-center text-gray-500">
                    No scholars found
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = "";

    scholars.forEach((scholar) => {
        const percentage = calculatePercentage(
            scholar.rendered_hours,
            scholar.required_hours
        );
        const status = getStatusByKey(scholar.status || getStatusKey(percentage));

        const row = document.createElement("tr");
        const hasPenalty = scholar.penalty_hours > 0;
        
        row.className = `hover:bg-gray-50 transition ${hasPenalty ? 'bg-rose-50' : ''}`;
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                <div class="flex items-center gap-2">
                    ${hasPenalty ? '<span class="flex h-2 w-2 rounded-full bg-rose-600 animate-pulse" title="Penalized"></span>' : ''}
                    ${scholar.student_id}
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${scholar.name}
                ${hasPenalty ? `<div class="text-[10px] font-bold text-rose-600">INCLUDES +${scholar.penalty_hours}h PENALTY</div>` : ''}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${scholar.school_display || "Not Set"}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${scholar.program || "N/A"}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                ${createMiniProgress(percentage)}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                <span class="${hasPenalty ? 'text-rose-600 font-bold' : ''}">
                    ${scholar.rendered_hours}/${scholar.required_hours}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    status.bgColor
                } ${status.textColor}">
                    ${status.text}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">
                <div class="flex gap-2">
                    <button onclick="viewScholarDetails('${scholar.student_id}')" 
                            class="text-blue-600 hover:text-blue-900 font-medium">
                        View
                    </button>
                </div>
            </td>
        `;

        tbody.appendChild(row);
    });
}

async function loadPenaltyLogs() {
    const tbody = document.getElementById('penalty-log-table');
    if (!tbody) return;

    try {
        const response = await fetch('/api/penalties/', {
            headers: {
                Authorization: `Bearer ${localStorage.getItem("access")}`,
            },
        });

        if (response.ok) {
            const data = await response.json();
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500 text-sm">No penalties issued yet.</td></tr>';
                return;
            }

            tbody.innerHTML = '';
            data.forEach(log => {
                const row = document.createElement('tr');
                row.className = 'hover:bg-gray-50 transition';
                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${new Date(log.created_at).toLocaleDateString()}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        ${log.scholar_name || 'Scholar'}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title="${log.reason}">
                        ${log.reason}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-rose-600 font-bold">
                        +${log.hours_added}h
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 py-1 text-xs font-semibold rounded-full ${log.status === 'ACTIVE' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}">
                            ${log.status}
                        </span>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }
    } catch (error) {
        console.error("Failed to load penalty logs:", error);
    }
}

function applyFilters() {
    loadScholars(getCurrentFilters());
}

function resetFilters() {
    document.getElementById("filter-status").value = "all";
    document.getElementById("filter-school").value = "all";
    document.getElementById("search-input").value = "";
    loadScholars(getCurrentFilters());
}

function calculatePercentage(rendered, required) {
    if (!required || required === 0) return 0;
    return Math.round((rendered / required) * 100);
}

function getStatus(percentage) {
    if (percentage >= 100) {
        return {
            text: "Complete",
            bgColor: "bg-green-100",
            textColor: "text-green-800",
        };
    } else if (percentage >= 70) {
        return {
            text: "On Track",
            bgColor: "bg-yellow-100",
            textColor: "text-yellow-800",
        };
    } else {
        return {
            text: "Behind",
            bgColor: "bg-red-100",
            textColor: "text-red-800",
        };
    }
}

function getStatusByKey(statusKey) {
    if (statusKey === "complete") {
        return {
            text: "Complete",
            bgColor: "bg-green-100",
            textColor: "text-green-800",
        };
    }

    if (statusKey === "on-track") {
        return {
            text: "On Track",
            bgColor: "bg-yellow-100",
            textColor: "text-yellow-800",
        };
    }

    return {
        text: "Behind",
        bgColor: "bg-red-100",
        textColor: "text-red-800",
    };
}

function getStatusKey(percentage) {
    if (percentage >= 100) return "complete";
    if (percentage >= 70) return "on-track";
    return "behind";
}

function formatStatusLabel(statusKey) {
    return getStatusByKey(statusKey).text;
}

function getProgressBarColor(percentage) {
    if (percentage >= 100) return "bg-green-600";
    if (percentage >= 70) return "bg-yellow-500";
    return "bg-red-600";
}

function viewScholarDetails(studentId) {
    window.open(`/profile?student_id=${studentId}`, "_blank");

}

function showLoading() {
    const tbody = document.getElementById("scholar-table");
    tbody.innerHTML = `
        <tr>
            <td colspan="8" class="px-6 py-12 text-center">
                <div class="flex flex-col items-center">
                    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                    <p class="text-gray-500">Loading scholars...</p>
                </div>
            </td>
        </tr>
    `;
}

function showError(message) {
    const tbody = document.getElementById("scholar-table");
    tbody.innerHTML = `
        <tr>
            <td colspan="8" class="px-6 py-12 text-center text-red-600">
                ${message}
            </td>
        </tr>
    `;
}

/**
 * Create charts
 */
function createCharts(data) {
    // Destroy existing charts if they exist
    if (window.distributionChart) window.distributionChart.destroy();
    if (window.officeChart) window.officeChart.destroy();
    if (window.dormerChart) window.dormerChart.destroy();

    const distributionCtx = document.getElementById('distribution-chart');
    if (distributionCtx) {
        window.distributionChart = new Chart(distributionCtx, {
            type: 'doughnut',
            data: {
                labels: ['Complete', 'On Track', 'Behind'],
                datasets: [{
                    data: [data.complete || 0, data.on_track || 0, data.behind || 0],
                    backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, 
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 10,
                            font: { size: 11 },
                            boxWidth: 12
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = data.total || 1;
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    const dormerCtx = document.getElementById('dormer-chart');
    if (dormerCtx) {
        window.dormerChart = new Chart(dormerCtx, {
            type: 'doughnut',
            data: {
                labels: ['Dormers (15hrs)', 'Non-Dormers (10hrs)'],
                datasets: [{
                    data: [data.dormer_count || 0, data.non_dormer_count || 0],
                    backgroundColor: ['#3b82f6', '#10b981'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,  
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 10,
                            font: { size: 11 },
                            boxWidth: 12
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = (data.dormer_count || 0) + (data.non_dormer_count || 0);
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    const officeCtx = document.getElementById('office-chart');
    if (officeCtx && data.office_stats) {
        const officeNames = data.office_stats.map(stat => stat.office_name);
        const officeHours = data.office_stats.map(stat => stat.total_hours);
        
        window.officeChart = new Chart(officeCtx, {
            type: 'bar',
            data: {
                labels: officeNames,
                datasets: [{
                    label: 'Total Hours',
                    data: officeHours,
                    backgroundColor: '#3b82f6',
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',  
                responsive: true,
                maintainAspectRatio: false,  
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.parsed.x} hours`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value + 'h';
                            },
                            font: { size: 11 }
                        },
                        grid: { color: '#e5e7eb' }
                    },
                    y: {
                        grid: { display: false },
                        ticks: {
                            font: { size: 11 }
                        }
                    }
                }
            }
        });
    }
}
