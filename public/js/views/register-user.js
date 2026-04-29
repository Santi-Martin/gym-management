/* ==========================================
   VIEW: REGISTER USER — Employee creates user
   ========================================== */

async function renderRegisterUser() {
  const vc = document.getElementById('view-container');
  vc.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;

  // Load memberships
  const memRes = await API.get('/memberships');
  const memberships = memRes.ok ? await API.json(memRes) : [];

  const fmtPeso = (n) => `$${Number(n).toLocaleString('es-AR')}`;

  vc.innerHTML = `
    <div style="max-width: 600px; margin: 0 auto;">
      <div class="view-header">
        <div class="view-title">Nuevo cliente</div>
        <div class="view-subtitle">Registrá un nuevo usuario y asignale una membresía</div>
      </div>

      <div class="card">
        <div id="reg-alert" style="display:none;"></div>
        <form id="register-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="reg-firstname">Nombre *</label>
              <input type="text" id="reg-firstname" class="form-input" placeholder="Juan" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="reg-lastname">Apellido *</label>
              <input type="text" id="reg-lastname" class="form-input" placeholder="Pérez" required />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="reg-email">Email *</label>
            <input type="email" id="reg-email" class="form-input" placeholder="juan@email.com" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="reg-password">Contraseña *</label>
            <div class="input-wrapper">
              <input type="password" id="reg-password" class="form-input" placeholder="Mínimo 6 caracteres" required minlength="6" />
              <button type="button" class="input-eye" id="reg-toggle-pwd">👁</button>
            </div>
            <div class="form-note">El usuario podrá cambiarla después desde su perfil.</div>
          </div>

          <div class="form-group" style="margin-bottom:28px;">
            <label class="form-label" for="reg-membership">Membresía (opcional)</label>
            <select id="reg-membership" class="form-select">
              <option value="">Sin membresía por ahora</option>
              ${memberships.map(m => `
                <option value="${m.id}">${m.name} — ${fmtPeso(m.price)} (${m.duration_days} días)</option>
              `).join('')}
            </select>
            <div class="form-note">Si asignás una membresía, comenzará desde hoy.</div>
          </div>

          <div style="display:flex;gap:12px;flex-wrap:wrap;">
            <button type="submit" class="btn btn--primary" id="reg-submit-btn">
              <span id="reg-submit-text">Crear cliente</span>
              <div class="btn-spinner" id="reg-spinner" style="display:none;"></div>
            </button>
            <button type="reset" class="btn btn--ghost" id="reg-reset-btn">Limpiar</button>
          </div>
        </form>
      </div>

      <div id="reg-success-card" style="display:none;" class="card" style="border-color:rgba(34,197,94,0.25);">
        <div class="card__title" style="color:var(--green);">✓ Usuario creado exitosamente</div>
        <div id="reg-success-info"></div>
        <div style="margin-top:20px;display:flex;gap:12px;">
          <button class="btn btn--primary" id="reg-another-btn">Registrar otro</button>
          <button class="btn btn--ghost" id="reg-view-qr-btn">Ver QR del usuario</button>
        </div>
      </div>
    </div>
  `;

  let lastCreatedUser = null;

  document.getElementById('reg-toggle-pwd').addEventListener('click', () => {
    const inp = document.getElementById('reg-password');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });

  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const alertEl = document.getElementById('reg-alert');
    alertEl.style.display = 'none';

    const body = {
      first_name: document.getElementById('reg-firstname').value.trim(),
      last_name: document.getElementById('reg-lastname').value.trim(),
      email: document.getElementById('reg-email').value.trim(),
      password: document.getElementById('reg-password').value,
      membership_id: document.getElementById('reg-membership').value || null
    };

    const btn = document.getElementById('reg-submit-btn');
    btn.disabled = true;
    document.getElementById('reg-spinner').style.display = 'block';
    document.getElementById('reg-submit-text').style.display = 'none';

    try {
      const res = await API.post('/users', body);
      const data = await API.json(res);
      if (!res.ok) throw new Error(data.error || 'Error al crear usuario');

      lastCreatedUser = data;
      document.getElementById('reg-success-card').style.display = 'block';
      document.getElementById('reg-success-card').scrollIntoView({ behavior: 'smooth' });
      document.getElementById('reg-success-info').innerHTML = `
        <p style="color:var(--text-muted);">
          <strong style="color:var(--text);">${data.first_name} ${data.last_name}</strong> fue registrado correctamente.<br/>
          Email: <strong style="color:var(--text);">${data.email}</strong>
        </p>
      `;
      document.getElementById('register-form').reset();
      Toast.success('Usuario creado exitosamente');
    } catch (err) {
      alertEl.className = 'alert alert--error';
      alertEl.textContent = err.message;
      alertEl.style.display = 'block';
    } finally {
      btn.disabled = false;
      document.getElementById('reg-spinner').style.display = 'none';
      document.getElementById('reg-submit-text').style.display = 'inline';
    }
  });

  document.getElementById('reg-another-btn')?.addEventListener('click', () => {
    document.getElementById('reg-success-card').style.display = 'none';
  });
}
