let currentView = 'flowchart';
let diagrams = {
    flowchart: '',
    connection: ''
};
let connectionInfo = {
    hasData: false,
    message: ''
};

function renderCurrentView() {
    const activeDiagram = currentView === 'connection' ? diagrams.connection : diagrams.flowchart;
    if (activeDiagram) {
        updateFlowchart(activeDiagram);
        if (typeof window.storeDiagramCode === 'function') {
            window.storeDiagramCode(activeDiagram);
        }
    }
    updateStatusMessage();
    updateTabState();
}

function updateStatusMessage() {
    const statusEl = document.getElementById('viewStatusMessage');
    if (!statusEl) {
        return;
    }

    if (currentView === 'connection' && connectionInfo.message) {
        statusEl.textContent = connectionInfo.message;
        statusEl.classList.remove('hidden');
    } else {
        statusEl.classList.add('hidden');
        statusEl.textContent = '';
    }
}

function updateTabState() {
    const flowTab = document.getElementById('flowchartViewTab');
    const connectionTab = document.getElementById('connectionViewTab');

    if (flowTab) {
        flowTab.classList.toggle('active', currentView === 'flowchart');
    }
    if (connectionTab) {
        connectionTab.classList.toggle('active', currentView === 'connection');
        connectionTab.classList.toggle('disabled', !connectionInfo.hasData);
        connectionTab.title = connectionInfo.hasData ? 'Show connection view' : 'Connection data is limited for this selection';
    }
}

function setActiveView(view) {
    if (view === currentView) {
        return;
    }
    currentView = view;
    renderCurrentView();
}

window.initializeViewToggle = function initializeViewToggle() {
    const flowTab = document.getElementById('flowchartViewTab');
    const connectionTab = document.getElementById('connectionViewTab');

    if (flowTab) {
        flowTab.addEventListener('click', () => setActiveView('flowchart'));
    }
    if (connectionTab) {
        connectionTab.addEventListener('click', () => setActiveView('connection'));
    }

    updateTabState();
};

window.updateDiagramViews = function updateDiagramViews({ flowchart, connection, metadata, connectionMetadata }) {
    diagrams.flowchart = flowchart || diagrams.flowchart;

    if (connection) {
        diagrams.connection = connection;
    } else {
        diagrams.connection = 'graph TD\n    noData["Connection information is not available for this selection"]';
    }

    if (connectionMetadata) {
        connectionInfo = {
            hasData: connectionMetadata.hasData !== false,
            message: connectionMetadata.message || ''
        };
    } else {
        connectionInfo = {
            hasData: !!connection,
            message: connection ? '' : 'Connection information is not available for this selection.'
        };
    }

    if (!diagrams.flowchart && flowchart) {
        diagrams.flowchart = flowchart;
    }

    renderCurrentView();
};

window.getCurrentView = function getCurrentView() {
    return currentView;
};
