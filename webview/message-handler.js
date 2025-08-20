// Message handling from extension
function handleExtensionMessage(event) {
    const message = event.data;
    console.log('Received message from extension:', message);
    
    switch (message.command) {
        case 'updateFlowchart':
            if (message.diagram) {
                updateFlowchart(message.diagram);
                // Store the diagram code for saving
                if (typeof window.storeDiagramCode === 'function') {
                    window.storeDiagramCode(message.diagram);
                }
            }
            
            if (message.tooltipData) {
                tooltipData = message.tooltipData;
            }
            break;
            
        case 'updateTooltipData':
            console.log('Updating tooltip data:', message.tooltipData);
            tooltipData = message.tooltipData || {};
            break;
            
        case 'regenerationComplete':
            console.log('Regeneration completed successfully');
            updateControlStates(message);
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
                console.log('PNG saved successfully:', message.filename);
                updateControlStates({ command: 'pngSaved' });
            } else {
                console.error('PNG failed:', message.error);
                updateControlStates({ command: 'pngSaveError' });
            }
            break;
            
        case 'saveDiagramResult':
            if (message.success) {
                console.log('Diagram saved successfully:', message.savedFlowchart);
                showNotification('Diagram saved successfully!', 'success');
            } else {
                console.error('Diagram save failed:', message.error);
                showNotification(`Failed to save diagram: ${message.error}`, 'error');
            }
            break;
            
        case 'savedDiagramsList':
            if (message.success) {
                console.log('Retrieved saved diagrams:', message.flowcharts);
                displaySavedDiagrams(message.flowcharts);
            } else {
                console.error('Failed to get saved diagrams:', message.error);
                showNotification(`Failed to load saved diagrams: ${message.error}`, 'error');
            }
            break;
            
        case 'loadSavedDiagramResult':
            if (message.success) {
                console.log('Loaded saved diagram successfully');
                showNotification('Diagram loaded successfully!', 'success');
            } else {
                console.error('Failed to load saved diagram:', message.error);
                showNotification(`Failed to load diagram: ${message.error}`, 'error');
            }
            break;
            
        case 'deleteSavedDiagramResult':
            if (message.success) {
                console.log('Diagram deleted successfully');
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
