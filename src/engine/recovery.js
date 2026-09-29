const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class RecoveryEngine {
  constructor(vaultDir = path.join(process.cwd(), '.guardian_vault')) {
    this.vaultDir = vaultDir;
    this.currentSnapshot = null;
    this._ensureVault();
  }

  _ensureVault() {
    if (!fs.existsSync(this.vaultDir)) {
      fs.mkdirSync(this.vaultDir, { recursive: true });
    }
  }

  _computeFileHash(filePath) {
    try {
      const buffer = fs.readFileSync(filePath);
      return crypto.createHash('sha256').update(buffer).digest('hex');
    } catch {
      return null;
    }
  }

  /**
   * Take a full snapshot of the specified target folder.
   * Backs up files safely into the vault and indexes metadata.
   * @param {string} targetDir
   */
  async createSnapshot(targetDir) {
    if (!fs.existsSync(targetDir)) {
      throw new Error(`Target directory does not exist: ${targetDir}`);
    }

    const snapshotId = `snap_${Date.now()}`;
    const snapshotStorage = path.join(this.vaultDir, snapshotId);
    fs.mkdirSync(snapshotStorage, { recursive: true });

    const files = {};

    const scanDirectory = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(targetDir, fullPath);

        if (entry.isDirectory()) {
          scanDirectory(fullPath);
        } else if (entry.isFile()) {
          const stats = fs.statSync(fullPath);
          const hash = this._computeFileHash(fullPath);
          const backupPath = path.join(snapshotStorage, hash);

          // Deduplicate backups by hash in storage
          if (!fs.existsSync(backupPath)) {
            fs.copyFileSync(fullPath, backupPath);
          }

          files[relPath] = {
            relPath,
            size: stats.size,
            mtime: stats.mtimeMs,
            hash,
            backupPath,
          };
        }
      }
    };

    scanDirectory(targetDir);

    const snapshot = {
      id: snapshotId,
      targetDir: path.resolve(targetDir),
      createdAt: new Date().toISOString(),
      fileCount: Object.keys(files).length,
      files,
    };

    // Save snapshot metadata
    fs.writeFileSync(
      path.join(snapshotStorage, 'meta.json'),
      JSON.stringify(snapshot, null, 2),
      'utf8'
    );

    this.currentSnapshot = snapshot;
    return snapshot;
  }

  /**
   * Compute differences between current target folder state and the snapshot.
   * @param {string} [targetDir]
   */
  diffCurrentState(targetDir = null) {
    const snap = this.currentSnapshot;
    if (!snap) {
      throw new Error('No baseline snapshot exists to compare against.');
    }

    const rootDir = targetDir ? path.resolve(targetDir) : snap.targetDir;
    const currentFiles = {};

    if (fs.existsSync(rootDir)) {
      const scanDirectory = (dir) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relPath = path.relative(rootDir, fullPath);

          if (entry.isDirectory()) {
            scanDirectory(fullPath);
          } else if (entry.isFile()) {
            const stats = fs.statSync(fullPath);
            const hash = this._computeFileHash(fullPath);
            currentFiles[relPath] = {
              relPath,
              size: stats.size,
              mtime: stats.mtimeMs,
              hash,
            };
          }
        }
      };
      scanDirectory(rootDir);
    }

    const modified = [];
    const deleted = [];
    const created = [];

    // Check for deleted or modified
    for (const [relPath, snapFile] of Object.entries(snap.files)) {
      if (!currentFiles[relPath]) {
        deleted.push(relPath);
      } else if (currentFiles[relPath].hash !== snapFile.hash) {
        modified.push(relPath);
      }
    }

    // Check for newly created files
    for (const relPath of Object.keys(currentFiles)) {
      if (!snap.files[relPath]) {
        created.push(relPath);
      }
    }

    return {
      snapshotId: snap.id,
      targetDir: rootDir,
      totalChanges: modified.length + deleted.length + created.length,
      modified,
      deleted,
      created,
    };
  }

  /**
   * Revert all changes and restore monitored folder strictly to snapshot state.
   * Verifies each file before claiming success.
   * @param {function} [onProgress] Callback (current, total, filename)
   */
  async restoreSnapshot(onProgress = null) {
    const snap = this.currentSnapshot;
    if (!snap) {
      throw new Error('No snapshot available to restore.');
    }

    const diff = this.diffCurrentState();
    const totalOperations = diff.created.length + diff.deleted.length + diff.modified.length;
    let completed = 0;

    let restoredDeleted = 0;
    let restoredModified = 0;
    let cleanedCreated = 0;
    const failed = [];

    // 1. Clean up created rogue files
    for (const relPath of diff.created) {
      const fullPath = path.join(snap.targetDir, relPath);
      try {
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
        cleanedCreated++;
      } catch (err) {
        failed.push({ file: relPath, reason: err.message });
      }
      completed++;
      if (onProgress) onProgress(completed, totalOperations, relPath);
    }

    // 2. Restore deleted files
    for (const relPath of diff.deleted) {
      const snapFile = snap.files[relPath];
      const fullPath = path.join(snap.targetDir, relPath);
      try {
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.copyFileSync(snapFile.backupPath, fullPath);
        // Verify restoration
        const restoredHash = this._computeFileHash(fullPath);
        if (restoredHash === snapFile.hash) {
          restoredDeleted++;
        } else {
          failed.push({ file: relPath, reason: 'Hash mismatch after restore' });
        }
      } catch (err) {
        failed.push({ file: relPath, reason: err.message });
      }
      completed++;
      if (onProgress) onProgress(completed, totalOperations, relPath);
    }

    // 3. Restore modified files
    for (const relPath of diff.modified) {
      const snapFile = snap.files[relPath];
      const fullPath = path.join(snap.targetDir, relPath);
      try {
        fs.copyFileSync(snapFile.backupPath, fullPath);
        // Verify restoration
        const restoredHash = this._computeFileHash(fullPath);
        if (restoredHash === snapFile.hash) {
          restoredModified++;
        } else {
          failed.push({ file: relPath, reason: 'Hash mismatch after restore' });
        }
      } catch (err) {
        failed.push({ file: relPath, reason: err.message });
      }
      completed++;
      if (onProgress) onProgress(completed, totalOperations, relPath);
    }

    // Strict post-recovery verification check
    const postDiff = this.diffCurrentState();
    const isFullyVerified = postDiff.totalChanges === 0;

    return {
      success: isFullyVerified && failed.length === 0,
      totalRequested: totalOperations,
      totalRestored: restoredDeleted + restoredModified + cleanedCreated,
      restoredDeleted,
      restoredModified,
      cleanedCreated,
      failed,
      isFullyVerified,
      remainingDiffs: postDiff.totalChanges,
    };
  }
}

module.exports = RecoveryEngine;
