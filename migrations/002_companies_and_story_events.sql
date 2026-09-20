-- Meridium-native companies (does not attempt to mirror any single sim's in-game company system)
CREATE TABLE IF NOT EXISTS companies (
    company_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Registry of players, so manifests and companies have something stable to join against
CREATE TABLE IF NOT EXISTS players (
    player_uuid VARCHAR(100) PRIMARY KEY,
    display_name VARCHAR(100),
    company_id UUID REFERENCES companies(company_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Community-wide logistics events (famines, blockades, disasters) with a shared progress goal
CREATE TABLE IF NOT EXISTS story_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(150) NOT NULL,
    narrative TEXT,
    event_type VARCHAR(30) NOT NULL,           -- 'FAMINE', 'BLOCKADE', 'DISASTER', ...
    target_commodity_code VARCHAR(30),         -- NULL = any commodity counts toward the goal
    target_destination_node_id VARCHAR(50),    -- NULL = any destination counts toward the goal
    goal_mass_kg DECIMAL(14,2) NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ends_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'SUCCEEDED', 'FAILED', 'EXPIRED'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Link manifests to the event they contribute toward, and to a registered player
ALTER TABLE global_tracking_manifest
    ADD COLUMN IF NOT EXISTS story_event_id UUID REFERENCES story_events(event_id) ON DELETE SET NULL;

ALTER TABLE global_tracking_manifest
    ADD CONSTRAINT fk_manifest_player FOREIGN KEY (assigned_player_uuid)
        REFERENCES players(player_uuid) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_manifest_story_event ON global_tracking_manifest (story_event_id)
    WHERE story_event_id IS NOT NULL;
