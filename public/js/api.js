/* ==========================================
   API.JS — Fetch wrapper with auth token
   ========================================== */

const API = {
  baseUrl: '/api',

  _getToken() {
    return localStorage.getItem('accessToken');
  },

  async _refreshToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) throw new Error('No refresh token');

    const res = await fetch(`${this.baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });

    if (!res.ok) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      window.location.reload();
      throw new Error('Session expired');
    }

    const data = await res.json();
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    return data.accessToken;
  },

  async request(method, path, body = null, retry = true) {
    const token = this._getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const opts = { method, headers };
    if (body && method !== 'GET') opts.body = JSON.stringify(body);

    const res = await fetch(`${this.baseUrl}${path}`, opts);

    if (res.status === 401 && retry) {
      const data = await res.json().catch(() => ({}));
      if (data.code === 'TOKEN_EXPIRED') {
        try {
          await this._refreshToken();
          return this.request(method, path, body, false);
        } catch {
          return res;
        }
      }
    }

    return res;
  },

  async get(path) {
    return this.request('GET', path);
  },

  async post(path, body) {
    return this.request('POST', path, body);
  },

  async put(path, body) {
    return this.request('PUT', path, body);
  },

  async delete(path) {
    return this.request('DELETE', path);
  },

  async json(res) {
    try {
      return await res.json();
    } catch {
      return {};
    }
  }
};
