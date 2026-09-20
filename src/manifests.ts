import { pool } from "./db";
import { isForeignKeyViolation } from "./db-errors";

export class ManifestValidationError extends Error {}
export class ManifestReferenceError extends Error {}

export interface ManifestInput {
  commodity_code: string;
  total_mass_kg: number;
  total_volume_m3: number;
  origin_node_id: string;
  destination_node_id: string;
  required_engine_archetype?: string | null;
  allowed_mediums?: string[] | null;
  assigned_player_uuid?: string | null;
  story_event_id?: string | null;
}

export const MANIFEST_STATUSES = ["PENDING_EXTRACTION", "IN_TRANSIT", "FULFILLED"];

export async function createManifest(input: ManifestInput) {
  const {
    commodity_code,
    total_mass_kg,
    total_volume_m3,
    origin_node_id,
    destination_node_id,
  } = input;

  if (!commodity_code || !total_mass_kg || !total_volume_m3 || !origin_node_id || !destination_node_id) {
    throw new ManifestValidationError(
      "commodity_code, total_mass_kg, total_volume_m3, origin_node_id, and destination_node_id are required"
    );
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
        input.required_engine_archetype ?? null,
        input.allowed_mediums ?? null,
        input.assigned_player_uuid ?? null,
        input.story_event_id ?? null,
      ]
    );
    return result.rows[0];
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      throw new ManifestReferenceError("assigned_player_uuid or story_event_id does not reference an existing record");
    }
    throw err;
  }
}

export async function updateManifestStatus(manifestId: string, currentStatus: string) {
  if (!MANIFEST_STATUSES.includes(currentStatus)) {
    throw new ManifestValidationError(`current_status must be one of: ${MANIFEST_STATUSES.join(", ")}`);
  }

  try {
    const result = await pool.query(
      "UPDATE global_tracking_manifest SET current_status = $1 WHERE manifest_id = $2 RETURNING *",
      [currentStatus, manifestId]
    );
    return result.rows[0] ?? null;
  } catch (err) {
    if (isInvalidTextRepresentation(err)) {
      return null;
    }
    throw err;
  }
}

function isInvalidTextRepresentation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "22P02";
}
