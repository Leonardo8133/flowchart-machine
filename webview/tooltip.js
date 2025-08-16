// Tooltip functionality
let tooltipDiv;
let lastClickedNodeId = null;

function initializeTooltip() {
    tooltipDiv = document.getElementById('tooltip');
    
    // Click event listener for tooltips
    document.addEventListener("click", function (e) {
        const clickedElement = e.target.closest(".clickable");
        if (clickedElement && lastClickedNodeId) {
            const content = tooltipData[lastClickedNodeId];
            if (content) {
                tooltipDiv.innerHTML = content;
                const rect = clickedElement.getBoundingClientRect();
                tooltipDiv.style.left = rect.right + 10 + "px";
                tooltipDiv.style.top = rect.top + "px";
                tooltipDiv.style.display = "block";
            }
            lastClickedNodeId = null;
        } else {
            tooltipDiv.style.display = "none";
        }
    }, true);
}

// Expose function globally for Mermaid click events
window.setClickedNode = function (nodeId) {
    lastClickedNodeId = nodeId;
};
