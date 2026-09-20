CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- The Master Cargo Manifest
CREATE TABLE IF NOT EXISTS global_tracking_manifest (
    manifest_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commodity_code VARCHAR(30) NOT NULL,       -- e.g., "AGRI_WHEAT", "MIN_IRON_ORE"
    total_mass_kg DECIMAL(12,2) NOT NULL,
    total_volume_m3 DECIMAL(10,2) NOT NULL,
    origin_node_id VARCHAR(50) NOT NULL,       -- Primary Key of loading hub
    destination_node_id VARCHAR(50) NOT NULL,  -- Primary Key of destination hub
    required_engine_archetype VARCHAR(30),     -- 'MOVER', 'CREATOR', 'CONSUMER'
    allowed_mediums TEXT[],                    -- ['HIGHWAY', 'RAIL', 'MARITIME', 'AVIATION', 'ORBITAL']
    current_status VARCHAR(30) NOT NULL DEFAULT 'PENDING_EXTRACTION',
    assigned_player_uuid VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
