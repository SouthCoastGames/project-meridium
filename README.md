### Meridium

**Meridium** is an open-source, meta-economy platform designed to bridge separate simulation games into a single, cohesive, global end-to-end logistics ecosystem. 

By utilizing game-specific telemetry hooks and an abstract cloud database, Meridium turns standalone simulators into interconnected nodes of a living world supply chain. A crop harvested in a farming simulator becomes freight hauled by a truck simulator, bulk cargo navigated by a maritime simulator, or payload flown across the globe in a flight simulator. 

### 🌐 The Architectural Vision

Meridium does not rewrite game engines. Instead, it operates as a cloud-based **Macro-Economic Overlay Engine**. The ecosystem consists of two primary components: 

1. **The Meridium Web Platform:** A centralized master database tracking global market values, supply-and-demand mechanics, localized logistics hubs, and live player telemetry.
2. **The Meridium Client Tracker:** A lightweight, modular desktop application running in the background. It hooks into a player's running simulator, reads native telemetry data, and pushes event state changes back to the global web API.

### Abstract Simulation Archetypes

To ensure Meridium is completely future-proof and game-agnostic, the platform categorizes all simulation mechanics into three abstract behaviors: 

* **The Creator (Resource Generators):** Games where gameplay involves creating mass out of a map environment (*e.g., harvesting agriculture, logging timber, excavating minerals*).
* **The Mover (Transit Linkers):** Games where gameplay involves shifting coordinates while maintaining cargo mass and volume constraints across specific mediums (*e.g., Highway, Rail, Maritime, Aviation, Orbital*).
* **The Consumer (Production Nodes):** Game mechanics where raw commodities are deleted or transformed into higher-tier manufacturing components or consumer goods.

### 🗄️ Core Database Pipeline (Conceptual Schema)

The master server treats the entire world as a unified network of nodes. It tracks the state changes of unique cargo payloads as they transition across different software clients. 

```sql

-- The Master Cargo Manifest
CREATE TABLE global_tracking_manifest (
    manifest_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commodity_code VARCHAR(30) NOT NULL,       -- e.g., "AGRI_WHEAT", "MIN_IRON_ORE"
    total_mass_kg DECIMAL(12,2) NOT NULL,
    total_volume_m3 DECIMAL(10,2) NOT NULL,
    origin_node_id VARCHAR(50) NOT NULL,       -- Primary Key of loading hub
    destination_node_id VARCHAR(50) NOT NULL,  -- Primary Key of destination hub
    required_engine_archetype VARCHAR(30),     -- 'MOVER', 'CREATOR', 'CONSUMER'
    allowed_mediums TEXT[],                    -- ['HIGHWAY', 'RAIL', 'MARITIME', 'AVIATION', 'ORBITAL']
    current_status VARCHAR(30),                -- 'PENDING_EXTRACTION', 'IN_TRANSIT', 'FULFILLED'
    assigned_player_uuid VARCHAR(100)
);
```
Use code with caution.

### 🚀 Roadmap & Project Milestones

### Phase 1: Core API & Web Dashboard (Current Focus)

* Establish the centralized web platform database structure.
* Build the live web map layout with support for multi-layered coordinate grids (Terrestrial, Maritime, Atmospheric, Orbital).
* Expose the base REST/WebSocket APIs for telemetry ingestion.

### Phase 2: The Core Tracker Client

* Develop the universal desktop companion app framework.
* Implement standard plugin loading infrastructure to allow modular game attachments.

### Phase 3: First-Wave Integration Plugins

* **Land Transit Node:** Initial telemetry wrapper using the SCS Telemetry SDK for truck simulators.
* **Aviation Node:** Initial telemetry wrapper using SimConnect for atmospheric flight simulators.
* **Resource Generation Node:** LUA-based event integration for farming/harvesting simulators.

### 🤝 Contributing to Meridium

Meridium is a highly ambitious community project, and we need developers, modders, and simulation enthusiasts of all backgrounds to bring it to life! 

### How You Can Help:

* **Backend Developers:** Help optimize the high-frequency telemetry endpoints and write the dynamic supply/demand algorithmic market logic.
* **Frontend Developers:** Build a beautiful, responsive web interface featuring live telemetry map layers, virtual enterprise/fleet management dashboards, and market tickers.
* **Simulator Modders:** Write lightweight wrapper plugins or telemetry extractors for your favorite simulation games to map their native APIs (SimConnect, FSUIPC, SCS SDK, Lua environments) into Meridium's abstract engine profiles.

To get started, check out our CONTRIBUTING.md (coming soon), browse the open issues, or join our community discussions. 

### 📄 License

Meridium is open-source software licensed under the [MIT License](LICENSE).
