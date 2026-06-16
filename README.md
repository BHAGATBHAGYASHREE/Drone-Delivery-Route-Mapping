# AeroRoute | Advanced Drone Delivery Pathfinding & Telemetry Dashboard

AeroRoute is a premium, visually stunning, high-fidelity web application for optimizing and mapping regional drone flight corridors. Built as a decoupled system using a **pure Python backend** and an interactive, glassmorphic **HTML5/CSS3/JavaScript frontend**, it models delivery networks as weighted directed graphs and implements **Dijkstra's Algorithm** with custom real-time environmental cost metrics and dynamic restricted airspace hazard avoidance.

---

## 1. Product Details & Specification

### Core Features
*   **Dynamic Logistics Flight Grid**: Renders an interactive map representing logistics sorting hubs, warehouses, and client dropzones directly on a responsive SVG viewport.
*   **Multi-Objective Pathfinder**: Calculates the mathematically optimal route based on three selectable constraints:
    *   *Spatial Distance (Geodesic)*: Minimizes the total physical travel distance (in kilometers).
    *   *Flight Time (Duration)*: Minimizes flight time (in minutes) by accounting for weather speed caps and payload penalties.
    *   *Battery Energy (Conserved)*: Minimizes Watt-hours consumed by factoring in battery drain, aerodynamic wind drag, altitude climb energy, and payload weight.
*   **Dynamic Weather Simulation**: Simulates real-time weather changes that recalculate edge weights on-the-fly:
    *   *Clear Skies*: Optimal cruising conditions.
    *   *Strong Winds*: Ground speed capped at 40 km/h; draws +60W power to combat headwinds.
    *   *Rain*: Ground speed capped at 35 km/h; increases risk rating by 60%.
    *   *Storms*: Suspends flights for cargo payloads exceeding 3.0 kg; caps speeds at 15 km/h; increases risk indices by 250% (+150W turbulence power draw).
*   **Interactive Radar Hazard Zones**: Dispatchers can toggle **Restricted Airspace Mode** and click directly on the radar screen. A pulsing red hazard zone is created, triggering a geometric point-to-segment collision check on the backend. Dijkstra dynamically recalculates the route around the hazard zone in real time.
*   **Dijkstra Tracer Console**: A live dashboard terminal that streams priority queue (min-heap) relaxation steps, showing how vertices are visited and edge costs updated.
*   **Simulated Flight Telemetry**: Features flight state animations where a drone icon traverses the computed route coordinate-by-coordinate, updating progress in real-time.
*   **Operational Report Sheet**: Compiles pre-flight flight paths, weather conditions, risk index metrics, energy consumption, and carbon offsets into a printable, professional dispatcher manifest.

### Expected Inputs & Outputs
*   **Inputs**:
    *   `Departure Logistics Hub` (Start Node ID)
    *   `Customer Destination` (End Node ID)
    *   `Optimization Metric` (Distance, Time, or Energy)
    *   `Weather Environment` (Clear, Windy, Rainy, Stormy)
    *   `Cargo Payload Weight` (0.0 to 5.0 kg slider)
    *   `Restricted Airspace Coordinates` (Dynamic hazard circles coordinates and radius)
*   **Outputs**:
    *   `Optimal Node Path` (Sequential list, e.g. `["Mumbai_Hub", "Ahmedabad_Commercial", "Delhi_Depot"]`)
    *   `Flight Time` (minutes)
    *   `Flight Distance` (km)
    *   `Battery Consumed` (% of 1000Wh battery capacity)
    *   `Average Risk Safety Rating` (1.0 to 5.0 scale)
    *   `CO₂ Offset` (kg saved vs. equivalent standard road transit)
    *   `Dijkstra tracer logs` (complete execution trace)

### Target Users & Scenarios
1.  **Logistics Dispatch Managers**: Coordinate, schedule, and optimize flight corridors for active delivery fleets.
2.  **Drone Fleet Supervisors**: Audit pre-flight weather constraints, cargo weight payload parameters, and battery thresholds prior to takeoff clearance.
3.  **Sustainability Auditors**: Extract operations reports to quantify carbon emissions reductions.

---

## 2. DSA Concept: Weighted Graph Optimization & Pathfinder

AeroRoute models the delivery network as a **Weighted Directed Graph** $G = (V, E)$, where:
*   $V$ represents logistics centers and dropzones.
*   $E$ represents viable flight corridors between nodes.

### Weight Cost Formulations
To model realistic flight physics, edge weights $w(u, v)$ are computed dynamically:

$$\text{Weight} = \begin{cases} 
\text{Distance (km)} & \text{if mode} = \text{distance} \\
\frac{\text{Distance}}{\text{Effective Speed}} \times 60 \text{ (minutes)} & \text{if mode} = \text{time} \\
\text{Power Draw (W)} \times \text{Flight Time (h)} \times (1.0 + (\text{Risk} - 1.0) \times 0.1 \times \text{Weather Risk}) & \text{if mode} = \text{energy} 
\end{cases}$$

#### Constant Constraints:
*   **Drone Base Speed**: $60.0\text{ km/h}$
*   **Drone Base Power Cruise**: $250.0\text{ W}$
*   **Battery Capacity**: $1000.0\text{ Wh}$ (Watt-hours)
*   **CO₂ Savings Offset**: $0.15\text{ kg CO}_2/\text{km}$ vs. road vehicle transit

#### Modifiers:
1.  **Weather Speed & Power Caps**:
    *   `Clear`: speed = $60.0\text{ km/h}$, extra power = $0\text{ W}$, risk multiplier = $1.0\times$
    *   `Windy`: speed = $40.0\text{ km/h}$, extra power = $+60\text{ W}$, risk multiplier = $1.4\times$
    *   `Rainy`: speed = $35.0\text{ km/h}$, extra power = $+30\text{ W}$, risk multiplier = $1.6\times$
    *   `Stormy`: speed = $15.0\text{ km/h}$, extra power = $+150\text{ W}$, risk multiplier = $3.5\times$
2.  **Payload Speed Penalty & Power Draw**:
    *   $\text{Payload Speed Penalty} = \text{Payload Weight (kg)} \times 2.0\text{ km/h}$
    *   $\text{Payload Power Draw} = \text{Payload Weight (kg)} \times 35.0\text{ W}$
    *   $\text{Effective Speed} = \max(10.0\text{ km/h}, \text{Weather Speed} - \text{Payload Speed Penalty})$
3.  **Altitude Power Draw**:
    *   $\text{Altitude Climb Power} = \text{Altitude Gain (meters)} \times 2.0\text{ W}$ (if altitude gain $> 0$)

### Dijkstra Priority Queue Pathfinder
AeroRoute implements Dijkstra's Algorithm utilizing a min-heap priority queue ($O(|E| + |V| \log |V|)$). It guarantees finding the global minimum cost path. 

```mermaid
graph TD
    Start([Initialize Dijkstra]) --> SetDistances[Set Start Node Dist=0, Others=∞]
    SetDistances --> PushHeap[Push Start Node to Min-Heap]
    
    PushHeap --> PopHeap{Heap Empty?}
    PopHeap -- Yes --> NoPath[Return Error: No Route Found]
    PopHeap -- No --> PopMin[Pop Node 'u' with Min Cost]
    
    PopMin --> CheckTarget{Is 'u' Destination?}
    CheckTarget -- Yes --> BuildPath[Reconstruct Shortest Path & Telemetry]
    BuildPath --> Success([Success Return])
    
    CheckTarget -- No --> ExploreEdges[Get Outgoing Edges of 'u']
    ExploreEdges --> LoopEdges{For Each Edge u -> v}
    
    LoopEdges -- No More Edges --> PopHeap
    LoopEdges -- Next Edge --> CheckHazards{Intersects Airspace Hazard?}
    
    CheckHazards -- Yes --> SkipEdge[Skip relaxation / Set Cost=∞]
    SkipEdge --> LoopEdges
    
    CheckHazards -- No --> CalculateWeight[Calculate Dynamic Weight cost]
    CalculateWeight --> RelaxEdge{New Cost < Current Dist 'v'?}
    
    RelaxEdge -- No --> LoopEdges
    RelaxEdge -- Yes --> UpdatePredecessor[Update Dist 'v' & Predecessor Link]
    UpdatePredecessor --> PushNew[Push 'v' to Heap]
    PushNew --> LoopEdges
```

### Geometric Restricted Airspace Collisions
When checking if a flight corridor between node $A(x_1, y_1)$ and node $B(x_2, y_2)$ intersects a circular hazard zone centered at $C(c_x, c_y)$ with radius $r$, the backend projects vector $\vec{AC}$ onto segment direction vector $\vec{AB}$:

$$\vec{v} = B - A, \quad \vec{w} = C - A$$

$$t = \max\left(0.0, \min\left(1.0, \frac{\vec{w} \cdot \vec{v}}{\vec{v} \cdot \vec{v}}\right)\right)$$

The closest point on the segment is $P = A + t \vec{v}$. The distance squared between $C$ and $P$ is:

$$\text{Distance}^2 = (c_x - p_x)^2 + (c_y - p_y)^2$$

If $\text{Distance}^2 \le r^2$, the corridor is blocked. Its cost is treated as infinite, forcing Dijkstra to bypass the edge.

## 3. Web UI & Layout Guide

AeroRoute features a premium, responsive glassmorphic lavender-themed dashboard:
*   **Mission Control Panel (Left)**: Configures flight inputs (Hub selectors, optimization objective, weather environment, payload weight) and triggers path calculations or resets.
*   **Dijkstra Inspector Terminal (Left - bottom of Control Tower)**: Displays the sequential path list and streams real-time priority queue (min-heap) relaxation tracer logs.
*   **Radar Navigation Viewport (Center)**: An SVG canvas displaying the city grid, nodes, active flight paths, and drone flight animations. Clicking directly on the viewport with **Restricted Airspace Mode** enabled places or removes circular hazard zones.
*   **Timeline Deck (Bottom Center)**: Tracks flight progress dynamically in minutes as the drone animates along the calculated route.
*   **Operational Telemetry HUD (Right)**: Stacked cards displaying real-time metrics for Flight Time, Distance, Power Cell remaining (with a visual progress bar), Risk Index, and Carbon Offsets.
*   **Pre-Flight Manifest Modal**: Displays a formatted, printable executive logistics summary of the configured flight parameters, path, and telemetry.

---

## 4. API Reference

### 1. Retrieve Graph Topology
Retrieves the nodes grid coordinates, node labels, types, and connections.

*   **URL**: `/api/graph`
*   **Method**: `GET`
*   **Response**: `200 OK` (JSON)
    ```json
    {
      "nodes": [
        {"id": "Mumbai_Hub", "label": "Mumbai Central Logistics Hub", "x": 50, "y": 50, "type": "hub"}
      ],
      "edges": [
        {"from": "Mumbai_Hub", "to": "Delhi_Depot", "distance": 4.2, "altitude_gain": 15, "risk_index": 1.0}
      ]
    }
    ```

### 2. Compute Shortest Path
Calculates the optimal flight path based on the criteria parameters.

*   **URL**: `/api/route`
*   **Method**: `GET`
*   **Parameters**:
    *   `start` (string, required): Departure node ID
    *   `end` (string, required): Target node ID
    *   `optimize` (string, optional): `distance` | `time` | `energy` (default: `time`)
    *   `weather` (string, optional): `clear` | `windy` | `rainy` | `stormy` (default: `clear`)
    *   `payload` (float, optional): Cargo weight in kg from `0.0` to `5.0` (default: `0.0`)
    *   `hazards` (string, optional): JSON string list of active circular hazards, e.g. `[{"x": 48.0, "y": 32.0, "r": 8.0}]`
*   **Response**: `200 OK` (JSON)
    ```json
    {
      "success": true,
      "error_message": "",
      "path": ["Mumbai_Hub", "Ahmedabad_Commercial", "Delhi_Depot"],
      "total_distance": 5.7,
      "total_time_mins": 6.84,
      "energy_consumed_wh": 31.5,
      "battery_consumed_pct": 3.15,
      "carbon_saved_kg": 0.855,
      "average_risk": 1.1,
      "algorithm_trace": [
        "🔍 Initializing Dijkstra shortest path routing...",
        "[1] Visited node 'Mumbai_Hub'..."
      ]
    }
    ```

---

## 5. Scalability, Usability, & Performance

*   **Sub-millisecond Performance**: The Dijkstra solver uses Python's native `heapq` module, running searches in less than 0.5 milliseconds.
*   **Scale**: The backend node coordinate scaling handles up to 10,000 vertices seamlessly.
*   **Zero Dependencies**: The backend requires **no third-party Python frameworks** (such as Flask, FastAPI, or Scikit-Learn), operating completely on Python 3 standard library packages (`http.server`, `urllib`, `heapq`, `json`).

## 6. Directory Structure

```
drone/
├── backend/
│   └── server.py        # Python server, Graph definition, & Dijkstra pathfinder
└── frontend/
    ├── index.html       # Dashboard HTML cockpit structure
    ├── style.css        # Responsive CSS grid layouts & neon themes
    ├── app.js           # SVG rendering, client-side animations, & API requests
    └── street_map.png   # Map grid background asset
```

---

## 7. Run the Project Locally

### Prerequisites
*   Python 3 installed on the system.

### Launch Server
1.  Navigate to the repository folder:
    ```bash
    cd "/Users/bhagyashreebhagat/Desktop/drone"
    ```
2.  Start the HTTP API server:
    ```bash
    python3 backend/server.py
    ```
3.  Open the web interface in your browser:
    ```
    http://localhost:8000
    ```
4.  Compute routes, toggling optimization objectives, parameters, and clicking directly on the map coordinates to add restricted airspace obstacles!
