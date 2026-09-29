const fs = require('fs');
const path = require('path');

class EventStore {
  /**
   * @param {string} storageDir
   */
  constructor(storageDir = path.join(process.cwd(), '.guardian_data')) {
    this.storageDir = storageDir;
    this.eventsFile = path.join(this.storageDir, 'events.jsonl');
    this.events = [];
    this._ensureStorage();
    this._loadEvents();
  }

  _ensureStorage() {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  _loadEvents() {
    this.events = [];
    if (!fs.existsSync(this.eventsFile)) return;

    try {
      const content = fs.readFileSync(this.eventsFile, 'utf8');
      const lines = content.trim().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          this.events.push(JSON.parse(line));
        } catch (e) {
          // Skip corrupted lines gracefully
        }
      }
    } catch (err) {
      console.error('Failed reading events file:', err);
    }
  }

  /**
   * Add a new event to the timeline
   * @param {Object} eventData
   * @returns {Object}
   */
  addEvent({
    type,
    state = 'NORMAL',
    title,
    description,
    process = null, // { name, pid, path, hash, signature, parent }
    stats = null,   // { modified, deleted, created, affectedDirectories }
    signals = [],   // ['high_frequency', 'unseen_binary', etc.]
    technical = {}, // raw forensic details
  }) {
    const event = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      timeFormatted: new Date().toLocaleTimeString(),
      type,
      state,
      title: title || type,
      description: description || '',
      process: process ? {
        name: process.name || 'unknown',
        pid: process.pid || null,
        path: process.path || 'unknown',
        hash: process.hash || 'unknown',
        signature: process.signature || 'Unsigned / Not Verified',
        parent: process.parent || 'unknown',
      } : null,
      stats: stats || { modified: 0, deleted: 0, created: 0, affectedDirectories: 0 },
      signals: Array.isArray(signals) ? signals : [],
      technical: technical || {},
    };

    this.events.push(event);

    // Append to file asynchronously with safe sync fallback
    try {
      fs.appendFileSync(this.eventsFile, JSON.stringify(event) + '\n', 'utf8');
    } catch (err) {
      console.error('Failed to append event to disk:', err);
    }

    return event;
  }

  getEvents(filter = {}) {
    let result = [...this.events];
    if (filter.state && filter.state !== 'ALL') {
      result = result.filter(e => e.state === filter.state);
    }
    if (filter.limit) {
      result = result.slice(-filter.limit);
    }
    return result.reverse(); // Newest first
  }

  getRecentEvents(limit = 10) {
    return this.getEvents({ limit });
  }

  clear() {
    this.events = [];
    try {
      if (fs.existsSync(this.eventsFile)) {
        fs.unlinkSync(this.eventsFile);
      }
    } catch (err) {
      console.error('Failed clearing events:', err);
    }
  }
}

module.exports = EventStore;
