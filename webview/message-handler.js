// Message handling from extension
function handleExtensionMessage(event) {
    const message = event.data;
    
    switch (message.command) {
        case 'updateFlowchart':
            if (message.diagram) {
                // Store the diagram code globally for expand functionality
                window.currentDiagramCode = message.diagram;
                updateFlowchart(message.diagram);
                // Store the diagram code for saving
                if (typeof window.storeDiagramCode === 'function') {
                    window.storeDiagramCode(message.diagram);
                }

                // Minimal HUD cursor update
                try {
                    const info = document.getElementById('cursorInfo');
                    const valueEl = document.getElementById('cursorValue');
                    if (message.savedDiagram) {
                        valueEl.textContent = "Saved Diagram: " + message.savedDiagram.name;
                    } else {
                        if (info && valueEl) {
                            const es = message?.metadata?.entry_selection;
                            if (es && es.type && es.type !== 'file') {
                                let text = '';
                                if (es.class) {
                                    text += es.class + '.';
                                }
                                if (es.name) {
                                    text += es.name;
                                }
                                valueEl.textContent = text || 'Unknown';
                            } else {
                                valueEl.textContent = 'Entire File';
                            }
                                info.style.display = '';
                        }
                    }
                } catch (e) {
                    console.warn('Cursor HUD update failed:', e);
                }

                // Update subgraph states if provided, otherwise reset
                if (message.whitelist || message.forceCollapse || message.metadata) {
                    if (typeof window.updateSubgraphStates === 'function') {
                        window.updateSubgraphStates({
                            whitelist: message.whitelist,
                            forceCollapse: message.forceCollapse,
                            metadata: message.metadata
                        });
                    }
                } else {
                    // Reset local UI states when a new diagram is loaded without state
                    if (typeof window.resetSubgraphStates === 'function') {
                        window.resetSubgraphStates();
                    }
                }
            }
            break;

        case 'storeCollapsedSubgraphs':
            // Deprecated: metadata no longer used
            if (typeof window.createExpandFunctions === 'function') {
                window.createExpandFunctions();
            }
            break;
            
        case 'regenerationComplete':
            updateControlStates(message);
            // Add buttons after regeneration
            if (typeof window.addSubgraphButtons === 'function') {
                setTimeout(() => {
                    window.addSubgraphButtons();
                }, 100);
            }
            break;

        case 'updateSubgraphStates':
            if (typeof window.updateSubgraphStates === 'function') {
                window.updateSubgraphStates({
                    whitelist: message.whitelist,
                    forceCollapse: message.forceCollapse,
                    metadata: message.metadata
                });
            }
            break;
            
        case 'regenerationError':
            console.error('Regeneration error:', message.error);
            updateControlStates(message);
            // Show error in the container
            if (mermaidContainer) {
                mermaidContainer.innerHTML = `<div style="color: var(--vscode-errorForeground, #f48771); padding: 20px; text-align: center;">Error: ${message.error}</div>`;
                
                // Re-attach event listeners after showing error
                setTimeout(() => {
                    attachContainerEventListeners(mermaidContainer);
                }, 100);
            }
            break;
            
        case 'pngResult':
            if (message.success) {
                updateControlStates({ command: 'pngSaved' });
            } else {
                console.error('PNG failed:', message.error);
                updateControlStates({ command: 'pngSaveError' });
            }
            break;
        
        case 'svgResult':
            if (message.success) {
            } else {
                console.error('SVG failed:', message.error);
            }
            break;
        
        case 'helpData':
            if (typeof updateHelpData === 'function') {
                updateHelpData(message);
            }
            break;
            
        case 'saveDiagramResult':
            if (message.success) {
                showNotification('Diagram saved successfully!', 'success');
            } else {
                console.error('Diagram save failed:', message.error);
                showNotification(`Failed to save diagram: ${message.error}`, 'error');
            }
            break;
            
        case 'savedDiagramsList':
            if (message.success) {
                displaySavedDiagrams(message.flowcharts);
            } else {
                console.error('Failed to get saved diagrams:', message.error);
                showNotification(`Failed to load saved diagrams: ${message.error}`, 'error');
            }
            break;
            
        case 'loadSavedDiagramResult':
            if (message.success) {
                showNotification('Diagram loaded successfully!', 'success');
            } else {
                console.error('Failed to load saved diagram:', message.error);
                showNotification(`Failed to load diagram: ${message.error}`, 'error');
            }
            break;
            
        case 'deleteSavedDiagramResult':
            if (message.success) {
                showNotification('Diagram deleted successfully!', 'success');
                // Refresh the saved diagrams list
                if (window.vscode) {
                    window.vscode.postMessage({
                        command: 'getSavedDiagrams'
                    });
                }
            } else {
                console.error('Failed to delete diagram:', message.error);
                showNotification(`Failed to delete diagram: ${message.error}`, 'error');
            }
            break;

        case 'updateCheckboxStates':
            updateCheckboxStates(message.checkboxStates);
            break;
        }
}

// Debug function to check container state
function debugContainerState() {

}

// Expose debug function globally for testing
window.debugContainerState = debugContainerState;
