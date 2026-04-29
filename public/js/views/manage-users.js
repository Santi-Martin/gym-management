/* ==========================================
   VIEW: MANAGE USERS — Employee manages clients
   ========================================== */

let manageUsersData = [];
let manageMemberships = [];

async function renderManageUsers() {
  const vc = document.getElementById('view-container');
  vc.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;

  const [usersRes, memRes] = await Promise.all([
    API.get('/users'),
    API.get('/memberships')
  ]);

  manageUsersData = usersRes.ok ? await API.json(usersRes) : [];
  manageMemberships = memRes.ok ? await API.json(memRes) : [];

  renderUserTable(manageUsersData);
}

function renderUserTable(users) {
  const vc = document.getElementById('view-container');
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-AR', { day:'2-digit', month:'short', year:'numeric' }) : '—';
  const fmtPeso = (n) => `$${Number(n).toLocaleString('es-AR')}`;

  vc.innerHTML = `
    <div class="view-header">
      <div class="view-header__row">
        <div>
          <div class="view-title">Gestión de clientes</div>
          <div class="view-subtitle">${users.length} usuarios registrados</div>
        </div>
        <button class="btn btn--primary" id="manage-add-btn">+ Nuevo cliente</button>
      </div>
    </div>

    <div class="search-bar">
      <input type="text" class="search-input" id="user-search" placeholder="🔍 Buscar por nombre o email..." />
      <select class="form-select" id="user-filter-status" style="width:auto;min-width:160px;">
        <option value="">Todos</option>
        <option value="active">Con membresía activa</option>
        <option value="expired">Sin membresía activa</option>
      </select>
    </div>

    <div class="card" style="padding:0;overflow:hidden;">
      <div class="table-wrap">
        <table id="users-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Membresía</th>
              <th>Vencimiento</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="users-tbody">
            ${users.length === 0 ? `<tr><td colspan="6" class="table-empty">No hay usuarios registrados</td></tr>` : ''}
            ${users.map(u => {
              const isActive = u.membership_status === 'active' && u.membership_end && new Date(u.membership_end) > new Date();
              return `
                <tr data-id="${u.id}">
                  <td class="td-strong">${u.first_name} ${u.last_name}</td>
                  <td>${u.email}</td>
                  <td>${u.membership_name || '—'}</td>
                  <td>${fmtDate(u.membership_end)}</td>
                  <td><span class="badge badge--${isActive ? 'active' : 'expired'}">${isActive ? 'Activa' : 'Sin plan'}</span></td>
                  <td>
                    <div style="display:flex;gap:6px;">
                      <button class="btn btn--sm btn--ghost edit-user-btn" data-id="${u.id}">Editar</button>
                      <button class="btn btn--sm btn--secondary assign-mem-btn" data-id="${u.id}">Membresía</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Search
  document.getElementById('user-search').addEventListener('input', filterUsers);
  document.getElementById('user-filter-status').addEventListener('change', filterUsers);
  document.getElementById('manage-add-btn').addEventListener('click', () => App.navigate('register-user'));

  // Edit buttons
  document.querySelectorAll('.edit-user-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditUserModal(parseInt(btn.dataset.id)));
  });

  // Assign membership buttons
  document.querySelectorAll('.assign-mem-btn').forEach(btn => {
    btn.addEventListener('click', () => openAssignMembershipModal(parseInt(btn.dataset.id)));
  });
}

function filterUsers() {
  const search = document.getElementById('user-search').value.toLowerCase();
  const filter = document.getElementById('user-filter-status').value;

  let filtered = manageUsersData.filter(u => {
    const name = `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase();
    const matchesSearch = name.includes(search);
    const isActive = u.membership_status === 'active' && u.membership_end && new Date(u.membership_end) > new Date();
    const matchesFilter = !filter || (filter === 'active' ? isActive : !isActive);
    return matchesSearch && matchesFilter;
  });

  renderUserTable(filtered);
}

function openEditUserModal(userId) {
  const user = manageUsersData.find(u => u.id === userId);
  if (!user) return;

  Modal.show(
    `Editar — ${user.first_name} ${user.last_name}`,
    `
      <div id="edit-user-alert" style="display:none;"></div>
      <form id="edit-user-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Nombre</label>
            <input type="text" id="edit-first" class="form-input" value="${user.first_name}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Apellido</label>
            <input type="text" id="edit-last" class="form-input" value="${user.last_name || ''}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" id="edit-email" class="form-input" value="${user.email}" required />
        </div>
        <div class="form-group">
          <label class="form-label">Teléfono</label>
          <input type="tel" id="edit-phone" class="form-input" value="${user.phone || ''}" />
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Nueva contraseña (dejar vacío para no cambiar)</label>
          <input type="password" id="edit-password" class="form-input" placeholder="Nueva contraseña..." minlength="6" />
        </div>
      </form>
    `,
    `<button class="btn btn--ghost" id="edit-cancel-btn">Cancelar</button>
     <button class="btn btn--primary" id="edit-save-btn">Guardar cambios</button>`
  );

  document.getElementById('edit-cancel-btn').onclick = () => Modal.hide();
  document.getElementById('edit-save-btn').onclick = async () => {
    const alertEl = document.getElementById('edit-user-alert');
    const body = {
      first_name: document.getElementById('edit-first').value,
      last_name: document.getElementById('edit-last').value,
      email: document.getElementById('edit-email').value,
      phone: document.getElementById('edit-phone').value || null,
    };
    const pwd = document.getElementById('edit-password').value;
    if (pwd) body.password = pwd;

    try {
      const res = await API.put(`/users/${userId}`, body);
      const data = await API.json(res);
      if (!res.ok) throw new Error(data.error);
      Toast.success('Usuario actualizado');
      Modal.hide();
      renderManageUsers();
    } catch (err) {
      alertEl.className = 'alert alert--error';
      alertEl.textContent = err.message;
      alertEl.style.display = 'block';
    }
  };
}

function openAssignMembershipModal(userId) {
  const user = manageUsersData.find(u => u.id === userId);
  if (!user) return;
  const fmtPeso = (n) => `$${Number(n).toLocaleString('es-AR')}`;

  Modal.show(
    `Membresía — ${user.first_name} ${user.last_name}`,
    `
      <div id="mem-assign-alert" style="display:none;"></div>
      ${user.membership_name ? `
        <div class="alert alert--info" style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
          <span class="led led--${user.membership_status === 'active' && new Date(user.membership_end) > new Date() ? 'green' : 'red'}"></span>
          Plan actual: <strong>${user.membership_name}</strong>
          — Vence: ${user.membership_end ? new Date(user.membership_end).toLocaleDateString('es-AR') : '—'}
        </div>
      ` : `<div class="alert alert--warning" style="margin-bottom:16px;">Sin membresía activa</div>`}
      <form id="assign-mem-form">
        <div class="form-group">
          <label class="form-label">Membresía</label>
          <select id="mem-select" class="form-select" required>
            <option value="">Seleccionar membresía...</option>
            ${manageMemberships.map(m => `<option value="${m.id}">${m.name} — ${fmtPeso(m.price)} (${m.duration_days} días)</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Fecha de inicio</label>
          <input type="date" id="mem-start" class="form-input" value="${new Date().toISOString().split('T')[0]}" />
          <div class="form-note">Por defecto empieza hoy</div>
        </div>
      </form>
    `,
    `<button class="btn btn--ghost" onclick="Modal.hide()">Cancelar</button>
     <button class="btn btn--primary" id="assign-mem-save">Asignar membresía</button>`
  );

  document.getElementById('assign-mem-save').onclick = async () => {
    const alertEl = document.getElementById('mem-assign-alert');
    const membershipId = document.getElementById('mem-select').value;
    const startDate = document.getElementById('mem-start').value;

    if (!membershipId) {
      alertEl.className = 'alert alert--error';
      alertEl.textContent = 'Seleccioná una membresía';
      alertEl.style.display = 'block';
      return;
    }

    try {
      const res = await API.post('/memberships/assign', {
        user_id: userId,
        membership_id: parseInt(membershipId),
        start_date: startDate
      });
      const data = await API.json(res);
      if (!res.ok) throw new Error(data.error);
      Toast.success('Membresía asignada exitosamente');
      Modal.hide();
      renderManageUsers();
    } catch (err) {
      alertEl.className = 'alert alert--error';
      alertEl.textContent = err.message;
      alertEl.style.display = 'block';
    }
  };
}
