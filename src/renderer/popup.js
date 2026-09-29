document.addEventListener('DOMContentLoaded', async () => {
  const api = window.guardianAPI;

  const toastProc = document.getElementById('toast-proc');
  const toastMsg = document.getElementById('toast-msg');
  const btnClose = document.getElementById('btn-close');
  const btnDetails = document.getElementById('btn-details');
  const btnRecover = document.getElementById('btn-recover');

  // Load active incident details
  try {
    const state = await api.getState();
    if (state && state.activeIncident) {
      const inc = state.activeIncident;
      if (inc.process && inc.process.name) {
        toastProc.textContent = inc.process.name;
      }
      if (inc.diff && inc.diff.totalChanges) {
        toastMsg.innerHTML = `<span class="banner-proc">${inc.process ? inc.process.name : 'Process'}</span> attempted ${inc.diff.totalChanges} unexpected changes.`;
      }
    }
  } catch (err) {
    console.error('Failed loading incident into notification banner:', err);
  }

  if (btnClose) {
    btnClose.addEventListener('click', () => {
      window.close();
    });
  }

  if (btnDetails) {
    btnDetails.addEventListener('click', async () => {
      await api.openMainWindow('incidents');
      window.close();
    });
  }

  if (btnRecover) {
    btnRecover.addEventListener('click', async () => {
      btnRecover.textContent = 'Restoring...';
      btnRecover.disabled = true;
      try {
        const res = await api.executeRecovery();
        btnRecover.textContent = 'Restored';
        setTimeout(() => {
          window.close();
        }, 1100);
      } catch {
        btnRecover.textContent = 'Error';
      }
    });
  }
});
