// Mermaid initialization and rendering
let mermaidContainer;
let metadata = {};

function hideLoadingContainer() {
    const loadingContainer = document.getElementById('loadingContainer');
    if (loadingContainer) {
        loadingContainer.style.display = 'none';
    }
}

async function initializeAndRender() {
    try {
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
            themeCSS: `
              /* Make subgraph labels opaque to hide edges behind */
              .flowchart-link {
                opacity: 0.7;
              }
              /* Make subgraphs wider to accommodate buttons */
              .cluster rect {
                min-width: 200px !important;
              }
              /* Add padding to subgraph content */
              .cluster {
                padding: 20px !important;
              }
              /* Style for subgraph buttons */
              .subgraph-buttons {
                transition: opacity 0.1s ease-in-out;
              }
              .svg-button {
                cursor: pointer;
                transition: all 0.1s ease-in-out;
              }
              .svg-button:hover rect {
                fill: #1177bb !important;
                stroke: #1177bb !important;
              }
            `
        });
        
        await mermaid.run();

        // Store the initial diagram code for expand functionality
        // The diagram is injected directly into the container as text content
        const diagramText = mermaidContainer.textContent || mermaidContainer.innerText || '';
        if (diagramText && diagramText.trim() && !diagramText.includes('DIAGRAM_PLACEHOLDER')) {
            window.currentDiagramCode = diagramText.trim();
        }

        hideLoadingContainer();

        // Attach event listeners to the initial container
        attachContainerEventListeners(mermaidContainer);
        
        // Add expand/collapse buttons to subgraphs
        addSubgraphButtons();

    } catch (error) {
        hideLoadingContainer();
        console.error("Failed to initialize Mermaid:", error);
    }
}

function updateFlowchart(diagram) {
    window.currentDiagramCode = diagram;
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
            const style = document.createElement('style');
            style.textContent = `
              .cluster-label {
                fill: #1e1e1e !important;
                stroke: #ffffff !important;
                stroke-width: 3px !important;
                paint-order: stroke !important;
              }
              .cluster-label tspan {
                fill: #ffffff !important;
                stroke: #1e1e1e !important;
                stroke-width: 2px !important;
                paint-order: stroke !important;
              }
              /* Make subgraphs wider to accommodate buttons */
              .cluster rect {
                min-width: 200px !important;
              }
              /* Add padding to subgraph content */
              .cluster {
                padding: 20px !important;
              }
              /* Style for subgraph buttons */
              .subgraph-buttons {
                transition: opacity 0.1s ease-in-out;
              }
              .svg-button {
                cursor: pointer;
                transition: all 0.1s ease-in-out;
              }
              .svg-button:hover rect {
                fill: #1177bb !important;
                stroke: #1177bb !important;
              }
            `;
            document.head.appendChild(style);
            
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
            
            addSubgraphButtons();
            
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

// Function to add expand/collapse buttons to subgraphs
function addSubgraphButtons() {
    if (!mermaidContainer) { return; }

    const subgraphs = mermaidContainer.querySelectorAll('g.cluster');
    if (subgraphs.length === 0) {
        requestAnimationFrame(addSubgraphButtons);
        return;
    }

    const extractScopeName = (labelText) => {
        const m = (labelText || '').match(/^(?:Function:|Class:|Method:)\s*([^()]+)/);
        return (m ? (m[0] || labelText) : (labelText || '')).trim();
    };

    for (const subgraph of subgraphs) {
        subgraph.querySelector('.subgraph-buttons')?.remove();

        const labelEl = subgraph.querySelector('.cluster-label');
        if (!labelEl) { continue; }

        const rawLabelText = labelEl.textContent || '';
        const scopeName = extractScopeName(rawLabelText);
        if (!scopeName) { continue; }

        // Resize the subgraph rectangle
        const rect = subgraph.querySelector('rect');
        if (rect) {
            const currentWidth = parseFloat(rect.getAttribute('width')) || 0;
            const currentHeight = parseFloat(rect.getAttribute('height')) || 0;
            const currentX = parseFloat(rect.getAttribute('x')) || 0;
            const currentY = parseFloat(rect.getAttribute('y')) || 0;

            console.log('currentWidth', currentWidth);
            console.log('currentHeight', currentHeight);


            if (currentWidth < 300) {
                // Increase size by 20px and adjust position to center
                rect.setAttribute('width', currentWidth + 40);
                rect.setAttribute('x', currentX - 20);

                // Move node labels up by 10px and add width to label (DEBUGGING)
                const nodeLabels = subgraph.querySelectorAll('.cluster-label');
                nodeLabels.forEach(label => {
                    const currentTransform = label.getAttribute('transform') || '';
                    const newTransform = currentTransform ? 
                        currentTransform + ' translate(0, 0)' : 
                        'translate(0, )';
                    label.setAttribute('transform', newTransform);
                });
            }
        }

        

        const bbox = subgraph.getBBox();
        if (!bbox) { continue; }

        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', 'subgraph-buttons');
        group.setAttribute('transform', `translate(${bbox.x + bbox.width - 33}, ${bbox.y + 3})`);
        group.setAttribute('opacity', '0');
        group.setAttribute('pointer-events', 'none');
        group.style.zIndex = '1000';
        const classContext = (() => {
            // Try to find nearest ancestor cluster label that starts with "Class:"
            let p = subgraph.parentElement;
            while (p) {
                const cl = p.querySelector && p.querySelector('.cluster-label');
                const t = cl && cl.textContent ? cl.textContent : '';
                const m = t.match(/^Class:\s*([^()]+)/);
                if (m && m[1]) { return { className: m[1].trim() }; }
                p = p.parentElement;
            }
            return undefined;
        })();

        const isCollapsed = (window.isSubgraphCollapsedWithContext && window.isSubgraphCollapsedWithContext(scopeName, classContext))
            || (window.isSubgraphCollapsed && window.isSubgraphCollapsed(scopeName));
        const btn = createSVGButton(isCollapsed ? '+' : '-', isCollapsed ? 'Expand subgraph' : 'Collapse subgraph', 0, 0);
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            // reuse classContext defined above
            const fn = isCollapsed ? window.expandSubgraphWithContext : window.collapseSubgraphWithContext;
            if (typeof fn === 'function') { fn(scopeName, classContext); }
        });

        const goToDefBtn = createSVGButton('</>', 'Go to Definition', -35, 0);
        goToDefBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            try {
                const fnName = (scopeName || '').replace(/^class_/, '').replace(/_call_.*$/, '');
                if (window.vscode && window.vscode.postMessage) {
                    window.vscode.postMessage({
                        command: 'goToDefinition',
                        functionName: fnName
                    });
                } else if (typeof window.goToDefinition === 'function') {
                    window.goToDefinition(fnName);
                }
            } catch (err) {
                console.error('goToDefinition click failed', err);
            }
        });

        group.appendChild(goToDefBtn);
        group.appendChild(btn);

        subgraph.addEventListener('mouseenter', () => {
            group.setAttribute('opacity', '1');
            group.setAttribute('pointer-events', 'auto');
        });
        subgraph.addEventListener('mouseleave', () => {
            group.setAttribute('opacity', '0');
            group.setAttribute('pointer-events', 'none');
        });

        subgraph.appendChild(group);
    }
}

// Helper function to create SVG buttons
function createSVGButton(text, title, x, y) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'svg-button');
    group.setAttribute('transform', `translate(${x}, ${y})`);
    
    // Create button background
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', '30');
    rect.setAttribute('height', '30');
    rect.setAttribute('rx', '3');
    rect.setAttribute('ry', '3');
    rect.setAttribute('fill', '#0e639c');
    rect.setAttribute('stroke', '#0e639c');
    rect.setAttribute('stroke-width', '1');
    rect.setAttribute('cursor', 'pointer');
    
    // Create button text
    const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textElement.setAttribute('x', '15');
    textElement.setAttribute('y', '20');
    textElement.setAttribute('text-anchor', 'middle');
    textElement.setAttribute('fill', '#ffffff');
    textElement.setAttribute('font-size', '14');
    textElement.setAttribute('font-weight', 'bold');
    textElement.setAttribute('font-family', 'var(--vscode-font-family)');
    textElement.setAttribute('pointer-events', 'none');
    textElement.textContent = text;
    
    // Add title for tooltip
    const titleElement = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    titleElement.textContent = title;
    
    // Add hover effects
    group.addEventListener('mouseenter', () => {
        rect.setAttribute('fill', '#1177bb');
        rect.setAttribute('stroke', '#1177bb');
    });
    
    group.addEventListener('mouseleave', () => {
        rect.setAttribute('fill', '#0e639c');
        rect.setAttribute('stroke', '#0e639c');
    });
    
    // Assemble the button
    group.appendChild(rect);
    group.appendChild(textElement);
    group.appendChild(titleElement);
    
    return group;
}

// Make updateFlowchart globally available
window.updateFlowchart = updateFlowchart;
window.addSubgraphButtons = addSubgraphButtons;
