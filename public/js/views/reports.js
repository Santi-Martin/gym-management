/* ==========================================
   VIEW: REPORTS — Admin financial reports
   ========================================== */

let currentPeriod = 'day';

async function renderReports() {
  const vc = document.getElementById('view-container');
  vc.innerHTML = `
    <div class="view-header">
      <div class="view-title">Reportes financieros</div>
      <div class="view-subtitle">Ingresos y estadísticas del gimnasio</div>
    </div>

    <div class="report-period-tabs" id="period-tabs">
      <button class="period-tab" data-period="hour">Última hora</button>
      <button class="period-tab active" data-period="day">Hoy</button>
      <button class="period-tab" data-period="week">7 días</button>
      <button class="period-tab" data-period="month">30 días</button>
      <button class="period-tab" data-period="year">Año</button>
      <button class="period-tab" data-period="custom">Personalizado</button>
    </div>

    <div id="custom-range" style="display:none;margin-bottom:16px;" class="card">
      <div style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap;">
        <div class="form-group" style="margin-bottom:0;flex:1;min-width:140px;">
          <label class="form-label">Desde</label>
          <input type="date" id="range-from" class="form-input" value="${new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0]}" />
        </div>
        <div class="form-group" style="margin-bottom:0;flex:1;min-width:140px;">
          <label class="form-label">Hasta</label>
          <input type="date" id="range-to" class="form-input" value="${new Date().toISOString().split('T')[0]}" />
        </div>
        <button class="btn btn--primary" id="apply-range-btn">Aplicar</button>
      </div>
    </div>

    <div id="report-content">
      <div class="loading-state"><div class="spinner"></div></div>
    </div>
  `;

  // Period tabs
  document.querySelectorAll('.period-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.period-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentPeriod = tab.dataset.period;
      document.getElementById('custom-range').style.display = currentPeriod === 'custom' ? 'block' : 'none';
      if (currentPeriod !== 'custom') loadReportData(currentPeriod);
    });
  });

  document.getElementById('apply-range-btn')?.addEventListener('click', () => {
    const from = document.getElementById('range-from').value;
    const to = document.getElementById('range-to').value;
    if (from && to) loadReportData('custom', from, to);
  });

  loadReportData('day');
}

async function loadReportData(period, from = null, to = null) {
  const content = document.getElementById('report-content');
  content.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Cargando datos...</p></div>`;

  let url = `/reports/income?period=${period}`;
  if (from && to) url = `/reports/income?from=${from}&to=${to}`;

  try {
    const res = await API.get(url);
    if (!res.ok) throw new Error('Error al cargar reporte');
    const data = await API.json(res);
    renderReportContent(data, period);
  } catch (err) {
    content.innerHTML = `<div class="alert alert--error">${err.message}</div>`;
  }
}

function renderReportContent(data, period) {
  const content = document.getElementById('report-content');
  const fmtPeso = (n) => `$${Number(n).toLocaleString('es-AR')}`;
  const fmtDate = (d) => new Date(d).toLocaleDateString('es-AR', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });

  const summary = data.summary;
  const byType = data.by_type || [];
  const topItems = data.top_items || [];
  const breakdown = data.daily_breakdown || [];
  const recentSales = data.recent_sales || [];

  const memIncome = byType.find(t => t.item_type === 'membership')?.total || 0;
  const prodIncome = byType.find(t => t.item_type === 'product')?.total || 0;

  // Build bar chart
  const maxVal = breakdown.reduce((max, b) => Math.max(max, b.total), 1);
  const barChart = breakdown.length > 1 ? `
    <div class="card">
      <div class="card__title">Evolución de ingresos</div>
      <div class="bar-chart" id="bar-chart">
        ${breakdown.map(b => `
          <div class="bar-chart__bar"
            style="height:${Math.max(4, (b.total / maxVal) * 140)}px;"
            data-label="${b.label}: ${fmtPeso(b.total)}"
            title="${b.label}: ${fmtPeso(b.total)}">
          </div>
        `).join('')}
      </div>
      <div class="chart-labels">
        ${breakdown.map(b => `<div class="chart-label">${b.label}</div>`).join('')}
      </div>
    </div>
  ` : '';

  content.innerHTML = `
    <!-- Summary stats -->
    <div class="stats-grid">
      <div class="stat-card stat-card--red">
        <div class="stat-card__icon">💰</div>
        <div class="stat-card__label">Ingresos totales</div>
        <div class="stat-card__value">${fmtPeso(summary.total_income)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__icon">🏋️</div>
        <div class="stat-card__label">Por membresías</div>
        <div class="stat-card__value">${fmtPeso(memIncome)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__icon">🛒</div>
        <div class="stat-card__label">Por productos</div>
        <div class="stat-card__value">${fmtPeso(prodIncome)}</div>
      </div>
      <div class="stat-card stat-card--green">
        <div class="stat-card__icon">👥</div>
        <div class="stat-card__label">Miembros activos</div>
        <div class="stat-card__value">${summary.active_members}</div>
      </div>
    </div>

    ${barChart}

    <!-- Top items -->
    ${topItems.length > 0 ? `
    <div class="card">
      <div class="card__title">Artículos más vendidos</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Artículo</th><th>Tipo</th><th>Unidades</th><th>Ingresos</th></tr></thead>
          <tbody>
            ${topItems.map(item => `
              <tr>
                <td class="td-strong">${item.item_name}</td>
                <td><span class="badge badge--${item.item_type === 'membership' ? 'active' : 'user'}">${item.item_type === 'membership' ? 'Membresía' : 'Producto'}</span></td>
                <td>${item.units_sold}</td>
                <td style="color:var(--red);font-weight:600;">${fmtPeso(item.revenue)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
    ` : ''}

    <!-- Recent sales detail -->
    <div class="card">
      <div class="card__title">Detalle de ventas <span>(${recentSales.length})</span></div>
      ${recentSales.length === 0 ?
        '<div class="empty-state"><div class="empty-state__icon">📊</div><div class="empty-state__title">Sin ventas en el período</div></div>' :
        `<div class="table-wrap">
          <table>
            <thead><tr><th>Artículo</th><th>Precio</th><th>Cant.</th><th>Total</th><th>Vendedor</th><th>Fecha</th></tr></thead>
            <tbody>
              ${recentSales.map(s => `
                <tr>
                  <td class="td-strong">${s.item_name}</td>
                  <td>${fmtPeso(s.item_price)}</td>
                  <td>${s.quantity}</td>
                  <td style="color:var(--red);font-weight:600;">${fmtPeso(s.total)}</td>
                  <td>${s.seller_name || '—'}</td>
                  <td>${fmtDate(s.sold_at)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`
      }
    </div>
  `;
}
