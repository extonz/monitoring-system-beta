const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const SecurityCoordinator = require('../engine/coordinator');

let mainWindow = null;
let coordinator = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1040,
    height: 760,
    minWidth: 880,
    minHeight: 620,
    title: 'Guardian — Local Behavioral Protection',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Initialize engine coordinator
  const defaultDir = path.join(process.cwd(), 'test_environment');
  coordinator = new SecurityCoordinator({ defaultTestDir: defaultDir });

  coordinator.on('state-changed', (state) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('state-changed', state);
    }
  });

  // Start initial baseline monitoring
  coordinator.startMonitoring(defaultDir).catch(err => {
    console.error('Failed auto-starting initial monitoring:', err);
  });
}

// IPC Handlers
ipcMain.handle('get-state', () => {
  return coordinator ? coordinator.getState() : {};
});

ipcMain.handle('start-monitoring', async (event, targetDir) => {
  return await coordinator.startMonitoring(targetDir);
});

ipcMain.handle('stop-monitoring', () => {
  coordinator.stopMonitoring();
  return coordinator.getState();
});

ipcMain.handle('execute-recovery', async () => {
  return await coordinator.executeRecovery((current, total, filename) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('recovery-progress', { current, total, filename });
    }
  });
});

ipcMain.handle('allow-activity', async (event, pid) => {
  await coordinator.allowActivity(pid);
  return coordinator.getState();
});

ipcMain.handle('run-scenario', async (event, scenarioType) => {
  return await coordinator.runScenario(scenarioType);
});

ipcMain.handle('get-events', (event, filter) => {
  return coordinator.eventStore.getEvents(filter);
});

ipcMain.handle('select-folder', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
  });
  if (!res.canceled && res.filePaths.length > 0) {
    return res.filePaths[0];
  }
  return null;
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
