// Zoom and Pan functionality
let currentZoom = 1;
let isPanning = false;
let lastPanPoint = { x: 0, y: 0 };
let panOffset = { x: 0, y: 0 };
let zoomCenterIndicator = null;

// Zoom functions
function zoomIn() {
	currentZoom = Math.min(currentZoom * 1.2, 50);
	updateTransform();
	updateZoomLevel();
}

function zoomOut() {
	currentZoom = Math.max(currentZoom / 1.2, 0.1);
	updateTransform();
	updateZoomLevel();
}

function resetZoom() {
	currentZoom = 1;
	panOffset = { x: 0, y: 0 };
	updateTransform();
	updateZoomLevel();
}

function updateTransform() {
	if (!mermaidContainer) return;
	
	const svg = mermaidContainer.querySelector('svg');
	if (svg) {
		svg.style.transform = `translate(${panOffset.x}px, ${panOffset.y}px) scale(${currentZoom})`;
	}
}

function updateZoomLevel() {
	const zoomLevelDiv = document.getElementById('zoomLevel');
	if (zoomLevelDiv) {
		zoomLevelDiv.textContent = Math.round(currentZoom * 100) + '%';
	}
}

// Mouse wheel zoom
function handleWheelZoom(event) {
	event.preventDefault();
	
	const delta = event.deltaY > 0 ? -1 : 1;
	const zoomFactor = delta > 0 ? 1.1 : 0.9;
	const newZoom = Math.max(0.1, Math.min(50, currentZoom * zoomFactor));
	
	if (!mermaidContainer) return;
	
	const svg = mermaidContainer.querySelector('svg');
	if (!svg) return;
	
	// Get mouse position relative to the SVG
	const svgRect = svg.getBoundingClientRect();
	const mouseX = event.clientX - svgRect.left;
	const mouseY = event.clientY - svgRect.top;
	
	// Calculate zoom ratio and mouse offset from center
	const zoomRatio = newZoom / currentZoom;
	
	// Calculate the center of the SVG
	const centerX = svgRect.width / 2;
	const centerY = svgRect.height / 2;
	const offsetX = mouseX - centerX;
	const offsetY = mouseY - centerY;
	
	// Update pan offset to keep mouse position stationary
	panOffset.x = panOffset.x - (offsetX * (zoomRatio - 1));
	panOffset.y = panOffset.y - (offsetY * (zoomRatio - 1));
	
	// Apply the zoom
	currentZoom = newZoom;
	updateTransform();
	updateZoomLevel();
}

// Panning functions
function startPan(event) {
	if (event.button !== 0) return; // Only left mouse button
	
	isPanning = true;
	lastPanPoint = { x: event.clientX, y: event.clientY };
	mermaidContainer.style.cursor = 'grabbing';
}

function pan(event) {
	if (!isPanning) return;
	
	const deltaX = event.clientX - lastPanPoint.x;
	const deltaY = event.clientY - lastPanPoint.y;
	
	panOffset.x += deltaX;
	panOffset.y += deltaY;
	
	lastPanPoint = { x: event.clientX, y: event.clientY };
	
	updateTransform();
}

function endPan() {
	isPanning = false;
	if (mermaidContainer) {
		mermaidContainer.style.cursor = 'grab';
	}
}

// Keyboard shortcuts
function handleKeyboardZoom(event) {
	// Only handle zoom shortcuts when flowchart is focused
	if (!mermaidContainer.contains(document.activeElement) && 
		!event.target.closest('.mermaid')) {
		return;
	}
	
	switch (event.key) {
		case '+':
		case '=':
			event.preventDefault();
			zoomIn();
			break;
		case '-':
			event.preventDefault();
			zoomOut();
			break;
		case '0':
			event.preventDefault();
			resetZoom();
			break;
	}
}

// Function to attach event listeners to a container
function attachContainerEventListeners(container) {
	if (!container) return;
	
	// Mouse wheel zoom
	container.addEventListener('wheel', handleWheelZoom);
	
	// Mouse events for panning
	container.addEventListener('mousedown', startPan);
	container.addEventListener('mousemove', pan);
	container.addEventListener('mouseup', endPan);
	container.addEventListener('mouseleave', endPan);
}

// Initialize zoom controls
function initializeZoomControls() {
	// Add click event listeners to zoom buttons
	const zoomInBtn = document.getElementById('zoomInBtn');
	const zoomOutBtn = document.getElementById('zoomOutBtn');
	const resetZoomBtn = document.getElementById('resetZoomBtn');
	
	if (zoomInBtn) {
		zoomInBtn.addEventListener('click', zoomIn);
	}
	
	if (zoomOutBtn) {
		zoomOutBtn.addEventListener('click', zoomOut);
	}
	
	if (resetZoomBtn) {
		resetZoomBtn.addEventListener('click', resetZoom);
	}
}

// Add keyboard event listener
document.addEventListener('keydown', handleKeyboardZoom);

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initializeZoomControls);
} else {
	initializeZoomControls();
}
