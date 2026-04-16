const auditTableBody = document.getElementById('audit-table-body');
const auditCount = document.getElementById('audit-count');
const searchInput = document.getElementById('search-input');
const officeInput = document.getElementById('office-input');
const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');
const refreshButton = document.getElementById('refresh-button');
const clearFiltersButton = document.getElementById('clear-filters');

function buildQueryString() {
    const params = new URLSearchParams();
    const search = searchInput.value.trim();
    const office = officeInput.value.trim();
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;

    if (search) params.set('search', search);
    if (office) params.set('office', office);
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);

    const query = params.toString();
    return query ? `?${query}` : '';
}

function setLoadingState() {
    auditTableBody.innerHTML = `
        <tr>
            <td colspan="9" class="px-5 py-16 text-center text-slate-500">
                Loading audit entries...
            </td>
        </tr>
    `;
}

function setEmptyState() {
    auditTableBody.innerHTML = `
        <tr>
            <td colspan="9" class="px-5 py-16 text-center text-slate-500">
                No audit entries found for the current filter.
            </td>
        </tr>
    `;
}

function setErrorState(message) {
    auditTableBody.innerHTML = `
        <tr>
            <td colspan="9" class="px-5 py-16 text-center text-red-600">
                ${message}
            </td>
        </tr>
    `;
}

function formatDate(value) {
    if (!value) return '-';
    try {
        const date = new Date(value);
        return date.toLocaleDateString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    } catch (err) {
        return value;
    }
}

function formatDateTime(value) {
    if (!value) return '-';
    try {
        const date = new Date(value);
        return date.toLocaleString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    } catch (err) {
        return value;
    }
}

async function loadAuditLogs() {
    setLoadingState();

    const accessToken = localStorage.getItem('access');
    if (!accessToken) {
        setErrorState('Authentication required. Please log in again.');
        return;
    }

    try {
        const response = await fetch(`/api/admin/audit-logs/${buildQueryString()}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            if (response.status === 403) {
                setErrorState('Access denied. Only admins may view audit logs.');
                return;
            }
            throw new Error('Unable to fetch audit logs.');
        }

        const data = await response.json();
        const logs = data.logs || [];
        auditCount.textContent = logs.length;

        if (!logs.length) {
            setEmptyState();
            return;
        }

        auditTableBody.innerHTML = logs.map(log => `
            <tr class="border-t border-slate-100 hover:bg-slate-50">
                <td class="px-5 py-4 text-sm text-slate-700">${formatDate(log.date_rendered)}</td>
                <td class="px-5 py-4 text-sm text-slate-700">${log.scholar_name || 'N/A'}</td>
                <td class="px-5 py-4 text-sm text-slate-700">${log.student_id}</td>
                <td class="px-5 py-4 text-sm text-slate-700">${log.office_name}</td>
                <td class="px-5 py-4 text-sm text-slate-700">${log.activity_description}</td>
                <td class="px-5 py-4 text-sm text-slate-700 text-center">${log.hours}</td>
                <td class="px-5 py-4 text-sm text-slate-700">${log.submitted_by}</td>
                <td class="px-5 py-4 text-sm text-slate-700">${formatDateTime(log.created_at)}</td>
                <td class="px-5 py-4 text-sm text-slate-700">${formatDateTime(log.updated_at)}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error(error);
        setErrorState('Failed to load audit logs. Please refresh the page.');
    }
}

function clearFilters() {
    searchInput.value = '';
    officeInput.value = '';
    startDateInput.value = '';
    endDateInput.value = '';
}

function setupListeners() {
    refreshButton.addEventListener('click', () => loadAuditLogs());
    clearFiltersButton.addEventListener('click', () => {
        clearFilters();
        loadAuditLogs();
    });

    [searchInput, officeInput, startDateInput, endDateInput].forEach((input) => {
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                loadAuditLogs();
            }
        });
    });
}

if (auditTableBody) {
    document.addEventListener('DOMContentLoaded', () => {
        setupListeners();
        loadAuditLogs();
    });
}
