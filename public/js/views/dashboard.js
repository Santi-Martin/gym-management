/* ==========================================
   VIEW: DASHBOARD — User/Employee/Admin home
   ========================================== */

async function renderDashboard() {
  const user = Auth.getUser();
  const vc = document.getElementById('view-container');

  vc.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Cargando...</p></div>`;

  try {
    // Fetch user data with membership
    const meRes = await API.get('/users/me');
    const me = await API.json(meRes);

    // Fetch today's visits if staff
    let todayVisits = [];
    if (Auth.isEmployee()) {
      const tvRes = await API.get('/visits/today');
      if (tvRes.ok) todayVisits = await API.json(tvRes);
    }

    // Fetch income summary if admin
    let income = null;
    if (Auth.isAdmin()) {
      const incRes = await API.get('/reports/income?period=day');
      if (incRes.ok) income = await API.json(incRes);
    }

    const membership = me.activeMembership;
    const isActive = membership && new Date(membership.end_date) > new Date();
    const daysLeft = membership ? Math.max(0, Math.ceil((new Date(membership.end_date) - new Date()) / (1000 * 60 * 60 * 24))) : 0;

    // Format date
    const fmtDate = (d) => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });

    let staffStats = '';
    if (Auth.isEmployee()) {
      staffStats = `
        <div class="stat-card">
          <div class="stat-card__icon">📅</div>
          <div class="stat-card__label">Ingresos hoy</div>
          <div class="stat-card__value">${todayVisits.length}</div>
          <div class="stat-card__sub">Visitas registradas</div>
        </div>
      `;
    }

    let adminStats = '';
    if (Auth.isAdmin() && income) {
      adminStats = `
        <div class="stat-card stat-card--red">
          <div class="stat-card__icon">💰</div>
          <div class="stat-card__label">Ingresos hoy</div>
          <div class="stat-card__value">$${(income.summary.total_income || 0).toLocaleString('es-AR')}</div>
          <div class="stat-card__sub">Recaudado hoy</div>
        </div>
        <div class="stat-card stat-card--green">
          <div class="stat-card__icon">👥</div>
          <div class="stat-card__label">Miembros activos</div>
          <div class="stat-card__value">${income.summary.active_members}</div>
          <div class="stat-card__sub">Con membresía vigente</div>
        </div>
      `;
    }

    let membershipCard = '';
    if (user.role === 'user') {
      if (membership && isActive) {
        membershipCard = `
          <div class="card">
            <div class="card__title">
              <span class="led led--green"></span>
              Mi Membresía — Activa
            </div>
            <div class="stats-grid" style="margin-bottom:0;">
              <div class="stat-card">
                <div class="stat-card__label">Plan</div>
                <div class="stat-card__value" style="font-size:1.2rem;">${membership.membership_name}</div>
              </div>
              <div class="stat-card ${daysLeft <= 3 ? 'stat-card--red' : 'stat-card--green'}">
                <div class="stat-card__label">Días restantes</div>
                <div class="stat-card__value">${daysLeft}</div>
                <div class="stat-card__sub">Vence: ${fmtDate(membership.end_date)}</div>
              </div>
              ${membership.visits_per_week ? `
              <div class="stat-card">
                <div class="stat-card__label">Visitas esta semana</div>
                <div class="stat-card__value">${membership.weekly_visits_used || 0} / ${membership.visits_per_week}</div>
                <div class="stat-card__sub">visitas utilizadas</div>
              </div>
              ` : ''}
            </div>
          </div>
        `;
      } else {
        membershipCard = `
          <div class="card" style="border-color:rgba(239,68,68,0.25);">
            <div class="card__title"><span class="led led--red"></span> Sin membresía activa</div>
            <p style="color:var(--text-muted);font-size:0.9rem;">Contactá con el personal del gimnasio para adquirir una membresía.</p>
          </div>
        `;
      }
    }

    let todayTable = '';
    if (Auth.isEmployee() && todayVisits.length > 0) {
      todayTable = `
        <div class="card">
          <div class="card__title">Ingresos de hoy <span>(${todayVisits.length})</span></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Nombre</th><th>Membresía</th><th>Hora</th></tr></thead>
              <tbody>
                ${todayVisits.slice(0, 8).map(v => `
                  <tr>
                    <td class="td-strong">${v.first_name} ${v.last_name}</td>
                    <td>${v.membership_name || '—'}</td>
                    <td>${new Date(v.visited_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    vc.innerHTML = `
      <div class="view-header">
        <div class="view-title">Bienvenido, ${me.first_name} 👋</div>
        <div class="view-subtitle">${new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
      </div>

      <div class="stats-grid">
        ${user.role === 'user' ? `
          <div class="stat-card">
            <div class="stat-card__icon">🏋️</div>
            <div class="stat-card__label">Mi membresía</div>
            <div class="stat-card__value" style="font-size:1rem;">${isActive ? membership.membership_name : 'Sin plan'}</div>
            <div class="stat-card__sub">${isActive ? `Vence en ${daysLeft} días` : 'Consultá al personal'}</div>
          </div>
        ` : ''}
        ${staffStats}
        ${adminStats}
      </div>

      ${membershipCard}
      ${todayTable}

      ${user.role === 'user' ? `
        <div class="card" style="text-align:center;">
          <p style="color:var(--text-muted);margin-bottom:16px;font-size:0.9rem;">Accedé rápidamente a tu código QR para ingresar al gimnasio.</p>
          <button class="btn btn--primary" id="dash-qr-btn">Ver mi QR de acceso</button>
        </div>
      ` : ''}
    `;

    document.getElementById('dash-qr-btn')?.addEventListener('click', () => App.navigate('my-qr'));

  } catch (err) {
    vc.innerHTML = `<div class="alert alert--error">Error al cargar el panel: ${err.message}</div>`;
  }
}
