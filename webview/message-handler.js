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
            
        case 'updateInitialState':
            if (message.showPrints !== undefined && showPrintsCheckbox) {
                showPrintsCheckbox.checked = message.showPrints;
            }
            if (message.detailFunctions !== undefined && detailFunctionsCheckbox) {
                detailFunctionsCheckbox.checked = message.detailFunctions;
            }
            if (message.forLoops !== undefined && showForLoopsCheckbox) {
                showForLoopsCheckbox.checked = message.forLoops;
            }
            if (message.whileLoops !== undefined && showWhileLoopsCheckbox) {
                showWhileLoopsCheckbox.checked = message.whileLoops;
            }
            if (message.variables !== undefined && showVariablesCheckbox) {
                showVariablesCheckbox.checked = message.variables;
            }
            if (message.ifs !== undefined && showIfsCheckbox) {
                showIfsCheckbox.checked = message.ifs;
            }
            if (message.imports !== undefined && showImportsCheckbox) {
                showImportsCheckbox.checked = message.imports;
            }
            if (message.exceptions !== undefined && showExceptionsCheckbox) {
                showExceptionsCheckbox.checked = message.exceptions;
            }
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
            
        case 'configUpdated':
            console.log('Configuration updated:', message.key, message.value);
            break;
            
        case 'getCheckboxStates':
            // Return current checkbox states to the extension
            if (window.vscode) {
                window.vscode.postMessage({
                    command: 'checkboxStates',
                    showPrints: showPrintsCheckbox ? showPrintsCheckbox.checked : true,
                    detailFunctions: detailFunctionsCheckbox ? detailFunctionsCheckbox.checked : true,
                    forLoops: showForLoopsCheckbox ? showForLoopsCheckbox.checked : true,
                    whileLoops: showWhileLoopsCheckbox ? showWhileLoopsCheckbox.checked : true,
                    variables: showVariablesCheckbox ? showVariablesCheckbox.checked : true,
                    ifs: showIfsCheckbox ? showIfsCheckbox.checked : true,
                    imports: showImportsCheckbox ? showImportsCheckbox.checked : true,
                    exceptions: showExceptionsCheckbox ? showExceptionsCheckbox.checked : true
                });
            }
            break;
    }
}

// Debug function to check container state
function debugContainerState() {
    console.log('=== Container State Debug ===');
    console.log('mermaidContainer variable:', mermaidContainer);
    console.log('mermaidContainer by ID:', document.getElementById('mermaidContainer'));
    console.log('mermaidContainer by class:', document.querySelector('.mermaid'));
    console.log('mermaidContainer by selector:', document.querySelector('.mermaid#mermaidContainer'));
    console.log('All mermaid elements:', document.querySelectorAll('.mermaid'));
    console.log('Content div:', document.querySelector('#content'));
    console.log('=============================');
}

// Expose debug function globally for testing
window.debugContainerState = debugContainerState;
