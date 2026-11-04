# NetSim – Smart Campus Network Simulator

<p align="center">
  <strong>An Interactive Computer Networks Simulation Platform</strong>
  <br />
  Learn, visualize, simulate, and troubleshoot a smart campus network.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite 6" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4-38BDF8?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript" />
  <img src="https://img.shields.io/badge/Vitest-34_Tests-6E9F18?style=for-the-badge&logo=vitest&logoColor=white" alt="Vitest" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Active_Development-success?style=flat-square" alt="Project Status" />
  <img src="https://img.shields.io/badge/Network-19_Devices-blue?style=flat-square" alt="Network Devices" />
  <img src="https://img.shields.io/badge/VLANs-5-purple?style=flat-square" alt="VLANs" />
  <img src="https://img.shields.io/badge/Simulation-Client_Side-orange?style=flat-square" alt="Client Side Simulation" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="MIT License" />
</p>

---

## Overview

**NetSim – Smart Campus Network Simulator** is an interactive, browser-based Computer Networks simulation platform designed to demonstrate how a modern college campus network operates.

The project models a complete campus network environment consisting of multiple departments, network devices, VLANs, servers, wireless clients, and an external ISP connection.

It allows users to explore network topology, understand IP addressing, simulate DHCP and DNS operations, trace packets across network layers, test connectivity, and troubleshoot common networking problems through interactive simulations.

Unlike a static network diagram, NetSim uses a deterministic JavaScript-based simulation engine to calculate network behavior according to modeled networking rules.

**The entire application runs on the client side.** It does not communicate with physical Cisco devices or operate a real network. Network configurations and simulation results are maintained in browser memory and persisted using localStorage.

## Key Features

| Feature | Description |
|---|---|
| Interactive Dashboard | Monitor device status, active links, configuration errors, and connectivity results. |
| Network Topology | Explore an interactive campus network with devices, connections, VLAN zones, and packet paths. |
| IP Addressing | View IPv4 addressing plans, subnet information, and device IP allocations. |
| VLSM Calculator | Calculate variable-length subnets based on host requirements. |
| VLAN Configuration | Explore VLAN segmentation, access ports, trunk links, and generated configurations. |
| DHCP Simulation | Visualize the complete Discover, Offer, Request, and Acknowledge (DORA) process. |
| DNS Resolution | Simulate hostname resolution and inspect DNS query results. |
| Packet Flow | Trace packet forwarding, ARP resolution, routing decisions, TTL changes, and reply paths. |
| Connectivity Testing | Simulate ICMP, TCP, and UDP connectivity between network devices. |
| Troubleshooting Lab | Inject, diagnose, and fix nine common networking faults. |
| Network Security | Explore Access Control Lists (ACLs), NAT overload, and network security policies. |
| Cisco IOS Generator | Generate educational Cisco IOS-style router and switch configurations. |
| OSI & TCP/IP Explorer | Understand network encapsulation and the relationship between protocol layers. |
| Simulation History | Review previously executed simulation activities. |
| Theme Support | Switch between dark and light themes. |
| Browser Persistence | Preserve network state and simulation history using localStorage. |

## Campus Network Architecture

NetSim models a hierarchical college campus network divided into separate logical network segments.

### Network Overview

| Component | Configuration |
|---|---|
| Total Devices | 19 |
| Network Links | 18 |
| VLAN Segments | 5 |
| Edge Router | R1 |
| Core Switch | CORE-SW |
| Access Switches | CSE-SW, ADM-SW, LIB-SW |
| Central DNS Server | SRV-CORE |
| Library Server | SRV-LIB |
| Wireless Access Point | AP-1 |
| External Network | ISP-R and PUBLIC-WEB |

### Logical VLAN and IP Addressing Plan

Each department has a dedicated IPv4 subnet to maintain logical network segmentation.

| VLAN ID | Department | Network | Default Gateway |
|:---:|---|---|---|
| 10 | CSE | `10.10.10.0/24` | `10.10.10.1` |
| 20 | Administration | `10.10.20.0/24` | `10.10.20.1` |
| 30 | Library | `10.10.30.0/24` | `10.10.30.1` |
| 40 | Server Room | `10.10.40.0/24` | `10.10.40.1` |
| 50 | Campus Wi-Fi | `10.10.50.0/24` | `10.10.50.1` |

Each VLAN uses a `/24` subnet mask (`255.255.255.0`).

### Network Devices

The simulated campus network includes:

- **R1:** Edge router with five 802.1Q subinterfaces and an external WAN connection.
- **CORE-SW:** Central switch connecting the router, access switches, servers, and wireless access point.
- **CSE-SW:** Access switch for the Computer Science department.
- **ADM-SW:** Access switch for the Administration department.
- **LIB-SW:** Access switch for the Library.
- **SRV-CORE:** Central server providing DNS and HTTP services.
- **SRV-LIB:** Library web server.
- **AP-1:** Wireless access point with SSID `DTC-Campus`.
- **End Devices:** Departmental PCs, laptop, and smartphone.
- **ISP-R:** Simulated external ISP router.
- **PUBLIC-WEB:** External web server.

### Default DHCP Address Allocation

| Device | IP Address |
|---|---|
| CSE-PC1 | `10.10.10.11` |
| CSE-PC2 | `10.10.10.12` |
| CSE-PC3 | `10.10.10.13` |
| ADM-PC1 | `10.10.20.11` |
| ADM-PC2 | `10.10.20.12` |
| LIB-PC1 | `10.10.30.11` |
| LIB-PC2 | `10.10.30.12` |
| LAPTOP-1 | `10.10.50.11` |
| PHONE-1 | `10.10.50.12` |

The DHCP pools reserve addresses `.1` through `.10` for gateways and static network infrastructure.

### Network Services

**DHCP:** Four DHCP pools are configured for CSE, Administration, Library, and Wi-Fi segments.

**DNS:** SRV-CORE (`10.10.40.10`) provides internal hostname resolution.

Default DNS records:

| Hostname | IP Address |
|---|---|
| `portal.campus.local` | `10.10.40.10` |
| `library.campus.local` | `10.10.40.20` |
| `dns.campus.local` | `10.10.40.10` |

**NAT Overload (PAT):** Internal private addresses are translated to the router's WAN address (`203.0.113.1`) when communicating with the simulated external network.

**Access Control List:** The `WIFI-IN` policy prevents Wi-Fi clients from accessing the Administration subnet while permitting other IPv4 traffic according to the configured rules.

## Simulation Modules

NetSim provides 12 main sections.

### 1. Overview Dashboard

Provides a centralized view of network health.

- Total connected devices.
- Active network links.
- Configuration validation results.
- Reference connectivity test.
- Network topology preview.
- Recent simulation activity.
- Quick navigation to important modules.

### 2. Network Topology

Explore the campus network through an interactive SVG-based topology.

Features:

- Visual representation of routers, switches, servers, and endpoints.
- VLAN-based network zones.
- Color-coded network links.
- Device status indicators.
- Device selection and inspection.
- Pan and zoom controls.
- Packet path visualization and animation.

### 3. IP Addressing

Understand the complete IPv4 addressing plan.

Features:

- VLAN-wise subnet information.
- Network and broadcast addresses.
- Subnet masks and usable host ranges.
- Device IP allocation.
- Address validation and error detection.
- Interactive VLSM calculator.

### 4. VLAN Configuration

Explore logical network segmentation.

Features:

- VLAN identification and configuration.
- Access and trunk port inspection.
- Allowed VLAN information.
- Router subinterface configuration.
- Generated Cisco IOS-style configurations.
- Configuration copy functionality.

### 5. DHCP & DNS

Understand how network clients obtain IP addresses and resolve domain names.

**DHCP DORA Simulation:**

1. Discover
2. Offer
3. Request
4. Acknowledge

Additional features:

- DHCP lease information.
- DHCP pool monitoring.
- Address release and renewal.
- APIPA fallback simulation.
- DNS hostname resolution.
- DNS query transcripts and error handling.

### 6. Packet Flow

Visualize how packets travel between different network segments.

Features:

- Source and destination selection.
- Gateway identification.
- ARP resolution.
- Layer 2 frame forwarding.
- Router processing.
- Longest Prefix Match routing.
- TTL decrement.
- NAT translation.
- Request and reply path visualization.

### 7. Connectivity Testing

Test communication between simulated network devices.

Supported protocols:

- ICMP
- TCP
- UDP

The results include packet delivery status, success percentage, routing path, gateway information, response time, and failure explanations.

### 8. OSI & TCP/IP Models

An interactive educational module covering:

- Seven layers of the OSI model.
- Four layers of the TCP/IP model.
- Data encapsulation and decapsulation.
- Protocol Data Units (PDUs).
- Network protocols and addressing.
- Mapping between OSI and TCP/IP layers.

### 9. Troubleshooting Lab

Practice identifying and resolving common networking problems.

The lab provides nine fault-injection scenarios:

| # | Scenario | Main Concept |
|:---:|---|---|
| 01 | Incorrect Default Gateway | IP Configuration |
| 02 | Wrong Subnet Mask | Subnetting |
| 03 | Duplicate IP Address | Address Management |
| 04 | DHCP Server Unavailable | DHCP and APIPA |
| 05 | Missing DNS Record | DNS Resolution |
| 06 | Interface Disabled | Interface Management |
| 07 | Missing Route | IP Routing |
| 08 | Incorrect VLAN Assignment | VLAN Configuration |
| 09 | Trunk Misconfiguration | 802.1Q Trunking |

**Troubleshooting workflow:**

`Select Scenario → Inject Fault → Run Diagnostics → Identify Root Cause → Apply Fix → Verify Result`

The lab uses the simulated network state, allowing injected faults to affect other relevant application sections.

### 10. Network Security

Explore the security configuration of the campus network.

Features:

- Wi-Fi ACL policy inspection.
- Permit and deny rule evaluation.
- Source and destination testing.
- NAT overload visualization.
- Network segmentation.
- Security best-practice checklist.
- Router management hardening concepts.

### 11. Documentation

Provides educational resources for understanding the project.

- Computer Networks viva questions.
- Networking command references.
- Suggested test plans.
- Cisco IOS command explanations.
- Network configuration guidance.

### 12. About Project

Explains the project's objectives, technology stack, scope, simulation boundaries, and learning outcomes.

## Core Networking Concepts

The simulation engine implements the following networking concepts:

| Concept | Implementation |
|---|---|
| IPv4 Addressing | IP conversion, subnet masks, CIDR and subnet validation |
| Subnetting | Network, broadcast, usable host range calculations |
| VLSM | Host-based subnet allocation |
| Layer 2 Switching | Broadcast domains, frame forwarding and ARP |
| VLAN | Logical network segmentation |
| IEEE 802.1Q | VLAN tagging and trunk handling |
| Inter-VLAN Routing | Router-on-a-Stick |
| Routing | Longest Prefix Match and static routes |
| DHCP | DORA process and address allocation |
| APIPA | Automatic Private IP Addressing fallback |
| DNS | Simulated hostname resolution |
| NAT/PAT | Network Address Translation overload |
| ACL | Ordered access-control rule evaluation |
| TTL | Router hop-based decrement |
| Diagnostics | Simulated network commands and validation |

## Technology Stack

| Category | Technology |
|---|---|
| Frontend | React 19 |
| Programming Language | JavaScript (ES6+) |
| Build Tool | Vite 6 |
| Styling | Tailwind CSS v4 |
| UI Components | shadcn/ui |
| Icons | Lucide React |
| Routing | React Router DOM v7 |
| State Management | React Context API |
| Persistence | Browser localStorage |
| Testing | Vitest |
| Analytics | Vercel Analytics |

## Architecture

NetSim follows a modular three-layer architecture.

```text
                 USER INTERFACE
                       |
          React Components and Pages
                       |
                       v
               STATE MANAGEMENT
                       |
             NetworkProvider
              React Context
                       |
              localStorage
                       |
                       v
              SIMULATION ENGINE
                       |
       +---------------+---------------+
       |               |               |
       v               v               v
     IP.js           L2.js          Engine.js
       |               |               |
       v               v               v
    Subnetting      Switching       Routing
    VLSM            VLAN            NAT / ACL
       |               |               |
       +---------------+---------------+
                       |
                       v
              NETWORK SERVICES
                       |
                +------+------+
                |             |
                v             v
              DHCP           DNS
```

### Architecture Principles

- Separation of UI and networking logic.
- Deterministic simulation functions.
- Centralized application state.
- Browser-based persistence.
- Reusable React components.
- Modular network engine.
- Automated testing of core functionality.

## Project Structure

```text
NetSim-Smart-Campus-Network/
│
├── components/
│   ├── app-shell.jsx
│   ├── dashboard.jsx
│   ├── dashboard/
│   │   └── stat-card.jsx
│   └── network/
│       ├── dora-sequence.jsx
│       ├── link-legend.jsx
│       ├── osi-stack.jsx
│       ├── primitives.jsx
│       ├── step-timeline.jsx
│       └── topology-canvas.jsx
│
├── lib/
│   ├── nav.js
│   ├── theme.js
│   ├── utils.js
│   ├── visual.js
│   └── network/
│       ├── default-config.js
│       ├── engine.js
│       ├── ios.js
│       ├── ip.js
│       ├── l2.js
│       ├── scenarios.js
│       ├── services.js
│       ├── show.js
│       ├── state.js
│       ├── store.jsx
│       └── types.js
│
├── public/
│
├── src/
│   ├── pages/
│   │   └── section-page.jsx
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
│
├── tests/
│   ├── network.test.js
│   └── visual.test.js
│
├── index.html
├── package.json
├── vite.config.js
├── README.md
└── LICENSE
```

## Getting Started

Follow these instructions to run the project locally.

### Prerequisites

Make sure you have the following installed:

- Node.js 18 or later.
- npm (Node Package Manager).
- Git.
- A modern web browser.

### 1. Clone the Repository

```bash
git clone https://github.com/BabulKumar100/NetSim-Smart-Campus-Network.git
```

### 2. Navigate to the Project Directory

```bash
cd NetSim-Smart-Campus-Network
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Start the Development Server

```bash
npm run dev
```

Open the local URL displayed in your terminal. Vite commonly uses:

```text
http://localhost:5173
```

If the configured port is different, use the URL printed by Vite.

### 5. Build for Production

```bash
npm run build
```

The optimized production files are generated in the `dist/` directory.

## Testing

NetSim uses Vitest to test the networking engine and application utilities.

Run the test suite:

```bash
npm test
```

The documented test suite contains 34 tests covering areas such as:

- IPv4 calculations and subnetting.
- VLSM allocation.
- Network validation.
- DHCP address allocation.
- DNS resolution.
- Packet forwarding.
- VLAN and ARP behavior.
- Routing and ACL evaluation.
- NAT translation.
- Troubleshooting scenarios.
- Visual and CLI output helpers.

## Example Simulation Scenarios

Try these scenarios after starting the application.

| Source | Destination | Expected Result |
|---|---|---|
| CSE-PC1 | SRV-CORE | PASS |
| ADM-PC1 | LIB-PC1 | PASS |
| LAPTOP-1 | SRV-CORE | PASS |
| CSE-PC1 | PUBLIC-WEB | PASS |
| LAPTOP-1 | ADM-PC1 | BLOCKED by Wi-Fi ACL |

These are expected outcomes for the documented default network configuration.

## Cisco Packet Tracer Integration

NetSim also provides an educational Cisco IOS-style configuration generator.

The generated configurations can be used as a reference when recreating the modeled topology in Cisco Packet Tracer.

Suggested workflow:

1. Open the VLAN Configuration section.
2. Select a router or switch.
3. Generate and copy its configuration.
4. Create the corresponding devices in Cisco Packet Tracer.
5. Adapt interface names and device-specific commands where necessary.
6. Apply the configurations.
7. Verify connectivity using ping and show commands.

**Note:** NetSim's internal simulation and Cisco Packet Tracer are separate environments. Generated configurations should be reviewed and tested against the selected Packet Tracer device model before use. NetSim does not directly control physical routers or switches.

## Simulation Boundaries

NetSim is an educational network simulator, not a production network management system.

- All network devices are modeled as JavaScript objects.
- Packet transmission and routing are simulated through deterministic functions.
- DHCP and DNS services are simulated.
- Network configurations are stored in browser state and localStorage.
- No physical network devices are controlled.
- No real Ethernet frames or IP packets are transmitted.
- Simulation results represent the implemented network model, not measurements from a real network.

The external network uses documentation IP address ranges for simulation purposes.

## Future Enhancements

Potential improvements include:

- More advanced routing protocols such as RIP, OSPF, and EIGRP.
- Additional VLAN security policies.
- Extended network configuration editing.
- Advanced packet inspection and diagnostics.
- Exportable network simulation reports.
- More complex campus network scenarios.
- Additional networking protocols and fault-injection exercises.

## Learning Outcomes

Through this project, users can develop practical understanding of:

- Computer network architecture and topology.
- IPv4 addressing and subnetting.
- VLANs and broadcast domains.
- Layer 2 switching and ARP.
- Inter-VLAN routing.
- DHCP and DNS operations.
- NAT and access-control policies.
- Packet forwarding and routing decisions.
- OSI and TCP/IP models.
- Network troubleshooting and diagnostics.

## Contributing

Contributions, suggestions, and bug reports are welcome.

To contribute:

1. Fork this repository.
2. Create a new feature branch.
3. Implement your changes.
4. Run the available tests.
5. Submit a pull request with a clear description of your changes.

For major changes, consider opening an issue first to discuss the proposed implementation.

## License

This project is distributed under the MIT License.

See the [LICENSE](LICENSE) file for more information.

## Author

**Babul Kumar**

B.Tech Computer Science & Engineering Student

- GitHub: [@BabulKumar100](https://github.com/BabulKumar100)
- LinkedIn: [Babul Kumar](https://www.linkedin.com/in/babulkumar100)

---

<p align="center">
  <strong>NetSim – Smart Campus Network Simulator</strong>
  <br />
  <em>Understand Networking. Visualize Connectivity. Master Troubleshooting.</em>
</p>
