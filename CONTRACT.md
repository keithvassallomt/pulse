# Pulse Domain Contract

This file defines the semantic assertions and product rules for Pulse. The auditor must verify that no implementation violates these rules.

## Information Architecture
- **ASSERT**: Machines identified as `type: qemu` (QEMU VMs) MUST render in the **VMs tab** and MUST NOT appear in the **Containers tab**.
- **ASSERT**: Machines identified as `type: lxc` (System Containers) MUST render in the **Containers tab** (or a dedicated LXC tab if implemented).
- **ASSERT**: Docker containers running *inside* an LXC (e.g., docker-host) MUST be enumerated within the **Containers tab** for that host.
- **ASSERT**: The **Stat Strip** must reflect aggregated data from all online hosts regardless of type.

## Data & Visibility
- **ASSERT**: If a machine is marked `status: offline`, all metrics displayed MUST be clearly labeled as **"Last Known"** or **"Stale"** and visually distinct (e.g., dimmed).
- **ASSERT**: **Anomaly Banners** must display human-readable **Machine Names** instead of raw numeric IDs.
- **ASSERT**: All UI headings must follow **Title Case** (e.g., "Dashboard", not "dashboard").

## Connectivity & State
- **ASSERT**: Configuring Proxmox API credentials MUST result in the presence of VM/LXC data. An empty list after configuration is considered a **Contract Violation**.
- **ASSERT**: The **SSH Terminal** must maintain a persistent, interactive connection. A static or non-responsive prompt is a failure.
