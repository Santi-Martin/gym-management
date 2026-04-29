/* ==========================================
   APP.JS — Main SPA Router & Controller
   ========================================== */

const App = {
  currentView: null,

  // Route definitions per role
  routes: {
    user: [
      { id: 'dashboard', label: 'Panel Principal', icon: '⊞', render: renderDashboard },
      { id: 'my-qr', label: 'Mi QR de Acceso', icon: '▣', render: renderMyQr },
      { id: 'my-membership', label: 'Mi Membresía', icon: '🏋️', render: renderMyMembership },
      { id: 'my-account', label: 'Mi Cuenta', icon: '◎', render: renderMyAccount },
    ],
    employee: [
      { id: 'dashboard', label: 'Panel Principal', icon: '⊞', render: renderDashboard },
      { section: 'Clientes' },
      { id: 'scan-entry', label: 'Escanear Ingreso', icon: '⬡', render: renderScanEntry },
      { id: 'register-user', label: 'Nuevo Cliente', icon: '+', render: renderRegisterUser },
      { id: 'manage-users', label: 'Gestionar Clientes', icon: '◈', render: renderManageUsers },
      { section: 'Ventas' },
      { id: 'sales', label: 'Registrar Venta', icon: '🛒', render: renderSales },
      { section: 'Mi Cuenta' },
      { id: 'my-account', label: 'Mi Cuenta', icon: '◎', render: renderMyAccount },
    ],
    admin: [
      { id: 'dashboard', label: 'Panel Principal', icon: '⊞', render: renderDashboard },
      { section: 'Clientes' },
      { id: 'scan-entry', label: 'Escanear Ingreso', icon: '⬡', render: renderScanEntry },
      { id: 'register-user', label: 'Nuevo Cliente', icon: '+', render: renderRegisterUser },
      { id: 'manage-users', label: 'Gestionar Clientes', icon: '◈', render: renderManageUsers },
      { section: 'Ventas & Reportes' },
      { id: 'sales', label: 'Registrar Venta', icon: '🛒', render: renderSales },
      { id: 'reports', label: 'Reportes Financieros', icon: '📊', render: renderReports },
      { section: 'Administración' },
      { id: 'create-employee', label: 'Gestionar Empleados', icon: '👤', render: renderCreateEmployee },
      { section: 'Mi Cuenta' },
      { id: 'my-account', label: 'Mi Cuenta', icon: '◎', render: renderMyAccount },
    ]
  },

  roleLabels: {
    admin: 'Administrador',
    employee: 'Empleado',
    user: 'Socio'
  },

  init() {
    if (Auth.isLoggedIn()) {
      this.showApp();
    } else {
      this.showLogin();
    }
  },

  showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-shell').style.display = 'none';
    this.setupLoginForm();
  },

  showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-shell').style.display = 'grid';
    this.setupSidebar();
    this.setupTopbar();
    this.navigate(this.getInitialView());
  },

  getInitialView() {
    const hash = window.location.hash.replace('#/', '');
    return hash || 'dashboard';
  },

  setupLoginForm() {
    // Toggle password
    document.getElementById('toggle-password').addEventListener('click', () => {
      const inp = document.getElementById('login-password');
      inp.type = inp.type === 'password' ? 'text' : 'password';
    });

    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('login-error');
      errEl.style.display = 'none';

      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      const btn = document.getElementById('login-submit-btn');
      const text = document.getElementById('login-btn-text');
      const spinner = document.getElementById('login-spinner');

      btn.disabled = true;
      text.style.display = 'none';
      spinner.style.display = 'block';

      try {
        await Auth.login(email, password);
        this.showApp();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
      } finally {
        btn.disabled = false;
        text.style.display = 'inline';
        spinner.style.display = 'none';
      }
    });
  },

  setupSidebar() {
    const user = Auth.getUser();
    const role = user.role;
    const routes = this.routes[role] || this.routes.user;

    // Logo click to landing page
    const logoText = document.querySelector('.sidebar__logo-text');
    if (logoText) {
      logoText.style.cursor = 'pointer';
      logoText.addEventListener('click', () => {
        window.location.href = '/';
      });
    }

    // Update user info
    document.getElementById('sidebar-user-name').textContent = `${user.first_name} ${user.last_name || ''}`.trim();
    document.getElementById('sidebar-user-role').textContent = this.roleLabels[role] || role;
    document.getElementById('sidebar-avatar').textContent = user.first_name[0].toUpperCase();
    document.getElementById('topbar-avatar').textContent = user.first_name[0].toUpperCase();

    // Build nav
    const nav = document.getElementById('sidebar-nav');
    nav.innerHTML = '';

    routes.forEach(route => {
      if (route.section) {
        const sec = document.createElement('div');
        sec.className = 'nav-section';
        sec.innerHTML = `<div class="nav-section__label">${route.section}</div>`;
        nav.appendChild(sec);
      } else {
        const btn = document.createElement('button');
        btn.className = 'nav-item';
        btn.dataset.view = route.id;
        btn.innerHTML = `<span class="nav-item__icon">${route.icon}</span>${route.label}`;
        btn.addEventListener('click', () => {
          this.navigate(route.id);
          this.closeMobileSidebar();
        });
        nav.appendChild(btn);
      }
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => this.logout());
  },

  setupTopbar() {
    const burger = document.getElementById('topbar-burger');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const close = document.getElementById('sidebar-close');

    burger.addEventListener('click', () => {
      sidebar.classList.add('open');
      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
    });

    overlay.addEventListener('click', () => this.closeMobileSidebar());
    close.addEventListener('click', () => this.closeMobileSidebar());

    // Navigation to my-account on profile click
    const topbarUser = document.querySelector('.topbar__user');
    if (topbarUser) {
      topbarUser.style.cursor = 'pointer';
      topbarUser.addEventListener('click', () => {
        this.navigate('my-account');
      });
    }
  },

  closeMobileSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('open');
    document.body.style.overflow = '';
  },

  navigate(viewId) {
    const user = Auth.getUser();
    const role = user.role;
    const routes = this.routes[role] || this.routes.user;
    const route = routes.find(r => r.id === viewId);

    if (!route) {
      this.navigate('dashboard');
      return;
    }

    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewId);
    });

    // Update topbar title
    document.getElementById('topbar-title').textContent = route.label;

    // Update hash
    window.history.replaceState(null, '', `/app#/${viewId}`);

    // Render view
    this.currentView = viewId;
    try {
      route.render();
    } catch (err) {
      document.getElementById('view-container').innerHTML =
        `<div class="alert alert--error">Error al cargar la vista: ${err.message}</div>`;
    }
  },

  async logout() {
    Modal.confirm(
      'Cerrar sesión',
      '¿Estás seguro que querés cerrar sesión?',
      async () => {
        await Auth.logout();
        window.location.reload();
      },
      'Cerrar sesión',
      true
    );
  }
};

// Initialize app on load
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
