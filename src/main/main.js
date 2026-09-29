const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, screen, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

const SecurityCoordinator = require('../engine/coordinator');

let mainWindow = null;
let popupWindow = null;
let tray = null;
let coordinator = null;
let isQuitting = false;

const iconPath = path.join(__dirname, '../../assets/icon.png');

function getTrayIcon() {
  if (fs.existsSync(iconPath)) {
    return nativeImage.createFromPath(iconPath);
  }
  // Fallback 16x16 empty image
  return nativeImage.createEmpty();
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 680,
    height: 490,
    minWidth: 620,
    minHeight: 440,
    title: 'Guardian',
    icon: getTrayIcon(),
    show: true,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#161618',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Minimize/Hide to tray instead of quitting on window close (Google Drive behavior)
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.webContents.on('did-fail-load', (e, code, desc) => {
    console.error('Failed to load main UI:', code, desc);
  });
}

function showToastPopup(incident) {
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.close();
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  const popupWidth = 360;
  const popupHeight = 160;
  const margin = 16;

  // Position at bottom-right corner just above Windows taskbar (macOS notification style)
  const x = Math.round(width - popupWidth - margin);
  const y = Math.round(height - popupHeight - margin);

  popupWindow = new BrowserWindow({
    width: popupWidth,
    height: popupHeight,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  popupWindow.loadFile(path.join(__dirname, '../renderer/popup.html'));

  popupWindow.once('ready-to-show', () => {
    popupWindow.showInactive(); // Show without stealing active keyboard focus from user's current app
  });
}

function setupTray() {
  const icon = getTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip('Guardian — System-Wide Protection Active');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Guardian: Protected', enabled: false },
    { type: 'separator' },
    {
      label: 'Open Guardian',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: 'Verify Protection Response',
      click: async () => {
        if (coordinator) {
          await coordinator.runScenario('SETUP_BASELINE');
          await coordinator.runScenario('SUSPICIOUS_BURST');
        }
      },
    },
    {
      label: 'Real-time Defense',
      type: 'checkbox',
      checked: true,
      click: (item) => {
        if (coordinator) {
          if (item.checked) coordinator.startMonitoring();
          else coordinator.stopMonitoring();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Guardian',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // Left click toggles main window
  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
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

ipcMain.handle('hide-window', () => {
  if (mainWindow) mainWindow.hide();
});

ipcMain.handle('open-main-window', (event, viewName) => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    if (viewName) {
      mainWindow.webContents.send('navigate-view', viewName);
    }
  }
});

app.whenReady().then(async () => {
  createMainWindow();
  setupTray();

  // Initialize engine coordinator
  coordinator = new SecurityCoordinator();

  coordinator.on('state-changed', (state) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('state-changed', state);
    }
  });

  // When anomalous incident is detected:
  // Show Avast-style toast popup in the corner, DO NOT open the full app!
  coordinator.on('incident-detected', (incident) => {
    showToastPopup(incident);
  });

  // Start system-wide monitoring across drives & user folders
  await coordinator.startMonitoring();
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  // Stay running in the system tray
});
