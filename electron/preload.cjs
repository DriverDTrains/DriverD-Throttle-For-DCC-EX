const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onSerialPorts: (callback) => {
    const subscription = (_event, ports) => callback(ports);
    ipcRenderer.on('serial-port-list', subscription);
    return () => ipcRenderer.removeListener('serial-port-list', subscription);
  },
  selectPort: (portId) => {
    ipcRenderer.send('port-selected', portId);
  },
  // TCP Bridge for WiFi
  tcpConnect: (host, port) => ipcRenderer.send('tcp-connect', { host, port }),
  tcpSend: (data) => ipcRenderer.send('tcp-send', data),
  tcpDisconnect: () => ipcRenderer.send('tcp-disconnect'),
  getLocalIP: () => ipcRenderer.invoke('get-local-ip'),
  onTcpData: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on('tcp-data', subscription);
    return () => ipcRenderer.removeListener('tcp-data', subscription);
  },
  onTcpConnected: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('tcp-connected', subscription);
    return () => ipcRenderer.removeListener('tcp-connected', subscription);
  },
  onTcpError: (callback) => {
    const subscription = (_event, error) => callback(error);
    ipcRenderer.on('tcp-error', subscription);
    return () => ipcRenderer.removeListener('tcp-error', subscription);
  },
  onTcpClose: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('tcp-close', subscription);
    return () => ipcRenderer.removeListener('tcp-close', subscription);
  },
});
