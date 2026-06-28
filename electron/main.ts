import { app, BrowserWindow, ipcMain, WebContents, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import net from 'net';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import os from 'os';

// Aggressively disable Bluetooth features to prevent OS permission prompts
app.commandLine.appendSwitch('disable-features', 'WebBluetooth,WebBluetoothScanning');
app.commandLine.appendSwitch('disable-web-bluetooth');

// Handling directory paths for both ESM (tsx dev) and CJS (prod bundle)
const isPackaged = app.isPackaged;
const isDev = !isPackaged && process.env.NODE_ENV === 'development';

const _dirname = (function() {
  if (typeof __dirname !== 'undefined') return __dirname;
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch (e) {
    return process.cwd();
  }
})();

// Detailed logging for path discovery in built app
console.log('--- DCC-EX Throttle Initialization ---');
console.log('Packaged:', isPackaged);
console.log('App Path:', app.getAppPath());
console.log('Dirname:', _dirname);
console.log('Node Env:', process.env.NODE_ENV);

// Re-evaluate distPath more robustly
// In dev: electron/main.ts -> ../dist
// In build: dist-electron/main.cjs -> ../dist
const distPath = path.resolve(_dirname, '..', 'dist');

console.log('Electron: Initialization...');
console.log(' - Packaged:', isPackaged);
console.log(' - Dev Mode:', isDev);
console.log(' - _dirname:', _dirname);
console.log(' - distPath:', distPath);

// Store the callback so we can call it when the user picks a port in the UI
let selectPortCallback: any = null;

// TCP Socket for WiFi Bridge
let tcpSocket: net.Socket | null = null;
let tcpSender: WebContents | null = null;

ipcMain.on('port-selected', (event, portId) => {
  console.log('Electron: port-selected received:', portId);
  if (selectPortCallback) {
    selectPortCallback(portId);
    selectPortCallback = null;
  }
});

ipcMain.handle('get-local-ip', () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      // In Node 18+ iface.family is a string ('IPv4'), in older it might be 4
      if ((iface.family === 'IPv4' || (iface.family as any) === 4) && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
});

// TCP Bridge handlers
ipcMain.on('tcp-connect', (event, { host, port }) => {
  console.log(`Electron Bridge: Connecting to ${host}:${port}`);
  tcpSender = event.sender;
  
  if (tcpSocket) {
    tcpSocket.destroy();
  }

  tcpSocket = new net.Socket();
  
  tcpSocket.connect(port, host, () => {
    console.log(`Electron Bridge: TCP Connected to ${host}:${port}`);
    if (tcpSender) tcpSender.send('tcp-connected');
  });

  tcpSocket.on('data', (data) => {
    if (tcpSender) tcpSender.send('tcp-data', data.toString());
  });

  tcpSocket.on('error', (err) => {
    console.error('Electron Bridge: TCP Error:', err);
    if (tcpSender) tcpSender.send('tcp-error', err.message);
  });

  tcpSocket.on('close', () => {
    console.log('Electron Bridge: TCP Closed');
    if (tcpSender) tcpSender.send('tcp-close');
    tcpSocket = null;
    tcpSender = null;
  });
});

ipcMain.on('tcp-send', (event, data) => {
  if (tcpSocket && tcpSocket.writable) {
    tcpSocket.write(data);
  }
});

ipcMain.on('tcp-disconnect', () => {
  if (tcpSocket) {
    tcpSocket.destroy();
    tcpSocket = null;
  }
});

/**
 * Starts an internal Express server to serve the app to mobile devices on the local network.
 * This ONLY runs in production (packaged) builds.
 */
async function startInternalServer() {
  console.log('Electron: startInternalServer() called');
  
  // If we are in dev mode (not packaged), the Vite dev server is already on port 3000.
  if (!isPackaged && isDev) {
    console.log('Electron: Internal server skipped (Dev mode active).');
    return;
  }

  try {
    console.log('Electron: Verifying server dependencies...');
    // test if express is available
    const expressTest = await import('express');
    console.log('Electron: Express is available.');
    
    const fs = await import('fs');
    
    // On macOS packaged app, app.getAppPath() is inside the ASAR or Resources/app
    const appPath = app.getAppPath();
    
    const possiblePaths = [
      path.join(appPath, 'dist'),
      path.resolve(_dirname, '..', 'dist'),
      path.resolve(process.cwd(), 'dist'),
      // macOS specific path: ../../Resources/app/dist
      path.join(path.dirname(appPath), 'Resources', 'app', 'dist')
    ];

    let finalDistPath = '';
    console.log('Electron: Searching for "dist" directory...');
    
    for (const p of possiblePaths) {
      const exists = fs.existsSync(p);
      const hasIndex = exists && fs.existsSync(path.join(p, 'index.html'));
      console.log(` - Checking: ${p} [Exists: ${exists}, Has index.html: ${hasIndex}]`);
      if (hasIndex) {
        finalDistPath = p;
        break;
      }
    }

    if (!finalDistPath) {
      console.error('Electron: FATAL - Could not find a valid "dist" folder. Internal server cannot start.');
      return;
    }

    console.log('Electron: Internal server starting with root:', finalDistPath);
    
    const expressApp = express();
    const httpServer = createServer(expressApp);
    const wss = new WebSocketServer({ noServer: true });

    const PORT = 3000;

    // WebSocket upgrade for mobile bridge
    httpServer.on('upgrade', (request, socket, head) => {
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
        ws.close(1008, 'Missing host or port');
        return;
      }

      console.log(`Internal Server Bridge: Connecting to ${host}:${port}`);
      const bridgeSocket = new net.Socket();
      bridgeSocket.connect(port, host);

      bridgeSocket.on('data', (data) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(data.toString());
      });

      bridgeSocket.on('error', (err) => {
        ws.send(`<Log: Bridge Error: ${err.message}>`);
        ws.close();
      });

      bridgeSocket.on('close', () => ws.close());

      ws.on('message', (msg) => {
        if (bridgeSocket.writable) bridgeSocket.write(msg.toString());
      });

      ws.on('close', () => bridgeSocket.destroy());
    });

    expressApp.use(express.static(finalDistPath));
    
    expressApp.get('/api/health', (req, res) => {
      res.json({ status: 'ok', source: 'electron-internal', packaged: isPackaged });
    });

    expressApp.get('*all', (req, res) => {
      res.sendFile(path.join(finalDistPath, 'index.html'));
    });

    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`Electron: Mobile server active on http://0.0.0.0:${PORT}`);
    });

    httpServer.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.warn('Electron: Port 3000 in use, skipping internal server.');
      } else {
        console.error('Electron: Server error:', err);
      }
    });

  } catch (error) {
    console.error('Electron: Failed to start internal server:', error);
  }
}

function createWindow() {

  const preloadPath = path.join(_dirname, 'preload.cjs');
  console.log('Electron: Loading preload from:', preloadPath);

  const iconPath = path.join(_dirname, 'DriverD-Throttle-Icon.png');
  console.log('Electron: Icon path:', iconPath);

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 1100,
    useContentSize: true,    // Added to see if it fixes Windows 1-Column Display
    title: "DriverD Throttle for DCC-EX",
    icon: iconPath,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
      webSecurity: false, // Required for TCP bridge if using fetch/WS to local IPs
      allowRunningInsecureContent: true
    },
  });

  // Open target="_blank" links in the system's default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // If it's a web link, open it externally
    if (url.startsWith('http:') || url.startsWith('https:')) {
      // Special case: if it's already a localhost link to our manual, just open it
      shell.openExternal(url);
      return { action: 'deny' };
    }
    
    // If it's our local user guide or manual (likely a file:// URL when clicked in Electron)
    if (url.includes('/userguide/') || url.includes('/manual/')) {
      // In a packaged app, file:// URLs point into the ASAR, which external browsers can't read.
      // Redirect to the internal server that we start on port 3000.
      let queryStr = '';
      try {
        const parsedUrl = new URL(url);
        queryStr = parsedUrl.search;
      } catch (e) {
        const parts = url.split('?');
        if (parts.length > 1) {
          queryStr = '?' + parts[1];
        }
      }
      shell.openExternal(`http://localhost:3000/userguide/index.html${queryStr}`);
      return { action: 'deny' };
    }

    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Handle Serial Port selection
  mainWindow.webContents.session.on('select-serial-port', (event, portList, webContents, callback) => {
    console.log('Electron: select-serial-port event triggered. Total ports:', portList.length);
    
    // List all ports to console for debugging
    portList.forEach(p => console.log(` - Port: ${p.portName} (${p.displayName})`));

    // Filter out Bluetooth ports to prevent the OS from nagging about Bluetooth permissions
    const filteredPorts = portList.filter(port => {
      const name = (port.displayName || port.portName || '').toLowerCase();
      const isBluetooth = name.includes('bluetooth') || name.includes('bth-') || name.includes('bt-') || name.includes('bluez');
      return !isBluetooth;
    });

    console.log('Electron: Filtered ports count:', filteredPorts.length);

    event.preventDefault();
    selectPortCallback = callback;
    // Send the filtered list of ports to the React front-end
    mainWindow.webContents.send('serial-port-list', filteredPorts);
  });

  // Aggressive Bluetooth blocking
  mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission) => {
    const p = permission as string;
    if (p === 'serial' || p === 'usb' || p === 'hid') return true;
    if (p === 'bluetooth') return false;
    return false;
  });

  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const p = permission as string;
    if (p === 'serial' || p === 'usb' || p === 'hid') callback(true);
    else callback(false);
  });

  mainWindow.webContents.on('select-bluetooth-device', (event, deviceList, callback) => {
    event.preventDefault();
    callback(''); // Cancel immediately
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    // In production, load the built index.html
    const indexPath = path.join(_dirname, '../dist/index.html');
    mainWindow.loadFile(indexPath);

    // Strip Origin and Referer headers in production to help WiFi connectivity with local devices
    mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
      (details, callback) => {
        delete details.requestHeaders['Origin'];
        delete details.requestHeaders['Referer'];
        callback({ cancel: false, requestHeaders: details.requestHeaders });
      }
    );
  }
}

app.whenReady().then(() => {
  console.log('Electron: app.whenReady() triggered');
  
  if (isPackaged || !isDev) {
    startInternalServer().catch(err => {
      console.error('Electron: Critical failure starting internal server:', err);
    });
  }
  
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
