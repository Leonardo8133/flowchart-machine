// Expand/collapse functionality backed by WhitelistService state
// We also track automatically collapsed subgraphs from Python metadata
let subgraphStates = {}; // UI state hint (expanded/collapsed), optional
let whitelistSet = new Set();
let forceCollapseSet = new Set();
let collapsedSubgraphsMetadata = {}; // Track automatically collapsed subgraphs
let expandedSubgraphsMetadata = {}; // Track automatically expanded subgraphs
let subgraphStatusMap = {}; // Unified map of all subgraph statuses
let allSubgraphsList = []; // Canonical subgraph identifiers from Python

// Receive current lists from the extension and update local caches
function updateSubgraphStates(payload) {
    const whitelist = Array.isArray(payload?.whitelist) ? payload.whitelist : [];
    const forceList = Array.isArray(payload?.forceCollapse) ? payload.forceCollapse : [];
    const metadata = payload?.metadata || {};

    // Process names for consistent matching
    whitelistSet = new Set(whitelist.map(name => name.replace(/\(\)/g, '').replace(/\(.*\)/g, '').trim()));
    forceCollapseSet = new Set(forceList.map(name => name.replace(/\(\)/g, '').replace(/\(.*\)/g, '').trim()));
    
    // Use new comprehensive metadata structure
    collapsedSubgraphsMetadata = metadata.collapsed_subgraphs || {};
    expandedSubgraphsMetadata = metadata.expanded_subgraphs || {};
    subgraphStatusMap = metadata.subgraph_status_map || {};
    allSubgraphsList = Array.isArray(metadata.all_subgraphs) ? metadata.all_subgraphs : [];
    
    console.log('Updated subgraph states:', {
        collapsed: Object.keys(collapsedSubgraphsMetadata).length,
        expanded: Object.keys(expandedSubgraphsMetadata).length,
        total: Object.keys(subgraphStatusMap).length
    });
    
    // Update statistics display
    updateSubgraphStatistics();
}

// Function to check if a subgraph is collapsed using new metadata
function isSubgraphCollapsed(scopeName) {
    // Clean the scope name by removing the parentheses and arguments
    const originalScopeName = scopeName;
    scopeName = scopeName.replace(/\(\)/g, '').replace(/\(.*\)/g, '').trim();

    // First, try to get status from the unified status map (most reliable)
    const statusInfo = subgraphStatusMap[originalScopeName] || subgraphStatusMap[scopeName];
    if (statusInfo && statusInfo.status) {
        return statusInfo.status === 'collapsed';
    }

    // Fallback to legacy detection methods
    const isWhitelisted = whitelistSet.has(scopeName);
    const isForceCollapsed = forceCollapseSet.has(scopeName);
    const isAutoCollapsed = collapsedSubgraphsMetadata[originalScopeName] || collapsedSubgraphsMetadata[scopeName];

    // Not collapsed if whitelisted
    if (isWhitelisted) {
        return false;
    }

    // Check if automatically collapsed by Python
    if (isAutoCollapsed) {
        return true;
    }

    // Collapsed if explicitly in force list
    if (isForceCollapsed) {
        return true;
    }

    return false;
}

// Context-aware collapsed-state check using canonical resolution and new metadata
function isSubgraphCollapsedWithContext(displayLabel, context) {
    const canonical = resolveCanonicalScope(displayLabel, context);
    const processed = canonical.replace(/\(\)/g, '').replace(/\(.*\)/g, '').trim();

    // First, try to get status from the unified status map (most reliable)
    const statusInfo = subgraphStatusMap[canonical];
    if (statusInfo && statusInfo.status) {
        return statusInfo.status === 'collapsed';
    }

    // Fallback to legacy detection methods
    const isWhitelisted = whitelistSet.has(processed);
    if (isWhitelisted) { return false; }

    const isAutoCollapsed = !!collapsedSubgraphsMetadata[canonical];
    if (isAutoCollapsed) { return true; }

    const isForceCollapsed = forceCollapseSet.has(processed);
    if (isForceCollapsed) { return true; }

    return false;
}

// Helper function to get subgraph information from new metadata
function getSubgraphInfo(scopeName) {
    const originalScopeName = scopeName;
    const cleanedScopeName = scopeName.replace(/\(\)/g, '').replace(/\(.*\)/g, '').trim();
    
    // Try to get from status map first
    let statusInfo = subgraphStatusMap[originalScopeName] || subgraphStatusMap[cleanedScopeName];
    
    if (statusInfo) {
        return {
            status: statusInfo.status,
            nodeCount: statusInfo.node_count,
            subgraphName: statusInfo.subgraph_name,
            scopeNodes: statusInfo.scope_nodes,
            isCollapsed: statusInfo.status === 'collapsed',
            isExpanded: statusInfo.status === 'expanded'
        };
    }
    
    // Fallback to individual maps
    if (collapsedSubgraphsMetadata[originalScopeName] || collapsedSubgraphsMetadata[cleanedScopeName]) {
        const info = collapsedSubgraphsMetadata[originalScopeName] || collapsedSubgraphsMetadata[cleanedScopeName];
        return {
            status: 'collapsed',
            nodeCount: info.node_count,
            subgraphName: info.subgraph_name,
            scopeNodes: info.scope_nodes,
            isCollapsed: true,
            isExpanded: false
        };
    }
    
    if (expandedSubgraphsMetadata[originalScopeName] || expandedSubgraphsMetadata[cleanedScopeName]) {
        const info = expandedSubgraphsMetadata[originalScopeName] || expandedSubgraphsMetadata[cleanedScopeName];
        return {
            status: 'expanded',
            nodeCount: info.node_count,
            subgraphName: info.subgraph_name,
            scopeNodes: info.scope_nodes,
            isCollapsed: false,
            isExpanded: true
        };
    }
    
    return null;
}

// Function to get all subgraphs with their status
function getAllSubgraphStatuses() {
    const statuses = {};
    for (const [scope, info] of Object.entries(subgraphStatusMap)) {
        statuses[scope] = {
            status: info.status,
            nodeCount: info.node_count,
            subgraphName: info.subgraph_name,
            isCollapsed: info.status === 'collapsed',
            isExpanded: info.status === 'expanded'
        };
    }
    return statuses;
}

// Function to expand a collapsed subgraph by adding it to whitelist
function expandSubgraph(scopeName) {
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
    
    // Debug logging
    console.log('resolveCanonicalScope:', { displayLabel, context, raw, allSubgraphsList });
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
        
        // First, try to find exact matches in allSubgraphsList
        const exactMatches = allSubgraphsList.filter(s => s.endsWith(`_${methodName}`));
        if (exactMatches.length === 1) { 
            return exactMatches[0]; 
        }
        
        // If we have class context, try to use it
        if (className) {
            const candidate = `class_${className}_${methodName}`;
            if (allSubgraphsList.includes(candidate)) { return candidate; }
            // If not found, try to find a match with the same class name
            const classMatches = exactMatches.filter(s => s.includes(`_${className}_`));
            if (classMatches.length === 1) { return classMatches[0]; }
        }
        
        // Fallback: return first match or method name
        return exactMatches[0] || methodName;
    }

    // Fallback: return as-is
    return raw;
}

function expandSubgraphWithContext(displayLabel, context) {
    const canonical = resolveCanonicalScope(displayLabel, context);
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
    console.log('collapseSubgraphWithContext:', { displayLabel, context, canonical });
    
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

// Enhanced expand/collapse all functionality using new metadata
function expandAllSubgraphs() {
    console.log('Expanding all subgraphs using new metadata...');
    
    // Get all subgraphs from the status map
    const allStatuses = getAllSubgraphStatuses();
    const collapsedScopes = Object.keys(allStatuses).filter(scope => allStatuses[scope].isCollapsed);
    
    console.log(`Found ${collapsedScopes.length} collapsed subgraphs to expand`);
    
    if (collapsedScopes.length === 0) {
        console.log('No collapsed subgraphs to expand');
        return;
    }
    
    // Send message to extension to expand all
    if (window.vscode && window.vscode.postMessage) {
        window.vscode.postMessage({ 
            command: 'expandAllSubgraphs',
            scopes: collapsedScopes,
            metadata: {
                collapsed_subgraphs: collapsedSubgraphsMetadata,
                expanded_subgraphs: expandedSubgraphsMetadata,
                subgraph_status_map: subgraphStatusMap
            }
        });
    } else {
        console.error('VS Code API not available for expand all');
    }
}

function collapseAllSubgraphs() {
    console.log('Collapsing all subgraphs using new metadata...');
    
    // Get all subgraphs from the status map
    const allStatuses = getAllSubgraphStatuses();
    const expandedScopes = Object.keys(allStatuses).filter(scope => allStatuses[scope].isExpanded);
    
    console.log(`Found ${expandedScopes.length} expanded subgraphs to collapse`);
    
    if (expandedScopes.length === 0) {
        console.log('No expanded subgraphs to collapse');
        return;
    }
    
    // Send message to extension to collapse all
    if (window.vscode && window.vscode.postMessage) {
        window.vscode.postMessage({ 
            command: 'collapseAllSubgraphs',
            scopes: expandedScopes,
            metadata: {
                collapsed_subgraphs: collapsedSubgraphsMetadata,
                expanded_subgraphs: expandedSubgraphsMetadata,
                subgraph_status_map: subgraphStatusMap
            }
        });
    } else {
        console.error('VS Code API not available for collapse all');
    }
}

// Function to get statistics about subgraph states
function getSubgraphStatistics() {
    const allStatuses = getAllSubgraphStatuses();
    const total = Object.keys(allStatuses).length;
    const collapsed = Object.values(allStatuses).filter(s => s.isCollapsed).length;
    const expanded = Object.values(allStatuses).filter(s => s.isExpanded).length;
    
    return {
        total,
        collapsed,
        expanded,
        collapsedPercentage: total > 0 ? Math.round((collapsed / total) * 100) : 0,
        expandedPercentage: total > 0 ? Math.round((expanded / total) * 100) : 0
    };
}

// Function to update subgraph statistics display
function updateSubgraphStatistics() {
    const statsElement = document.getElementById('subgraphStats');
    if (!statsElement) return;
    
    const stats = getSubgraphStatistics();
    
    if (stats.total === 0) {
        statsElement.querySelector('.stats-text').textContent = 'No subgraphs';
        return;
    }
    
    const statsText = `${stats.expanded}↑ ${stats.collapsed}↓ (${stats.total} total)`;
    statsElement.querySelector('.stats-text').textContent = statsText;
    
    // Update tooltip with detailed information
    statsElement.title = `Subgraph Statistics:\n` +
        `• Total: ${stats.total}\n` +
        `• Expanded: ${stats.expanded} (${stats.expandedPercentage}%)\n` +
        `• Collapsed: ${stats.collapsed} (${stats.collapsedPercentage}%)`;
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
