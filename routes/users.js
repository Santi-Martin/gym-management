const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const { pool, getActiveMembership } = require('../database/db');
const { authenticateToken, isEmployeeOrAdmin, isAdmin } = require('../middleware/auth');
const { validateUserCreate, sanitizeString, validateEmail } = require('../middleware/validators');

const router = express.Router();

// GET /api/users — list all users (employee+)
router.get('/', authenticateToken, isEmployeeOrAdmin, async (req, res) => {
  const { search } = req.query;
  let query = `
    SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.role, u.qr_code, u.created_at,
           um.status as membership_status, um.end_date as membership_end,
           m.name as membership_name
    FROM users u
    LEFT JOIN user_memberships um ON um.user_id = u.id
      AND um.status = 'active' AND um.end_date > NOW()
      AND um.id = (
        SELECT id FROM user_memberships
        WHERE user_id = u.id AND status = 'active' AND end_date > NOW()
        ORDER BY created_at DESC LIMIT 1
      )
    LEFT JOIN memberships m ON m.id = um.membership_id
    WHERE u.role = 'user'
  `;
  const params = [];

  if (search) {
    query += ` AND (u.email ILIKE $1 OR u.first_name ILIKE $1 OR u.last_name ILIKE $1)`;
    params.push(`%${search}%`);
  }

  query += ' ORDER BY u.created_at DESC';

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// GET /api/users/me — current user profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, first_name, last_name, phone, role, qr_code, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const membership = await getActiveMembership(req.user.id);
    res.json({ ...user, activeMembership: membership || null });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

// GET /api/users/:id — get a specific user (employee+) or self
router.get('/:id', authenticateToken, async (req, res) => {
  const targetId = parseInt(req.params.id);
  if (req.user.role === 'user' && req.user.id !== targetId) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }

  try {
    const result = await pool.query(
      'SELECT id, email, first_name, last_name, phone, role, qr_code, created_at FROM users WHERE id = $1',
      [targetId]
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const membership = await getActiveMembership(targetId);
    res.json({ ...user, activeMembership: membership || null });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
});

// POST /api/users — create a new user (employee+)
router.post('/', authenticateToken, isEmployeeOrAdmin, validateUserCreate, async (req, res) => {
  const { email, password, first_name, last_name, phone, membership_id } = req.body;

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const qrCode = uuidv4();

    const userResult = await pool.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, phone, role, qr_code)
      VALUES ($1, $2, $3, $4, $5, 'user', $6)
      RETURNING id
    `, [email.toLowerCase().trim(), passwordHash, first_name, sanitizeString(last_name), phone || null, qrCode]);

    const userId = userResult.rows[0].id;

    if (membership_id) {
      const memResult = await pool.query('SELECT * FROM memberships WHERE id = $1', [membership_id]);
      const membership = memResult.rows[0];
      if (membership) {
        const startDate = new Date();
        const endDate = new Date(startDate.getTime() + membership.duration_days * 24 * 60 * 60 * 1000);
        await pool.query(`
          INSERT INTO user_memberships (user_id, membership_id, start_date, end_date, status, created_by)
          VALUES ($1, $2, $3, $4, 'active', $5)
        `, [userId, membership_id, startDate.toISOString(), endDate.toISOString(), req.user.id]);

        await pool.query(`
          INSERT INTO sales (sold_by, item_type, item_name, item_price, quantity, total, client_id)
          VALUES ($1, 'membership', $2, $3, 1, $4, $5)
        `, [req.user.id, membership.name, membership.price, membership.price, userId]);
      }
    }

    const newUser = await pool.query(
      'SELECT id, email, first_name, last_name, phone, role, qr_code, created_at FROM users WHERE id = $1',
      [userId]
    );
    res.status(201).json(newUser.rows[0]);
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// PUT /api/users/:id — update user (employee+ or self for password)
router.put('/:id', authenticateToken, async (req, res) => {
  const targetId = parseInt(req.params.id);
  const isStaff = ['admin', 'employee'].includes(req.user.role);

  if (!isStaff && req.user.id !== targetId) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [targetId]);
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const { email, password, first_name, last_name, phone } = req.body;
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (isStaff) {
      if (email && validateEmail(email)) {
        const emailConflict = await pool.query(
          'SELECT id FROM users WHERE email = $1 AND id != $2',
          [email.toLowerCase().trim(), targetId]
        );
        if (emailConflict.rows.length > 0) return res.status(409).json({ error: 'Email ya en uso' });
        updates.push(`email = $${paramIndex++}`);
        params.push(email.toLowerCase().trim());
      }
      if (first_name) { updates.push(`first_name = $${paramIndex++}`); params.push(sanitizeString(first_name)); }
      if (last_name !== undefined) { updates.push(`last_name = $${paramIndex++}`); params.push(sanitizeString(last_name)); }
      if (phone !== undefined) { updates.push(`phone = $${paramIndex++}`); params.push(phone); }
    }

    if (password) {
      if (password.length < 6) return res.status(400).json({ error: 'Contraseña mínimo 6 caracteres' });
      const hash = await bcrypt.hash(password, 12);
      updates.push(`password_hash = $${paramIndex++}`);
      params.push(hash);
    }

    if (updates.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });

    updates.push(`updated_at = NOW()`);
    params.push(targetId);

    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`, params);

    const updated = await pool.query(
      'SELECT id, email, first_name, last_name, phone, role, qr_code, created_at, updated_at FROM users WHERE id = $1',
      [targetId]
    );
    res.json(updated.rows[0]);
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// GET /api/users/:id/qr — get QR code as data URL
router.get('/:id/qr', authenticateToken, async (req, res) => {
  const targetId = parseInt(req.params.id);
  if (req.user.role === 'user' && req.user.id !== targetId) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }

  try {
    const result = await pool.query('SELECT qr_code FROM users WHERE id = $1', [targetId]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const qrDataUrl = await QRCode.toDataURL(user.qr_code, {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' }
    });
    res.json({ qr_code: user.qr_code, qr_image: qrDataUrl });
  } catch (err) {
    res.status(500).json({ error: 'Error generando QR' });
  }
});

// GET /api/users/:id/visits — visit history
router.get('/:id/visits', authenticateToken, async (req, res) => {
  const targetId = parseInt(req.params.id);
  if (req.user.role === 'user' && req.user.id !== targetId) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }

  try {
    const result = await pool.query(`
      SELECT v.*, u.first_name as registered_by_name, u.last_name as registered_by_lastname
      FROM visits v
      LEFT JOIN users u ON u.id = v.registered_by
      WHERE v.user_id = $1
      ORDER BY v.visited_at DESC
      LIMIT 50
    `, [targetId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Get visits error:', err);
    res.status(500).json({ error: 'Error al obtener visitas' });
  }
});

module.exports = router;
