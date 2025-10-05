// Main initialization file
// Global variable to store current mermaid diagram code
let currentDiagramCode = '';
let activeHelpTooltip = null;

function closeHelpTooltip(tooltip) {
    if (!tooltip) {
        return;
    }
    const container = tooltip.parentElement;
    tooltip.classList.remove('visible');
    if (container) {
        container.classList.remove('help-open');
    }
    if (activeHelpTooltip === tooltip) {
        activeHelpTooltip = null;
    }
}

function enhanceHelpTargets(root = document) {
    const scope = root instanceof Element ? root : document;
    const elements = scope.querySelectorAll('[data-help]');

    elements.forEach(element => {
        if (!(element instanceof HTMLElement)) {
            return;
        }
        if (element.classList.contains('help-enhanced')) {
            return;
        }

        const helpText = element.getAttribute('data-help');
        if (!helpText) {
            return;
        }

        element.classList.add('has-help', 'help-enhanced');

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'help-trigger';
        trigger.setAttribute('aria-label', 'Mostrar detalhes do elemento');
        trigger.textContent = '?';

        const tooltip = document.createElement('div');
        tooltip.className = 'help-tooltip';
        tooltip.setAttribute('role', 'tooltip');
        tooltip.textContent = helpText;

        const openTooltip = () => {
            if (activeHelpTooltip && activeHelpTooltip !== tooltip) {
                closeHelpTooltip(activeHelpTooltip);
            }
            tooltip.classList.add('visible');
            element.classList.add('help-open');
            activeHelpTooltip = tooltip;
        };

        const hideTooltip = () => {
            closeHelpTooltip(tooltip);
        };

        trigger.addEventListener('click', event => {
            event.stopPropagation();
            if (tooltip.classList.contains('visible')) {
                hideTooltip();
            } else {
                openTooltip();
            }
        });

        trigger.addEventListener('focus', openTooltip);
        trigger.addEventListener('blur', hideTooltip);
        tooltip.addEventListener('click', event => event.stopPropagation());

        element.appendChild(trigger);
        element.appendChild(tooltip);
    });
}

window.enhanceHelpTargets = enhanceHelpTargets;

document.addEventListener('click', event => {
    if (!activeHelpTooltip) {
        return;
    }
    const target = event.target;
    if (!(target instanceof Element)) {
        return;
    }
    if (target.closest('.help-tooltip') || target.closest('.help-trigger')) {
        return;
    }
    closeHelpTooltip(activeHelpTooltip);
});

// Function to store the diagram code (called from message handler)
function storeDiagramCode(diagramCode) {
    currentDiagramCode = diagramCode;    
    // Also update the mermaidCodeText element if it exists
    const mermaidCodeText = document.getElementById('mermaidCodeText');
    if (mermaidCodeText) {
        mermaidCodeText.textContent = diagramCode;
    }
}

// Make the function globally available
window.storeDiagramCode = storeDiagramCode;

// Copy code functionality
function handleCopyCodeClick() {
    const mermaidCodeText = document.getElementById('mermaidCodeText');
    if (mermaidCodeText && mermaidCodeText.textContent) {
        navigator.clipboard.writeText(mermaidCodeText.textContent).then(() => {
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
    }
}

document.addEventListener("DOMContentLoaded", function () {
    // Initialize controls first
    if (typeof initializeControls === "function") {
        initializeControls();
        initializeSavedDiagrams();
    }

    if (typeof enhanceHelpTargets === 'function') {
        enhanceHelpTargets();
    }
    
    // Add copy button event listener
    const copyCodeBtn = document.getElementById('copyCodeBtn');
    if (copyCodeBtn) {
        copyCodeBtn.addEventListener('click', handleCopyCodeClick);
    }
    
    // Set up message handling
    if (typeof handleExtensionMessage === "function") {
        window.addEventListener('message', handleExtensionMessage);
    }
    
    // Wait a bit more for controls to be fully initialized
    setTimeout(() => {
        // Initialize Mermaid
        if (typeof acquireVsCodeApi === "function") {
            initializeAndRender();
        } else {
            const container = document.getElementById('mermaidContainer');
            if (container) {
                container.innerHTML = 'This webview is designed to run in VS Code. Open a Python file and use the "Generate Python Flowchart" command.';
            }
        }
    }, 100); // Reduced from 500ms to 100ms since controls are already initialized
});

// Initialize saved diagrams functionality
function initializeSavedDiagrams() {
    const saveDiagramBtn = document.getElementById('saveDiagramBtn');
    const showSavedBtn = document.getElementById('showSavedBtn');

    
    if (saveDiagramBtn) {
        saveDiagramBtn.addEventListener('click', handleSaveDiagram);
    }
    
    if (showSavedBtn) {
        showSavedBtn.addEventListener('click', handleShowSavedDiagrams);
    }
}

// Handle save diagram button click
function handleSaveDiagram() {
    // Try to get mermaid code from global variable first, then from element

    
    let mermaidCode = currentDiagramCode;
    
    if (!mermaidCode || !mermaidCode.trim()) {
        const mermaidCodeText = document.getElementById('mermaidCodeText');
        if (mermaidCodeText) {
            mermaidCode = mermaidCodeText.textContent || '';
        }
    }
    
    if (!mermaidCode || !mermaidCode.trim()) {
        showNotification('Please generate a flowchart first', 'warning');
        return;
    }
    
    // Send message to extension to save the diagram
    if (window.vscode) {
        try {
            window.vscode.postMessage({
                command: 'saveDiagram',
                mermaidCode: mermaidCode
            });
        } catch (error) {
            console.error('📤 Error sending message:', error);
        }
    } else {
        console.error('📤 VS Code API not available!');
    }
}

// Handle show/hide saved diagrams button click
function handleShowSavedDiagrams() {
    const savedDiagramsList = document.getElementById('savedDiagramsList');
    const showSavedBtn = document.getElementById('showSavedBtn');
    
    if (savedDiagramsList && showSavedBtn) {
        const isVisible = savedDiagramsList.classList.contains('show');
        
        if (!isVisible) {
            // Show the list
            savedDiagramsList.classList.add('show');
            savedDiagramsList.classList.remove('hidden');
            
            // Request saved diagrams from extension
            if (window.vscode) {
                window.vscode.postMessage({
                    command: 'getSavedDiagrams'
                });
            }
        } else {
            // Hide the list
            savedDiagramsList.classList.remove('show');
            savedDiagramsList.classList.add('hidden');
        }
    }
}


// Note: hide functionality is now integrated into handleShowSavedDiagrams

// Display saved diagrams in the floating list
function displaySavedDiagrams(flowcharts) {
    const content = document.getElementById('savedDiagramsContent');
    const savedDiagramsCount = document.getElementById('savedDiagramsCount');

    if (!content) return;
    
    // Update file count
    if (savedDiagramsCount) {
        const count = flowcharts ? flowcharts.length : 0;
        savedDiagramsCount.textContent = `${count} file${count !== 1 ? 's' : ''}`;
    }
    
    if (!flowcharts || flowcharts.length === 0) {
        content.innerHTML = '<div class="saved-diagram-item" data-help="Nenhum fluxograma salvo ainda. Gere um diagrama e clique em Save para armazená-lo."><div class="saved-diagram-name">No saved diagrams</div></div>';
        if (typeof window.enhanceHelpTargets === 'function') {
            window.enhanceHelpTargets(content);
        }
        return;
    }

    content.innerHTML = flowcharts.map(flowchart => `
        <div class="saved-diagram-item" data-id="${flowchart.id}" data-help="Clique para carregar este fluxograma salvo. Use o ícone de lixeira para remover.">
            <div class="saved-diagram-name">${flowchart.name}</div>
            <div class="saved-diagram-date">${new Date(flowchart.savedAt).toLocaleString()}</div>
            <button class="saved-diagram-delete" title="Delete diagram">
                <img src="{{trashIcon}}" width="14" height="14" alt="Delete">
            </button>
        </div>
    `).join('');

    if (typeof window.enhanceHelpTargets === 'function') {
        window.enhanceHelpTargets(content);
    }
    
    // Add click listeners to load diagrams and delete buttons
    content.querySelectorAll('.saved-diagram-item').forEach(item => {
        const deleteBtn = item.querySelector('.saved-diagram-delete');

        // Add click handler for loading diagram
        item.addEventListener('click', (e) => {
            // Don't load if delete button was clicked
            if (e.target.classList.contains('saved-diagram-delete')) {
                return;
            }
            
            const id = item.dataset.id;
            if (id && window.vscode) {
                window.vscode.postMessage({
                    command: 'loadSavedDiagram',
                    id: id
                });
            }
        });
        
        // Add delete button handler
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = item.dataset.id;
                const name = item.querySelector('.saved-diagram-name').textContent;
                showConfirmDialog(`Are you sure you want to delete "${name}"?`, () => {
                    if (window.vscode) {
                        window.vscode.postMessage({
                            command: 'deleteSavedDiagram',
                            id: id
                        });
                    }
                });
            });
        }
    });
}

// Show notification
function showNotification(message, type = 'info') {
    // Simple notification - you can enhance this with a proper notification system
    
    // Create a temporary notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#4caf50'};
        color: white;
        padding: 12px 24px;
        border-radius: 4px;
        z-index: 10000;
        font-size: 14px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// Show confirmation dialog (replacement for blocked confirm())
function showConfirmDialog(message, onConfirm) {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 20000;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    // Create dialog
    const dialog = document.createElement('div');
    dialog.style.cssText = `
        background: var(--vscode-editor-background, #1e1e1e);
        border: 1px solid var(--vscode-panel-border, #3c3c3c);
        border-radius: 8px;
        padding: 20px;
        max-width: 400px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    `;
    
    // Create message
    const messageEl = document.createElement('p');
    messageEl.style.cssText = `
        color: var(--vscode-foreground, #cccccc);
        margin: 0 0 20px 0;
        font-size: 14px;
        line-height: 1.4;
    `;
    messageEl.textContent = message;
    
    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        gap: 12px;
        justify-content: flex-end;
    `;
    
    // Create cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = `
        background: var(--vscode-button-secondaryBackground, #3c3c3c);
        color: var(--vscode-button-secondaryForeground, #ffffff);
        border: none;
        border-radius: 4px;
        padding: 8px 16px;
        cursor: pointer;
        font-size: 13px;
    `;
    
    // Create delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.style.cssText = `
        background: var(--vscode-errorForeground, #f48771);
        color: white;
        border: none;
        border-radius: 4px;
        padding: 8px 16px;
        cursor: pointer;
        font-size: 13px;
    `;
    
    // Add event listeners
    cancelBtn.addEventListener('click', () => {
        document.body.removeChild(overlay);
    });
    
    deleteBtn.addEventListener('click', () => {
        document.body.removeChild(overlay);
        onConfirm();
    });
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            document.body.removeChild(overlay);
        }
    });
    
    // Assemble dialog
    buttonContainer.appendChild(cancelBtn);
    buttonContainer.appendChild(deleteBtn);
    dialog.appendChild(messageEl);
    dialog.appendChild(buttonContainer);
    overlay.appendChild(dialog);
    
    // Show dialog
    document.body.appendChild(overlay);
    
    // Focus delete button
    deleteBtn.focus();
}
