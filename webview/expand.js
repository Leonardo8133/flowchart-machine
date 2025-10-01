// Expand/collapse functionality backed by WhitelistService state
// We also track automatically collapsed subgraphs from Python metadata
let subgraphStates = {}; // UI state hint (expanded/collapsed), optional
let whitelistSet = new Set();
let forceCollapseSet = new Set();
let collapsedSubgraphsMetadata = {}; // Track automatically collapsed subgraphs
let allSubgraphsList = []; // Canonical subgraph identifiers from Python

// Receive current lists from the extension and update local caches
function updateSubgraphStates(payload) {
    const whitelist = Array.isArray(payload?.whitelist) ? payload.whitelist : [];
    const forceList = Array.isArray(payload?.forceCollapse) ? payload.forceCollapse : [];
    const metadata = payload?.metadata || {};

    // Process names for consistent matching
    whitelistSet = new Set(whitelist.map(name => name.replace(/\(\)/g, '').replace(/\(.*\)/g, '').trim()));
    forceCollapseSet = new Set(forceList.map(name => name.replace(/\(\)/g, '').replace(/\(.*\)/g, '').trim()));
    collapsedSubgraphsMetadata = metadata.collapsed_subgraphs || {};
    allSubgraphsList = Array.isArray(metadata.all_subgraphs) ? metadata.all_subgraphs : [];
}

// Function to check if a subgraph is collapsed
function isSubgraphCollapsed(scopeName) {
    // Clean the scope name by removing the parentheses and arguments
    const originalScopeName = scopeName;
    scopeName = scopeName.replace(/\(\)/g, '').replace(/\(.*\)/g, '').trim();
    console.log('isSubgraphCollapsed called with:', originalScopeName, '-> processed:', scopeName);
    console.log('whitelistSet', whitelistSet);
    console.log('forceCollapseSet', forceCollapseSet);
    console.log('collapsedSubgraphsMetadata', collapsedSubgraphsMetadata);

    // Check if the processed scope name matches any of the sets
    const isWhitelisted = whitelistSet.has(scopeName);
    const isForceCollapsed = forceCollapseSet.has(scopeName);
    const isAutoCollapsed = collapsedSubgraphsMetadata[originalScopeName] || collapsedSubgraphsMetadata[scopeName];

    console.log('Results:', { isWhitelisted, isForceCollapsed, isAutoCollapsed });

    // Not collapsed if whitelisted
    if (isWhitelisted) {
        console.log('Returning false: whitelisted');
        return false;
    }

    // Check if automatically collapsed by Python
    if (isAutoCollapsed) {
        console.log('Returning true: auto collapsed');
        return true;
    }

    // Collapsed if explicitly in force list
    if (isForceCollapsed) {
        console.log('Returning true: force collapsed');
        return true;
    }

    console.log('Returning false: not collapsed');
    return false;
}

// Context-aware collapsed-state check using canonical resolution
function isSubgraphCollapsedWithContext(displayLabel, context) {
    const canonical = resolveCanonicalScope(displayLabel, context);
    const processed = canonical.replace(/\(\)/g, '').replace(/\(.*\)/g, '').trim();

    const isWhitelisted = whitelistSet.has(processed);
    if (isWhitelisted) { return false; }

    const isAutoCollapsed = !!collapsedSubgraphsMetadata[canonical];
    if (isAutoCollapsed) { return true; }

    const isForceCollapsed = forceCollapseSet.has(processed);
    if (isForceCollapsed) { return true; }

    return false;
}

// Function to expand a collapsed subgraph by adding it to whitelist
function expandSubgraph(scopeName) {
    console.log('Expanding subgraph', scopeName);
    // Update state to expanded
    subgraphStates[scopeName] = 'expanded';

    // Process the scope name for consistent matching
    const processedScopeName = scopeName.replace(/\(\)/g, '').replace(/\(.*\)/g, '').trim();

    // Optimistically update local lists
    // Find and remove from force collapse set
    if (forceCollapseSet.has(processedScopeName)) {
        forceCollapseSet.delete(processedScopeName);
    }

    // Add to whitelist
    whitelistSet.add(processedScopeName);
    // Request expansion from the extension
    requestExpandSubgraph(scopeName);
}

// Function to create expand/collapse button for individual subgraphs
function createSubgraphToggleButton(scopeName, isCollapsed) {
    const button = document.createElement('button');
    button.className = 'subgraph-toggle-button';
    button.title = isCollapsed ? 'Expand subgraph' : 'Collapse subgraph';
    
    if (isCollapsed) {
        button.innerHTML = '<img src="{{maximizeIcon}}" width="14" height="14" alt="Expand">';
        button.onclick = () => expandSubgraph(scopeName);
    } else {
        button.innerHTML = '<img src="{{minusIcon}}" width="14" height="14" alt="Collapse">';
        button.onclick = () => collapseSubgraph(scopeName);
    }
    
    return button;
}

// Function to collapse an expanded subgraph by removing it from whitelist
function collapseSubgraph(scopeName) {
    console.log('Collapsing subgraph', scopeName);
    // Update state to collapsed
    subgraphStates[scopeName] = 'collapsed';

    // Process the scope name for consistent matching
    const processedScopeName = scopeName.replace(/\(\)/g, '').replace(/\(.*\)/g, '').trim();

    // Optimistically update local lists
    // Find and remove from whitelist
    if (whitelistSet.has(processedScopeName)) {
        whitelistSet.delete(processedScopeName);
    }

    // Add to force collapse
    forceCollapseSet.add(processedScopeName);
    // Request collapse from the extension
    requestCollapseSubgraph(scopeName);
}

// Request expansion from the extension
function requestExpandSubgraph(scopeName) {
    // Send message to extension to expand subgraph
    if (window.vscode && window.vscode.postMessage) {
        window.vscode.postMessage({
            command: 'expandSubgraph',
            scopeName: scopeName
        });
    } else {
        console.error('❌ VS Code API not available for expansion');
    }
}

// Request collapse from the extension
function requestCollapseSubgraph(scopeName) {
    if (window.vscode && window.vscode.postMessage) {
        window.vscode.postMessage({
            command: 'collapseSubgraph',
            scopeName: scopeName
        });
    } else {
        console.error('VS Code API not available for collapse');
    }
}

// ============================
// Canonical resolution helpers
// ============================

function stripExtra(label) {
    // Remove trailing count e.g. " (12 nodes)" and parentheses arguments like ()
    return (label || '')
        .replace(/\s*\([^)]*nodes\)\s*$/i, '')
        .replace(/\(\)/g, '')
        .trim();
}

function resolveCanonicalScope(displayLabel, context) {
    // If already looks canonical and present, return as-is
    if (displayLabel && allSubgraphsList.includes(displayLabel)) { return displayLabel; }

    const raw = stripExtra(displayLabel);
    // Class label
    if (/^Class:\s*/i.test(raw)) {
        const className = raw.replace(/^Class:\s*/i, '').trim();
        const candidate = `class_${className}`;
        if (allSubgraphsList.includes(candidate)) { return candidate; }
        return candidate; // best-effort
    }
    // Function label (may be "Function: foo" or "Function: foo - Call X")
    if (/^Function:\s*/i.test(raw)) {
        const funcPart = raw.replace(/^Function:\s*/i, '').replace(/\s*-\s*Call.*$/i, '').trim();
        const funcName = funcPart.replace(/\(\)$/, '').trim();
        // Prefer exact function scope
        if (allSubgraphsList.includes(funcName)) { return funcName; }
        // Otherwise if a single call-instance exists, pick that
        const callMatches = allSubgraphsList.filter(s => s === funcName || s.startsWith(`${funcName}_call_`));
        if (callMatches.length === 1) { return callMatches[0]; }
        return funcName; // best-effort
    }
    // Method label
    if (/^Method:\s*/i.test(raw)) {
        const methodName = raw.replace(/^Method:\s*/i, '').trim();
        const className = (context && context.className) ? context.className : undefined;
        if (className) {
            const candidate = `class_${className}_${methodName}`;
            if (allSubgraphsList.includes(candidate)) { return candidate; }
            return candidate; // best-effort
        }
        // Try to uniquely resolve by suffix if no class context
        const matches = allSubgraphsList.filter(s => /^class_/.test(s) && s.endsWith(`_${methodName}`));
        if (matches.length === 1) { return matches[0]; }
        return matches[0] || methodName; // fallback to first if ambiguous
    }

    // Fallback: return as-is
    return raw;
}

function expandSubgraphWithContext(displayLabel, context) {
    const canonical = resolveCanonicalScope(displayLabel, context);
    console.log('expandSubgraphWithContext', { displayLabel, context, canonical });
    // Update state
    subgraphStates[displayLabel] = 'expanded';
    // Keep local sets in sync (use canonical for stable matching)
    const processed = canonical.replace(/\(\)/g, '').replace(/\(.*\)/g, '').trim();
    if (forceCollapseSet.has(processed)) { forceCollapseSet.delete(processed); }
    whitelistSet.add(processed);
    // Send message to extension with canonical scope name
    if (window.vscode && window.vscode.postMessage) {
        window.vscode.postMessage({ command: 'expandSubgraph', scopeName: canonical });
    } else {
        console.error('❌ VS Code API not available for expansion');
    }
}

function collapseSubgraphWithContext(displayLabel, context) {
    const canonical = resolveCanonicalScope(displayLabel, context);
    console.log('collapseSubgraphWithContext', { displayLabel, context, canonical });
    // Update state
    subgraphStates[displayLabel] = 'collapsed';
    // Keep local sets in sync (use canonical for stable matching)
    const processed = canonical.replace(/\(\)/g, '').replace(/\(.*\)/g, '').trim();
    if (whitelistSet.has(processed)) { whitelistSet.delete(processed); }
    forceCollapseSet.add(processed);
    // Send message to extension with canonical scope name
    if (window.vscode && window.vscode.postMessage) {
        window.vscode.postMessage({ command: 'collapseSubgraph', scopeName: canonical });
    } else {
        console.error('VS Code API not available for collapse');
    }
}

// Backwards compat noop (metadata no longer used)
function createExpandFunctions() {}

// Function to reset subgraph states (called when new diagram is loaded)
function resetSubgraphStates() {
    subgraphStates = {};
    // Note: whitelistSet, forceCollapseSet, and collapsedSubgraphsMetadata are managed by updateSubgraphStates
}

// Expose functions globally
window.updateSubgraphStates = updateSubgraphStates;
window.createExpandFunctions = createExpandFunctions;
window.expandSubgraph = expandSubgraph;
window.collapseSubgraph = collapseSubgraph;
window.isSubgraphCollapsed = isSubgraphCollapsed;
window.isSubgraphCollapsedWithContext = isSubgraphCollapsedWithContext;
window.resetSubgraphStates = resetSubgraphStates;
window.createSubgraphToggleButton = createSubgraphToggleButton;
window.expandSubgraphWithContext = expandSubgraphWithContext;
window.collapseSubgraphWithContext = collapseSubgraphWithContext;
