const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('guardianAPI', {
  getState: () => ipcRenderer.invoke('get-state'),
  startMonitoring: (targetDir) => ipcRenderer.invoke('start-monitoring', targetDir),
  stopMonitoring: () => ipcRenderer.invoke('stop-monitoring'),
  executeRecovery: () => ipcRenderer.invoke('execute-recovery'),
  allowActivity: (pid) => ipcRenderer.invoke('allow-activity', pid),
  runScenario: (scenarioType) => ipcRenderer.invoke('run-scenario', scenarioType),
  getEvents: (filter) => ipcRenderer.invoke('get-events', filter),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  hideWindow: () => ipcRenderer.invoke('hide-window'),
  openMainWindow: (view) => ipcRenderer.invoke('open-main-window', view),
  onStateChanged: (callback) => {
    const subscription = (event, value) => callback(value);
    ipcRenderer.on('state-changed', subscription);
    return () => ipcRenderer.removeListener('state-changed', subscription);
  },
  onRecoveryProgress: (callback) => {
    const subscription = (event, value) => callback(value);
    ipcRenderer.on('recovery-progress', subscription);
    return () => ipcRenderer.removeListener('recovery-progress', subscription);
  },
  onNavigate: (callback) => {
    const subscription = (event, view) => callback(view);
    ipcRenderer.on('navigate-view', subscription);
    return () => ipcRenderer.removeListener('navigate-view', subscription);
  },
});
