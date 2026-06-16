# AeroRoute | Drone Delivery Route Mapping & Optimization System

A premium, visually stunning, high-fidelity web application for mapping and optimizing drone flight corridors using **Dijkstra's Algorithm**. The application uses a pure **Python backend** for routing computations and an interactive, glassmorphic **HTML5/CSS3/JavaScript frontend** with real-time telemetry updates and simulated flight animations.

---

## 1. Product Details & Specifications

### Core Features & Functionalities
- **Dynamic Flight Grid**: Renders an interactive logistics delivery network showing sorting hubs, warehouses, and client dropzones directly on an SVG map viewport.
- **Dijkstra Pathfinder Engine**: Calculates the absolute shortest flight path based on three selectable optimization objectives:
  - *Flight Time (Duration)*: Minimizes delivery times by routing around wind bottlenecks.
  - *Battery Energy (Conserved)*: Minimizes Watt-hours consumed by penalizing positive altitude gains, headwinds, and cargo payloads.
  - *Spatial Distance (Geodesic)*: Finds the geometrically shortest route.
- **Dynamic Weather Modifiers**: Atmospheric changes recalculate edge weights dynamically on-the-fly:
  - *Clear Skies*: Baseline operating values.
  - *Strong Winds*: Caps ground speed at 40 km/h and draws +60W power fighting headwinds.
  - *Rain*: Caps ground speed at 35 km/h and increases risk metrics by 60%.
  - *Storms*: Severe turbulence caps speed at 15 km/h. Drone operations are suspended for payloads exceeding 3.0 kg.
- **Interactive Restricted Airspace (Radar Hazard Zones)**: Dispatchers can toggle **Restricted Airspace Mode** and click directly on the radar screen. A pulsing red hazard zone is created, triggering a geometric point-to-segment collision check on the backend. Dijkstra dynamically recalculates the route around the hazard zone in real time.
- **Dijkstra Tracer Console**: Displays real-time Priority Queue (min-heap) relaxation steps inside the dashboard terminal, explaining how the DSA concept evaluates nodes.
- **Simulated Flight Tracker**: Animates the drone icon moving along the calculated shortest path coordinates.
- **Operational Report**: Compiles pre-flight configurations and calculated analytics into a printable report sheet or downloadable text file.

### Expected Inputs & Outputs
- **Inputs**:
  - `Departure Logistics Hub` (Start Node ID)
  - `Customer Destination` (End Node ID)
  - `Optimization Objective` (Distance, Time, or Energy)
  - `Weather Environment` (Clear, Windy, Rainy, Stormy)
  - `Cargo Payload Weight` (0.0 to 5.0 kg slider)
  - `Airspace Hazard Coordinates` (Direct canvas clicks)
- **Outputs**:
  - `Optimal Node Path` (Sequential list, e.g. `["Mumbai_Hub", "Delhi_Depot", "Chennai_Zone"]`)
  - `Flight Time` (minutes)
  - `Flight Distance` (km)
  - `Battery Remaining` (% capacity)
  - `Average Risk safety Rating` (1.0 to 5.0 scale)
  - `CO₂ Emissions Saved` (kg offset vs road transit)
  - `Dijkstra Tracer Logs` (step-by-step priority queue relaxation logs)

### Target Users & Usage Scenarios
1. **Logistics Dispatch Managers**: Coordinate, schedule, and optimize flight corridors for active delivery fleets.
2. **Flight Operations Technicians**: Audit pre-flight weather alerts, battery requirements, and risk metrics before clearing drone takeoffs.
3. **Supply Chain Directors**: Review operational carbon savings, travel efficiencies, and transport cost savings.

---

## 2. DSA Concept: Dijkstra's Weighted Graph Optimization

If you are new to Data Structures and Algorithms (DSA), this section will help you understand how AeroRoute calculates the best flight path for a drone.

### 1. The Core Concept (In Plain English)
Imagine you are using a GPS map app on your phone to drive from one city to another:
*   **Nodes (Vertices)**: These are the **cities or intersections** (like Mumbai Central or Bengaluru Transit Terminal).
*   **Edges**: These are the **roads or flight corridors** connecting the cities.
*   **Weights (Costs)**: This is the **toll or difficulty** of using a road. In our drone app, the "cost" is not money, but rather the **travel distance (km)**, **flight time (minutes)**, or **battery power (Watt-hours)** consumed.

Our application represents the map as a **Weighted Directed Graph**. A "directed" graph means flight corridors can have different costs depending on the direction of travel (for example, flying *against* the wind is harder than flying *with* it!).

---

### 2. How Dijkstra's Algorithm Works (Step-by-Step)
Dijkstra's algorithm is like a smart explorer that always visits the closest unvisited city first to make sure it finds the absolute cheapest route:

1.  **Preparation**: 
    *   Set the cost of your starting city to `0`.
    *   Set the cost of all other cities on the map to **Infinity** (since we don't know how to reach them yet).
2.  **Explore**:
    *   Look at the unvisited city with the **cheapest accumulated cost** (on step 1, this is the start city at `0`).
3.  **Update Neighbors ("Relaxation")**:
    *   Look at all the cities you can fly directly to from this city.
    *   Calculate the cost to get to each neighbor *through* your current city.
    *   If this new path is cheaper than the cost currently written on that neighbor, update it with the new cheaper cost!
4.  **Mark Visited**:
    *   Mark the current city as "visited". We will never have to re-evaluate it.
5.  **Repeat**:
    *   Pick the next cheapest unvisited city and go back to Step 2.
    *   Repeat this until you reach your destination.

This process guarantees that when we reach the destination, we have found the absolute cheapest possible flight path!

---

### 3. How We Handle Obstacles (Restricted Airspace)
When you click on the map and place a red pulsing **Radar Hazard Zone** (restricted airspace):
1.  The backend checks every single flight corridor (edges).
2.  It mathematically calculates if the straight line between the two hubs crosses the red circle.
3.  If a corridor intersects the hazard circle, the backend sets that corridor's weight to **Infinity** (effectively deleting/blocking the road).
4.  Dijkstra's algorithm is then forced to route around the red circle because it cannot travel along "infinite-cost" paths.

---

<details>
<summary><b>📐 Show Advanced Mathematical Formulations & Geometry</b></summary>

### Weight Cost Equations
Edge weights $w(u, v)$ are computed dynamically based on the optimization objective:

$$\text{Weight} = \begin{cases} 
\text{Distance (km)} & \text{if mode} = \text{distance} \\
\frac{\text{Distance}}{\text{Effective Speed}} \times 60 \text{ (minutes)} & \text{if mode} = \text{time} \\
\text{Power Draw (W)} \times \text{Flight Time (h)} \times (1.0 + (\text{Risk} - 1.0) \times 0.1 \times \text{Weather Risk}) & \text{if mode} = \text{energy} 
\end{cases}$$

*   **Drone Base Speed**: $60.0\text{ km/h}$
*   **Effective Speed**: $\max(10.0\text{ km/h}, \text{Weather Speed} - (\text{Payload Weight (kg)} \times 2.0))$
*   **Total Power Draw**: $\text{Base Power (250W)} + \text{Weather Power} + \text{Payload Power} + \text{Altitude Climb Power}$
*   **Time Complexity**: $O(|E| + |V| \log |V|)$ using a min-heap priority queue (`heapq` in Python).

### Point-to-Segment Projection (Restricted Airspace Collisions)
To check if a corridor between $A(x_1, y_1)$ and $B(x_2, y_2)$ intersects a hazard circle centered at $C(c_x, c_y)$ with radius $r$, we project vector $\vec{AC}$ onto segment direction vector $\vec{AB}$:

$$\vec{v} = B - A, \quad \vec{w} = C - A$$

$$t = \max\left(0.0, \min\left(1.0, \frac{\vec{w} \cdot \vec{v}}{\vec{v} \cdot \vec{v}}\right)\right)$$

The closest point on the segment is $P = A + t \vec{v}$. If $(c_x - p_x)^2 + (c_y - p_y)^2 \le r^2$, the segment is blocked.
</details>

---


## 3. Production Deployment & Hosting

The project is structured for full-stack deployment across separate frontend and backend hosting services.

### Hosted Live Links
- **Interactive Frontend (Vercel)**: [https://drone-delivery-route-mapping.vercel.app](https://drone-delivery-route-mapping.vercel.app)
- **REST API Backend (Render)**: [https://drone-delivery-route-mapping-backend.onrender.com](https://drone-delivery-route-mapping-backend.onrender.com)

### Dynamic Environment Routing
The frontend automatically switches its backend API endpoint depending on where the app is being accessed:
```javascript
const API_BASE_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "" // Uses local relative routing when running the local Python server
    : "https://drone-delivery-route-mapping-backend.onrender.com"; // Redirects requests to hosted Render backend
```

---

## 4. Scalability, Usability, & Performance

### Performance Considerations
Pathfinder calculations execute in sub-milliseconds on the pure Python backend using heap-based priority queues (`heapq`). Static asset transfers and API routing respond instantly, ensuring smooth sub-second updates inside the web browser.

### Usability Considerations
The dashboard features an intuitive, visual-first viewport. Dispatchers click nodes directly on the map, trigger simulated drone trajectories, read Priority Queue relaxation tracer consoles, toggle satellite backgrounds, and print formatted report sheets with single-click actions.

### Scalability Considerations
Decoupled API gateway architecture allows for modular scale. The coordinates system can adapt from 12 nodes to 10,000 regional delivery vertices, and the backend Dijkstra core pathfinder will compute optimal pathways without performance degradation.

---

## 5. Project File Structure

```
drone/
├── backend/
│   └── server.py        # Python HTTP Server, Graph model, & Dijkstra pathfinder
├── frontend/
│   ├── index.html       # Sci-fi web dashboard & Tracer console UI
│   ├── style.css        # Neon styles, animations, scrollbars, and print layouts
│   ├── app.js           # SVG Map drawing, form listeners, and animations
│   └── satellite_map.png# Generated satellite map background graphic
├── render.yaml          # Render service deployment configuration
├── requirements.txt     # Root dependencies file for Render
└── README.md            # Detailed project documentation and API guides
```

---

## 6. Run the Project Locally

The AeroRoute server has **zero third-party dependencies**. It utilizes standard Python libraries.

### Prerequisites
- Python 3

### Step-by-Step Launch
1. Open your terminal.
2. Navigate to the project directory:
   ```bash
   cd "/Users/bhagyashreebhagat/Desktop/drone"
   ```
3. Run the Python backend gateway server:
   ```bash
   python3 backend/server.py
   ```
4. Open your web browser and navigate to:
   ```
   http://localhost:8000
   ```
5. Choose locations by clicking nodes on the map or using dropdown parameters, calculate flight routes, inspect Dijkstra relaxation steps, and print logistics reports!
