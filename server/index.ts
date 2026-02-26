import "dotenv/config";
import { createServer } from "http";
import { createServer as createSecureServer } from "https";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import next from "next";
import { parse } from "url";
import { Server } from "socket.io";
import { getToken } from "next-auth/jwt";
import { MeetingManager } from "./meeting-manager";
import { getMeeting } from "./db/repositories/meetings";
import { getProject } from "./db/repositories/projects";
import { initDb } from "./db/connection";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);
const nextAuthSecret = process.env.NEXTAUTH_SECRET;

const certPath = join(__dirname, "..", "certs", "cert.pem");
const keyPath = join(__dirname, "..", "certs", "key.pem");
const useHttps = existsSync(certPath) && existsSync(keyPath);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

initDb().then(() => app.prepare()).then(() => {
  const requestHandler = (req: any, res: any) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  };

  const server = useHttps
    ? createSecureServer(
        { cert: readFileSync(certPath), key: readFileSync(keyPath) },
        requestHandler,
      )
    : createServer(requestHandler);

  const io = new Server(server, {
    maxHttpBufferSize: 1e6,
  });

  if (nextAuthSecret) {
    io.use(async (socket, next) => {
      try {
        const cookieHeader = socket.handshake.headers.cookie ?? "";
        const cookies: Record<string, string> = {};
        cookieHeader.split(";").forEach((c) => {
          const [key, ...val] = c.trim().split("=");
          if (key) cookies[key] = val.join("=");
        });
        const token = await getToken({
          req: { cookies, headers: socket.handshake.headers } as any,
          secret: nextAuthSecret,
          secureCookie: process.env.NEXTAUTH_URL?.startsWith("https://") ?? false,
        });
        if (!token) return next(new Error("Authentication failed"));
        socket.data.userName = token.name ?? null;
        next();
      } catch {
        next(new Error("Authentication failed"));
      }
    });
  }

  const meetingManager = new MeetingManager(io);

  io.on("connection", async (socket) => {
    const { meetingId, role } = socket.handshake.query as Record<string, string>;

    if (!meetingId) {
      socket.emit("error", "Missing meetingId");
      socket.disconnect();
      return;
    }

    const meeting = await getMeeting(meetingId);
    if (!meeting) {
      socket.emit("error", "Meeting not found");
      socket.disconnect();
      return;
    }

    const project = await getProject(meeting.project_id);
    if (!project) {
      socket.emit("error", "Project not found");
      socket.disconnect();
      return;
    }

    console.log(`[io] ${role || "producer"} connected: ${socket.id} → meeting ${meetingId}`);

    if (role === "viewer") {
      meetingManager.joinAsViewer(socket, project.id, meetingId);
    } else {
      meetingManager.joinAsProducer(socket, project.id, meetingId);
    }

    socket.on("disconnect", () => {
      meetingManager.handleDisconnect(socket);
    });
  });

  const protocol = useHttps ? "https" : "http";
  server.listen(port, () => {
    console.log(`> Ready on ${protocol}://${hostname}:${port}`);
  });
});
