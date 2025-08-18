// Controls initialization and event handling
let regenerateBtn;
let savePngBtn;
let showPrintsCheckbox;
let detailFunctionsCheckbox;
let mermaidCodeText;
let showCodeBtn;

// Acquire VS Code API once
let vscode;
if (typeof acquireVsCodeApi === "function") {
    vscode = acquireVsCodeApi();
    // Make it globally available for other scripts
    window.vscode = vscode;
}

function initializeControls() {
    // Get references to control elements
    regenerateBtn = document.getElementById('regenerateBtn');
    savePngBtn = document.getElementById('savePngBtn');
    showPrintsCheckbox = document.getElementById('showPrintsCheckbox');
    detailFunctionsCheckbox = document.getElementById('detailFunctionsCheckbox');
    mermaidCodeText = document.getElementById('mermaidCodeText');
    showCodeBtn = document.getElementById('showCodeBtn');

    // Add event listeners
    if (regenerateBtn) {
        regenerateBtn.addEventListener('click', handleRegenerateClick);
    }
    
    if (savePngBtn) {
        savePngBtn.addEventListener('click', handleSavePngClick);
    }
    
    if (showPrintsCheckbox) {
        showPrintsCheckbox.addEventListener('change', handleShowPrintsChange);
    }
    
    if (detailFunctionsCheckbox) {
        detailFunctionsCheckbox.addEventListener('change', handleDetailFunctionsChange);
    }
    
    if (showCodeBtn) {
        showCodeBtn.addEventListener('click', handleShowCodeClick);
    }
}

function handleShowCodeClick() {
    mermaidCodeText.classList.toggle('hidden');
    showCodeBtn.textContent = mermaidCodeText.classList.contains('hidden') ?  '⬇️ Show MermaidCode': '⬆️ Hide MermaidCode';
}

function handleRegenerateClick() {
    console.log('Regenerate button clicked');
    
    if (vscode) {
        console.log('VS Code API available, sending regenerate command');
        
        // Disable button during regeneration
        regenerateBtn.disabled = true;
        regenerateBtn.textContent = "⏳ Regenerating...";
        
        vscode.postMessage({
            command: 'updateFlowchart'
        });
    } else {
        console.log('VS Code API not available');
    }
}

function handleSavePngClick() {
    console.log('Save PNG button clicked');
    
    // Disable button during save
    savePngBtn.disabled = true;
    savePngBtn.textContent = "⏳ Converting...";
    
    try {
        convertSvgToPng();
    } catch (error) {
        console.error('PNG conversion failed:', error);
        // Re-enable button on error
        savePngBtn.disabled = false;
        savePngBtn.textContent = "💾 Save Flowchart (PNG)";
    }
}

function handleShowPrintsChange(event) {
    const value = event.target.checked;
    console.log('Show prints changed:', value);
    
    if (vscode) {
        vscode.postMessage({
            command: 'updateConfig',
            key: 'showPrints',
            value: value
        });
    }
}

function handleDetailFunctionsChange(event) {
    const value = event.target.checked;
    console.log('Detail functions changed:', value);
    
    if (vscode) {
        vscode.postMessage({
            command: 'updateConfig',
            key: 'detailFunctions',
            value: value
        });
    }
}

function updateControlStates(message) {
    switch (message.command) {
        case 'regenerationComplete':
            if (regenerateBtn) {
                regenerateBtn.disabled = false;
                regenerateBtn.textContent = "🔄 Regenerate Flowchart";
            }
            break;
            
        case 'regenerationError':
            if (regenerateBtn) {
                regenerateBtn.disabled = false;
                regenerateBtn.textContent = "🔄 Regenerate Flowchart";
            }
            break;
            
        case 'pngSaved':
        case 'pngSaveError':
            if (savePngBtn) {
                savePngBtn.disabled = false;
                savePngBtn.textContent = "💾 Save Flowchart (PNG)";
            }
            break;
    }
}
