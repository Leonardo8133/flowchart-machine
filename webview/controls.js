// Controls initialization and event handling
let regenerateBtn;
let savePngBtn;
let unfoldAllBtn;
let collapseAllBtn;
let showPrintsCheckbox;
let showFunctionsCheckbox;
let showForLoopsCheckbox;
let showWhileLoopsCheckbox;
let showVariablesCheckbox;
let showIfsCheckbox;
let showImportsCheckbox;
let showExceptionsCheckbox;
let showReturnsCheckbox;
let showClassesCheckbox;
let mergeCommonNodesCheckbox;
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
    unfoldAllBtn = document.getElementById('unfoldAllBtn');
    collapseAllBtn = document.getElementById('collapseAllBtn');
    showPrintsCheckbox = document.getElementById('showPrints');
    showFunctionsCheckbox = document.getElementById('showFunctions');
    showForLoopsCheckbox = document.getElementById('showForLoops');
    showWhileLoopsCheckbox = document.getElementById('showWhileLoops');
    showVariablesCheckbox = document.getElementById('showVariables');
    showIfsCheckbox = document.getElementById('showIfs');
    showImportsCheckbox = document.getElementById('showImports');
    showExceptionsCheckbox = document.getElementById('showExceptions');
    showReturnsCheckbox = document.getElementById('showReturns');
    showClassesCheckbox = document.getElementById('showClasses');
    mergeCommonNodesCheckbox = document.getElementById('mergeCommonNodes');
    mermaidCodeText = document.getElementById('mermaidCodeText');
    showCodeBtn = document.getElementById('showCodeBtn');
    dropdownToggle = document.getElementById('dropdownToggle');
    dropdownContent = document.getElementById('dropdownContent');

    // Add event listeners
    if (unfoldAllBtn) {
        unfoldAllBtn.addEventListener('click', handleExpandAllClick);
    }

    if (collapseAllBtn) {
        collapseAllBtn.addEventListener('click', handleCollapseAllClick);
    }

    if (regenerateBtn) {
        regenerateBtn.addEventListener('click', handleRegenerateClick);
    }

    if (savePngBtn) {
        savePngBtn.addEventListener('click', handleSavePngClick);
    }
    
    if (showPrintsCheckbox) {
        showPrintsCheckbox.addEventListener('change', handleConfigChange);
    }
    
    if (showFunctionsCheckbox) {
        showFunctionsCheckbox.addEventListener('change', handleConfigChange);
    }
    
    if (showForLoopsCheckbox) {
        showForLoopsCheckbox.addEventListener('change', handleConfigChange);
    }
    
    if (showWhileLoopsCheckbox) {
        showWhileLoopsCheckbox.addEventListener('change', handleConfigChange);
    }
    
    if (showVariablesCheckbox) {
        showVariablesCheckbox.addEventListener('change', handleConfigChange);
    }
    
    if (showIfsCheckbox) {
        showIfsCheckbox.addEventListener('change', handleConfigChange);
    }
    
    if (showImportsCheckbox) {
        showImportsCheckbox.addEventListener('change', handleConfigChange);
    }
    
    if (showExceptionsCheckbox) {
        showExceptionsCheckbox.addEventListener('change', handleConfigChange);
    }

    if (showReturnsCheckbox) {
        showReturnsCheckbox.addEventListener('change', handleConfigChange);
    }

    if (showClassesCheckbox) {
        showClassesCheckbox.addEventListener('change', handleConfigChange);
    }

    if (mergeCommonNodesCheckbox) {
        mergeCommonNodesCheckbox.addEventListener('change', handleConfigChange);
    }
    
    if (showCodeBtn) {
        showCodeBtn.addEventListener('click', handleShowCodeClick);
    }

    if (dropdownToggle) {
        dropdownToggle.addEventListener('click', handleDropdownToggle);
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', handleOutsideClick);

    // Handle Retrieve Initial Values for Checkboxes
    getCurrentCheckboxStatesValues();

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

function handleExpandAllClick() {
    console.log('Expand All button clicked');

    if (vscode) {
        console.log('VS Code API available, sending expand all command');
        vscode.postMessage({
            command: 'expandAllSubgraphs'
        });
    } else {
        console.log('VS Code API not available');
    }
}

function handleCollapseAllClick() {
    console.log('Collapse All button clicked');

    if (vscode) {
        console.log('VS Code API available, sending collapse all command');
        vscode.postMessage({
            command: 'collapseAllSubgraphs'
        });
    } else {
        console.log('VS Code API not available');
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

function handleConfigChange(event) {
    // Checkboxes IDS need to match the configuration keys
    const value = event.target.checked;
    const configName = event.target.id;
    console.log('🔧 Configuration changed:', value, 'Key:', configName);
    if (vscode) {
        const message = {
            command: 'updateConfig',
            key: configName,
            value: value
        };
        console.log('🔧 Sending message to extension:', message);
        vscode.postMessage(message);
    } else {
        console.error('🔧 VS Code API not available');
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

function getCurrentCheckboxStatesValues() {
    if (vscode) {
        vscode.postMessage({
            command: 'getCurrentCheckboxStatesValues'
        });
    }
}

function updateCheckboxStates(checkboxStates) {
    showPrintsCheckbox.checked = checkboxStates.showPrints;
    showFunctionsCheckbox.checked = checkboxStates.showFunctions;
    showForLoopsCheckbox.checked = checkboxStates.showForLoops;
    showWhileLoopsCheckbox.checked = checkboxStates.showWhileLoops;
    showVariablesCheckbox.checked = checkboxStates.showVariables;
    showIfsCheckbox.checked = checkboxStates.showIfs;
    showImportsCheckbox.checked = checkboxStates.showImports;
    showReturnsCheckbox.checked = checkboxStates.showReturns;
    showExceptionsCheckbox.checked = checkboxStates.showExceptions;
    showClassesCheckbox.checked = checkboxStates.showClasses;
    mergeCommonNodesCheckbox.checked = checkboxStates.mergeCommonNodes;
    
}