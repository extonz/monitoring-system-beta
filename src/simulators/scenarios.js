const fs = require('fs');
const path = require('path');

class ScenarioRunner {
  constructor(targetDir) {
    this.targetDir = path.resolve(targetDir);
  }

  _ensureTarget() {
    if (!fs.existsSync(this.targetDir)) {
      fs.mkdirSync(this.targetDir, { recursive: true });
    }
  }

  /**
   * Populate initial baseline test files (e.g. sample documents, spreadsheets)
   */
  setupBaselineFiles(count = 20) {
    this._ensureTarget();
    const created = [];
    const docTypes = ['contract', 'report', 'financials', 'notes', 'budget', 'presentation'];

    for (let i = 1; i <= count; i++) {
      const type = docTypes[i % docTypes.length];
      const filename = `${type}_v${i}.docx`;
      const filePath = path.join(this.targetDir, filename);
      const content = `Guardian MVP Protected Document #${i}\nClassification: Confidential User Document\nTimestamp: ${new Date().toISOString()}\nPayload Data: ${'X'.repeat(256)}`;
      fs.writeFileSync(filePath, content, 'utf8');
      created.push(filePath);
    }
    return created;
  }

  /**
   * Scenario A: Normal Application Update
   * Simulates legitimate high-volume software or game update.
   */
  async runNormalUpdateScenario(onStep = null) {
    this._ensureTarget();
    const updateDir = path.join(this.targetDir, 'Application', 'Cache');
    fs.mkdirSync(updateDir, { recursive: true });

    const total = 15;
    for (let i = 1; i <= total; i++) {
      const chunkFile = path.join(updateDir, `chunk_${i}.dat`);
      fs.writeFileSync(chunkFile, `Package chunk payload ${i} - SHA verified`, 'utf8');
      if (onStep) onStep(i, total, `Updating component ${i}/${total}`);
      await new Promise(r => setTimeout(r, 60)); // Moderate, paced interval
    }

    return {
      name: 'Normal Application Update',
      type: 'NORMAL_UPDATE',
      process: {
        name: 'updater.exe',
        pid: 3412,
        isKnownTrusted: true,
        isSigned: true,
        path: 'C:\\Program Files\\ExampleApp\\updater.exe',
      },
      filesModified: total,
    };
  }

  /**
   * Scenario B: Suspicious Rapid Tampering / Encrypting Simulation
   * Simulates an unknown rogue binary modifying user documents and deleting files rapidly.
   */
  async runSuspiciousActivityScenario(onStep = null) {
    this._ensureTarget();
    const entries = fs.readdirSync(this.targetDir).filter(f => !f.startsWith('.'));
    const total = entries.length;
    let modified = 0;
    let deleted = 0;

    // 1. Rapidly overwrite and rename files with mock encryption
    for (let i = 0; i < entries.length; i++) {
      const filename = entries[i];
      const fullPath = path.join(this.targetDir, filename);
      if (fs.statSync(fullPath).isFile()) {
        if (i % 4 === 0) {
          // Delete file
          fs.unlinkSync(fullPath);
          deleted++;
        } else {
          // Corrupt / tamper
          fs.writeFileSync(fullPath, `CORRUPTED_BY_ANOMALOUS_PAYLOAD_${Date.now()}`, 'utf8');
          modified++;
        }
      }
      if (onStep) onStep(i + 1, total, `Tampering with ${filename}`);
      await new Promise(r => setTimeout(r, 15)); // High burst rate
    }

    // Add a few rogue ransom notes
    const rogue1 = path.join(this.targetDir, 'HOW_TO_DECRYPT_FILES.txt');
    fs.writeFileSync(rogue1, 'All your files have been locked by an unknown process.', 'utf8');

    return {
      name: 'Suspicious Burst Tampering',
      type: 'SUSPICIOUS_BURST',
      process: {
        name: 'unknown_payload.exe',
        pid: 9942,
        isKnownTrusted: false,
        isSigned: false,
        path: 'C:\\Users\\User\\AppData\\Local\\Temp\\unknown_payload.exe',
      },
      stats: {
        modified,
        deleted,
        created: 1,
        totalOps: modified + deleted + 1,
        elapsedSeconds: 0.8,
      },
    };
  }
}

module.exports = ScenarioRunner;
