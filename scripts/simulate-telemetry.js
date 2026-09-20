// Fakes a Client Tracker for local testing: connects to /ws/telemetry, identifies as a
// player, then streams random position updates so the Live Map has something to show.
const WebSocket = require("ws");

const host = process.env.MERIDIUM_HOST || "localhost:3000";
const playerUuid = process.argv[2] || `sim-player-${Math.floor(Math.random() * 1000)}`;
const medium = process.argv[3] || "HIGHWAY";

const ws = new WebSocket(`ws://${host}/ws/telemetry`);

let x = Math.random() * 1000;
let y = Math.random() * 1000;

ws.on("open", () => {
  console.log(`Connected as ${playerUuid} (${medium})`);
  ws.send(JSON.stringify({ type: "identify", player_uuid: playerUuid }));
});

ws.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.type === "error") {
    console.error("Server error:", msg.message);
  }
});

setInterval(() => {
  x = Math.max(0, Math.min(1000, x + (Math.random() - 0.5) * 40));
  y = Math.max(0, Math.min(1000, y + (Math.random() - 0.5) * 40));
  ws.send(JSON.stringify({ type: "position", x, y, medium }));
}, 1000);
