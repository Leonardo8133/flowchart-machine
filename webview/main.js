// Main initialization file
document.addEventListener("DOMContentLoaded", function () {
    // Wait longer for all scripts and external libraries to load
    setTimeout(() => {
        // Check if all required functions are available
        if (typeof initializeControls === 'function' && 
            typeof initializeTooltip === 'function' && 
            typeof handleExtensionMessage === 'function' &&
            typeof initializeAndRender === 'function') {
            
            // Initialize all components
            initializeControls();
            initializeTooltip();
            
            // Set up message handling
            window.addEventListener('message', handleExtensionMessage);
            
            // Check if we're running in VS Code or browser
            if (typeof acquireVsCodeApi === "function") {
                // In VS Code, initialize Mermaid
                initializeAndRender();
            } else {
                // In browser, show demo message
                const container = document.getElementById('mermaidContainer');
                if (container) {
                    container.innerHTML = 'This webview is designed to run in VS Code. Open a Python file and use the "Generate Python Flowchart" command.';
                }
            }
        } else {
            console.error('Some required functions are not available:', {
                initializeControls: typeof initializeControls,
                initializeTooltip: typeof initializeTooltip,
                handleExtensionMessage: typeof handleExtensionMessage,
                initializeAndRender: typeof initializeAndRender
            });
        }
    }, 500);
});
