import "dotenv/config";
import { createServer } from "http";
import next from "next";
import { parse } from "url";
import { WebSocketServer, WebSocket } from "ws";
import { AudioPipeline } from "./audio-pipeline";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const { pathname } = parse(request.url!);

    if (pathname === "/ws/audio") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  wss.on("connection", (ws: WebSocket) => {
    console.log("[ws] Client connected");
    const pipeline = new AudioPipeline(ws);
    pipeline.start();

    ws.on("close", () => {
      console.log("[ws] Client disconnected");
      pipeline.stop();
    });
  });

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
