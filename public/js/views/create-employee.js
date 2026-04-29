/* ==========================================
   VIEW: CREATE EMPLOYEE — Admin only
   ========================================== */

async function renderCreateEmployee() {
  const vc = document.getElementById('view-container');

  const empRes = await API.get('/reports/employees');
  const employees = empRes.ok ? await API.json(empRes) : [];
  const fmtDate = (d) => new Date(d).toLocaleDateString('es-AR', { day:'2-digit', month:'long', year:'numeric' });

  vc.innerHTML = `
    <div class="view-header">
      <div class="view-title">Empleados</div>
      <div class="view-subtitle">Gestión de cuentas del personal</div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start;" id="emp-grid">
      <!-- Create form -->
      <div class="card">
        <div class="card__title">Crear empleado</div>
        <div id="emp-alert" style="display:none;"></div>
        <form id="create-emp-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="emp-firstname">Nombre *</label>
              <input type="text" id="emp-firstname" class="form-input" required placeholder="María" />
            </div>
            <div class="form-group">
              <label class="form-label" for="emp-lastname">Apellido *</label>
              <input type="text" id="emp-lastname" class="form-input" required placeholder="González" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="emp-email">Email *</label>
            <input type="email" id="emp-email" class="form-input" required placeholder="maria@gymmanagement.com" />
          </div>
          <div class="form-group">
            <label class="form-label" for="emp-phone">Teléfono</label>
            <input type="tel" id="emp-phone" class="form-input" placeholder="+54 11 1234-5678" />
          </div>
          <div class="form-group" style="margin-bottom:24px;">
            <label class="form-label" for="emp-password">Contraseña *</label>
            <div class="input-wrapper">
              <input type="password" id="emp-password" class="form-input" required minlength="6" placeholder="Mínimo 6 caracteres" />
              <button type="button" class="input-eye" id="emp-toggle-pwd">👁</button>
            </div>
          </div>
          <button type="submit" class="btn btn--primary" id="emp-submit-btn">
            <span id="emp-submit-text">Crear empleado</span>
            <div class="btn-spinner" id="emp-spinner" style="display:none;"></div>
          </button>
        </form>
      </div>

      <!-- Employee list -->
      <div class="card">
        <div class="card__title">Personal activo <span>(${employees.length})</span></div>
        ${employees.length === 0 ?
          '<div class="empty-state"><div class="empty-state__icon">👤</div><div class="empty-state__title">Sin empleados registrados</div></div>' :
          `<div style="display:flex;flex-direction:column;gap:8px;">
            ${employees.map(e => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--dark-3);border-radius:var(--radius);border:1px solid var(--border);">
                <div>
                  <div style="font-weight:600;color:var(--text);">${e.first_name} ${e.last_name}</div>
                  <div style="font-size:0.78rem;color:var(--text-dim);">${e.email}</div>
                  <div style="font-size:0.72rem;color:var(--text-dim);margin-top:2px;">Desde: ${fmtDate(e.created_at)}</div>
                </div>
                <span class="badge badge--employee">Empleado</span>
              </div>
            `).join('')}
          </div>`
        }
      </div>
    </div>
  `;

  if (window.innerWidth < 768) {
    document.getElementById('emp-grid').style.gridTemplateColumns = '1fr';
  }

  document.getElementById('emp-toggle-pwd').addEventListener('click', () => {
    const inp = document.getElementById('emp-password');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });

  document.getElementById('create-emp-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const alertEl = document.getElementById('emp-alert');
    alertEl.style.display = 'none';

    const body = {
      first_name: document.getElementById('emp-firstname').value.trim(),
      last_name: document.getElementById('emp-lastname').value.trim(),
      email: document.getElementById('emp-email').value.trim(),
      phone: document.getElementById('emp-phone').value.trim() || null,
      password: document.getElementById('emp-password').value
    };

    const btn = document.getElementById('emp-submit-btn');
    btn.disabled = true;
    document.getElementById('emp-spinner').style.display = 'block';
    document.getElementById('emp-submit-text').style.display = 'none';

    try {
      const res = await API.post('/reports/employees', body);
      const data = await API.json(res);
      if (!res.ok) throw new Error(data.error || 'Error al crear empleado');
      Toast.success(`Empleado ${data.first_name} creado exitosamente`);
      renderCreateEmployee();
    } catch (err) {
      alertEl.className = 'alert alert--error';
      alertEl.textContent = err.message;
      alertEl.style.display = 'block';
      btn.disabled = false;
      document.getElementById('emp-spinner').style.display = 'none';
      document.getElementById('emp-submit-text').style.display = 'inline';
    }
  });
}
