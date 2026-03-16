let allScholars = [];
let filteredScholars = [];

document.addEventListener("DOMContentLoaded", function () {
    loadScholars();
});

async function loadScholars() {
    try {
        showLoading();

        const response = await fetch("/api/admin/scholars/", {
            headers: {
                Authorization: `Bearer ${localStorage.getItem("access")}`, // Ensure this is 'access'
            },
        });

        if (!response.ok) throw new Error("Failed to load scholars");

        const data = await response.json();

        allScholars = data.scholars || [];
        filteredScholars = allScholars;

        updateStats(data);
        renderTable(filteredScholars);

        if (typeof Chart !== "undefined") {
            createCharts(data);
        }

        const now = new Date();
        document.getElementById(
            "last-updated"
        ).textContent = now.toLocaleTimeString();
    } catch (error) {
        console.error("JS CRASHED HERE:", error);
        showError("Failed to load scholars. Please try again.");
    }
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
                <td colspan="7" class="px-6 py-12 text-center text-gray-500">
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
        const status = getStatus(percentage);

        const row = document.createElement("tr");
        row.className = "hover:bg-gray-50 transition";
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                ${scholar.student_id}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${scholar.name}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${scholar.program || "N/A"}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                ${createMiniProgress(percentage)}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${scholar.rendered_hours}/${scholar.required_hours}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    status.bgColor
                } ${status.textColor}">
                    ${status.text}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">
                <button onclick="viewScholarDetails('${scholar.student_id}')" 
                        class="text-blue-600 hover:text-blue-900 font-medium">
                    View Details
                </button>
            </td>
        `;

        tbody.appendChild(row);
    });
}

function applyFilters() {
    const statusFilter = document.getElementById("filter-status").value;
    const schoolFilter = document.getElementById("filter-school").value;
    const searchQuery = document
        .getElementById("search-input")
        .value.toLowerCase()
        .trim();

    filteredScholars = allScholars.filter((scholar) => {
        if (statusFilter !== "all") {
            const percentage = calculatePercentage(
                scholar.rendered_hours,
                scholar.required_hours
            );
            const status = getStatusKey(percentage);
            if (status !== statusFilter) return false;
        }


        if (schoolFilter !== "all") {
            if (scholar.school !== schoolFilter) return false;
        }

        if (searchQuery) {
            const matchesName = scholar.name
                .toLowerCase()
                .includes(searchQuery);
            const matchesID = scholar.student_id
                .toLowerCase()
                .includes(searchQuery);
            if (!matchesName && !matchesID) return false;
        }

        return true;
    });

    renderTable(filteredScholars);
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

function getStatusKey(percentage) {
    if (percentage >= 100) return "complete";
    if (percentage >= 70) return "on-track";
    return "behind";
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
            <td colspan="7" class="px-6 py-12 text-center">
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
            <td colspan="7" class="px-6 py-12 text-center text-red-600">
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
