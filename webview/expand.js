// Expand/collapse functionality backed by WhitelistService state
// We also track automatically collapsed subgraphs from Python metadata
let subgraphStates = {}; // UI state hint (expanded/collapsed), optional
let whitelistSet = new Set();
let forceCollapseSet = new Set();
let collapsedSubgraphsMetadata = {}; // Track automatically collapsed subgraphs

// Receive current lists from the extension and update local caches
function updateSubgraphStates(payload) {
    const whitelist = Array.isArray(payload?.whitelist) ? payload.whitelist : [];
    const forceList = Array.isArray(payload?.forceCollapse) ? payload.forceCollapse : [];
    const metadata = payload?.metadata || {};

    // Process names for consistent matching
    whitelistSet = new Set(whitelist.map(name => name.replace(/\(\)/g, '').replace(/\(.*\)/g, '').trim()));
    forceCollapseSet = new Set(forceList.map(name => name.replace(/\(\)/g, '').replace(/\(.*\)/g, '').trim()));
    collapsedSubgraphsMetadata = metadata.collapsed_subgraphs || {};
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
window.resetSubgraphStates = resetSubgraphStates;
