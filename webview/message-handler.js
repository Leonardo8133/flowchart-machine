// Message handling from extension
function handleExtensionMessage(event) {
    const message = event.data;
    console.log('Received message from extension:', message);
    
    switch (message.command) {
        case 'updateFlowchart':
            if (message.diagram) {
                updateFlowchart(message.diagram);
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
            console.log('Updating initial state:', message);
            if (message.showPrints !== undefined && showPrintsCheckbox) {
                showPrintsCheckbox.checked = message.showPrints;
            }
            if (message.detailFunctions !== undefined && detailFunctionsCheckbox) {
                detailFunctionsCheckbox.checked = message.detailFunctions;
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
            
        case 'configUpdated':
            console.log('Configuration updated:', message.key, message.value);
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
