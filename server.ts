import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import net from "net";
import path from "path";
import fs from "fs";

function getImagesRecursively(dir: string, baseDir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    if (file.startsWith('.')) return;
    const fullPath = path.join(dir, file);
    try {
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(getImagesRecursively(fullPath, baseDir));
      } else {
        const ext = path.extname(file).toLowerCase();
        if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(ext)) {
          const relative = path.relative(baseDir, fullPath);
          results.push(relative.replace(/\\/g, '/'));
        }
      }
    } catch (e) {
      // Ignore files we cannot stat
    }
  });
  return results;
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  const PORT = 3000;

  // Handle WebSocket upgrade for the TCP bridge
  server.on('upgrade', (request, socket, head) => {
    const { pathname } = new URL(request.url || '', `http://${request.headers.host}`);

    if (pathname === '/bridge') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws, request) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const host = url.searchParams.get('host');
    const port = parseInt(url.searchParams.get('port') || '0');

    if (!host || !port) {
      console.log('Bridge: Missing host or port');
      ws.close(1008, 'Missing host or port');
      return;
    }

    console.log(`Bridge: Connecting to ${host}:${port}`);
    
    const tcpSocket = new net.Socket();
    
    tcpSocket.connect(port, host, () => {
      console.log(`Bridge: TCP Connected to ${host}:${port}`);
    });

    tcpSocket.on('data', (data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data.toString());
      }
    });

    tcpSocket.on('error', (err) => {
      console.error('Bridge: TCP Error:', err);
      ws.send(`<Log: Bridge TCP Error: ${err.message}>`);
      ws.close();
    });

    tcpSocket.on('close', () => {
      console.log('Bridge: TCP Closed');
      ws.close();
    });

    ws.on('message', (message) => {
      const cmd = message.toString();
      if (tcpSocket.writable) {
        tcpSocket.write(cmd);
      }
    });

    ws.on('close', () => {
      console.log('Bridge: WS Closed');
      tcpSocket.destroy();
    });
  });

  // Serve the interactive Guide
  app.use("/guide", express.static(path.join(process.cwd(), "public/userguide")));

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/guide-images", (req, res) => {
    try {
      const baseDir = path.join(process.cwd(), "public/userguide");
      const images = getImagesRecursively(baseDir, baseDir);
      images.sort();
      res.json({ images });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
