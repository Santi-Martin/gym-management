const express = require('express');
const { pool, getActiveMembership } = require('../database/db');
const { authenticateToken, isEmployeeOrAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/memberships — list all membership types (public)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM memberships ORDER BY price ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('List memberships error:', err);
    res.status(500).json({ error: 'Error al obtener membresías' });
  }
});

// GET /api/memberships/user/:userId — get active membership for a user
router.get('/user/:userId', authenticateToken, async (req, res) => {
  const targetId = parseInt(req.params.userId);
  if (req.user.role === 'user' && req.user.id !== targetId) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }

  try {
    const active = await getActiveMembership(targetId);

    let weeklyVisits = 0;
    if (active && active.visits_per_week) {
      const monday = getMondayOfCurrentWeek();
      const result = await pool.query(`
        SELECT COUNT(*) as count FROM visits
        WHERE user_id = $1 AND user_membership_id = $2
          AND DATE(visited_at) >= DATE($3)
      `, [targetId, active.id, monday]);
      weeklyVisits = parseInt(result.rows[0]?.count || 0);
    }

    const historyResult = await pool.query(`
      SELECT um.*, m.name as membership_name, m.price, m.duration_days, m.visits_per_week
      FROM user_memberships um
      JOIN memberships m ON m.id = um.membership_id
      WHERE um.user_id = $1
      ORDER BY um.created_at DESC
    `, [targetId]);

    res.json({
      active: active ? { ...active, weekly_visits_used: weeklyVisits } : null,
      history: historyResult.rows
    });
  } catch (err) {
    console.error('Get user membership error:', err);
    res.status(500).json({ error: 'Error al obtener membresía' });
  }
});

function getMondayOfCurrentWeek() {
  const now = new Date();
  const day = now.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}

// POST /api/memberships/assign — assign a membership to a user (employee+)
router.post('/assign', authenticateToken, isEmployeeOrAdmin, async (req, res) => {
  const { user_id, membership_id, start_date } = req.body;

  if (!user_id || !membership_id) {
    return res.status(400).json({ error: 'user_id y membership_id son requeridos' });
  }

  try {
    const userResult = await pool.query("SELECT id FROM users WHERE id = $1 AND role = 'user'", [user_id]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    const memResult = await pool.query('SELECT * FROM memberships WHERE id = $1', [membership_id]);
    const membership = memResult.rows[0];
    if (!membership) return res.status(404).json({ error: 'Membresía no encontrada' });

    // Expire any existing active membership
    await pool.query(`
      UPDATE user_memberships SET status = 'expired'
      WHERE user_id = $1 AND status = 'active'
    `, [user_id]);

    const start = start_date ? new Date(start_date) : new Date();
    const end = new Date(start.getTime() + membership.duration_days * 24 * 60 * 60 * 1000);

    const insertResult = await pool.query(`
      INSERT INTO user_memberships (user_id, membership_id, start_date, end_date, status, created_by)
      VALUES ($1, $2, $3, $4, 'active', $5)
      RETURNING id
    `, [user_id, membership_id, start.toISOString(), end.toISOString(), req.user.id]);

    await pool.query(`
      INSERT INTO sales (sold_by, item_type, item_name, item_price, quantity, total, client_id)
      VALUES ($1, 'membership', $2, $3, 1, $4, $5)
    `, [req.user.id, membership.name, membership.price, membership.price, user_id]);

    const newMem = await pool.query(`
      SELECT um.*, m.name as membership_name, m.price, m.duration_days, m.visits_per_week
      FROM user_memberships um
      JOIN memberships m ON m.id = um.membership_id
      WHERE um.id = $1
    `, [insertResult.rows[0].id]);

    res.status(201).json(newMem.rows[0]);
  } catch (err) {
    console.error('Assign membership error:', err);
    res.status(500).json({ error: 'Error al asignar membresía' });
  }
});

// PUT /api/memberships/update/:id — update end_date or status (employee+)
router.put('/update/:id', authenticateToken, isEmployeeOrAdmin, async (req, res) => {
  const { id } = req.params;
  const { end_date, status, membership_id } = req.body;

  try {
    const existingResult = await pool.query('SELECT * FROM user_memberships WHERE id = $1', [id]);
    if (existingResult.rows.length === 0) return res.status(404).json({ error: 'Membresía de usuario no encontrada' });

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (end_date) {
      updates.push(`end_date = $${paramIndex++}`);
      params.push(new Date(end_date).toISOString());
    }
    if (status && ['active', 'expired', 'cancelled'].includes(status)) {
      updates.push(`status = $${paramIndex++}`);
      params.push(status);
    }
    if (membership_id) {
      const memResult = await pool.query('SELECT * FROM memberships WHERE id = $1', [membership_id]);
      if (memResult.rows.length === 0) return res.status(404).json({ error: 'Membresía no encontrada' });
      updates.push(`membership_id = $${paramIndex++}`);
      params.push(membership_id);
    }

    if (updates.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });

    params.push(id);
    await pool.query(`UPDATE user_memberships SET ${updates.join(', ')} WHERE id = $${paramIndex}`, params);

    const updated = await pool.query(`
      SELECT um.*, m.name as membership_name, m.price, m.duration_days, m.visits_per_week
      FROM user_memberships um
      JOIN memberships m ON m.id = um.membership_id
      WHERE um.id = $1
    `, [id]);

    res.json(updated.rows[0]);
  } catch (err) {
    console.error('Update membership error:', err);
    res.status(500).json({ error: 'Error al actualizar membresía' });
  }
});

module.exports = router;
