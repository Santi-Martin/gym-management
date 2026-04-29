/* ==========================================
   VIEW: MY QR — User QR code display
   ========================================== */

async function renderMyQr() {
  const user = Auth.getUser();
  const vc = document.getElementById('view-container');
  vc.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Generando QR...</p></div>`;

  try {
    const [qrRes, memRes] = await Promise.all([
      API.get(`/users/${user.id}/qr`),
      API.get(`/memberships/user/${user.id}`)
    ]);

    const qrData = await API.json(qrRes);
    const memData = await API.json(memRes);
    const membership = memData.active;

    const isActive = membership && new Date(membership.end_date) > new Date();
    const daysLeft = membership ? Math.max(0, Math.ceil((new Date(membership.end_date) - new Date()) / (1000 * 60 * 60 * 24))) : 0;

    const fmtDate = (d) => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });

    let visitsBlock = '';
    if (membership && membership.visits_per_week) {
      const used = membership.weekly_visits_used || memData.active.weekly_visits_used || 0;
      const remaining = membership.visits_per_week - used;
      visitsBlock = `
        <div class="qr-visits">
          <div class="qr-visits__num">${remaining}</div>
          <div class="qr-visits__label">visitas disponibles esta semana</div>
        </div>
      `;
    } else if (membership) {
      visitsBlock = `
        <div class="qr-visits">
          <div class="qr-visits__num">∞</div>
          <div class="qr-visits__label">acceso ilimitado</div>
        </div>
      `;
    } else {
      visitsBlock = `
        <div class="qr-visits" style="border-color:rgba(239,68,68,0.2);">
          <div class="qr-visits__num" style="color:#f87171;">0</div>
          <div class="qr-visits__label">sin membresía activa</div>
        </div>
      `;
    }

    vc.innerHTML = `
      <div class="view-header">
        <div class="view-title">Mi código QR</div>
        <div class="view-subtitle">Mostralo al empleado para registrar tu ingreso</div>
      </div>

      <div class="qr-card">
        <div class="qr-card__status">
          <span class="led ${isActive ? 'led--green' : 'led--red'}"></span>
          <span class="qr-card__status-text">
            ${isActive ? `Plan <strong style="color:var(--text);">${membership.membership_name}</strong> — Activo` : 'Sin membresía activa'}
          </span>
        </div>

        <div class="qr-image-wrap">
          <img src="${qrData.qr_image}" alt="QR Code de ${user.first_name}" id="qr-img" />
        </div>

        <div class="qr-info">
          <div class="qr-info__name">${user.first_name} ${user.last_name || ''}</div>
          ${membership && isActive ? `
            <div class="qr-info__expiry">
              Vence el <span class="expiry-date">${fmtDate(membership.end_date)}</span>
              (en ${daysLeft} día${daysLeft !== 1 ? 's' : ''})
            </div>
          ` : membership ? `
            <div class="qr-info__expiry" style="color:#f87171;">Membresía vencida</div>
          ` : ''}
        </div>

        ${visitsBlock}

        <button class="btn btn--ghost btn--full" onclick="window.printQR()">🖨️ Descargar QR</button>
      </div>
    `;

    // Store QR image for download
    window.printQR = function () {
      const img = document.getElementById('qr-img');
      if (!img) return;
      const a = document.createElement('a');
      a.href = img.src;
      a.download = `gym-mgmt-qr-${user.first_name}.png`;
      a.click();
    };

  } catch (err) {
    vc.innerHTML = `<div class="alert alert--error">Error al cargar QR: ${err.message}</div>`;
  }
}
