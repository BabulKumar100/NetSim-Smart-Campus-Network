# 🌐 NetSim: Smart Campus Network Design & Simulation System

[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Tests](https://img.shields.io/badge/Tests-34%20Passing-brightgreen?style=flat-square&logo=vitest&logoColor=white)](https://vitest.dev/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

An interactive, browser-based **Smart Campus Network Architecture & Simulation** platform developed for Computer Networks Project-Based Learning (PBL). 

NetSim models a full-scale hierarchical college campus network — featuring **VLAN segmentation, Router-on-a-Stick inter-VLAN routing, DHCP DORA exchange, Campus DNS, NAT/PAT translation, Extended Access Control Lists (ACLs), OSI layer-by-layer packet flow tracing, and a fault-injection troubleshooting lab with verified Cisco IOS configurations**.

---

## 📌 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Campus Network Architecture](#-campus-network-architecture)
  - [Logical VLAN & Subnet Design](#logical-vlan--subnet-design)
  - [Hardware & Device Inventory](#hardware--device-inventory)
- [Core Technologies & Network Protocols](#-core-technologies--network-protocols)
  - [1. VLAN Segmentation & 802.1Q Trunking](#1-vlan-segmentation--8021q-trunking)
  - [2. Inter-VLAN Routing (Router-on-a-Stick)](#2-inter-vlan-routing-router-on-a-stick)
  - [3. DHCP Multi-Pool Server & DORA Sequence](#3-dhcp-multi-pool-server--dora-sequence)
  - [4. Campus DNS Resolution](#4-campus-dns-resolution)
  - [5. Edge NAT / PAT Overload](#5-edge-nat--pat-overload)
  - [6. Network Security & Extended ACL Policies](#6-network-security--extended-acl-policies)
- [Interactive Simulation Modules](#-interactive-simulation-modules)
  - [Packet Journey Tracer (OSI & TCP/IP Stack)](#packet-journey-tracer-osi--tcpip-stack)
  - [Fault-Injection Troubleshooting Lab](#fault-injection-troubleshooting-lab)
  - [VLSM Subnet Calculator](#vlsm-subnet-calculator)
  - [Cisco IOS Configuration Generator](#cisco-ios-configuration-generator)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation & Local Run](#installation--local-run)
  - [Running Unit & Integration Tests](#running-unit--integration-tests)
- [Cisco Packet Tracer Deployment Guide](#-cisco-packet-tracer-deployment-guide)
- [Viva & Interview Q&A Quick Reference](#-viva--interview-qa-quick-reference)
- [Contributing & License](#-contributing--license)

---

## 📖 Overview

In modern academic institutions, digital connectivity is mission-critical. A flat, unmanaged network suffers from excessive broadcast traffic, security vulnerabilities, lack of QoS, and difficult troubleshooting.

**NetSim** designs and simulates an enterprise-grade hierarchical campus network infrastructure:
- **Core Layer:** Edge routing (Cisco 2911 R1) providing WAN aggregation, NAT overload, and inter-VLAN subinterfaces.
- **Distribution Layer:** Central switching handling VLAN aggregation, redundant links, and high-speed trunking.
- **Access Layer:** Edge switches delivering access ports to departmental labs, offices, classrooms, and wireless access points.
- **Demilitarized / Server Zone:** Centralized servers (DHCP, DNS, Web Portal, Student DB) protected by access controls.

---

## 🚀 Key Features

| Feature | Description |
| :--- | :--- |
| **Interactive Topology Canvas** | Dynamic SVG/Canvas network topology map rendering device statuses (healthy, degraded, down), link states, and live traffic animations. |
| **Complete IP Addressing Plan** | Comprehensive IPv4 subnet table with CIDR notations, subnet masks, wildcards, usable host ranges, and broadcast boundaries. |
| **VLSM Subnet Calculator** | Interactive Variable Length Subnet Masking (VLSM) tool to dynamically calculate subnets based on host capacity requirements. |
| **VLAN & Trunk Inspector** | Visual breakdown of VLAN allocations (10, 20, 30, 40, 50), access vs trunk port configurations, 802.1Q tags, and native VLAN management. |
| **DORA Protocol Visualizer** | Step-by-step visual sequence of the DHCP process: **Discover** (Broadcast) ➔ **Offer** (Unicast) ➔ **Request** (Broadcast) ➔ **Acknowledge** (Unicast), with lease table monitoring and APIPA fallback. |
| **Campus DNS Resolver** | Simulated DNS server resolving internal domain names (`portal.campus.edu`, `library.campus.edu`) to respective IP addresses with live nslookup transcripts. |
| **Packet Journey Tracer** | Trace simulated packets hop-by-hop through Layer 2 Ethernet frames, ARP lookups, Layer 3 routing tables, ACL filtering, and NAT translation. |
| **OSI / TCP-IP Encapsulation View** | Layer-by-layer breakdown (L7 Application down to L1 Physical) showing exact headers, source/destination MACs, IPs, and port numbers. |
| **Connectivity Diagnostic Suite** | Ping (ICMP) and service reachability simulator between any two devices with latency statistics and diagnostic outputs. |
| **Fault-Injection Lab (9 Scenarios)** | Real-world fault scenarios (e.g., native VLAN mismatch, DHCP exhaustion, incorrect default gateway, ACL misconfiguration) with step-by-step troubleshooting and fixes. |
| **Cisco IOS CLI Generator** | Production-ready Cisco IOS scripts for all switches and routers ready to paste directly into Cisco Packet Tracer or real hardware. |

---

## 🏛️ Campus Network Architecture

### Logical VLAN & Subnet Design

The campus network uses the private RFC 1918 block `10.10.0.0/16`, segmented into dedicated department subnets:

| VLAN ID | Segment Name | Subnet Network | Subnet Mask | Usable Host Range | Default Gateway | Broadcast Address | Description |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **10** | **CSE Department** | `10.10.10.0/24` | `255.255.255.0` | `10.10.10.2 - 10.10.10.254` | `10.10.10.1` | `10.10.10.255` | Computer Science labs, academic workstations |
| **20** | **Admin Block** | `10.10.20.0/24` | `255.255.255.0` | `10.10.20.2 - 10.10.20.254` | `10.10.20.1` | `10.10.20.255` | Administration, accounts, staff & registrar |
| **30** | **Central Library** | `10.10.30.0/24` | `255.255.255.0` | `10.10.30.2 - 10.10.30.254` | `10.10.30.1` | `10.10.30.255` | Digital library terminals, OPAC catalogs |
| **40** | **Server Farm** | `10.10.40.0/24` | `255.255.255.0` | `10.10.40.2 - 10.10.40.254` | `10.10.40.1` | `10.10.40.255` | DNS, DHCP, Web Portal, Student DB |
| **50** | **Campus Wi-Fi** | `10.10.50.0/24` | `255.255.255.0` | `10.10.50.2 - 10.10.50.254` | `10.10.50.1` | `10.10.50.255` | Student Wi-Fi, BYOD mobile devices (restricted) |
| **WAN** | **Edge to ISP** | `203.0.113.0/30` | `255.255.255.252` | `203.0.113.1 - 203.0.113.2` | `203.0.113.2` | `203.0.113.3` | Point-to-point uplink to simulated Internet |
| **INET** | **Public Web** | `198.51.100.0/24` | `255.255.255.0` | `198.51.100.2 - 198.51.100.254` | `198.51.100.1` | `198.51.100.255` | Simulated external public internet host |

---

### Hardware & Device Inventory

- **Edge Router (R1 - Cisco 2911):**
  - GigabitEthernet `G0/0`: Internal 802.1Q trunk connected to Core Switch (`G0/1`).
  - Subinterfaces: `G0/0.10`, `G0/0.20`, `G0/0.30`, `G0/0.40`, `G0/0.50` acting as default gateways.
  - GigabitEthernet `G0/1`: WAN uplink to ISP Router (`203.0.113.1/30`).
- **Core Switch (SW-CORE - Cisco Catalyst 3560 / 2960):**
  - Trunk uplinks to Edge Router and distribution/access switches.
  - Native VLAN: 99 (management isolation).
- **Access Switches:**
  - `SW-CSE` (VLAN 10 access ports)
  - `SW-ADMIN` (VLAN 20 access ports)
  - `SW-LIB` (VLAN 30 access ports)
  - `SW-WIFI` (VLAN 50 access ports connected to WAP)
  - `SW-SERVER` (VLAN 40 access ports connected to Server Farm)
- **Servers & Endpoints:**
  - `SRV-DNS` (`10.10.40.10`) - Campus DNS Service
  - `SRV-WEB` (`10.10.40.20`) - Student Portal & LMS
  - `SRV-DHCP` (`10.10.40.30`) - Dynamic Host Configuration Server
  - Departmental PCs, Admin workstations, Library computers, and Wireless client laptops.

---

## 🛠️ Core Technologies & Network Protocols

### 1. VLAN Segmentation & 802.1Q Trunking
Each department resides in its own broadcast domain. Switches tag Ethernet frames with standard IEEE 802.1Q 4-byte tags when traversing trunk links:
```text
[ Ethernet Preamble ] [ Dest MAC ] [ Source MAC ] [ 802.1Q Tag (VLAN ID) ] [ EtherType ] [ Payload ] [ FCS ]
```

### 2. Inter-VLAN Routing (Router-on-a-Stick)
Instead of requiring an expensive physical router interface per VLAN, router `R1` uses subinterfaces on a single physical link (`G0/0`):
```cisco
interface GigabitEthernet0/0.10
 encapsulation dot1Q 10
 ip address 10.10.10.1 255.255.255.0
!
interface GigabitEthernet0/0.20
 encapsulation dot1Q 20
 ip address 10.10.20.1 255.255.255.0
!
interface GigabitEthernet0/0.30
 encapsulation dot1Q 30
 ip address 10.10.30.1 255.255.255.0
```

### 3. DHCP Multi-Pool Server & DORA Sequence
The DHCP server (`10.10.40.30`) or router relay provides automated IP allocation:
1. **Discover (DHCPDISCOVER):** Client broadcasts `0.0.0.0:68 ➔ 255.255.255.255:67`.
2. **Offer (DHCPOFFER):** Server offers candidate IP, subnet mask, gateway, DNS, and lease time.
3. **Request (DHCPREQUEST):** Client formally requests the offered parameters.
4. **Acknowledge (DHCPACK):** Server commits the lease into the active binding table.

*Addresses `10.10.x.1` through `10.10.x.10` are excluded from each pool for static network infrastructure and printers.*

### 4. Campus DNS Resolution
The campus DNS server maintains internal A records:
- `portal.campus.edu` ➔ `10.10.40.20`
- `library.campus.edu` ➔ `10.10.30.10`
- `dns.campus.edu` ➔ `10.10.40.10`

### 5. Edge NAT / PAT Overload
Because internal campus devices use private RFC 1918 addresses (`10.10.0.0/16`), they cannot be routed across the public Internet. Edge router `R1` executes Port Address Translation (NAT Overload):
```cisco
ip access-list standard NAT-PERMIT
 permit 10.10.0.0 0.0.255.255
!
ip nat inside source list NAT-PERMIT interface GigabitEthernet0/1 overload
```
Every outgoing TCP/UDP packet has its source IP replaced with `203.0.113.1` and a unique high port number assigned.

### 6. Network Security & Extended ACL Policies
Wireless networks represent untrusted traffic. An **Extended Access Control List (ACL 101)** is applied inbound on the Wi-Fi subinterface `G0/0.50`:
```cisco
ip access-list extended WIFI_RESTRICTIONS
 ! Permit DNS queries to Campus DNS
 permit udp 10.10.50.0 0.0.0.255 host 10.10.40.10 eq 53
 ! Permit HTTP/HTTPS access to Campus Web Portal
 permit tcp 10.10.50.0 0.0.0.255 host 10.10.40.20 eq 80
 permit tcp 10.10.50.0 0.0.0.255 host 10.10.40.20 eq 443
 ! DENY any Wi-Fi traffic into the sensitive Admin Block (VLAN 20)
 deny ip 10.10.50.0 0.0.0.255 10.10.20.0 0.0.0.255
 ! Permit all outbound Internet traffic
 permit ip 10.10.50.0 0.0.0.255 any
```

---

## 🔍 Interactive Simulation Modules

### Packet Journey Tracer (OSI & TCP/IP Stack)
Follow the lifecycle of an ICMP echo or HTTP GET request:
1. **L7 Application:** Browser issues HTTP GET `http://portal.campus.edu`.
2. **L4 Transport:** Source port 49152, Destination port 80 (TCP).
3. **L3 Network:** ARP table check ➔ Packet routed to Default Gateway `10.10.10.1`.
4. **L2 Data Link:** 802.1Q encapsulation with VLAN Tag 10 ➔ Trunk port.
5. **Router Inspection:** Subinterface de-encapsulates tag, checks routing table, inspects ACL, forwards to VLAN 40 subinterface with Tag 40.
6. **L1 Physical:** Frame delivery to destination server.

### Fault-Injection Troubleshooting Lab
Test and practice systematic network diagnostics across 9 pre-built fault scenarios:

| # | Fault Scenario | Layer | Manifested Symptoms | Diagnostic Commands | Fix Action |
| :-: | :--- | :-: | :--- | :--- | :--- |
| **1** | **VLAN Tag Mismatch** | L2 | Switch port assigned to wrong VLAN; no gateway ping | `show vlan brief`, `show interfaces status` | Correct access VLAN assignment |
| **2** | **Trunk Pruning Error** | L2 | Inter-switch trunk missing required VLAN in allowed list | `show interfaces trunk` | `switchport trunk allowed vlan add <id>` |
| **3** | **Wrong Default Gateway** | L3 | Local subnet pings pass; all remote VLAN pings fail | `ipconfig /all`, `show ip route` | Configure correct subinterface gateway IP |
| **4** | **Subinterface Down** | L3 | Total outage for an entire departmental segment | `show ip interface brief` | Bring parent and subinterface up (`no shutdown`) |
| **5** | **DHCP Pool Exhaustion** | L7 | Clients get APIPA `169.254.x.x` addresses | `show ip dhcp binding`, `show ip dhcp pool` | Clear stale bindings or expand pool subnet mask |
| **6** | **DNS Misconfiguration** | L7 | Ping by IP succeeds; ping by domain name fails | `nslookup portal.campus.edu` | Fix client DNS server IP or add missing DNS A-record |
| **7** | **ACL Over-blocking** | L3/L4 | Legitimate traffic dropped silently | `show access-lists` | Reorder permit/deny statements or fix wildcard mask |
| **8** | **Missing Default Route** | L3 | Campus communicates internally; public internet unreachable | `show ip route` | Add `ip route 0.0.0.0 0.0.0.0 203.0.113.2` on edge router |
| **9** | **NAT Overload Missing** | L3 | External server sees private IP or traffic dropped at ISP | `show ip nat translations` | Re-enable NAT overload configuration on WAN uplink |

---

## 💻 Tech Stack

- **Frontend Core:** [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Bundler & Build Tool:** [Vite 6](https://vitejs.dev/)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/), [tw-animate-css](https://github.com/)
- **UI & Icons:** [shadcn/ui](https://ui.shadcn.com/), [Lucide React](https://lucide.dev/)
- **Routing:** [React Router v7](https://reactrouter.com/)
- **Testing:** [Vitest](https://vitest.dev/) (Unit & integration testing)
- **Analytics:** `@vercel/analytics`

---

## 📁 Project Structure

```text
smart-campus-network-design/
├── components/
│   ├── app-shell.jsx              # Navigation layout, sidebar and header
│   ├── dashboard.jsx              # Main operations dashboard & status overview
│   ├── dashboard/
│   │   └── stat-card.jsx          # Network health indicators & metrics
│   ├── network/
│   │   ├── dora-sequence.jsx      # Visual animated DHCP DORA flow
│   │   ├── link-legend.jsx        # Topology link color legend
│   │   ├── osi-stack.jsx          # Interactive 7-layer OSI encapsulation widget
│   │   ├── primitives.jsx         # Badges, panels, codeblocks, callouts
│   │   ├── step-timeline.jsx      # Packet trace step-by-step timeline
│   │   └── topology-canvas.jsx    # SVG/Canvas network topology renderer
│   └── ui/                        # Reusable UI component library (shadcn/ui)
├── lib/
│   ├── nav.js                     # Section routes and metadata
│   ├── theme.js                   # Theme management
│   ├── utils.js                   # Utility helpers (cn, formatting)
│   ├── visual.js                  # CLI transcript formatting (nslookup, ping)
│   └── network/
│       ├── default-config.js      # Campus topology, default devices & IP configs
│       ├── engine.js              # Simulation engine (connectivity, packet routing, ACLs)
│       ├── ios.js                 # Cisco IOS configuration generator & CLI parser
│       ├── ip.js                  # IPv4 calculations, VLSM math, CIDR conversions
│       ├── l2.js                  # Layer 2 switching logic, MAC tables, 802.1Q tags
│       ├── scenarios.js           # 9 fault-injection troubleshooting scenarios
│       ├── services.js            # Simulated DHCP server, lease pool, DNS resolution
│       ├── show.js                # Simulated Cisco IOS show commands
│       ├── state.js               # Reactive network state store
│       ├── store.jsx              # React context & custom hooks for network state
│       └── types.js               # Network data models & constants
├── public/                        # Static brand assets, icons and favicon
├── src/
│   ├── pages/
│   │   └── section-page.jsx       # Consolidated view handler for all sections
│   ├── App.jsx                    # Root routing configuration
│   ├── index.css                  # Global Tailwind styles & CSS variables
│   └── main.jsx                   # Application bootstrap entry point
├── tests/
│   ├── network.test.js            # Unit tests for routing, DHCP, DNS, ACL, VLSM
│   └── visual.test.js             # Visual rendering & CLI transcript tests
├── index.html                     # HTML template
├── package.json                   # Project scripts and dependencies
├── vite.config.js                 # Vite bundler configuration
└── README.md                      # Comprehensive project documentation
```

---

## ⚡ Getting Started

### Prerequisites
Make sure you have Node.js installed on your machine:
- **Node.js**: `v18.0.0` or higher
- **Package Manager**: `npm`, `pnpm`, or `yarn`

### Installation & Local Run

1. **Clone the repository:**
   ```bash
   git clone https://github.com/BabulKumar100/NetSim-Smart-Campus-Network.git
   cd NetSim-Smart-Campus-Network
   ```

2. **Install project dependencies:**
   ```bash
   npm install
   # or with pnpm
   pnpm install
   ```

3. **Start the local development server:**
   ```bash
   npm run dev
   ```
   Open your browser and navigate to `http://localhost:5173`.

4. **Build for production:**
   ```bash
   npm run build
   ```
   The compiled production assets will be output to the `dist/` folder.

5. **Preview production build:**
   ```bash
   npm run preview
   ```

### Running Unit & Integration Tests

The project includes 34 automated unit and integration tests covering IP math, VLSM calculation, DHCP DORA cycles, DNS lookup, and ACL rule evaluation.

```bash
npm test
```

---

## 🧪 Cisco Packet Tracer Deployment Guide

To deploy this exact topology inside **Cisco Packet Tracer**:

1. **Place Devices:**
   - 1x Router (Cisco 2911 or 1941) labeled `R1`
   - 1x Core Switch (Cisco Catalyst 2960 or 3560) labeled `SW-CORE`
   - 4x Access Switches (Cisco 2960) for `CSE`, `ADMIN`, `LIB`, `WIFI`
   - 1x Server-PT for Central Server Farm (`DNS / DHCP / Web`)
   - End-user PCs and Laptops connected to respective access switches.
2. **Cabling:**
   - Connect `R1 G0/0` to `SW-CORE G0/1` with Copper Straight-Through cable.
   - Connect `SW-CORE` to Access Switches using Copper Straight-Through cables (Trunk ports).
   - Connect access switch FastEthernet ports to PCs (Access ports).
3. **Configure Devices:**
   - Navigate to the **VLAN Configuration** or **Documentation** tab in NetSim.
   - Select each device (`R1`, `SW-CORE`, `SW-CSE`, etc.) to copy its pre-generated Cisco IOS script.
   - Open the device **CLI** tab in Packet Tracer, enter `enable` ➔ `configure terminal`, and paste the configuration.
4. **Verify Connectivity:**
   - On any client PC, set IP Configuration to **DHCP** and verify receipt of a `10.10.x.x` address.
   - Open PC Command Prompt and ping the default gateway: `ping 10.10.10.1`.
   - Ping between VLANs: `ping 10.10.20.10`.
   - Open Web Browser and navigate to `http://portal.campus.edu`.

---

## 🎓 Viva & Interview Q&A Quick Reference

<details>
<summary><b>1. Why do we segment the campus network using VLANs?</b></summary>
VLANs divide a single physical Layer 2 switch into multiple logical broadcast domains. This isolates broadcast storms, enhances security by preventing unauthorized eavesdropping between departments, improves network performance, and simplifies management.
</details>

<details>
<summary><b>2. What is Router-on-a-Stick and why is it used?</b></summary>
Router-on-a-Stick is an inter-VLAN routing technique where a single physical router interface carries traffic for multiple VLANs via an 802.1Q trunk link. Subinterfaces are created on the router (e.g., <code>G0/0.10</code>), each configured with 802.1Q encapsulation and assigned the default gateway IP for that specific VLAN. This eliminates the requirement of having a separate physical router interface for every VLAN.
</details>

<details>
<summary><b>3. Explain the DHCP DORA process.</b></summary>
DHCP uses 4 messages:
1. <b>Discover:</b> Client broadcasts to locate available DHCP servers.
2. <b>Offer:</b> Server reserves an IP and unicasters/broadcasts configuration parameters to client.
3. <b>Request:</b> Client broadcasts acceptance of the specific server's offer.
4. <b>Acknowledge (ACK):</b> Server confirms the lease, committing the IP binding.
</details>

<details>
<summary><b>4. Why is NAT required at the edge router?</b></summary>
The campus network uses private IPv4 addresses (RFC 1918 <code>10.10.0.0/16</code>) which are non-routable on the public Internet. Edge router R1 performs Port Address Translation (NAT Overload/PAT), substituting private source IPs with its public IP (<code>203.0.113.1</code>) and assigning unique source ports to multiplex connections over a single public address.
</details>

<details>
<summary><b>5. Why apply an Extended ACL specifically on the Campus Wi-Fi segment?</b></summary>
Wi-Fi clients are inherently less trusted (guest devices, BYOD laptops, smartphones) and have a higher risk of malware or unauthorized access attempts. Applying an Extended ACL on subinterface <code>G0/0.50</code> blocks Wi-Fi clients from reaching sensitive administrative records in VLAN 20, while permitting general internet browsing and public campus portal access.
</details>

<details>
<summary><b>6. What is the purpose of the default route <code>0.0.0.0 0.0.0.0</code> on R1?</b></summary>
The edge router R1 only knows its directly connected subnets (VLANs 10-50 and the point-to-point link to ISP). Any packet destined for an external Internet IP address has no specific entry in R1's routing table. The default route directs all unknown destination traffic to the ISP's gateway router (<code>203.0.113.2</code>).
</details>

---

## 📜 Contributing & License

Contributions, suggestions, and issue reports are welcome! Feel free to open an issue or submit a pull request.

This project is licensed under the **MIT License**.
