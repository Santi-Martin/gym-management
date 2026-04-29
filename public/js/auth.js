/* ==========================================
   AUTH.JS — Auth state management
   ========================================== */

const Auth = {
  getUser() {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  },

  isLoggedIn() {
    return !!localStorage.getItem('accessToken') && !!this.getUser();
  },

  async login(email, password) {
    const res = await API.post('/auth/login', { email, password });
    const data = await API.json(res);
    if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión');
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data.user;
  },

  async logout() {
    const refreshToken = localStorage.getItem('refreshToken');
    try {
      await API.post('/auth/logout', { refreshToken });
    } catch {}
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  },

  hasRole(...roles) {
    const user = this.getUser();
    if (!user) return false;
    return roles.includes(user.role);
  },

  isAdmin() { return this.hasRole('admin'); },
  isEmployee() { return this.hasRole('employee', 'admin'); },
  isUser() { return this.hasRole('user'); }
};
