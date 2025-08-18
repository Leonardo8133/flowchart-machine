/**
 * Export functionality for converting SVG flowcharts to PNG
 */

/**
 * Convert SVG to PNG and send to extension
 */
async function convertSvgToPng() {
    try {
        // Get SVG from .mermaid class
        const mermaidElement = document.querySelector('.mermaid');
        if (!mermaidElement) {
            throw new Error('No flowchart found. Please generate a flowchart first.');
        }

        const svgElement = mermaidElement.querySelector('svg');
        if (!svgElement) {
            throw new Error('No SVG found in the flowchart. Please regenerate the flowchart.');
        }

        // Get SVG content and convert to PNG
        const svgString = new XMLSerializer().serializeToString(svgElement);
        const dimensions = calculateDimensions(svgElement);
        const pngDataUrl = await svgToPng(svgString, dimensions.width, dimensions.height);
        
        // Send single message to extension
        if (typeof window.vscode !== 'undefined') {
            window.vscode.postMessage({
                command: 'createPng',
                pngData: pngDataUrl,
                filename: 'flowchart.png'
            });
        } else {
            throw new Error('VS Code API not available');
        }
        
    } catch (error) {
        console.error('PNG conversion failed:', error);
        // Send error to extension
        if (typeof window.vscode !== 'undefined') {
            window.vscode.postMessage({
                command: 'createPng',
                error: error.message
            });
        }
    }
}

/**
 * Calculate dimensions for PNG
 */
function calculateDimensions(svgElement) {
    const svgRect = svgElement.getBoundingClientRect();
    const vb = svgElement.viewBox?.baseVal;
    const hasViewBox = vb && vb.width && vb.height;
    const svgWidth = hasViewBox ? vb.width : (svgRect.width || 800);
    const svgHeight = hasViewBox ? vb.height : (svgRect.height || 600);
    
    const minWidth = 800;
    const minHeight = 600;
    const maxWidth = 4000;
    const maxHeight = 3000;
    
    // Start from intrinsic aspect ratio and content size
    const aspectRatio = svgWidth / Math.max(1, svgHeight);
    let width = Math.max(minWidth, Math.min(maxWidth, svgWidth));
    let height = Math.max(minHeight, Math.min(maxHeight, width / aspectRatio));
    
    // Add headroom for small charts to avoid cramped height
    if (width <= 1000 && height <= 800) {
        height = Math.min(maxHeight, height + 120);
    }
    
    return {
        width: Math.round(width / 2) * 2,
        height: Math.round(height / 2) * 2
    };
}

/**
 * Convert SVG to PNG data URL
 */
function svgToPng(svgString, width, height) {
    return new Promise((resolve, reject) => {
        try {
            const fixedSvg = fixSvgForConversion(svgString, width, height);
            const dataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(fixedSvg)));
            
            const img = new Image();
            img.onload = function() {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    
                    // Use VS Code background color instead of hardcoded white
                    const vscodeBackground = getComputedStyle(document.body).getPropertyValue('--vscode-editor-background') || '#1e1e1e';
                    ctx.fillStyle = vscodeBackground;
                    ctx.fillRect(0, 0, width, height);
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    resolve(canvas.toDataURL('image/png'));
                } catch (canvasError) {
                    reject(new Error('Canvas rendering failed: ' + canvasError.message));
                }
            };
            
            img.onerror = function() {
                reject(new Error('SVG image failed to load'));
            };
            
            setTimeout(() => {
                reject(new Error('SVG loading timeout'));
            }, 10000);
            
            img.src = dataUrl;
        } catch (error) {
            reject(new Error('SVG processing failed: ' + error.message));
        }
    });
}

/**
 * Fix SVG for conversion
 */
function fixSvgForConversion(svgString, width, height) {
    let svg = svgString.trim();
    
    // Remove XML declaration
    svg = svg.replace(/<\?xml[^>]*\?>/g, '');
    
    // Ensure SVG has proper namespace
    if (!svg.includes('xmlns="http://www.w3.org/2000/svg"')) {
        svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    
    // Add xlink namespace if needed
    if (svg.includes('xlink:') && !svg.includes('xmlns:xlink')) {
        svg = svg.replace('<svg', '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
    }
    
    // Ensure SVG has dimensions; don't override existing viewBox to preserve aspect
    const svgMatch = svg.match(/<svg[^>]*>/);
    if (svgMatch) {
        let svgTag = svgMatch[0];
        if (!svgTag.includes('width=')) {
            svgTag = svgTag.replace('>', ` width="${width}">`);
        }
        if (!svgTag.includes('height=')) {
            svgTag = svgTag.replace('>', ` height="${height}">`);
        }
        // Add background color to root
        const vscodeBackground = getComputedStyle(document.body).getPropertyValue('--vscode-editor-background') || '#1e1e1e';
        if (!svgTag.includes('style=')) {
            svgTag = svgTag.replace('>', ` style="background-color: ${vscodeBackground}">`);
        } else {
            svgTag = svgTag.replace(/style="([^"]*)"/, `style="$1; background-color: ${vscodeBackground}"`);
        }
        svg = svg.replace(svgMatch[0], svgTag);
    }
    
    // Remove external stylesheet links
    svg = svg.replace(/<link[^>]*>/g, '');
    
    return svg;
}

// Export the main function
window.convertSvgToPng = convertSvgToPng;