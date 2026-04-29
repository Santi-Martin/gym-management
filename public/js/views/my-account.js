/* ==========================================
   VIEW: MY ACCOUNT — Edit profile + Change password
   ========================================== */

function renderMyAccount() {
  const user = Auth.getUser();
  const isAdmin = user.role === 'admin';
  const vc = document.getElementById('view-container');

  vc.innerHTML = `
    <div style="max-width: 960px; margin: 0 auto;">
      <div class="view-header">
        <div class="view-title">Mi Cuenta</div>
        <div class="view-subtitle">Administrá tu información personal</div>
      </div>

      <div style="display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; align-items: start; margin-bottom: 20px;">
        <div class="card" style="flex: 1; min-width: 320px; max-width: 500px; margin-bottom: 0;">
          <div class="card__title">Información personal</div>
          <div style="display:grid;gap:12px;margin-bottom:0;">
            <div>
              <div class="form-label">Nombre</div>
              <div style="color:var(--text);font-weight:500;padding:10px 0;" id="info-name">${user.first_name} ${user.last_name || ''}</div>
            </div>
            <div>
              <div class="form-label">Email</div>
              <div style="color:var(--text);padding:10px 0;" id="info-email">${user.email}</div>
            </div>
            <div>
              <div class="form-label">Rol</div>
              <div style="padding:10px 0;"><span class="badge badge--${user.role}">${user.role === 'admin' ? 'Administrador' : user.role === 'employee' ? 'Empleado' : 'Socio'}</span></div>
            </div>
          </div>
        </div>

        ${isAdmin ? `
        <div class="card" style="flex: 1; min-width: 320px; max-width: 500px; margin-bottom: 0;">
          <div class="card__title">✏️ Editar información personal</div>
          <div id="profile-alert" style="display:none;"></div>
          <form id="edit-profile-form">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="edit-first-name">Nombre</label>
                <input type="text" id="edit-first-name" class="form-input"
                  value="${user.first_name || ''}" placeholder="Tu nombre" required />
              </div>
              <div class="form-group">
                <label class="form-label" for="edit-last-name">Apellido</label>
                <input type="text" id="edit-last-name" class="form-input"
                  value="${user.last_name || ''}" placeholder="Tu apellido" />
              </div>
            </div>
            <div class="form-group" style="margin-bottom:24px;">
              <label class="form-label" for="edit-email">Correo electrónico</label>
              <input type="email" id="edit-email" class="form-input"
                value="${user.email || ''}" placeholder="tu@correo.com" required />
            </div>
            <button type="submit" class="btn btn--primary" id="save-profile-btn">
              <span id="save-profile-text">Guardar cambios</span>
              <div class="btn-spinner" id="save-profile-spinner" style="display:none;"></div>
            </button>
          </form>
        </div>
        ` : ''}
      </div>

      <div style="display: flex; justify-content: center;">
        <div class="card" style="width: 100%; max-width: 500px;">
          <div class="card__title">🔒 Cambiar contraseña</div>
          <div id="account-alert" style="display:none;"></div>
          <form id="change-password-form">
            <div class="form-group">
              <label class="form-label" for="current-password">Contraseña actual</label>
              <div class="input-wrapper">
                <input type="password" id="current-password" class="form-input" placeholder="Tu contraseña actual" required />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" for="new-password">Nueva contraseña</label>
              <input type="password" id="new-password" class="form-input" placeholder="Mínimo 6 caracteres" required minlength="6" />
            </div>
            <div class="form-group" style="margin-bottom:24px;">
              <label class="form-label" for="confirm-password">Confirmar contraseña</label>
              <input type="password" id="confirm-password" class="form-input" placeholder="Repite la nueva contraseña" required />
            </div>
            <button type="submit" class="btn btn--primary" id="change-pwd-btn">
              <span id="change-pwd-text">Cambiar contraseña</span>
              <div class="btn-spinner" id="change-pwd-spinner" style="display:none;"></div>
            </button>
          </form>
        </div>
      </div>
    </div>
  `;

  /* ─── Editar perfil (solo admin) ─── */
  if (isAdmin) {
    document.getElementById('edit-profile-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const alertEl = document.getElementById('profile-alert');
      const firstName = document.getElementById('edit-first-name').value.trim();
      const lastName = document.getElementById('edit-last-name').value.trim();
      const email = document.getElementById('edit-email').value.trim();

      alertEl.style.display = 'none';

      if (!firstName || !email) {
        alertEl.className = 'alert alert--error';
        alertEl.textContent = 'El nombre y el correo son obligatorios';
        alertEl.style.display = 'block';
        return;
      }

      const btn = document.getElementById('save-profile-btn');
      const spinner = document.getElementById('save-profile-spinner');
      const text = document.getElementById('save-profile-text');
      btn.disabled = true;
      spinner.style.display = 'block';
      text.style.display = 'none';

      try {
        const res = await API.put(`/users/${user.id}`, { first_name: firstName, last_name: lastName, email });
        const data = await API.json(res);
        if (!res.ok) throw new Error(data.error || 'Error al guardar cambios');

        // Actualizar datos locales en Auth
        const updatedUser = { ...Auth.getUser(), first_name: data.first_name, last_name: data.last_name, email: data.email };
        localStorage.setItem('user', JSON.stringify(updatedUser));

        // Refrescar los valores mostrados en el card superior
        document.getElementById('info-name').textContent = `${data.first_name} ${data.last_name || ''}`.trim();
        document.getElementById('info-email').textContent = data.email;

        // Refrescar sidebar si está disponible
        if (typeof renderShell === 'function') renderShell();

        alertEl.className = 'alert alert--success';
        alertEl.textContent = '✓ Información actualizada correctamente';
        alertEl.style.display = 'block';
        Toast.success('Perfil actualizado');
      } catch (err) {
        alertEl.className = 'alert alert--error';
        alertEl.textContent = err.message;
        alertEl.style.display = 'block';
      } finally {
        btn.disabled = false;
        spinner.style.display = 'none';
        text.style.display = 'inline';
      }
    });
  }

  /* ─── Cambiar contraseña ─── */
  document.getElementById('change-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const alertEl = document.getElementById('account-alert');
    const newPwd = document.getElementById('new-password').value;
    const confirmPwd = document.getElementById('confirm-password').value;
    const currentPwd = document.getElementById('current-password').value;

    alertEl.style.display = 'none';

    if (newPwd !== confirmPwd) {
      alertEl.className = 'alert alert--error';
      alertEl.textContent = 'Las contraseñas no coinciden';
      alertEl.style.display = 'block';
      return;
    }

    const btn = document.getElementById('change-pwd-btn');
    const spinner = document.getElementById('change-pwd-spinner');
    const text = document.getElementById('change-pwd-text');
    btn.disabled = true;
    spinner.style.display = 'block';
    text.style.display = 'none';

    try {
      // Verify current password by attempting login
      const currentEmail = Auth.getUser().email;
      const verifyRes = await API.post('/auth/login', { email: currentEmail, password: currentPwd });
      if (!verifyRes.ok) {
        throw new Error('Contraseña actual incorrecta');
      }

      const res = await API.put(`/users/${user.id}`, { password: newPwd });
      const data = await API.json(res);
      if (!res.ok) throw new Error(data.error || 'Error al cambiar contraseña');

      alertEl.className = 'alert alert--success';
      alertEl.textContent = '✓ Contraseña cambiada exitosamente';
      alertEl.style.display = 'block';
      document.getElementById('change-password-form').reset();
      Toast.success('Contraseña actualizada');
    } catch (err) {
      alertEl.className = 'alert alert--error';
      alertEl.textContent = err.message;
      alertEl.style.display = 'block';
    } finally {
      btn.disabled = false;
      spinner.style.display = 'none';
      text.style.display = 'inline';
    }
  });
}
