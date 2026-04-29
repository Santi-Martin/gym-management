/* ==========================================
   VIEW: MY MEMBERSHIP
   ========================================== */

async function renderMyMembership() {
  const user = Auth.getUser();
  const vc = document.getElementById('view-container');
  vc.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;

  try {
    const res = await API.get(`/memberships/user/${user.id}`);
    const data = await API.json(res);
    const active = data.active;
    const history = data.history || [];

    const fmtDate = (d) => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
    const fmtPeso = (n) => `$${Number(n).toLocaleString('es-AR')}`;

    const isActive = active && new Date(active.end_date) > new Date();
    const daysLeft = active ? Math.max(0, Math.ceil((new Date(active.end_date) - new Date()) / (1000*60*60*24))) : 0;

    let activeCard = '';
    if (active && isActive) {
      const used = active.weekly_visits_used || 0;
      activeCard = `
        <div class="card" style="border-color:rgba(34,197,94,0.2);">
          <div class="card__title"><span class="led led--green"></span> Membresía Activa</div>
          <div class="stats-grid">
            <div class="stat-card stat-card--green">
              <div class="stat-card__label">Plan</div>
              <div class="stat-card__value" style="font-size:1.1rem;">${active.membership_name}</div>
              <div class="stat-card__sub">${fmtPeso(active.price)}</div>
            </div>
            <div class="stat-card ${daysLeft <= 5 ? 'stat-card--red' : ''}">
              <div class="stat-card__label">Días restantes</div>
              <div class="stat-card__value">${daysLeft}</div>
              <div class="stat-card__sub">Vence: ${fmtDate(active.end_date)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-card__label">Inicio</div>
              <div class="stat-card__value" style="font-size:1rem;">${fmtDate(active.start_date)}</div>
            </div>
            ${active.visits_per_week ? `
            <div class="stat-card">
              <div class="stat-card__label">Visitas esta semana</div>
              <div class="stat-card__value">${used} / ${active.visits_per_week}</div>
              <div class="stat-card__sub">${active.visits_per_week - used} disponibles</div>
            </div>
            ` : `
            <div class="stat-card">
              <div class="stat-card__label">Acceso</div>
              <div class="stat-card__value">∞</div>
              <div class="stat-card__sub">Ilimitado</div>
            </div>
            `}
          </div>
        </div>
      `;
    } else {
      activeCard = `
        <div class="card" style="border-color:var(--border-red);">
          <div class="card__title"><span class="led led--red"></span> Sin membresía activa</div>
          <p style="color:var(--text-muted);font-size:0.9rem;margin-bottom:16px;">
            ${active ? 'Tu membresía está vencida.' : 'No tenés ninguna membresía asignada.'}
            Contactá con el personal para renovar o adquirir un plan.
          </p>
        </div>
      `;
    }

    let historyTable = '';
    if (history.length > 0) {
      historyTable = `
        <div class="card">
          <div class="card__title">Historial de membresías</div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Plan</th><th>Inicio</th><th>Fin</th><th>Estado</th></tr></thead>
              <tbody>
                ${history.map(h => {
                  const s = h.status === 'active' && new Date(h.end_date) > new Date() ? 'active' : 'expired';
                  return `
                    <tr>
                      <td class="td-strong">${h.membership_name}</td>
                      <td>${fmtDate(h.start_date)}</td>
                      <td>${fmtDate(h.end_date)}</td>
                      <td><span class="badge badge--${s}">${s === 'active' ? 'Activa' : 'Vencida'}</span></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    vc.innerHTML = `
      <div class="view-header">
        <div class="view-title">Mi Membresía</div>
        <div class="view-subtitle">Estado y detalle de tu plan actual</div>
      </div>
      ${activeCard}
      ${historyTable}
    `;
  } catch (err) {
    vc.innerHTML = `<div class="alert alert--error">Error: ${err.message}</div>`;
  }
}
