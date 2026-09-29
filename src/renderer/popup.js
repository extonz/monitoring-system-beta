document.addEventListener('DOMContentLoaded', async () => {
  const api = window.guardianAPI;

  const toastProc = document.getElementById('toast-proc');
  const toastMsg = document.getElementById('toast-msg');
  const btnClose = document.getElementById('btn-close');
  const btnDetails = document.getElementById('btn-details');
  const btnRecover = document.getElementById('btn-recover');
  const btnAllow = document.getElementById('btn-allow');

  // Load incident details
  try {
    const state = await api.getState();
    if (state && state.activeIncident) {
      const inc = state.activeIncident;
      if (inc.process && inc.process.name) {
        toastProc.textContent = inc.process.name;
      }
      if (inc.diff && inc.diff.totalChanges) {
        toastMsg.innerHTML = `<span class="proc-name">${inc.process ? inc.process.name : 'A process'}</span> modified or deleted ${inc.diff.totalChanges} files in rapid succession.`;
      }
    }
  } catch (err) {
    console.error('Failed loading incident into popup:', err);
  }

  btnClose.addEventListener('click', () => {
    window.close();
  });

  btnDetails.addEventListener('click', async () => {
    await api.openMainWindow('incident');
    window.close();
  });

  btnRecover.addEventListener('click', async () => {
    btnRecover.textContent = 'Restoring...';
    btnRecover.disabled = true;
    try {
      const res = await api.executeRecovery();
      btnRecover.textContent = `✓ ${res.totalRestored} Restored`;
      setTimeout(() => {
        window.close();
      }, 1400);
    } catch (e) {
      btnRecover.textContent = 'Error';
    }
  });

  btnAllow.addEventListener('click', async () => {
    await api.allowActivity();
    window.close();
  });
});
