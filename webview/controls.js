// Controls initialization and event handling
let regenerateBtn;
let savePngBtn;
let showPrintsCheckbox;
let detailFunctionsCheckbox;
let showForLoopsCheckbox;
let showWhileLoopsCheckbox;
let showVariablesCheckbox;
let showIfsCheckbox;
let showImportsCheckbox;
let showExceptionsCheckbox;
let mermaidCodeText;
let showCodeBtn;
let dropdownToggle;
let dropdownContent;

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
    showForLoopsCheckbox = document.getElementById('showForLoopsCheckbox');
    showWhileLoopsCheckbox = document.getElementById('showWhileLoopsCheckbox');
    showVariablesCheckbox = document.getElementById('showVariablesCheckbox');
    showIfsCheckbox = document.getElementById('showIfsCheckbox');
    showImportsCheckbox = document.getElementById('showImportsCheckbox');
    showExceptionsCheckbox = document.getElementById('showExceptionsCheckbox');
    mermaidCodeText = document.getElementById('mermaidCodeText');
    showCodeBtn = document.getElementById('showCodeBtn');
    dropdownToggle = document.getElementById('dropdownToggle');
    dropdownContent = document.getElementById('dropdownContent');

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
    
    if (showForLoopsCheckbox) {
        showForLoopsCheckbox.addEventListener('change', handleShowForLoopsChange);
    }
    
    if (showWhileLoopsCheckbox) {
        showWhileLoopsCheckbox.addEventListener('change', handleShowWhileLoopsChange);
    }
    
    if (showVariablesCheckbox) {
        showVariablesCheckbox.addEventListener('change', handleShowVariablesChange);
    }
    
    if (showIfsCheckbox) {
        showIfsCheckbox.addEventListener('change', handleShowIfsChange);
    }
    
    if (showImportsCheckbox) {
        showImportsCheckbox.addEventListener('change', handleShowImportsChange);
    }
    
    if (showExceptionsCheckbox) {
        showExceptionsCheckbox.addEventListener('change', handleShowExceptionsChange);
    }
    
    if (showCodeBtn) {
        showCodeBtn.addEventListener('click', handleShowCodeClick);
    }

    if (dropdownToggle) {
        dropdownToggle.addEventListener('click', handleDropdownToggle);
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', handleOutsideClick);
}

function handleShowCodeClick() {
    mermaidCodeText.classList.toggle('hidden');
    showCodeBtn.textContent = mermaidCodeText.classList.contains('hidden') ?  '⬇️ Show MermaidCode': '⬆️ Hide MermaidCode';
}

function handleDropdownToggle(event) {
    event.stopPropagation();
    dropdownContent.classList.toggle('show');
    dropdownToggle.classList.toggle('active');
}

function handleOutsideClick(event) {
    if (!dropdownToggle.contains(event.target) && !dropdownContent.contains(event.target)) {
        dropdownContent.classList.remove('show');
        dropdownToggle.classList.remove('active');
    }
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
        savePngBtn.textContent = "⬇️ Download (PNG)";
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

function handleDetailFunctionsChange() {
    if (vscode) {
        vscode.postMessage({
            command: 'updateConfig',
            key: 'detailFunctions',
            value: detailFunctionsCheckbox.checked
        });
    }
}

function handleShowForLoopsChange() {
    if (vscode) {
        vscode.postMessage({
            command: 'updateConfig',
            key: 'forLoops',
            value: showForLoopsCheckbox.checked
        });
    }
}

function handleShowWhileLoopsChange() {
    if (vscode) {
        vscode.postMessage({
            command: 'updateConfig',
            key: 'whileLoops',
            value: showWhileLoopsCheckbox.checked
        });
    }
}

function handleShowVariablesChange() {
    if (vscode) {
        vscode.postMessage({
            command: 'updateConfig',
            key: 'variables',
            value: showVariablesCheckbox.checked
        });
    }
}

function handleShowIfsChange() {
    if (vscode) {
        vscode.postMessage({
            command: 'updateConfig',
            key: 'ifs',
            value: showIfsCheckbox.checked
        });
    }
}

function handleShowImportsChange() {
    if (vscode) {
        vscode.postMessage({
            command: 'updateConfig',
            key: 'imports',
            value: showImportsCheckbox.checked
        });
    }
}

function handleShowExceptionsChange() {
    if (vscode) {
        vscode.postMessage({
            command: 'updateConfig',
            key: 'exceptions',
            value: showExceptionsCheckbox.checked
        });
    }
}

function updateControlStates(message) {
    switch (message.command) {
        case 'regenerationComplete':
            if (regenerateBtn) {
                regenerateBtn.disabled = false;
                regenerateBtn.textContent = "🔄 Regenerate";
            }
            break;
            
        case 'regenerationError':
            if (regenerateBtn) {
                regenerateBtn.disabled = false;
                regenerateBtn.textContent = "🔄 Regenerate";
            }
            break;
            
        case 'pngSaved':
        case 'pngSaveError':
            if (savePngBtn) {
                savePngBtn.disabled = false;
                savePngBtn.textContent = "⬇️ Download (PNG)";
            }
            break;
    }
}
