let allScholars = [];
let filteredScholars = [];

// Load scholars when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadScholars();
});

/**
 * Fetch all scholars from backend API
 */
async function loadScholars() {
    try {
        showLoading();
        
        const response = await fetch('/api/admin/scholars/', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access')}`
            }
        });

        if (response.status === 401 || response.status === 403) {
        // If token is missing or user isn't an ADMIN, send them back to login
        window.location.href = '/login/';
        }
        
        if (!response.ok) {
            throw new Error('Failed to load scholars');
        }
        
        const data = await response.json();
        
        allScholars = data.scholars;
        filteredScholars = allScholars;
        
        updateStats(data);
        renderTable(filteredScholars);
        
    } catch (error) {
        console.error('Error loading scholars:', error);
        showError('Failed to load scholars. Please try again.');
    }
}

/**
 * Update stats cards
 */
function updateStats(data) {
    document.getElementById('stat-total').textContent = data.total || 0;
    document.getElementById('stat-completion').textContent = 
        data.completion_rate ? `${data.completion_rate.toFixed(1)}%` : '0%';
    document.getElementById('stat-behind').textContent = data.behind || 0;
    document.getElementById('stat-average').textContent = 
        data.average_hours ? `${data.average_hours.toFixed(1)}h` : '0h';
}

/**
 * Render scholar table
 */
function renderTable(scholars) {
    const tbody = document.getElementById('scholar-table');
    
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
    
    tbody.innerHTML = '';
    
    scholars.forEach(scholar => {
        const percentage = calculatePercentage(scholar.rendered_hours, scholar.required_hours);
        const status = getStatus(percentage);
        
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 transition';
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                ${scholar.student_id}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${scholar.name}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${scholar.program || 'N/A'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="w-full">
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-xs text-gray-600">${percentage}%</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                        <div class="h-2 rounded-full ${getProgressBarColor(percentage)}" 
                             style="width: ${Math.min(percentage, 100)}%"></div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${scholar.rendered_hours}/${scholar.required_hours}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${status.bgColor} ${status.textColor}">
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

/**
 * Apply filters
 */
function applyFilters() {
    const statusFilter = document.getElementById('filter-status').value;
    const schoolFilter = document.getElementById('filter-school').value;
    const searchQuery = document.getElementById('search-input').value.toLowerCase().trim();
    
    filteredScholars = allScholars.filter(scholar => {
        // Filter by status
        if (statusFilter !== 'all') {
            const percentage = calculatePercentage(scholar.rendered_hours, scholar.required_hours);
            const status = getStatusKey(percentage);
            if (status !== statusFilter) return false;
        }
        
        // Filter by school
        if (schoolFilter !== 'all') {
            if (scholar.school !== schoolFilter) return false;
        }
        
        // Search filter
        if (searchQuery) {
            const matchesName = scholar.name.toLowerCase().includes(searchQuery);
            const matchesID = scholar.student_id.toLowerCase().includes(searchQuery);
            if (!matchesName && !matchesID) return false;
        }
        
        return true;
    });
    
    renderTable(filteredScholars);
}

/**
 * Helper: Calculate percentage
 */
function calculatePercentage(rendered, required) {
    if (!required || required === 0) return 0;
    return Math.round((rendered / required) * 100);
}

/**
 * Helper: Get status object
 */
function getStatus(percentage) {
    if (percentage >= 100) {
        return {
            text: 'Complete',
            bgColor: 'bg-green-100',
            textColor: 'text-green-800'
        };
    } else if (percentage >= 70) {
        return {
            text: 'On Track',
            bgColor: 'bg-yellow-100',
            textColor: 'text-yellow-800'
        };
    } else {
        return {
            text: 'Behind',
            bgColor: 'bg-red-100',
            textColor: 'text-red-800'
        };
    }
}

/**
 * Helper: Get status key for filtering
 */
function getStatusKey(percentage) {
    if (percentage >= 100) return 'complete';
    if (percentage >= 70) return 'on-track';
    return 'behind';
}

/**
 * Helper: Get progress bar color
 */
function getProgressBarColor(percentage) {
    if (percentage >= 100) return 'bg-green-600';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-red-600';
}

/**
 * View scholar details
 */
function viewScholarDetails(studentId) {
    window.location.href = `/scholar/${studentId}/profile/`;
}

/**
 * Show loading state
 */
function showLoading() {
    const tbody = document.getElementById('scholar-table');
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

/**
 * Show error message
 */
function showError(message) {
    const tbody = document.getElementById('scholar-table');
    tbody.innerHTML = `
        <tr>
            <td colspan="7" class="px-6 py-12 text-center text-red-600">
                ${message}
            </td>
        </tr>
    `;
}

/**
 * Logout function
 */
function logout() {
    localStorage.clear();
    window.location.href = '/login/';
}