<h1 align="center">Welcome to the @Driver-D Throttle for DCC-EX!<br>All aboard!</h1>

<div align="center">
   <img width="1200" height="1100" alt="DDT-Throttle-for-DCC-EX" src="DriverDThrottle_Local_sm.png" />
</div>

<h2> Install & Run the @Driver-D Throttle for DCC-EX! </h2>

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:**  Node.js

NOTE: To install Node.js, visit the Node.js download page and download and run the installer for your computer.  
https://nodejs.org/en/download

Manual installation of the @DriverD-Throttle for DCC-EX in Mac Terminal or Windows Powershell:
1. Change Directory:<br>
   Change directory (cd) to the folder with the app (the one you found this README in). 

FOR BACKEND ONLY:

2. Install & Update Dependencies:<br>
   Enter Command: 'npm install'  (Note: An API key is NOT required for this app.)<br>
   Enter Command: 'npm audit fix --force'<br>

3. Run the App:<br>
   Enter Command: 'npm run dev'<br>

4. Use the Throttle:<br>
   Access the DriverD Throttle in a browser from http://localhost:3000 or remotely from another device at http://[your computer's IP address]:3000<br>
      
6. Stop the Backend Process:<br>
   Ctrl-C in Terminal / Powershell to end the node process when done.

TO COMPILE THE STANDALONE APP:

7. Install & Update Dependencies & Build the App:<br>
   Enter Command: 'npm install --save-dev electron electron-builder wait-on concurrently cross-env esbuild shx'<br>
   Enter Command: 'npm audit fix --force'<br>
   Enter Command: 'npm run electron:build'<br>

Happy Railroading! 🚂<br>

DriverD & Scratchy-C [Meow!]<br>

   <img width="119" height="119" alt="Scratchy-C" src="Scratchy-C.png" />

<div align="center"><i>Created in Google AI Studio by @DriverDTrains (c) 2026.</i></center></div>
