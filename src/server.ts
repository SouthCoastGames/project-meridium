import express from "express";
import path from "path";
import { pool } from "./db";

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/manifests", async (_req, res) => {
  const result = await pool.query(
    "SELECT * FROM global_tracking_manifest ORDER BY created_at DESC LIMIT 100"
  );
  res.json(result.rows);
});

app.post("/api/manifests", async (req, res) => {
  const {
    commodity_code,
    total_mass_kg,
    total_volume_m3,
    origin_node_id,
    destination_node_id,
    required_engine_archetype,
    allowed_mediums,
    assigned_player_uuid,
    story_event_id,
  } = req.body;

  if (!commodity_code || !total_mass_kg || !total_volume_m3 || !origin_node_id || !destination_node_id) {
    return res.status(400).json({
      error: "commodity_code, total_mass_kg, total_volume_m3, origin_node_id, and destination_node_id are required",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO global_tracking_manifest
        (commodity_code, total_mass_kg, total_volume_m3, origin_node_id, destination_node_id, required_engine_archetype, allowed_mediums, assigned_player_uuid, story_event_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        commodity_code,
        total_mass_kg,
        total_volume_m3,
        origin_node_id,
        destination_node_id,
        required_engine_archetype ?? null,
        allowed_mediums ?? null,
        assigned_player_uuid ?? null,
        story_event_id ?? null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      return res.status(400).json({ error: "assigned_player_uuid or story_event_id does not reference an existing record" });
    }
    throw err;
  }
});

app.patch("/api/manifests/:id/status", async (req, res) => {
  const { current_status } = req.body;
  const allowed = ["PENDING_EXTRACTION", "IN_TRANSIT", "FULFILLED"];
  if (!allowed.includes(current_status)) {
    return res.status(400).json({ error: `current_status must be one of: ${allowed.join(", ")}` });
  }

  const result = await pool.query(
    "UPDATE global_tracking_manifest SET current_status = $1 WHERE manifest_id = $2 RETURNING *",
    [current_status, req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "manifest not found" });
  }
  res.json(result.rows[0]);
});

// --- Companies ---

app.get("/api/companies", async (_req, res) => {
  const result = await pool.query("SELECT * FROM companies ORDER BY name");
  res.json(result.rows);
});

app.post("/api/companies", async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }
  try {
    const result = await pool.query(
      "INSERT INTO companies (name) VALUES ($1) RETURNING *",
      [name]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (isUniqueViolation(err)) {
      return res.status(409).json({ error: "a company with that name already exists" });
    }
    throw err;
  }
});

// --- Players ---

app.post("/api/players", async (req, res) => {
  const { player_uuid, display_name, company_id } = req.body;
  if (!player_uuid) {
    return res.status(400).json({ error: "player_uuid is required" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO players (player_uuid, display_name, company_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (player_uuid) DO UPDATE SET display_name = EXCLUDED.display_name, company_id = EXCLUDED.company_id
       RETURNING *`,
      [player_uuid, display_name ?? null, company_id ?? null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      return res.status(400).json({ error: "company_id does not reference an existing company" });
    }
    throw err;
  }
});

app.get("/api/players/:player_uuid", async (req, res) => {
  const result = await pool.query(
    `SELECT p.*, c.name AS company_name
     FROM players p
     LEFT JOIN companies c ON c.company_id = p.company_id
     WHERE p.player_uuid = $1`,
    [req.params.player_uuid]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: "player not found" });
  }
  res.json(result.rows[0]);
});

// --- Story Events ---

app.get("/api/story-events", async (req, res) => {
  const { status } = req.query;
  const result = status
    ? await pool.query("SELECT * FROM story_events WHERE status = $1 ORDER BY starts_at DESC", [status])
    : await pool.query("SELECT * FROM story_events ORDER BY starts_at DESC");
  res.json(result.rows);
});

app.post("/api/story-events", async (req, res) => {
  const {
    title,
    narrative,
    event_type,
    target_commodity_code,
    target_destination_node_id,
    goal_mass_kg,
    ends_at,
  } = req.body;

  if (!title || !event_type || !goal_mass_kg || !ends_at) {
    return res.status(400).json({ error: "title, event_type, goal_mass_kg, and ends_at are required" });
  }

  const result = await pool.query(
    `INSERT INTO story_events (title, narrative, event_type, target_commodity_code, target_destination_node_id, goal_mass_kg, ends_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      title,
      narrative ?? null,
      event_type,
      target_commodity_code ?? null,
      target_destination_node_id ?? null,
      goal_mass_kg,
      ends_at,
    ]
  );

  res.status(201).json(result.rows[0]);
});

app.get("/api/story-events/:id/progress", async (req, res) => {
  const eventResult = await pool.query("SELECT * FROM story_events WHERE event_id = $1", [req.params.id]);
  if (eventResult.rows.length === 0) {
    return res.status(404).json({ error: "story event not found" });
  }
  const event = eventResult.rows[0];

  const totalResult = await pool.query(
    `SELECT COALESCE(SUM(total_mass_kg), 0) AS total_mass_kg
     FROM global_tracking_manifest
     WHERE story_event_id = $1 AND current_status = 'FULFILLED'`,
    [req.params.id]
  );

  const byCompanyResult = await pool.query(
    `SELECT c.company_id, c.name, COALESCE(SUM(m.total_mass_kg), 0) AS contributed_mass_kg
     FROM global_tracking_manifest m
     JOIN players p ON p.player_uuid = m.assigned_player_uuid
     JOIN companies c ON c.company_id = p.company_id
     WHERE m.story_event_id = $1 AND m.current_status = 'FULFILLED'
     GROUP BY c.company_id, c.name
     ORDER BY contributed_mass_kg DESC`,
    [req.params.id]
  );

  const byPlayerResult = await pool.query(
    `SELECT p.player_uuid, p.display_name, COALESCE(SUM(m.total_mass_kg), 0) AS contributed_mass_kg
     FROM global_tracking_manifest m
     JOIN players p ON p.player_uuid = m.assigned_player_uuid
     WHERE m.story_event_id = $1 AND m.current_status = 'FULFILLED'
     GROUP BY p.player_uuid, p.display_name
     ORDER BY contributed_mass_kg DESC
     LIMIT 50`,
    [req.params.id]
  );

  res.json({
    event,
    total_mass_kg: totalResult.rows[0].total_mass_kg,
    goal_mass_kg: event.goal_mass_kg,
    by_company: byCompanyResult.rows,
    by_player: byPlayerResult.rows,
  });
});

function isForeignKeyViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23503";
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(port, () => {
  console.log(`Meridium API listening on http://localhost:${port}`);
});
