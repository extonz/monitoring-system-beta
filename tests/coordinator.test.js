const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SecurityCoordinator = require('../src/engine/coordinator');

const coordTestDir = path.join(__dirname, 'temp_coord_env');
const coordVaultDir = path.join(__dirname, 'temp_coord_vault');
const coordDataDir = path.join(__dirname, 'temp_coord_data');

function cleanup() {
  [coordTestDir, coordVaultDir, coordDataDir].forEach(d => {
    if (fs.existsSync(d)) {
      fs.rmSync(d, { recursive: true, force: true });
    }
  });
}

test.beforeEach(cleanup);
test.after(cleanup);

test('SecurityCoordinator - full lifecycle: baseline -> normal update -> suspicious burst -> containment -> verified recovery', async () => {
  const coordinator = new SecurityCoordinator({
    defaultTestDir: coordTestDir,
    vaultDir: coordVaultDir,
    storageDir: coordDataDir,
  });

  // 1. Initialize Baseline
  await coordinator.runScenario('SETUP_BASELINE');
  await coordinator.startMonitoring(coordTestDir);

  let state = coordinator.getState();
  assert.strictEqual(state.state, 'NORMAL');
  assert.strictEqual(state.isMonitoring, true);

  // 2. Normal Update Scenario
  await coordinator.runScenario('NORMAL_UPDATE');
  state = coordinator.getState();
  assert.strictEqual(state.state, 'NORMAL');
  assert.strictEqual(state.activeIncident, null);

  // 3. Suspicious Burst Scenario (triggers containment)
  await coordinator.runScenario('SUSPICIOUS_BURST');
  state = coordinator.getState();
  assert.strictEqual(state.state, 'CONTAINED');
  assert.ok(state.activeIncident);
  assert.strictEqual(state.activeIncident.process.name, 'unknown_payload.exe');
  assert.ok(state.activeIncident.diff.totalChanges > 0);

  // 4. Verified Recovery
  const recoveryResult = await coordinator.executeRecovery();
  assert.strictEqual(recoveryResult.isFullyVerified, true);
  assert.strictEqual(recoveryResult.remainingDiffs, 0);

  state = coordinator.getState();
  assert.strictEqual(state.state, 'RECOVERED');
  assert.strictEqual(state.activeIncident.recovered, true);

  // 5. Clean up monitor
  coordinator.stopMonitoring();
  state = coordinator.getState();
  assert.strictEqual(state.isMonitoring, false);
});
