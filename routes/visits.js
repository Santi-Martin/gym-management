const express = require('express');
const { pool, getActiveMembership } = require('../database/db');
const { authenticateToken, isEmployeeOrAdmin } = require('../middleware/auth');

const router = express.Router();

function getMondayOfCurrentWeek() {
  const now = new Date();
  const day = now.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}

// POST /api/visits/scan — register entry via QR code (employee+)
router.post('/scan', authenticateToken, isEmployeeOrAdmin, async (req, res) => {
  const { qr_code } = req.body;

  if (!qr_code) {
    return res.status(400).json({ error: 'Código QR requerido' });
  }

  try {
    const userResult = await pool.query(
      'SELECT id, first_name, last_name, email FROM users WHERE qr_code = $1',
      [qr_code.trim()]
    );
    const user = userResult.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'Código QR no válido o usuario no encontrado' });
    }

    const membership = await getActiveMembership(user.id);
    if (!membership) {
      return res.status(403).json({
        error: 'El usuario no tiene membresía activa',
        user: { id: user.id, first_name: user.first_name, last_name: user.last_name },
        allowed: false
      });
    }

    const now = new Date();
    const endDate = new Date(membership.end_date);
    if (now > endDate) {
      await pool.query("UPDATE user_memberships SET status = 'expired' WHERE id = $1", [membership.id]);
      return res.status(403).json({
        error: 'La membresía del usuario está vencida',
        user: { id: user.id, first_name: user.first_name, last_name: user.last_name },
        allowed: false
      });
    }

    let weeklyVisitsUsed = 0;
    let visitsRemaining = null;

    if (membership.visits_per_week) {
      const monday = getMondayOfCurrentWeek();
      const result = await pool.query(`
        SELECT COUNT(*) as count FROM visits
        WHERE user_id = $1 AND user_membership_id = $2
          AND DATE(visited_at) >= DATE($3)
      `, [user.id, membership.id, monday]);
      weeklyVisitsUsed = parseInt(result.rows[0]?.count || 0);
      visitsRemaining = membership.visits_per_week - weeklyVisitsUsed;

      if (weeklyVisitsUsed >= membership.visits_per_week) {
        return res.status(403).json({
          error: `Límite de ${membership.visits_per_week} visitas por semana alcanzado`,
          user: { id: user.id, first_name: user.first_name, last_name: user.last_name },
          membership: membership.membership_name,
          allowed: false,
          weekly_visits_used: weeklyVisitsUsed,
          visits_per_week: membership.visits_per_week
        });
      }
    }

    await pool.query(`
      INSERT INTO visits (user_id, user_membership_id, registered_by, visited_at)
      VALUES ($1, $2, $3, NOW())
    `, [user.id, membership.id, req.user.id]);

    if (membership.visits_per_week) {
      visitsRemaining = visitsRemaining - 1;
    }

    res.json({
      allowed: true,
      message: '¡Ingreso registrado exitosamente!',
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email
      },
      membership: {
        name: membership.membership_name,
        end_date: membership.end_date,
        visits_per_week: membership.visits_per_week,
        weekly_visits_used: membership.visits_per_week ? weeklyVisitsUsed + 1 : null,
        visits_remaining: visitsRemaining
      }
    });
  } catch (err) {
    console.error('Scan error:', err);
    res.status(500).json({ error: 'Error al registrar visita' });
  }
});

// GET /api/visits/today — today's visits (employee+)
router.get('/today', authenticateToken, isEmployeeOrAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT v.id, v.visited_at,
             u.first_name, u.last_name, u.email,
             m.name as membership_name,
             e.first_name as emp_first, e.last_name as emp_last
      FROM visits v
      JOIN users u ON u.id = v.user_id
      LEFT JOIN user_memberships um ON um.id = v.user_membership_id
      LEFT JOIN memberships m ON m.id = um.membership_id
      LEFT JOIN users e ON e.id = v.registered_by
      WHERE DATE(v.visited_at) = CURRENT_DATE
      ORDER BY v.visited_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Today visits error:', err);
    res.status(500).json({ error: 'Error al obtener visitas' });
  }
});

// GET /api/visits/recent — recent visits summary (employee+)
router.get('/recent', authenticateToken, isEmployeeOrAdmin, async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  try {
    const result = await pool.query(`
      SELECT v.id, v.visited_at,
             u.first_name, u.last_name, u.email,
             m.name as membership_name
      FROM visits v
      JOIN users u ON u.id = v.user_id
      LEFT JOIN user_memberships um ON um.id = v.user_membership_id
      LEFT JOIN memberships m ON m.id = um.membership_id
      ORDER BY v.visited_at DESC
      LIMIT $1
    `, [limit]);
    res.json(result.rows);
  } catch (err) {
    console.error('Recent visits error:', err);
    res.status(500).json({ error: 'Error al obtener visitas' });
  }
});

module.exports = router;
