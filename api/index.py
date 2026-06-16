import os
import urllib.parse
from http.server import BaseHTTPRequestHandler
import json
import heapq

# Graph Edge representation
class Edge:
    def __init__(self, to, distance, altitude_gain, risk_index):
        self.to = to
        self.distance = distance        # in km
        self.altitude_gain = altitude_gain  # in meters
        self.risk_index = risk_index    # 1.0 (safe) to 5.0 (hazardous)

# Graph Node representation
class Node:
    def __init__(self, node_id, label, x, y, node_type):
        self.id = node_id
        self.label = label
        self.x = x                      # 0-100 grid x
        self.y = y                      # 0-100 grid y
        self.type = node_type            # "hub", "warehouse", "delivery_point"

class DroneDeliveryGraph:
    def __init__(self):
        self.nodes = {}
        self.adj_list = {}
        
        # Drone Constants
        self.DRONE_BASE_SPEED = 60.0       # km/h in clear weather
        self.DRONE_BATTERY_CAPACITY = 1000.0 # Wh (Watt-hours)
        self.DRONE_BASE_POWER = 250.0       # Watts (normal cruise power)
        self.CO2_SAVINGS_PER_KM = 0.15      # kg saved per km vs road transit
        
        self.initialize_default_network()

    def add_node(self, node_id, label, x, y, node_type):
        self.nodes[node_id] = Node(node_id, label, x, y, node_type)

    def add_edge(self, from_node, to_node, distance, altitude_gain, risk_index):
        if from_node not in self.adj_list:
            self.adj_list[from_node] = []
        self.adj_list[from_node].append(Edge(to_node, distance, altitude_gain, risk_index))

    def initialize_default_network(self):
        # Coordinates match a grid from 0 to 100
        self.add_node("Mumbai_Hub", "Mumbai Central Logistics Hub", 50, 50, "hub")
        self.add_node("Delhi_Depot", "Delhi Supply Depot", 50, 15, "warehouse")
        self.add_node("Bengaluru_Terminal", "Bengaluru Transit Terminal", 85, 45, "hub")
        self.add_node("Kolkata_Center", "Kolkata Automated Sorting Center", 45, 80, "warehouse")
        self.add_node("Hyderabad_Depot", "Hyderabad Drone Depot", 15, 55, "hub")
        
        self.add_node("Chennai_Zone", "Chennai Delivery Zone", 75, 20, "delivery_point")
        self.add_node("Pune_Zone", "Pune Delivery Zone", 80, 70, "delivery_point")
        self.add_node("Kochi_Coast", "Kochi Coastal Delivery Zone", 25, 85, "delivery_point")
        self.add_node("Jaipur_Zone", "Jaipur Pink Delivery Zone", 20, 25, "delivery_point")
        self.add_node("Ahmedabad_Commercial", "Ahmedabad Commercial Zone", 48, 40, "delivery_point")
        self.add_node("Goa_Beach_Landing", "Goa Beach Landing", 90, 20, "delivery_point")
        self.add_node("Noida_Industrial", "Noida Automation Park", 10, 10, "delivery_point")

        # Bidirectional flight connections
        # Mumbai Hub
        self.add_edge("Mumbai_Hub", "Ahmedabad_Commercial", 1.5, 0, 1.1)
        self.add_edge("Ahmedabad_Commercial", "Mumbai_Hub", 1.5, 0, 1.1)
        self.add_edge("Mumbai_Hub", "Delhi_Depot", 4.2, 15, 1.0)
        self.add_edge("Delhi_Depot", "Mumbai_Hub", 4.2, -15, 1.0)
        self.add_edge("Mumbai_Hub", "Bengaluru_Terminal", 4.5, 5, 1.2)
        self.add_edge("Bengaluru_Terminal", "Mumbai_Hub", 4.5, -5, 1.2)
        self.add_edge("Mumbai_Hub", "Kolkata_Center", 3.8, 10, 1.0)
        self.add_edge("Kolkata_Center", "Mumbai_Hub", 3.8, -10, 1.0)
        self.add_edge("Mumbai_Hub", "Hyderabad_Depot", 4.8, 8, 1.0)
        self.add_edge("Hyderabad_Depot", "Mumbai_Hub", 4.8, -8, 1.0)

        # Delhi Depot Area
        self.add_edge("Delhi_Depot", "Jaipur_Zone", 3.5, 5, 1.1)
        self.add_edge("Jaipur_Zone", "Delhi_Depot", 3.5, -5, 1.1)
        self.add_edge("Delhi_Depot", "Chennai_Zone", 3.2, 5, 1.2)
        self.add_edge("Chennai_Zone", "Delhi_Depot", 3.2, -5, 1.2)
        self.add_edge("Jaipur_Zone", "Noida_Industrial", 2.5, 10, 1.5)
        self.add_edge("Noida_Industrial", "Jaipur_Zone", 2.5, -10, 1.5)
        self.add_edge("Hyderabad_Depot", "Noida_Industrial", 5.0, 15, 1.2)
        self.add_edge("Noida_Industrial", "Hyderabad_Depot", 5.0, -15, 1.2)

        # Bengaluru Terminal Area
        self.add_edge("Bengaluru_Terminal", "Chennai_Zone", 3.0, 5, 1.1)
        self.add_edge("Chennai_Zone", "Bengaluru_Terminal", 3.0, -5, 1.1)
        self.add_edge("Bengaluru_Terminal", "Goa_Beach_Landing", 4.0, 20, 2.2)
        self.add_edge("Goa_Beach_Landing", "Bengaluru_Terminal", 4.0, -20, 2.2)
        self.add_edge("Chennai_Zone", "Goa_Beach_Landing", 2.8, 10, 1.8)
        self.add_edge("Goa_Beach_Landing", "Chennai_Zone", 2.8, -10, 1.8)
        
        # Kolkata Center Area
        self.add_edge("Bengaluru_Terminal", "Pune_Zone", 3.1, -2, 1.0)
        self.add_edge("Pune_Zone", "Bengaluru_Terminal", 3.1, 2, 1.0)
        self.add_edge("Kolkata_Center", "Pune_Zone", 3.9, 8, 1.1)
        self.add_edge("Pune_Zone", "Kolkata_Center", 3.9, -8, 1.1)
        self.add_edge("Kolkata_Center", "Kochi_Coast", 3.0, 5, 1.2)
        self.add_edge("Kochi_Coast", "Kolkata_Center", 3.0, -5, 1.2)

        # Hyderabad Depot Area
        self.add_edge("Hyderabad_Depot", "Kochi_Coast", 3.6, 5, 1.0)
        self.add_edge("Kochi_Coast", "Hyderabad_Depot", 3.6, -5, 1.0)
        self.add_edge("Hyderabad_Depot", "Jaipur_Zone", 3.3, 0, 1.1)
        self.add_edge("Jaipur_Zone", "Hyderabad_Depot", 3.3, 0, 1.1)

    def is_edge_intersecting_hazard(self, from_node_id, to_node_id, hazard_x, hazard_y, radius):
        node_a = self.nodes.get(from_node_id)
        node_b = self.nodes.get(to_node_id)
        if not node_a or not node_b:
            return False
            
        x1, y1 = node_a.x, node_a.y
        x2, y2 = node_b.x, node_b.y
        cx, cy = hazard_x, hazard_y
        
        vx = x2 - x1
        vy = y2 - y1
        
        wx = cx - x1
        wy = cy - y1
        
        v_dot_v = vx * vx + vy * vy
        if v_dot_v == 0.0:
            dist_sq = wx * wx + wy * wy
            return dist_sq <= radius * radius
            
        t = (wx * vx + wy * vy) / v_dot_v
        t = max(0.0, min(1.0, t))
        
        proj_x = x1 + t * vx
        proj_y = y1 + t * vy
        
        dx = cx - proj_x
        dy = cy - proj_y
        dist_sq = dx * dx + dy * dy
        
        return dist_sq <= radius * radius

    def calculate_edge_cost(self, edge, weather, payload_weight, optimize_by):
        speed = self.DRONE_BASE_SPEED
        weather_power_addition = 0.0
        weather_risk_multiplier = 1.0

        if weather == "windy":
            speed = 40.0
            weather_power_addition = 60.0
            weather_risk_multiplier = 1.4
        elif weather == "rainy":
            speed = 35.0
            weather_power_addition = 30.0
            weather_risk_multiplier = 1.6
        elif weather == "stormy":
            speed = 15.0
            weather_power_addition = 150.0
            weather_risk_multiplier = 3.5

        payload_speed_penalty = payload_weight * 2.0
        payload_power_draw = payload_weight * 35.0
        effective_speed = max(10.0, speed - payload_speed_penalty)

        altitude_climb_power = (edge.altitude_gain * 2.0) if edge.altitude_gain > 0 else 0.0

        travel_time_hours = edge.distance / effective_speed
        total_power_draw = self.DRONE_BASE_POWER + weather_power_addition + payload_power_draw + altitude_climb_power
        energy_consumed_wh = total_power_draw * travel_time_hours

        if optimize_by == "distance":
            return edge.distance
        elif optimize_by == "time":
            return travel_time_hours * 60.0  # minutes
        elif optimize_by == "energy":
            return energy_consumed_wh * (1.0 + (edge.risk_index - 1.0) * 0.1 * weather_risk_multiplier)
            
        return edge.distance

    def find_shortest_path(self, start_node, end_node, weather, payload_weight, optimize_by, hazards=None):
        if start_node not in self.nodes:
            return {"success": False, "error_message": f"Start node '{start_node}' not found in delivery grid."}
        if end_node not in self.nodes:
            return {"success": False, "error_message": f"Destination node '{end_node}' not found in delivery grid."}

        if weather == "stormy" and payload_weight > 3.0:
            return {"success": False, "error_message": "Flight Cancelled: Drone operations suspended for payloads > 3kg during Storm alerts."}

        distances = {node_id: float('inf') for node_id in self.nodes}
        predecessors = {}
        distances[start_node] = 0.0
        
        pq = [(0.0, start_node)]
        
        trace = []
        trace.append(f"🔍 Initializing Dijkstra shortest path routing from '{start_node}' to '{end_node}'")
        trace.append(f"   Optimization Objective: {optimize_by.upper()}")
        trace.append(f"   Environment Parameters: Weather={weather.upper()}, Payload={payload_weight}kg")
        trace.append(f"   [Step 1] Set starting node distance to 0.00, and all other nodes to infinity (∞).")
        
        visited_steps = 0
        
        while pq:
            current_cost, u = heapq.heappop(pq)
            
            if current_cost > distances[u]:
                continue
                
            visited_steps += 1
            trace.append(f"\n[{visited_steps}] Visited node '{u}' (accumulated cost: {current_cost:.2f}). Relaxing outgoing flight corridors...")
            
            if u == end_node:
                trace.append(f"   🎯 Target node '{end_node}' reached! Stopping search.")
                break
                
            edges = self.adj_list.get(u, [])
            if not edges:
                trace.append(f"   No outgoing flight corridors from '{u}'.")
                
            for edge in edges:
                v = edge.to
                
                blocked = False
                if hazards:
                    for hz in hazards:
                        hz_x = float(hz.get("x", 0))
                        hz_y = float(hz.get("y", 0))
                        hz_r = float(hz.get("r", 8.0))
                        if self.is_edge_intersecting_hazard(u, v, hz_x, hz_y, hz_r):
                            blocked = True
                            break
                if blocked:
                    trace.append(f"      🚫 Edge '{u} -> {v}' blocked by restricted airspace Radar Hazard Zone. Skipping relaxation.")
                    continue
                    
                weight = self.calculate_edge_cost(edge, weather, payload_weight, optimize_by)
                new_cost = distances[u] + weight
                
                if new_cost < distances[v]:
                    old_cost_str = f"{distances[v]:.2f}" if distances[v] != float('inf') else "∞"
                    trace.append(f"      ⚡ Edge '{u} -> {v}': new path cost {new_cost:.2f} < current cost {old_cost_str}. Updating cost and predecessor link.")
                    distances[v] = new_cost
                    predecessors[v] = u
                    heapq.heappush(pq, (new_cost, v))
                else:
                    trace.append(f"      Edge '{u} -> {v}': path cost {new_cost:.2f} >= current cost {distances[v]:.2f}. Skipping relaxation.")

        if distances[end_node] == float('inf'):
            trace.append(f"❌ Pathfinder Alert: No viable flight route found between {start_node} and {end_node}")
            return {"success": False, "error_message": f"No viable flight route found between {start_node} and {end_node}", "algorithm_trace": trace}

        path = []
        curr = end_node
        while curr != start_node:
            path.append(curr)
            curr = predecessors[curr]
        path.append(start_node)
        path.reverse()

        total_distance = 0.0
        total_time_hours = 0.0
        total_energy_wh = 0.0
        total_risk = 0.0
        edge_count = 0

        for i in range(len(path) - 1):
            u_node = path[i]
            v_node = path[i+1]
            
            found_edge = None
            for edge in self.adj_list.get(u_node, []):
                if edge.to == v_node:
                    found_edge = edge
                    break
                    
            if found_edge:
                total_distance += found_edge.distance
                
                speed = self.DRONE_BASE_SPEED
                weather_power_addition = 0.0
                weather_risk_multiplier = 1.0

                if weather == "windy":
                    speed = 40.0
                    weather_power_addition = 60.0
                    weather_risk_multiplier = 1.4
                elif weather == "rainy":
                    speed = 35.0
                    weather_power_addition = 30.0
                    weather_risk_multiplier = 1.6
                elif weather == "stormy":
                    speed = 15.0
                    weather_power_addition = 150.0
                    weather_risk_multiplier = 3.5

                payload_speed_penalty = payload_weight * 2.0
                payload_power_draw = payload_weight * 35.0
                effective_speed = max(10.0, speed - payload_speed_penalty)
                
                altitude_climb_power = (found_edge.altitude_gain * 2.0) if found_edge.altitude_gain > 0 else 0.0

                travel_time_h = found_edge.distance / effective_speed
                power_draw = self.DRONE_BASE_POWER + weather_power_addition + payload_power_draw + altitude_climb_power
                energy_wh = power_draw * travel_time_h

                total_time_hours += travel_time_h
                total_energy_wh += energy_wh
                total_risk += found_edge.risk_index * weather_risk_multiplier
                edge_count += 1

        avg_risk = (total_risk / edge_count) if edge_count > 0 else 1.0
        battery_consumed = (total_energy_wh / self.DRONE_BATTERY_CAPACITY) * 100.0
        carbon_saved = total_distance * self.CO2_SAVINGS_PER_KM

        return {
            "success": True,
            "error_message": "",
            "path": path,
            "total_distance": round(total_distance, 2),
            "total_time_mins": round(total_time_hours * 60.0, 2),
            "energy_consumed_wh": round(total_energy_wh, 2),
            "battery_consumed_pct": round(battery_consumed, 2),
            "carbon_saved_kg": round(carbon_saved, 4),
            "average_risk": round(avg_risk, 2),
            "algorithm_trace": trace
        }

    def get_graph_data(self):
        nodes_list = []
        for n_id, n in self.nodes.items():
            nodes_list.append({
                "id": n.id,
                "label": n.label,
                "x": n.x,
                "y": n.y,
                "type": n.type
            })

        edges_list = []
        for from_id, edges in self.adj_list.items():
            for edge in edges:
                edges_list.append({
                    "from": from_id,
                    "to": edge.to,
                    "distance": edge.distance,
                    "altitude_gain": edge.altitude_gain,
                    "risk_index": edge.risk_index
                })

        return {"nodes": nodes_list, "edges": edges_list}


graph = DroneDeliveryGraph()


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query = urllib.parse.parse_qs(parsed_url.query)

        def add_cors_headers():
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")

        # API endpoint: retrieve full map topology
        if path == "/api/graph":
            try:
                data = graph.get_graph_data()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                add_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps(data).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                add_cors_headers()
                self.end_headers()
                err = {"success": False, "error_message": f"Graph retrieval failed: {str(e)}"}
                self.wfile.write(json.dumps(err).encode("utf-8"))
            return

        # API endpoint: compute Dijkstra shortest flight route
        elif path == "/api/route":
            start = query.get("start", [""])[0]
            end = query.get("end", [""])[0]
            weather = query.get("weather", ["clear"])[0]
            optimize = query.get("optimize", ["time"])[0]
            
            try:
                payload = float(query.get("payload", ["0.0"])[0])
            except ValueError:
                payload = 0.0

            hazards_raw = query.get("hazards", ["[]"])[0]
            try:
                hazards = json.loads(hazards_raw)
            except Exception:
                hazards = []

            if not start or not end:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                add_cors_headers()
                self.end_headers()
                err = {"success": False, "error_message": "Missing 'start' or 'end' node query parameter."}
                self.wfile.write(json.dumps(err).encode("utf-8"))
                return

            try:
                res = graph.find_shortest_path(start, end, weather, payload, optimize, hazards)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                add_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps(res).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                add_cors_headers()
                self.end_headers()
                err = {"success": False, "error_message": f"Dijkstra calculations failed: {str(e)}"}
                self.wfile.write(json.dumps(err).encode("utf-8"))
            return

        else:
            self.send_response(404)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"Not Found")
