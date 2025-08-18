// Mermaid initialization and rendering
let mermaidContainer;
let tooltipData = {};

function hideLoadingContainer() {
    const loadingContainer = document.getElementById('loadingContainer');
    if (loadingContainer) {
        loadingContainer.style.display = 'none';
    }
}

async function initializeAndRender() {
    try {
        console.log("Initializing Mermaid...");
        
        // waitMermaidToLoad();
        
        console.log("Mermaid library loaded, initializing...");
        
        // Find the mermaid container element
        mermaidContainer = document.getElementById('mermaidContainer');
        
        // Add 'mermaid' class to the container
        mermaidContainer.classList.add('mermaid');
        
        if (!mermaidContainer) {
            throw new Error('Mermaid container element not found in DOM');
        }
        
        mermaid.initialize({
            theme: "dark",
            securityLevel: "loose",
            fontFamily: "var(--vscode-font-family)",
            startOnLoad: true,
        });
        
        await mermaid.run();

        hideLoadingContainer();

        // Attach event listeners to the initial container
        attachContainerEventListeners(mermaidContainer);
        
        // Mark clickable nodes after a short delay
        setTimeout(markClickableNodes, 300);
    } catch (error) {
        hideLoadingContainer();
        console.error("Failed to initialize Mermaid:", error);
    }
}

function updateFlowchart(diagram) {
    if (!mermaidContainer) {
        console.error('Mermaid container not found');
        return;
    }

    try {
        // Hide mermaid container and show loading message
        mermaidContainer.style.display = 'none';
        const loadingContainer = document.getElementById('loadingContainer');
        if (loadingContainer) {
            loadingContainer.style.display = 'flex';
        }
        
        // Clear container before rendering
        mermaidContainer.setAttribute('data-processed', 'false');
        mermaidContainer.innerHTML = '';
        
        // Generate unique ID for this render
        const uniqueId = 'mermaid_' + Date.now();
        
        // Render the new diagram with unique ID
        mermaid.render(uniqueId, diagram).then(({ svg }) => {
            // Insert the SVG content into our container
            mermaidContainer.innerHTML = svg;
            
            // Hide loading and show mermaid container
            if (loadingContainer) {
                loadingContainer.style.display = 'none';
            }
            mermaidContainer.style.display = 'block';
            
            // Re-attach event listeners to the container
            attachContainerEventListeners(mermaidContainer);
            
            // Preserve zoom and pan state
            setTimeout(() => {
                // Fit diagram to container on each render
                updateTransform();
                updateZoomLevel();
            }, 100);
            
            // Mark clickable nodes again
            setTimeout(markClickableNodes, 300);
            
        }).catch(error => {
            console.error('Mermaid rendering failed:', error);
            hideLoadingContainer();
        });
        
    } catch (error) {
        console.error('❌ Error updating flowchart:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack,
            diagram: diagram
        });
    }
}

function markClickableNodes() {
    if (!tooltipData || Object.keys(tooltipData).length === 0) return;

    Object.keys(tooltipData).forEach((nodeId) => {
        const el = document.getElementById(nodeId);
        if (el) {
            el.classList.add("clickable");
            el.style.cursor = "pointer";
        }
    });
}
