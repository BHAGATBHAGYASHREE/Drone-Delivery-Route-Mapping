// AeroRoute Frontend Dashboard Controller

// State Management
let graphData = null;
let selectedStartNode = null;
let selectedEndNode = null;
let activePathNodes = [];

// SVG Coordinate Scaler Configurations
// Coords in backend are 0-100. SVG viewport is 1000 x 900.
const marginX = 80;
const marginY = 80;
const scaleWidth = 840;  // 1000 - 2 * 80
const scaleHeight = 740; // 900 - 2 * 80

function getSvgCoords(x, y) {
    return {
        x: (x / 100) * scaleWidth + marginX,
        y: (y / 100) * scaleHeight + marginY
    };
}

// DOM Selector Bindings
const startNodeSelect = document.getElementById("start-node");
const endNodeSelect = document.getElementById("end-node");
const weatherSelect = document.getElementById("weather");
const optimizeSelect = document.getElementById("optimize-by");
const payloadSlider = document.getElementById("payload");
const payloadValLabel = document.getElementById("payload-val");
const routingForm = document.getElementById("routing-form");
const computeBtn = document.getElementById("compute-btn");
const resetBtn = document.getElementById("reset-btn");
const safetyAlert = document.getElementById("safety-alert");
const alertTitle = document.getElementById("alert-title");
const alertDesc = document.getElementById("alert-desc");

// Telemetry Labels
const valTime = document.getElementById("val-time");
const valDistance = document.getElementById("val-distance");
const valBattery = document.getElementById("val-battery");
const valEnergy = document.getElementById("val-energy");
const valRisk = document.getElementById("val-risk");
const valCarbon = document.getElementById("val-carbon");
const batteryRingProgress = document.getElementById("battery-ring-progress");
const batteryProgressBar = document.getElementById("battery-progress-bar");
const batteryIcon = document.getElementById("battery-icon");
const sequenceContainer = document.getElementById("sequence-container");
const tracerOutput = document.getElementById("tracer-output");

// Timeline Deck Elements
const timelineTrack = document.getElementById("timeline-track");
const timelineProgressBar = document.getElementById("timeline-progress-bar");
const timelineCursor = document.getElementById("timeline-cursor");
const timelineCursorVal = document.getElementById("timeline-cursor-val");
const timelineTicks = document.querySelectorAll(".map-timeline .tick-t");
let currentFlightDuration = 0; // In minutes

// Tab Controls
const tabSequenceBtn = document.getElementById("tab-sequence-btn");
const tabTracerBtn = document.getElementById("tab-tracer-btn");
const tabSequence = document.getElementById("tab-sequence");
const tabTracer = document.getElementById("tab-tracer");

// SVG Elements
const nodesGroup = document.getElementById("nodes-group");
const edgesGroup = document.getElementById("edges-group");
const activePathGroup = document.getElementById("active-path-group");
const droneGroup = document.getElementById("drone-group");
const droneMap = document.getElementById("drone-map");
const hazardsGroup = document.getElementById("hazards-group");
const hazardModeBtn = document.getElementById("hazard-mode-btn");
let activeHazards = [];
let hazardModeActive = false;

// Report Modal Selectors
const viewReportBtn = document.getElementById("view-report-btn");
const reportModal = document.getElementById("report-modal");
const closeModalBtn = document.getElementById("close-modal-btn");
const downloadReportBtn = document.getElementById("download-report-btn");
const printReportBtn = document.getElementById("print-report-btn");
const reportDate = document.getElementById("report-date");

// Initial Startup
document.addEventListener("DOMContentLoaded", () => {
    fetchGraphData();
    setupEventListeners();
    updateWeatherAlert();
});

// Event Binding Setup
function setupEventListeners() {
    // Payload slider values
    payloadSlider.addEventListener("input", (e) => {
        payloadValLabel.textContent = e.target.value;
        updateWeatherAlert();
    });

    // Weather pre-flight alerts
    weatherSelect.addEventListener("change", updateWeatherAlert);

    // Sync select options to visual elements
    startNodeSelect.addEventListener("change", (e) => {
        setStartNode(e.target.value);
    });

    endNodeSelect.addEventListener("change", (e) => {
        setEndNode(e.target.value);
    });

    // Dijkstra tab toggling
    tabSequenceBtn.addEventListener("click", () => switchTab("sequence"));
    tabTracerBtn.addEventListener("click", () => switchTab("tracer"));

    // Form submission
    routingForm.addEventListener("submit", (e) => {
        e.preventDefault();
        calculateRoute();
    });

    // Clear Selection State
    resetBtn.addEventListener("click", resetSelection);

    // Modal controls
    viewReportBtn.addEventListener("click", openReportModal);
    closeModalBtn.addEventListener("click", () => reportModal.classList.add("hidden"));
    printReportBtn.addEventListener("click", () => window.print());
    downloadReportBtn.addEventListener("click", downloadTextReport);



    // Close modal if click target is backdrop overlay
    window.addEventListener("click", (e) => {
        if (e.target === reportModal) {
            reportModal.classList.add("hidden");
        }
    });

    // Restricted Airspace Hazard Toggle
    if (hazardModeBtn) {
        hazardModeBtn.addEventListener("click", () => {
            hazardModeActive = !hazardModeActive;
            if (hazardModeActive) {
                hazardModeBtn.classList.add("active");
                hazardModeBtn.querySelector("span").textContent = "Restricted Airspace Mode: ON";
            } else {
                hazardModeBtn.classList.remove("active");
                hazardModeBtn.querySelector("span").textContent = "Restricted Airspace Mode: OFF";
            }
        });
    }

    // Map Click Handler for placing/removing restricted zones
    if (droneMap) {
        droneMap.addEventListener("click", (e) => {
            if (!hazardModeActive) return;

            // Don't click trigger when clicking nodes
            if (e.target.closest(".map-node")) {
                return;
            }

            const svgCoords = getSvgClickCoords(e);
            const gridCoords = getGridCoords(svgCoords.x, svgCoords.y);

            const cx = Math.max(0, Math.min(100, gridCoords.x));
            const cy = Math.max(0, Math.min(100, gridCoords.y));

            // Check if click hits an existing hazard
            let hitIndex = -1;
            for (let i = 0; i < activeHazards.length; i++) {
                const hz = activeHazards[i];
                const dx = hz.x - cx;
                const dy = hz.y - cy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist <= hz.r) {
                    hitIndex = i;
                    break;
                }
            }

            if (hitIndex !== -1) {
                // Remove hazard
                activeHazards.splice(hitIndex, 1);
            } else {
                // Add hazard
                activeHazards.push({
                    x: cx,
                    y: cy,
                    r: 8.0
                });
            }

            renderHazards();

            // Auto-recalculate route
            if (selectedStartNode && selectedEndNode) {
                calculateRoute();
            }
        });
    }
}

// Switch between Sequence and tracer terminal tabs
function switchTab(tab) {
    if (tab === "sequence") {
        tabSequenceBtn.classList.add("active");
        tabTracerBtn.classList.remove("active");
        tabSequence.classList.remove("hidden");
        tabTracer.classList.add("hidden");
    } else {
        tabSequenceBtn.classList.remove("active");
        tabTracerBtn.classList.add("active");
        tabSequence.classList.add("hidden");
        tabTracer.classList.remove("hidden");
    }
}

// Fetch logistics graph map coordinates from Python Backend API
async function fetchGraphData() {
    try {
        const response = await fetch("/api/graph");
        if (!response.ok) throw new Error("AeroRoute connection failed.");
        graphData = await response.json();
        
        populateNodeDropdowns();
        renderMap();
    } catch (error) {
        console.error("Graph loading error:", error);
        alert("Ops Center Alert: Unable to connect to Python routing server. Ensure backend/server.py is running.");
    }
}

// Populate Start and End dropdown selector nodes
function populateNodeDropdowns() {
    startNodeSelect.innerHTML = '<option value="" disabled selected>Select departure hub...</option>';
    endNodeSelect.innerHTML = '<option value="" disabled selected>Select customer dropzone...</option>';

    // Alphabetical label sorting
    const sortedNodes = [...graphData.nodes].sort((a, b) => a.label.localeCompare(b.label));

    sortedNodes.forEach(node => {
        const optStart = document.createElement("option");
        optStart.value = node.id;
        optStart.textContent = `${node.label} (${node.id})`;
        startNodeSelect.appendChild(optStart);

        const optEnd = document.createElement("option");
        optEnd.value = node.id;
        optEnd.textContent = `${node.label} (${node.id})`;
        endNodeSelect.appendChild(optEnd);
    });
}

// Live pre-flight safety parameter validator
function updateWeatherAlert() {
    const weather = weatherSelect.value;
    const payload = parseFloat(payloadSlider.value);
    
    safetyAlert.classList.remove("hidden", "warning");
    
    if (weather === "stormy") {
        if (payload > 3.0) {
            safetyAlert.classList.remove("hidden");
            safetyAlert.className = "weather-alert"; // red grounding class
            alertTitle.textContent = "CRITICAL WARNING: Flights Grounded";
            alertDesc.textContent = "Drone payload exceeds stormy weather safety limits. Cargo weight cap is 3.0 kg during active storm warnings.";
            computeBtn.disabled = true;
            computeBtn.style.opacity = "0.4";
        } else {
            safetyAlert.classList.remove("hidden");
            safetyAlert.className = "weather-alert warning"; // orange safety cap class
            alertTitle.textContent = "Storm Warning: Route Capped";
            alertDesc.textContent = "Strong turbulence warning active. Flight corridor ground speed capped at 15 km/h safety limits.";
            computeBtn.disabled = false;
            computeBtn.style.opacity = "1";
        }
    } else if (weather === "windy") {
        safetyAlert.classList.remove("hidden");
        safetyAlert.className = "weather-alert warning";
        alertTitle.textContent = "Wind Shear Advisory Active";
        alertDesc.textContent = "Strong headwinds active. Drone speed reduced to 40 km/h. Motors will draw extra 60W power.";
        computeBtn.disabled = false;
        computeBtn.style.opacity = "1";
    } else if (weather === "rainy") {
        safetyAlert.classList.remove("hidden");
        safetyAlert.className = "weather-alert warning";
        alertTitle.textContent = "Precipitation Alert: Caps Active";
        alertDesc.textContent = "Sensor visibility degraded. Ground speeds capped at 35 km/h limits. Safety risk metrics scaled by 60%.";
        computeBtn.disabled = false;
        computeBtn.style.opacity = "1";
    } else {
        // Clear sky
        safetyAlert.classList.add("hidden");
        computeBtn.disabled = false;
        computeBtn.style.opacity = "1";
    }
}

// Render nodes and edge paths on SVG Viewport
function renderMap() {
    nodesGroup.innerHTML = "";
    edgesGroup.innerHTML = "";
    activePathGroup.innerHTML = "";
    droneGroup.classList.add("hidden");
    generateStreetLines();

    const nodeMap = new Map(graphData.nodes.map(n => [n.id, n]));
    const drawnEdges = new Set();

    // 1. Render Edges (Paths) first to position them behind node circles
    graphData.edges.forEach(edge => {
        const fromNode = nodeMap.get(edge.from);
        const toNode = nodeMap.get(edge.to);
        
        if (!fromNode || !toNode) return;

        const fromCoords = getSvgCoords(fromNode.x, fromNode.y);
        const toCoords = getSvgCoords(toNode.x, toNode.y);

        // Vector line
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", fromCoords.x);
        line.setAttribute("y1", fromCoords.y);
        line.setAttribute("x2", toCoords.x);
        line.setAttribute("y2", toCoords.y);
        line.setAttribute("class", "map-edge");
        line.setAttribute("id", `edge-${edge.from}-${edge.to}`);
        line.setAttribute("marker-end", "url(#arrow)");
        edgesGroup.appendChild(line);

        // Distance text weights
        const edgeId = [edge.from, edge.to].sort().join("-");
        if (!drawnEdges.has(edgeId)) {
            drawnEdges.add(edgeId);
            const midX = (fromCoords.x + toCoords.x) / 2;
            const midY = (fromCoords.y + toCoords.y) / 2 - 10;
            
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", midX);
            text.setAttribute("y", midY);
            text.setAttribute("class", "edge-weight");
            text.setAttribute("text-anchor", "middle");
            text.textContent = `${edge.distance} km`;
            edgesGroup.appendChild(text);
        }
    });

    // 2. Render Node Vertices
    graphData.nodes.forEach(node => {
        const coords = getSvgCoords(node.x, node.y);

        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("class", `map-node ${node.type}`);
        g.setAttribute("id", `node-${node.id}`);
        g.setAttribute("data-id", node.id);

        // Glow ring element
        const pulse = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        pulse.setAttribute("cx", coords.x);
        pulse.setAttribute("cy", coords.y);
        pulse.setAttribute("r", 9);
        pulse.setAttribute("class", "node-pulse");
        g.appendChild(pulse);

        // Center base circle
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", coords.x);
        circle.setAttribute("cy", coords.y);
        circle.setAttribute("r", node.type === "hub" ? 13 : 9);
        circle.setAttribute("class", "node-base");
        g.appendChild(circle);

        // Render Centered FontAwesome Icon inside Node
        let iconClass = "fa-circle-dot";
        if (node.id === "Mumbai_Hub") iconClass = "fa-building-shield";
        else if (node.id === "Delhi_Depot") iconClass = "fa-warehouse";
        else if (node.id === "Bengaluru_Terminal") iconClass = "fa-network-wired";
        else if (node.id === "Kolkata_Center") iconClass = "fa-cart-flatbed";
        else if (node.id === "Hyderabad_Depot") iconClass = "fa-satellite-dish";
        else if (node.id.endsWith("_Zone")) iconClass = "fa-house";
        else if (node.id === "Ahmedabad_Commercial") iconClass = "fa-store";
        else if (node.id === "Goa_Beach_Landing") iconClass = "fa-umbrella-beach";
        else if (node.id === "Kochi_Coast") iconClass = "fa-ship";
        else if (node.id === "Noida_Industrial") iconClass = "fa-industry";

        const foreignObj = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
        const size = node.type === "hub" ? 22 : 16;
        foreignObj.setAttribute("x", coords.x - size / 2);
        foreignObj.setAttribute("y", coords.y - size / 2);
        foreignObj.setAttribute("width", size);
        foreignObj.setAttribute("height", size);

        const iconDiv = document.createElement("div");
        iconDiv.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
        iconDiv.className = "node-icon-container";
        iconDiv.innerHTML = `<i class="fa-solid ${iconClass}"></i>`;
        
        foreignObj.appendChild(iconDiv);
        g.appendChild(foreignObj);

        // Text label
        const textLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
        textLabel.setAttribute("x", coords.x);
        textLabel.setAttribute("y", coords.y + (node.type === "hub" ? 27 : 22));
        textLabel.setAttribute("class", "node-label");
        textLabel.setAttribute("text-anchor", "middle");
        textLabel.textContent = node.id.replace("_", " ");
        g.appendChild(textLabel);

        // Interactive node clicks mapping selection
        g.addEventListener("click", () => handleNodeClick(node.id));

        nodesGroup.appendChild(g);
    });
}

// Select start and destination by clicking map nodes directly
function handleNodeClick(nodeId) {
    if (!selectedStartNode) {
        setStartNode(nodeId);
    } else if (selectedStartNode === nodeId) {
        resetSelection();
    } else if (!selectedEndNode) {
        setEndNode(nodeId);
    } else if (selectedEndNode === nodeId) {
        setEndNode(null);
    } else {
        setEndNode(nodeId);
    }
}

// Set Start selection state
function setStartNode(nodeId) {
    document.querySelectorAll(".map-node.selected-start").forEach(n => {
        n.classList.remove("selected-start");
    });

    selectedStartNode = nodeId;
    
    if (nodeId) {
        const nodeEl = document.getElementById(`node-${nodeId}`);
        if (nodeEl) nodeEl.classList.add("selected-start");
        startNodeSelect.value = nodeId;
    } else {
        startNodeSelect.value = "";
    }
}

// Set End selection state
function setEndNode(nodeId) {
    document.querySelectorAll(".map-node.selected-end").forEach(n => {
        n.classList.remove("selected-end");
    });

    selectedEndNode = nodeId;

    if (nodeId) {
        const nodeEl = document.getElementById(`node-${nodeId}`);
        if (nodeEl) nodeEl.classList.add("selected-end");
        endNodeSelect.value = nodeId;
    } else {
        endNodeSelect.value = "";
    }
}

// Clear all map selection filters
function resetSelection() {
    setStartNode(null);
    setEndNode(null);
    activePathGroup.innerHTML = "";
    droneGroup.classList.add("hidden");
    
    // Clear dynamic overlays
    const calloutsGroup = document.getElementById("callouts-group");
    if (calloutsGroup) calloutsGroup.innerHTML = "";
    const pinGroup = document.getElementById("destination-pin-group");
    if (pinGroup) pinGroup.innerHTML = "";

    document.querySelectorAll(".map-node").forEach(n => {
        n.classList.remove("on-active-path");
    });
    
    // Clear telemetry cards
    valTime.textContent = "--";
    valDistance.textContent = "--";
    valBattery.textContent = "--";
    valEnergy.textContent = "-- Wh";
    valRisk.textContent = "--";
    valCarbon.textContent = "--";
    if (batteryRingProgress) {
        batteryRingProgress.style.strokeDashoffset = "251.2";
        batteryRingProgress.style.stroke = "var(--neon-cyan)";
    }
    if (batteryProgressBar) {
        batteryProgressBar.style.width = "0%";
        batteryProgressBar.style.backgroundColor = "rgba(255, 255, 255, 0.08)";
    }
    batteryIcon.style.color = "var(--text-muted)";
    batteryIcon.className = "fa-solid fa-battery-empty";
    
    sequenceContainer.innerHTML = '<p class="placeholder-text">Select route parameters and calculate path.</p>';
    tracerOutput.textContent = "Awaiting Dijkstra calculations... Run 'Calculate Route' to print real-time priority queue relaxation steps.";
    activePathNodes = [];
    currentFlightDuration = 0;

    // Reset timeline elements
    if (timelineCursor) {
        timelineCursor.style.display = "none";
        timelineCursor.style.left = "0%";
    }
    if (timelineProgressBar) {
        timelineProgressBar.style.width = "0%";
    }
    if (timelineCursorVal) {
        timelineCursorVal.textContent = "0.0 min";
    }

    // Reset timeline ticks to default 20 min scale (ascending)
    if (timelineTicks && timelineTicks.length === 6) {
        timelineTicks[0].textContent = "00 min";
        timelineTicks[1].textContent = "04 min";
        timelineTicks[2].textContent = "08 min";
        timelineTicks[3].textContent = "12 min";
        timelineTicks[4].textContent = "16 min";
        timelineTicks[5].textContent = "20 min";
    }

    // Reset restricted airspace hazards
    activeHazards = [];
    renderHazards();
    hazardModeActive = false;
    if (hazardModeBtn) {
        hazardModeBtn.classList.remove("active");
        hazardModeBtn.querySelector("span").textContent = "Restricted Airspace Mode: OFF";
    }
}

// Calculate Dijkstra path corridor
async function calculateRoute() {
    if (!selectedStartNode || !selectedEndNode) {
        alert("Pre-flight Alert: Departure and customer target points must be specified.");
        return;
    }

    if (selectedStartNode === selectedEndNode) {
        alert("Pre-flight Alert: Departure and Destination targets must be distinct nodes.");
        return;
    }

    // Set loading indicator
    computeBtn.disabled = true;
    computeBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
    
    const params = new URLSearchParams({
        start: selectedStartNode,
        end: selectedEndNode,
        weather: weatherSelect.value,
        payload: payloadSlider.value,
        optimize: optimizeSelect.value,
        hazards: JSON.stringify(activeHazards)
    });

    try {
        const response = await fetch(`/api/route?${params.toString()}`);
        if (!response.ok) throw new Error("AeroRoute gateway calculations error.");
        const data = await response.json();

        if (!data.success) {
            alert(`Calculation Fault: ${data.error_message}`);
            resetSelection();
            return;
        }

        activePathNodes = data.path;
        displayTelemetry(data);
        drawActiveRoutePath();
        animateDroneFlight();

    } catch (error) {
        console.error("Shortest path calculation failed:", error);
        alert("AeroRoute failure: Backend connection lost. Ensure Python server is running.");
    } finally {
        computeBtn.disabled = false;
        computeBtn.innerHTML = '<i class="fa-solid fa-compass-drafting"></i> Calculate Route';
        updateWeatherAlert();
    }
}

// Display computed telemetry properties
function displayTelemetry(data) {
    valDistance.textContent = data.total_distance.toFixed(2);
    valTime.textContent = data.total_time_mins.toFixed(2);
    
    currentFlightDuration = data.total_time_mins;

    // Initialize timeline slider position (starts at 0% matching actual duration)
    if (timelineCursor) {
        timelineCursor.style.display = "block";
        timelineCursor.style.left = "0%";
    }
    if (timelineProgressBar) {
        timelineProgressBar.style.width = "0%";
    }
    if (timelineCursorVal) {
        timelineCursorVal.textContent = "0.0 min";
    }

    // Update timeline ticks to match the actual route time (ascending)
    if (timelineTicks && timelineTicks.length === 6) {
        timelineTicks[0].textContent = "0.0 min";
        timelineTicks[1].textContent = `${(currentFlightDuration * 0.2).toFixed(1)} min`;
        timelineTicks[2].textContent = `${(currentFlightDuration * 0.4).toFixed(1)} min`;
        timelineTicks[3].textContent = `${(currentFlightDuration * 0.6).toFixed(1)} min`;
        timelineTicks[4].textContent = `${(currentFlightDuration * 0.8).toFixed(1)} min`;
        timelineTicks[5].textContent = `${currentFlightDuration.toFixed(1)} min`;
    }
    valEnergy.textContent = `${data.energy_consumed_wh.toFixed(1)} Wh`;
    valRisk.textContent = data.average_risk.toFixed(1);
    valCarbon.textContent = data.carbon_saved_kg.toFixed(3);

    // Battery remaining capacity
    const batteryUsed = data.battery_consumed_pct;
    const batteryRemaining = Math.max(0, 100 - batteryUsed);
    valBattery.textContent = batteryRemaining.toFixed(0);

    // Mini battery progress bar
    if (batteryProgressBar) {
        batteryProgressBar.style.width = `${batteryRemaining.toFixed(0)}%`;
        
        // Colors matching status
        if (batteryRemaining >= 70) {
            batteryProgressBar.style.backgroundColor = "var(--neon-cyan)";
            batteryIcon.style.color = "var(--neon-cyan)";
            batteryIcon.className = "fa-solid fa-battery-full";
        } else if (batteryRemaining >= 30) {
            batteryProgressBar.style.backgroundColor = "var(--neon-yellow)";
            batteryIcon.style.color = "var(--neon-yellow)";
            batteryIcon.className = "fa-solid fa-battery-three-quarters";
        } else {
            batteryProgressBar.style.backgroundColor = "var(--neon-red)";
            batteryIcon.style.color = "var(--neon-red)";
            batteryIcon.className = "fa-solid fa-battery-quarter";
        }
    }

    // Render radial gauge stroke dashoffset (if exists)
    if (batteryRingProgress) {
        const circumference = 251.2;
        const offset = circumference - (batteryRemaining / 100) * circumference;
        batteryRingProgress.style.strokeDashoffset = offset;
        
        // Charge level color styling
        if (batteryRemaining >= 70) {
            batteryRingProgress.style.stroke = "var(--neon-green)";
        } else if (batteryRemaining >= 30) {
            batteryRingProgress.style.stroke = "var(--neon-yellow)";
        } else {
            batteryRingProgress.style.stroke = "var(--neon-red)";
        }
    }

    // Sequencer flight path mapping
    sequenceContainer.innerHTML = "";
    const nodeMap = new Map(graphData.nodes.map(n => [n.id, n]));

    data.path.forEach((nodeId, index) => {
        const node = nodeMap.get(nodeId);
        if (!node) return;

        const step = document.createElement("div");
        step.className = "seq-node";
        step.innerHTML = `
            <span class="seq-num">${index + 1}</span>
            <span class="seq-name">${node.label}</span>
            <span class="seq-type ${node.type}">${node.type.replace("_", " ")}</span>
        `;
        sequenceContainer.appendChild(step);

        if (index < data.path.length - 1) {
            const arrow = document.createElement("div");
            arrow.className = "seq-arrow";
            arrow.innerHTML = '<i class="fa-solid fa-caret-down"></i>';
            sequenceContainer.appendChild(arrow);
        }
    });

    // Write trace logs to code block
    if (data.algorithm_trace && data.algorithm_trace.length > 0) {
        tracerOutput.textContent = data.algorithm_trace.join("\n");
    } else {
        tracerOutput.textContent = "No log trace recorded by Dijkstra core engine.";
    }
}

// Highlight the shortest path on the map
function drawActiveRoutePath() {
    activePathGroup.innerHTML = "";
    
    // Clear old callouts and destination pins
    const calloutsGroup = document.getElementById("callouts-group");
    if (calloutsGroup) calloutsGroup.innerHTML = "";
    const pinGroup = document.getElementById("destination-pin-group");
    if (pinGroup) pinGroup.innerHTML = "";

    // Clear active path class from all nodes
    document.querySelectorAll(".map-node").forEach(n => {
        n.classList.remove("on-active-path");
    });

    if (activePathNodes.length < 2) return;

    const nodeMap = new Map(graphData.nodes.map(n => [n.id, n]));
    let points = [];
    
    activePathNodes.forEach(nodeId => {
        const node = nodeMap.get(nodeId);
        if (node) {
            const coords = getSvgCoords(node.x, node.y);
            points.push(`${coords.x},${coords.y}`);
            
            // Mark node as being on active path
            const nodeEl = document.getElementById(`node-${nodeId}`);
            if (nodeEl) nodeEl.classList.add("on-active-path");
        }
    });

    // 1. Draw static route background guideline
    const bgPolyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    bgPolyline.setAttribute("points", points.join(" "));
    bgPolyline.setAttribute("stroke", "rgba(147, 51, 234, 0.18)");
    bgPolyline.setAttribute("stroke-width", "5.5");
    bgPolyline.setAttribute("stroke-linecap", "round");
    bgPolyline.setAttribute("stroke-linejoin", "round");
    bgPolyline.setAttribute("fill", "none");
    activePathGroup.appendChild(bgPolyline);

    // 2. Draw dynamic dotted active transmitting path (masked by clip-path)
    const activePolyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    activePolyline.setAttribute("points", points.join(" "));
    activePolyline.setAttribute("class", "transmitting-line");
    activePolyline.setAttribute("fill", "none");
    activePolyline.setAttribute("clip-path", "url(#path-clip)");
    activePathGroup.appendChild(activePolyline);

    // 3. Set path d coordinates in the clip mask line
    const clipLine = document.getElementById("clip-path-line");
    if (clipLine) {
        clipLine.setAttribute("d", `M ${points.join(" L ")}`);
    }

    // 4. Draw Travel Time Brackets [ X min ] along intermediate and end nodes
    if (calloutsGroup) {
        let cumulativeTime = 0.0;
        for (let i = 0; i < activePathNodes.length; i++) {
            const nodeId = activePathNodes[i];
            const node = nodeMap.get(nodeId);
            if (!node) continue;
            const coords = getSvgCoords(node.x, node.y);

            if (i > 0) {
                const prevNodeId = activePathNodes[i - 1];
                const edge = graphData.edges.find(e => 
                    (e.from === prevNodeId && e.to === nodeId) || 
                    (e.from === nodeId && e.to === prevNodeId)
                );
                if (edge) {
                    const speed = weatherSelect.value === "windy" ? 40.0 :
                                  weatherSelect.value === "rainy" ? 35.0 :
                                  weatherSelect.value === "stormy" ? 15.0 : 60.0;
                    const effectiveSpeed = Math.max(10.0, speed - parseFloat(payloadSlider.value) * 2.0);
                    const segmentTimeMins = (edge.distance / effectiveSpeed) * 60.0;
                    cumulativeTime += segmentTimeMins;
                }

                // Render brackets for all nodes along calculated path except start
                const calloutG = document.createElementNS("http://www.w3.org/2000/svg", "g");
                calloutG.setAttribute("class", "node-callout");

                // Alternate dx coordinate offset for spacing
                const dx = (i % 2 === 0) ? -45 : 30;
                const dy = -30;

                const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                line.setAttribute("x1", coords.x);
                line.setAttribute("y1", coords.y);
                line.setAttribute("x2", coords.x + dx);
                line.setAttribute("y2", coords.y + dy);
                line.setAttribute("class", "callout-line");
                calloutG.appendChild(line);

                const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                text.setAttribute("x", coords.x + dx + (dx > 0 ? 5 : -55));
                text.setAttribute("y", coords.y + dy + 4);
                text.setAttribute("class", "callout-text");
                text.textContent = `[ ${Math.round(cumulativeTime)} min ]`;
                calloutG.appendChild(text);

                calloutsGroup.appendChild(calloutG);
            }
        }
    }

    // 5. Draw Custom White Destination pin bobbing above the final target node
    if (pinGroup) {
        const destNodeId = activePathNodes[activePathNodes.length - 1];
        const destNode = nodeMap.get(destNodeId);
        if (destNode) {
            const destCoords = getSvgCoords(destNode.x, destNode.y);
            const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
            g.setAttribute("class", "destination-pin");
            g.setAttribute("transform", `translate(${destCoords.x}, ${destCoords.y})`);

            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", "M 0 0 C -10 -10 -20 -20 -20 -30 C -20 -41 -11 -50 0 -50 C 11 -50 20 -41 20 -30 C 20 -20 10 -10 0 0 Z");
            path.setAttribute("fill", "#ffffff");
            path.setAttribute("stroke", "rgba(0, 0, 0, 0.2)");
            path.setAttribute("stroke-width", "1");
            g.appendChild(path);

            const innerCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            innerCircle.setAttribute("cx", "0");
            innerCircle.setAttribute("cy", "-30");
            innerCircle.setAttribute("r", "6");
            innerCircle.setAttribute("fill", "var(--neon-magenta)");
            g.appendChild(innerCircle);

            pinGroup.appendChild(g);
        }
    }
}

// Animate the drone flying from start to end along active path coordinates
function animateDroneFlight() {
    const clipLine = document.getElementById("clip-path-line");
    if (!clipLine || activePathNodes.length < 2) return;

    droneGroup.classList.remove("hidden");
    droneGroup.classList.add("in-flight");
    const pathLength = clipLine.getTotalLength();
    
    // Set initial mask values
    clipLine.style.strokeDasharray = pathLength;
    clipLine.style.strokeDashoffset = pathLength;
    
    let startTimestamp = null;
    const duration = Math.min(12000, Math.max(5000, pathLength * 9.0));

    function easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function step(timestamp) {
        if (!startTimestamp) startTimestamp = timestamp;
        const elapsed = timestamp - startTimestamp;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeInOutCubic(progress);

        const currentLength = easedProgress * pathLength;
        const point = clipLine.getPointAtLength(currentLength);

        // Update mask offset to draw/reveal the dotted line behind the drone
        clipLine.style.strokeDashoffset = pathLength - currentLength;

        // Calculate dynamic heading direction angle
        const delta = 1.5;
        const nextLength = Math.min(pathLength, currentLength + delta);
        const nextPoint = clipLine.getPointAtLength(nextLength);
        
        let angle = 0;
        if (nextPoint && point) {
            const dx = nextPoint.x - point.x;
            const dy = nextPoint.y - point.y;
            if (dx !== 0 || dy !== 0) {
                angle = Math.atan2(dy, dx) * (180 / Math.PI);
            }
        }

        // Apply translation and standard heading angle (drawn facing right)
        droneGroup.setAttribute("transform", `translate(${point.x}, ${point.y}) rotate(${angle})`);

        // Update timeline deck track bar & cursor
        const elapsedFlightTime = currentFlightDuration * progress;
        const clampedElapsed = Math.max(0, Math.min(currentFlightDuration, elapsedFlightTime));
        const posPct = progress * 100;

        if (timelineCursor) {
            timelineCursor.style.left = `${posPct}%`;
        }
        if (timelineProgressBar) {
            timelineProgressBar.style.width = `${posPct}%`;
        }
        if (timelineCursorVal) {
            timelineCursorVal.textContent = `${clampedElapsed.toFixed(1)} min`;
        }
        if (valTime) {
            valTime.textContent = clampedElapsed.toFixed(2);
        }

        if (progress < 1) {
            requestAnimationFrame(step);
        } else {
            // Anchor drone at destination with correct heading
            const destination = graphData.nodes.find(n => n.id === selectedEndNode);
            if (destination) {
                const destCoords = getSvgCoords(destination.x, destination.y);
                droneGroup.setAttribute("transform", `translate(${destCoords.x}, ${destCoords.y}) rotate(${angle})`);
            }
            // Ensure mask reveals full line at end
            clipLine.style.strokeDashoffset = 0;
            droneGroup.classList.remove("in-flight");

            // Ensure timeline finishes at exactly currentFlightDuration (100% position)
            if (valTime) {
                valTime.textContent = currentFlightDuration.toFixed(2);
            }
            if (timelineCursor) {
                timelineCursor.style.left = "100%";
            }
            if (timelineProgressBar) {
                timelineProgressBar.style.width = "100%";
            }
            if (timelineCursorVal) {
                timelineCursorVal.textContent = `${currentFlightDuration.toFixed(1)} min`;
            }
        }
    }

    requestAnimationFrame(step);
}

// Populate modal report variables
function openReportModal() {
    if (activePathNodes.length < 2) {
        alert("Report Unavailable: A flight path corridor must be generated first.");
        return;
    }

    const nodeMap = new Map(graphData.nodes.map(n => [n.id, n]));

    // 1. Meta information
    reportDate.textContent = new Date().toLocaleString();
    document.getElementById("rep-start").textContent = `${nodeMap.get(selectedStartNode).label} (${selectedStartNode})`;
    document.getElementById("rep-end").textContent = `${nodeMap.get(selectedEndNode).label} (${selectedEndNode})`;
    document.getElementById("rep-optimize").textContent = optimizeSelect.value.toUpperCase();
    document.getElementById("rep-weather").textContent = weatherSelect.value.toUpperCase();
    document.getElementById("rep-payload").textContent = `${payloadSlider.value} kg`;

    // 2. Metrics mapping
    document.getElementById("rep-dist").textContent = `${valDistance.textContent} km`;
    document.getElementById("rep-time").textContent = `${valTime.textContent} mins`;
    document.getElementById("rep-battery").textContent = `${(100 - parseFloat(valBattery.textContent)).toFixed(0)}% (${valEnergy.textContent})`;
    document.getElementById("rep-risk").textContent = `${valRisk.textContent} / 5.0`;
    document.getElementById("rep-carbon").textContent = `${valCarbon.textContent} kg`;
    document.getElementById("rep-carbon-savings").textContent = valCarbon.textContent;

    // 3. Sequential node routing list
    const pathList = document.getElementById("rep-path-list");
    pathList.innerHTML = "";
    activePathNodes.forEach((nodeId, index) => {
        const node = nodeMap.get(nodeId);
        
        const nodeSpan = document.createElement("span");
        nodeSpan.className = "rep-node-item";
        nodeSpan.textContent = node.label;
        pathList.appendChild(nodeSpan);

        if (index < activePathNodes.length - 1) {
            const arrowSpan = document.createElement("span");
            arrowSpan.className = "rep-arrow";
            arrowSpan.innerHTML = " &rarr; ";
            pathList.appendChild(arrowSpan);
        }
    });

    reportModal.classList.remove("hidden");
}

// Download formatted printable ASCII route optimization report
function downloadTextReport() {
    const nodeMap = new Map(graphData.nodes.map(n => [n.id, n]));
    const timeStr = new Date().toLocaleString();
    
    let txt = `======================================================================\n`;
    txt += `                 AEROROUTE SYSTEM LOGISTICS REPORT\n`;
    txt += `======================================================================\n`;
    txt += `Timestamp:       ${timeStr}\n`;
    txt += `Pathfinder:      Dijkstra Weighted Graph Search (Python Server)\n`;
    txt += `----------------------------------------------------------------------\n\n`;
    
    txt += `1. FLIGHT CONFIGURATION:\n`;
    txt += `------------------------\n`;
    txt += `Departure Node:  ${nodeMap.get(selectedStartNode).label} (${selectedStartNode})\n`;
    txt += `Arrival Node:    ${nodeMap.get(selectedEndNode).label} (${selectedEndNode})\n`;
    txt += `Objective:       ${optimizeSelect.value.toUpperCase()}\n`;
    txt += `Weather Alert:   ${weatherSelect.value.toUpperCase()}\n`;
    txt += `Payload Cargo:   ${payloadSlider.value} kg\n\n`;
    
    txt += `2. ROUTE CORRIDOR SEQUENCE:\n`;
    txt += `---------------------------\n`;
    txt += activePathNodes.map(nodeId => nodeMap.get(nodeId).label).join(" -> ") + "\n\n";
    
    txt += `3. CRITICAL OPERATIONAL TELEMETRY:\n`;
    txt += `----------------------------------\n`;
    txt += `Total Distance:  ${valDistance.textContent} km\n`;
    txt += `Est. Duration:   ${valTime.textContent} minutes\n`;
    txt += `Battery Expended: ${(100 - parseFloat(valBattery.textContent)).toFixed(0)}% (${valEnergy.textContent})\n`;
    txt += `Safety Rating:   ${valRisk.textContent} / 5.0 Risk Index\n`;
    txt += `Carbon Offset:   ${valCarbon.textContent} kg CO2 saved vs Road Transit\n\n`;
    
    txt += `4. DSA ALGORITHMIC NOTES:\n`;
    txt += `-------------------------\n`;
    txt += `- Dijkstra's shortest path routing calculated via heap priority queue.\n`;
    txt += `- Relaxed edge weights modified by cargo payloads and altitude climb power.\n`;
    txt += `- Bypassed flight grids over high wind tunnels and safety risk zones.\n`;
    txt += `- Net Carbon offset achieved is ${valCarbon.textContent} kg CO2 via electric UAV transit.\n\n`;
    txt += `======================================================================\n`;
    txt += `AeroRoute Logistics Routing Optimizer. Subject to FAA UAV Regulations.\n`;
    txt += `======================================================================\n`;

    const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `AeroRoute_Report_${selectedStartNode}_to_${selectedEndNode}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
}

// Generate background city grid street lines
function generateStreetLines() {
    const streetGroup = document.getElementById("street-lines-group");
    if (!streetGroup) return;
    streetGroup.innerHTML = "";

    const width = 1000;
    const height = 900;
    const step = 45;

    // Grid street layout with slight organic coordinates variations
    for (let x = 30; x < width; x += step) {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", x);
        line.setAttribute("y1", 0);
        line.setAttribute("x2", x + (Math.sin(x) * 12));
        line.setAttribute("y2", height);
        line.setAttribute("stroke", "rgba(124, 58, 237, 0.08)");
        line.setAttribute("stroke-width", x % 90 === 0 ? "1.5" : "0.7");
        streetGroup.appendChild(line);
    }

    for (let y = 30; y < height; y += step) {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", 0);
        line.setAttribute("y1", y);
        line.setAttribute("x2", width);
        line.setAttribute("y2", y + (Math.cos(y) * 12));
        line.setAttribute("stroke", "rgba(124, 58, 237, 0.08)");
        line.setAttribute("stroke-width", y % 90 === 0 ? "1.5" : "0.7");
        streetGroup.appendChild(line);
    }

    // Arterial highways diagonal overlays
    const highways = [
        { x1: 0, y1: 150, x2: 850, y2: 900 },
        { x1: 150, y1: 0, x2: 1000, y2: 750 },
        { x1: 0, y1: 750, x2: 850, y2: 0 },
        { x1: 300, y1: 900, x2: 1000, y2: 250 }
    ];

    highways.forEach(h => {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", h.x1);
        line.setAttribute("y1", h.y1);
        line.setAttribute("x2", h.x2);
        line.setAttribute("y2", h.y2);
        line.setAttribute("stroke", "rgba(124, 58, 237, 0.12)");
        line.setAttribute("stroke-width", "1.8");
        streetGroup.appendChild(line);
    });
}

// Calculate click coordinates relative to SVG viewBox (1000 x 900)
function getSvgClickCoords(event) {
    const rect = droneMap.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 1000;
    const y = ((event.clientY - rect.top) / rect.height) * 900;
    return { x, y };
}

// Convert SVG coordinate space to 0-100 grid system coordinates
function getGridCoords(svgX, svgY) {
    const x = ((svgX - marginX) / scaleWidth) * 100;
    const y = ((svgY - marginY) / scaleHeight) * 100;
    return { x, y };
}

// Render the active restricted airspace circles onto the SVG hazards group
function renderHazards() {
    if (!hazardsGroup) return;
    hazardsGroup.innerHTML = "";

    activeHazards.forEach((hz, idx) => {
        const svgCoords = getSvgCoords(hz.x, hz.y);
        const svgRadius = (hz.r / 100) * scaleWidth;

        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", svgCoords.x);
        circle.setAttribute("cy", svgCoords.y);
        circle.setAttribute("r", svgRadius);
        circle.setAttribute("class", "hazard-zone");
        circle.setAttribute("data-index", idx);

        hazardsGroup.appendChild(circle);
    });
}
