const chokidar = require('chokidar');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const os = require('os');

class FileMonitor extends EventEmitter {
  constructor() {
    super();
    this.watcher = null;
    this.monitoredPaths = [];
    this.isMonitoring = false;
    this.totalEventsObserved = 0;
  }

  /**
   * Determine primary system directories to monitor system-wide
   * Focuses on user storage, documents, desktop, downloads, and roots while filtering OS kernel churn.
   */
  getDefaultSystemPaths() {
    const userProfile = process.env.USERPROFILE || os.homedir();
    const candidatePaths = [
      path.join(userProfile, 'Desktop'),
      path.join(userProfile, 'Documents'),
      path.join(userProfile, 'Downloads'),
      path.join(userProfile, 'Pictures'),
      path.join(userProfile, 'Videos'),
      path.join(process.cwd(), 'test_environment'), // local workspace test area
    ];

    // Check if whole user directory or secondary drives exist
    const activePaths = candidatePaths.filter(p => fs.existsSync(p));
    if (activePaths.length === 0) {
      activePaths.push(userProfile);
    }
    return activePaths;
  }

  /**
   * Start system-wide monitoring across all primary system directories
   * @param {string|string[]} [customPaths]
   */
  start(customPaths = null) {
    if (this.isMonitoring) {
      this.stop();
    }

    let pathsToWatch = [];
    if (customPaths) {
      pathsToWatch = Array.isArray(customPaths) ? customPaths : [customPaths];
    } else {
      pathsToWatch = this.getDefaultSystemPaths();
    }

    // Ensure paths exist
    pathsToWatch = pathsToWatch.map(p => path.resolve(p)).filter(p => {
      try {
        if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
        return true;
      } catch {
        return false;
      }
    });

    this.monitoredPaths = pathsToWatch;

    // Intelligent ignore regex to prevent OS internal lockups while watching system-wide
    const ignorePatterns = [
      /(^|[\/\\])\../,                      // dotfiles (.git, .cache)
      /node_modules/,                       // dependencies
      /AppData[\\\/]Local[\\\/]Temp/,       // windows temp churn
      /AppData[\\\/]Local[\\\/]Microsoft/,  // edge/windows telemetry
      /\$Recycle\.Bin/,                     // recycle bin
      /System Volume Information/,          // system restore
      /pagefile\.sys/,
      /hiberfil\.sys/,
      /\.guardian_vault/,                   // guardian internal snapshot store
      /\.guardian_data/,                    // guardian internal event logs
    ];

    this.watcher = chokidar.watch(this.monitoredPaths, {
      ignored: ignorePatterns,
      persistent: true,
      ignoreInitial: true,
      depth: 6, // deep monitoring across folder hierarchies
      awaitWriteFinish: {
        stabilityThreshold: 80,
        pollInterval: 40,
      },
    });

    this.watcher
      .on('add', (filePath) => this._onEvent('add', filePath))
      .on('change', (filePath) => this._onEvent('change', filePath))
      .on('unlink', (filePath) => this._onEvent('unlink', filePath))
      .on('error', (err) => this.emit('error', err));

    this.isMonitoring = true;
    this.emit('started', { monitoredPaths: this.monitoredPaths });
  }

  _onEvent(type, filePath) {
    this.totalEventsObserved++;
    const event = {
      type,
      path: filePath,
      filename: path.basename(filePath),
      dir: path.dirname(filePath),
      timestamp: Date.now(),
    };
    this.emit('activity', event);
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    this.isMonitoring = false;
    this.emit('stopped');
  }

  getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      systemWide: true,
      monitoredPaths: this.monitoredPaths,
      totalEventsObserved: this.totalEventsObserved,
      primaryLocation: this.monitoredPaths.length > 0 ? this.monitoredPaths[0] : 'System Wide',
    };
  }
}

module.exports = FileMonitor;
