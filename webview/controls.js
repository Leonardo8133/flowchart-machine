// Controls initialization and event handling
let regenerateBtn;
let savePngBtn;
let downloadModal;
let downloadBackdrop;
let downloadPngOption;
let downloadSvgOption;
let downloadCancel;
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
let helpBtn;
let bugReportBtn;
let helpModal;
let bugReportModal;
let optionsBtn;
let optionsModal;

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
    downloadModal = document.getElementById('downloadModal');
    downloadBackdrop = document.getElementById('downloadModalBackdrop');
    downloadPngOption = document.getElementById('downloadPngOption');
    downloadSvgOption = document.getElementById('downloadSvgOption');
    downloadCancel = document.getElementById('downloadCancel');
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
    helpBtn = document.getElementById('helpBtn');
    bugReportBtn = document.getElementById('bugReportBtn');
    helpModal = document.getElementById('helpModal');
    bugReportModal = document.getElementById('bugReportModal');
    optionsBtn = document.getElementById('optionsBtn');
    optionsModal = document.getElementById('optionsModal');

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
    
    if (downloadPngOption) {
        downloadPngOption.addEventListener('click', handleSavePngFromModal);
    }
    if (downloadSvgOption) {
        downloadSvgOption.addEventListener('click', handleSaveSvgFromModal);
    }
    if (downloadCancel) {
        downloadCancel.addEventListener('click', closeDownloadModal);
    }
    if (downloadBackdrop) {
        downloadBackdrop.addEventListener('click', closeDownloadModal);
    }

    // Help modal event listeners
    const helpModalClose = document.getElementById('helpModalClose');
    const helpModalBackdrop = helpModal ? helpModal.querySelector('.modal-backdrop') : null;
    if (helpModalClose) {
        helpModalClose.addEventListener('click', closeHelpModal);
    }
    if (helpModalBackdrop) {
        helpModalBackdrop.addEventListener('click', closeHelpModal);
    }

    // Bug report modal event listeners
    const bugReportModalClose = document.getElementById('bugReportModalClose');
    const bugReportModalBackdrop = bugReportModal ? bugReportModal.querySelector('.modal-backdrop') : null;
    if (bugReportModalClose) {
        bugReportModalClose.addEventListener('click', closeBugReportModal);
    }
    if (bugReportModalBackdrop) {
        bugReportModalBackdrop.addEventListener('click', closeBugReportModal);
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
    const sequentialFlowToggle = document.getElementById('sequentialFlow');
    if (sequentialFlowToggle) {
        sequentialFlowToggle.addEventListener('change', handleConfigChange);
    }
    
    if (showCodeBtn) {
        showCodeBtn.addEventListener('click', handleShowCodeClick);
    }

    if (dropdownToggle) {
        dropdownToggle.addEventListener('click', handleDropdownToggle);
    }

    if (helpBtn) {
        helpBtn.addEventListener('click', handleHelpClick);
    }

    if (bugReportBtn) {
        bugReportBtn.addEventListener('click', handleBugReportClick);
    }

    if (optionsBtn) {
        optionsBtn.addEventListener('click', handleOptionsClick);
    }

    // Options modal event listeners
    const optionsModalClose = document.getElementById('optionsModalClose');
    const optionsModalBackdrop = optionsModal ? optionsModal.querySelector('.modal-backdrop') : null;
    if (optionsModalClose) {
        optionsModalClose.addEventListener('click', closeOptionsModal);
    }
    if (optionsModalBackdrop) {
        optionsModalBackdrop.addEventListener('click', closeOptionsModal);
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', handleOutsideClick);

    // Handle Retrieve Initial Values for Checkboxes
    getCurrentCheckboxStatesValues();

}

function handleShowCodeClick() {
    mermaidCodeText.classList.toggle('hidden');
    showCodeBtn.textContent = mermaidCodeText.classList.contains('hidden') ?  '▼ Show MermaidCode': '▲ Hide MermaidCode';
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

    if (vscode) {
        vscode.postMessage({
            command: 'expandAllSubgraphs'
        });
    } else {
    }
}

function handleCollapseAllClick() {

    if (vscode) {
        vscode.postMessage({
            command: 'collapseAllSubgraphs'
        });
    } else {
    }
}

function handleRegenerateClick() {

    if (vscode) {

        // Disable button during regeneration
        regenerateBtn.disabled = true;
        const currentHtml = regenerateBtn.innerHTML;
        regenerateBtn.innerHTML = currentHtml.replace('Regenerate', '⏳ Regenerating...');

        vscode.postMessage({
            command: 'updateFlowchart'
        });
    } else {
    }
}

async function handleSavePngClick() {
    openDownloadModal();
}

function openDownloadModal() {
    if (downloadModal) {
        downloadModal.classList.remove('hidden');
    }
}

function closeDownloadModal() {
    if (downloadModal) {
        downloadModal.classList.add('hidden');
    }
}

function closeHelpModal() {
    if (helpModal) {
        helpModal.classList.add('hidden');
    }
}

function closeBugReportModal() {
    if (bugReportModal) {
        bugReportModal.classList.add('hidden');
    }
}

function handleOptionsClick() {
    if (optionsModal) {
        optionsModal.classList.remove('hidden');
        // Sync current checkbox values on open
        getCurrentCheckboxStatesValues();
    }
}

function closeOptionsModal() {
    if (optionsModal) {
        optionsModal.classList.add('hidden');
    }
}

// Update help data in modals
function updateHelpData(data) {   
    // Update bug report links
    const githubLink = document.getElementById('githubIssuesLink');
    const emailLink = document.getElementById('emailContactLink');
    
    if (githubLink) {
        const issuesUrl = data.repository.replace('.git', '') + '/issues';
        githubLink.href = issuesUrl;
    }
    
    if (emailLink) {
        emailLink.href = 'mailto:' + data.email;
    }
}

async function handleSavePngFromModal() {
    const currentHtml = savePngBtn.innerHTML;
    savePngBtn.disabled = true;
    savePngBtn.innerHTML = currentHtml.replace('Download', '⏳ Converting...');
    try {
        await convertSvgToPng();
    } finally {
        savePngBtn.innerHTML = currentHtml;
        savePngBtn.disabled = false;
        closeDownloadModal();
    }
}

async function handleSaveSvgFromModal() {
    const currentHtml = savePngBtn.innerHTML;
    savePngBtn.disabled = true;
    savePngBtn.innerHTML = currentHtml.replace('Download', '⏳ Exporting...');
    try {
        await exportCurrentSvg();
    } finally {
        savePngBtn.innerHTML = currentHtml;
        savePngBtn.disabled = false;
        closeDownloadModal();
    }
}

function handleHelpClick() {
    if (helpModal) {
        helpModal.classList.remove('hidden');
        // Request help data from extension
        if (vscode) {
            vscode.postMessage({ command: 'getHelpData' });
        }
    }
}

function handleBugReportClick() {
    if (bugReportModal) {
        bugReportModal.classList.remove('hidden');
        // Request help data from extension for repository info
        if (vscode) {
            vscode.postMessage({ command: 'getHelpData' });
        }
    }
}

function handleConfigChange(event) {
    // Checkboxes IDS need to match the configuration keys
    const value = event.target.checked;
    const configName = event.target.id;
    if (vscode) {
        const message = {
            command: 'updateConfig',
            key: configName,
            value: value
        };
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
                const currentHtml = regenerateBtn.innerHTML;
                regenerateBtn.innerHTML = currentHtml.replace('⏳ Regenerating...', 'Regenerate');
            }
            break;
            
        case 'regenerationError':
            if (regenerateBtn) {
                regenerateBtn.disabled = false;
                const currentHtml = regenerateBtn.innerHTML;
                regenerateBtn.innerHTML = currentHtml.replace('⏳ Regenerating...', 'Regenerate');
            }
            break;
            
        case 'pngSaved':
        case 'pngSaveError':
            if (savePngBtn) {
                savePngBtn.disabled = false;
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
    const seqToggle = document.getElementById('sequentialFlow');
    if (seqToggle) { seqToggle.checked = !!checkboxStates.sequentialFlow; }
    
}