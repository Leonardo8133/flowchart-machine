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
let financingBtn;
let financingModal;
let financingSourcesContainer;
let addFinancingSourceBtn;
let calculateFinancingBtn;
let financingResult;
let financingForm;

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
    financingBtn = document.getElementById('financingBtn');
    financingModal = document.getElementById('financingModal');
    financingSourcesContainer = document.getElementById('financingSourcesContainer');
    addFinancingSourceBtn = document.getElementById('addFinancingSourceBtn');
    calculateFinancingBtn = document.getElementById('calculateFinancingBtn');
    financingResult = document.getElementById('financingResult');
    financingForm = document.getElementById('financingForm');

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

    const financingModalClose = document.getElementById('financingModalClose');
    const financingModalBackdrop = financingModal ? financingModal.querySelector('.modal-backdrop') : null;

    if (financingModalClose) {
        financingModalClose.addEventListener('click', closeFinancingModal);
    }

    if (financingModalBackdrop) {
        financingModalBackdrop.addEventListener('click', closeFinancingModal);
    }

    if (financingBtn) {
        financingBtn.addEventListener('click', handleFinancingClick);
    }

    if (addFinancingSourceBtn) {
        addFinancingSourceBtn.addEventListener('click', () => addFinancingSourceRow());
    }

    if (calculateFinancingBtn) {
        calculateFinancingBtn.addEventListener('click', calculateFinancingPlan);
    }

    if (financingForm) {
        financingForm.addEventListener('submit', (event) => {
            event.preventDefault();
            calculateFinancingPlan();
        });
    }

    if (financingResult) {
        setFinancingResult('Informe os valores para gerar o resumo do financiamento.', false);
    }

    if (financingSourcesContainer && financingSourcesContainer.childElementCount === 0) {
        addFinancingSourceRow();
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

    if (helpBtn) {
        helpBtn.addEventListener('click', handleHelpClick);
    }

    if (bugReportBtn) {
        bugReportBtn.addEventListener('click', handleBugReportClick);
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

function closeFinancingModal() {
    if (financingModal) {
        financingModal.classList.add('hidden');
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

function handleFinancingClick() {
    if (financingModal) {
        financingModal.classList.remove('hidden');
        if (typeof window.enhanceHelpTargets === 'function') {
            window.enhanceHelpTargets(financingModal);
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

}

function addFinancingSourceRow(name = '', value = '') {
    if (!financingSourcesContainer) {
        return;
    }

    const row = document.createElement('div');
    row.className = 'financing-source-row';
    row.setAttribute('data-help', 'Informe o nome da fonte (pessoa ou origem) e o valor aportado.');

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Nome da fonte';
    nameInput.value = name;
    nameInput.className = 'financing-source-name';
    nameInput.setAttribute('aria-label', 'Nome da fonte de investimento');

    const amountInput = document.createElement('input');
    amountInput.type = 'number';
    amountInput.placeholder = 'Valor (R$)';
    amountInput.min = '0';
    amountInput.step = '0.01';
    amountInput.value = value;
    amountInput.className = 'financing-source-amount';
    amountInput.setAttribute('aria-label', 'Valor investido pela fonte');

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'financing-remove-source';
    removeBtn.textContent = 'Remover';
    removeBtn.title = 'Remover fonte';
    removeBtn.addEventListener('click', () => {
        row.remove();
        if (financingSourcesContainer.childElementCount === 0) {
            addFinancingSourceRow();
        }
    });

    row.appendChild(nameInput);
    row.appendChild(amountInput);
    row.appendChild(removeBtn);
    financingSourcesContainer.appendChild(row);

    if (typeof window.enhanceHelpTargets === 'function') {
        window.enhanceHelpTargets(row);
    }
}

function setFinancingResult(message, isError) {
    if (!financingResult) {
        return;
    }
    financingResult.innerHTML = message;
    financingResult.classList.toggle('error', Boolean(isError));
    if (typeof window.enhanceHelpTargets === 'function') {
        window.enhanceHelpTargets(financingResult);
    }
}

function calculateFinancingPlan() {
    if (!financingResult) {
        return;
    }

    const amountInput = document.getElementById('financingAmount');
    const rateInput = document.getElementById('financingRate');
    const monthsInput = document.getElementById('financingMonths');

    const amount = parseFloat(amountInput?.value ?? '');
    const months = parseInt(monthsInput?.value ?? '', 10);
    const rawRate = parseFloat(rateInput?.value ?? '');

    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(months) || months <= 0) {
        setFinancingResult('Informe um valor total e um prazo válidos para realizar o cálculo.', true);
        return;
    }

    const monthlyRate = Number.isFinite(rawRate) ? rawRate / 100 : 0;
    const safeRate = Number.isFinite(monthlyRate) ? monthlyRate : 0;
    const payment = safeRate > 0
        ? (amount * safeRate) / (1 - Math.pow(1 + safeRate, -months))
        : amount / months;

    const sources = [];
    if (financingSourcesContainer) {
        financingSourcesContainer.querySelectorAll('.financing-source-row').forEach(row => {
            const nameInputEl = row.querySelector('.financing-source-name');
            const valueInputEl = row.querySelector('.financing-source-amount');
            const sourceName = nameInputEl?.value?.trim() || 'Fonte';
            const sourceValue = parseFloat(valueInputEl?.value ?? '');
            const normalizedValue = Number.isFinite(sourceValue) && sourceValue > 0 ? sourceValue : 0;
            sources.push({ name: sourceName, amount: normalizedValue });
        });
    }

    const totalSources = sources.reduce((sum, source) => sum + source.amount, 0);
    const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

    let summary = `<p><strong>Valor financiado:</strong> ${formatter.format(amount)}</p>`;
    summary += `<p><strong>Prazo:</strong> ${months} mês${months === 1 ? '' : 'es'}`;
    if (Number.isFinite(rawRate) && rawRate > 0) {
        summary += ` · <strong>Juros:</strong> ${rawRate.toFixed(2)}% a.m.`;
    }
    summary += `</p>`;
    summary += `<p><strong>Parcela mensal estimada:</strong> ${formatter.format(payment)}</p>`;
    summary += `<p><strong>Total das fontes cadastradas:</strong> ${formatter.format(totalSources)}</p>`;

    if (sources.length > 0) {
        summary += '<p><strong>Participação por fonte:</strong></p><ul>';
        sources.forEach(source => {
            const share = totalSources > 0 ? (source.amount / totalSources) : 0;
            const parcelShare = payment * share;
            summary += `<li><strong>${source.name}</strong>: ${formatter.format(source.amount)} (${(share * 100).toFixed(1)}% do total) · Parcela proporcional: ${formatter.format(parcelShare)}</li>`;
        });
        summary += '</ul>';
    } else {
        summary += '<p>Adicione fontes para acompanhar diferentes pessoas ou origens de investimento.</p>';
    }

    const remaining = amount - totalSources;
    if (remaining > 0.01) {
        summary += `<p><strong>Saldo restante:</strong> ${formatter.format(remaining)} ainda precisa ser distribuído entre as fontes.</p>`;
    } else if (remaining < -0.01) {
        summary += `<p><strong>Excedente:</strong> ${formatter.format(Math.abs(remaining))} além do valor necessário foi informado.</p>`;
    } else {
        summary += '<p>As fontes cobrem exatamente o valor financiado.</p>';
    }

    setFinancingResult(summary, false);
}