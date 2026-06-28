DCC-EX Electron App Builder by @DriverDTrains (c) 2026


# Electron Standalone App Setup Guide

This guide explains how to turn this DCC-EX Throttle project into a standalone desktop application using Electron.

## Prerequisites
- **Node.js** (v18 or newer) installed on your system.
- Your DCC-EX Command Station connected via USB.

## 1. Local Setup
Download the source code to your computer and open the folder in your terminal.

## 2. Install Dependencies
Run the following commands in your terminal to install the necessary Electron packages:

```bash
npm install --save-dev electron electron-builder wait-on concurrently cross-env esbuild shx
```

Corect any installation errors or vulnerabilities:

```bash
npm audit fix --force
```


## 3. Run and Build
To start the app in development mode:
```bash
npm run electron:dev
```

To create a standalone installer or executable:
```bash
npm run electron:build
```
The built application will be located in the `dist-electron` folder.


## WiFi Connection in Build
Unlike the browser version which requires a separate Node.js server, the **built Electron application** has a built-in TCP bridge. This means you can connect to your DCC-EX EX-CommandStation over WiFi directly from the standalone app without running any extra background services.

## Mobile Device Support (Simultaneous Mode)
When the built Electron application is running, it automatically starts a hidden web server on port **3000**. 
This allows you to connect other devices (like a mobile phone or tablet) to the same computer:
1. Find your computer's local IP address (e.g., `192.168.1.15`).
2. On your mobile device, open a web browser and go to `http://192.168.1.15:3000`.
3. You can now control your trains from both the computer and your phone simultaneously!

*Note: Both devices must be on the same local network.*


## Why use Electron for this?
- **Manual Port Selection:** When you click "Connect", the app will show a built-in menu where you can explicitly select your DCC-EX device from a list, preventing "guessing" or accidental Bluetooth connections.
- **USB Stability:** Better handling of serial port disconnections.
- **Always on Top:** You can configure the window to stay on top while you work on your layout.
- **Offline Access:** The app doesn't need a browser to run once installed.
- **Bypass Browser Warnings:** Electron handles the security permissions once, so you aren't nagged by the browser for every connection.


## Troubleshooting
If the serial port doesn't show up:
1. Ensure your DCC-EX Command Station is powered on and plugged into the USB port.
2. Check your drivers (Arduino/CH340 drivers are usually required).
3. In the Electron `main.ts` file, we've enabled a permission handler to automatically allow access to serial devices.
