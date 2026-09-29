const chokidar = require('chokidar');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

class FileMonitor extends EventEmitter {
  constructor() {
    super();
    this.watcher = null;
    this.targetDir = null;
    this.isMonitoring = false;
    this.totalEventsObserved = 0;
  }

  /**
   * Start monitoring a designated target directory
   * @param {string} dirPath
   */
  start(dirPath) {
    if (this.isMonitoring) {
      this.stop();
    }

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    this.targetDir = path.resolve(dirPath);
    this.watcher = chokidar.watch(this.targetDir, {
      ignored: /(^|[\/\\])\..|node_modules/, // ignore dotfiles and node_modules
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    });

    this.watcher
      .on('add', (filePath) => this._onEvent('add', filePath))
      .on('change', (filePath) => this._onEvent('change', filePath))
      .on('unlink', (filePath) => this._onEvent('unlink', filePath))
      .on('error', (err) => this.emit('error', err));

    this.isMonitoring = true;
    this.emit('started', { targetDir: this.targetDir });
  }

  _onEvent(type, filePath) {
    this.totalEventsObserved++;
    const event = {
      type,
      path: filePath,
      relative: path.relative(this.targetDir, filePath),
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
      targetDir: this.targetDir,
      totalEventsObserved: this.totalEventsObserved,
    };
  }
}

module.exports = FileMonitor;
