import { WebSocketServer, WebSocket, RawData } from "ws";
import type { Server as HttpServer } from "http";
import { createManifest, updateManifestStatus, ManifestValidationError, ManifestReferenceError } from "./manifests";
import { MEDIUMS } from "./constants";

interface ConnectionState {
  playerUuid: string | null;
}

export function attachTelemetryWebSocketServer(server: HttpServer) {
  const liveViewers = new Set<WebSocket>();

  // Both endpoints use `noServer: true` with manual upgrade routing below, rather than each
  // taking `{ server, path }` directly — attaching two WebSocketServers to the same http.Server
  // that way corrupts the frame stream (each registers its own 'upgrade' listener on the shared
  // server, and having two active at once breaks handshake completion for both).
  const liveWss = new WebSocketServer({ noServer: true, perMessageDeflate: false });
  liveWss.on("connection", (ws: WebSocket) => {
    liveViewers.add(ws);
    ws.on("close", () => liveViewers.delete(ws));
  });

  const telemetryWss = new WebSocketServer({ noServer: true, perMessageDeflate: false });
  telemetryWss.on("connection", (ws: WebSocket) => {
    const state: ConnectionState = { playerUuid: null };

    ws.on("message", (raw: RawData) => handleMessage(ws, state, raw, liveViewers));

    ws.on("close", () => {
      console.log(`Telemetry client disconnected${state.playerUuid ? ` (player ${state.playerUuid})` : ""}`);
    });
  });

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = new URL(req.url ?? "", `http://${req.headers.host}`);
    if (pathname === "/ws/live") {
      liveWss.handleUpgrade(req, socket, head, (ws) => liveWss.emit("connection", ws, req));
    } else if (pathname === "/ws/telemetry") {
      telemetryWss.handleUpgrade(req, socket, head, (ws) => telemetryWss.emit("connection", ws, req));
    } else {
      socket.destroy();
    }
  });

  return { telemetryWss, liveWss };
}

async function handleMessage(ws: WebSocket, state: ConnectionState, raw: RawData, liveViewers: Set<WebSocket>) {
  let message: any;
  try {
    message = JSON.parse(raw.toString());
  } catch {
    send(ws, { type: "error", message: "invalid JSON" });
    return;
  }

  try {
    switch (message?.type) {
      case "identify": {
        if (!message.player_uuid) {
          send(ws, { type: "error", message: "identify requires player_uuid" });
          return;
        }
        state.playerUuid = message.player_uuid;
        console.log(`Telemetry client identified as player ${state.playerUuid}`);
        send(ws, { type: "ack", for: "identify" });
        return;
      }

      case "manifest.create": {
        const payload = message.payload ?? {};
        const manifest = await createManifest({
          ...payload,
          assigned_player_uuid: payload.assigned_player_uuid ?? state.playerUuid,
        });
        send(ws, { type: "ack", for: "manifest.create", data: manifest });
        return;
      }

      case "manifest.status": {
        if (!message.manifest_id) {
          send(ws, { type: "error", message: "manifest.status requires manifest_id" });
          return;
        }
        const manifest = await updateManifestStatus(message.manifest_id, message.current_status);
        if (!manifest) {
          send(ws, { type: "error", message: "manifest not found" });
          return;
        }
        send(ws, { type: "ack", for: "manifest.status", data: manifest });
        return;
      }

      case "position": {
        if (!state.playerUuid) {
          send(ws, { type: "error", message: "position requires identify first" });
          return;
        }
        const { x, y, medium } = message;
        if (typeof x !== "number" || typeof y !== "number" || !MEDIUMS.includes(medium)) {
          send(ws, { type: "error", message: `position requires numeric x, y, and medium one of: ${MEDIUMS.join(", ")}` });
          return;
        }
        broadcast(liveViewers, {
          type: "position",
          player_uuid: state.playerUuid,
          x,
          y,
          medium,
          at: new Date().toISOString(),
        });
        return;
      }

      default:
        send(ws, { type: "error", message: `unknown message type: ${message?.type}` });
    }
  } catch (err) {
    if (err instanceof ManifestValidationError || err instanceof ManifestReferenceError) {
      send(ws, { type: "error", message: err.message });
      return;
    }
    console.error("Telemetry message handling error:", err);
    send(ws, { type: "error", message: "internal error" });
  }
}

function send(ws: WebSocket, message: unknown) {
  ws.send(JSON.stringify(message));
}

function broadcast(viewers: Set<WebSocket>, message: unknown) {
  const payload = JSON.stringify(message);
  for (const viewer of viewers) {
    if (viewer.readyState === WebSocket.OPEN) {
      viewer.send(payload);
    }
  }
}
