/**
 * Initialize a linear progress bar
 * @param {string} elementId - ID of the progress bar fill element
 * @param {number} percentage - Progress percentage (0-100)
 */
function initProgressBar(elementId, percentage) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    // Determine status class
    element.classList.remove('complete', 'on-track', 'behind');
    if (percentage >= 100) {
        element.classList.add('complete');
    } else if (percentage >= 70) {
        element.classList.add('on-track');
    } else {
        element.classList.add('behind');
    }
    
    // Animate width
    setTimeout(() => {
        element.style.width = `${Math.min(percentage, 100)}%`;
    }, 100);
}

/**
 * Initialize circular progress
 * @param {string} svgId - ID of SVG element
 * @param {number} percentage - Progress percentage (0-100)
 */
function initCircularProgress(svgId, percentage) {
    const svg = document.getElementById(svgId);
    if (!svg) return;
    
    const circle = svg.querySelector('.progress-circle');
    const radius = circle.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    circle.style.strokeDashoffset = circumference;
    
    circle.classList.remove('complete', 'on-track', 'behind');
    if (percentage >= 100) {
        circle.classList.add('complete');
    } else if (percentage >= 70) {
        circle.classList.add('on-track');
    } else {
        circle.classList.add('behind');
    }
    
    setTimeout(() => {
        const offset = circumference - (percentage / 100) * circumference;
        circle.style.strokeDashoffset = offset;
    }, 100);
}

/**
 * Create a complete progress bar HTML
 * @param {number} rendered - Hours rendered
 * @param {number} required - Hours required
 * @param {string} containerId - Where to insert the progress bar
 */
function createProgressBar(rendered, required, containerId) {
    const percentage = Math.round((rendered / required) * 100);
    const remaining = Math.max(required - rendered, 0);
    
    let statusClass = '';
    let statusText = '';
    
    if (percentage >= 100) {
        statusClass = 'complete';
        statusText = 'Complete!';
    } else if (percentage >= 70) {
        statusClass = 'on-track';
        statusText = `${remaining} hours remaining`;
    } else {
        statusClass = 'behind';
        statusText = `${remaining} hours remaining`;
    }
    
    const html = `
        <div class="progress-container">
            <div class="progress-header">
                <span class="progress-text">
                    ${rendered} / ${required} Hours
                </span>
                <span class="progress-percentage ${statusClass}">
                    ${percentage}%
                </span>
            </div>
            <div class="progress-bar-wrapper">
                <div class="progress-bar-fill ${statusClass}" 
                     style="width: 0%" 
                     data-percentage="${percentage}">
                </div>
            </div>
            <p class="progress-sublabel">
                ${statusText}
            </p>
        </div>
    `;
    
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = html;
        
        setTimeout(() => {
            const fill = container.querySelector('.progress-bar-fill');
            if (fill) {
                fill.style.width = `${Math.min(percentage, 100)}%`;
            }
        }, 100);
    }
}

/**
 * Create mini progress bar for tables
 * @param {number} percentage - Progress percentage
 * @returns {string} HTML string
 */
function createMiniProgress(percentage) {
    let statusClass = '';
    if (percentage >= 100) {
        statusClass = 'complete';
    } else if (percentage >= 70) {
        statusClass = 'on-track';
    } else {
        statusClass = 'behind';
    }
    
    return `
        <div class="mini-progress">
            <div class="flex items-center justify-between mb-1">
                <span class="text-xs text-gray-600">${percentage}%</span>
            </div>
            <div class="mini-progress-bar">
                <div class="mini-progress-fill ${statusClass}" 
                     style="width: ${Math.min(percentage, 100)}%">
                </div>
            </div>
        </div>
    `;
}

/**
 * Helper: Get status color class
 */
function getStatusClass(percentage) {
    if (percentage >= 100) return 'complete';
    if (percentage >= 70) return 'on-track';
    return 'behind';
}