const express = require('express');
const { pool } = require('../database/db');
const { authenticateToken, isAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/reports/income?period=day|week|month|year&from=&to=
router.get('/income', authenticateToken, isAdmin, async (req, res) => {
  const { period, from, to } = req.query;

  let dateFilter = '';
  const params = [];
  let paramIndex = 1;

  if (from && to) {
    dateFilter = `AND DATE(s.sold_at) BETWEEN DATE($${paramIndex++}) AND DATE($${paramIndex++})`;
    params.push(from, to);
  } else {
    switch (period) {
      case 'hour':
        dateFilter = `AND s.sold_at >= NOW() - INTERVAL '1 hour'`;
        break;
      case 'day':
        dateFilter = `AND DATE(s.sold_at) = CURRENT_DATE`;
        break;
      case 'week':
        dateFilter = `AND s.sold_at >= NOW() - INTERVAL '7 days'`;
        break;
      case 'month':
        dateFilter = `AND s.sold_at >= NOW() - INTERVAL '30 days'`;
        break;
      case 'year':
        dateFilter = `AND s.sold_at >= NOW() - INTERVAL '365 days'`;
        break;
      default:
        dateFilter = `AND DATE(s.sold_at) = CURRENT_DATE`;
    }
  }

  try {
    const totalRow = await pool.query(
      `SELECT COALESCE(SUM(s.total), 0) as total FROM sales s WHERE 1=1 ${dateFilter}`,
      params
    );

    const byType = await pool.query(
      `SELECT s.item_type, COALESCE(SUM(s.total), 0) as total, COUNT(*) as count
       FROM sales s WHERE 1=1 ${dateFilter}
       GROUP BY s.item_type`,
      params
    );

    const topItems = await pool.query(
      `SELECT s.item_name, s.item_type, SUM(s.quantity) as units_sold, SUM(s.total) as revenue
       FROM sales s WHERE 1=1 ${dateFilter}
       GROUP BY s.item_name, s.item_type
       ORDER BY revenue DESC
       LIMIT 10`,
      params
    );

    // Daily breakdown for charts
    let groupBy = `DATE(s.sold_at)`;
    let labelFormat = `DATE(s.sold_at)::text`;

    if (period === 'year' || (from && to && daysBetween(from, to) > 90)) {
      groupBy = `TO_CHAR(s.sold_at, 'YYYY-MM')`;
      labelFormat = `TO_CHAR(s.sold_at, 'YYYY-MM')`;
    } else if (period === 'hour') {
      groupBy = `TO_CHAR(s.sold_at, 'HH24:00')`;
      labelFormat = `TO_CHAR(s.sold_at, 'HH24:00')`;
    }

    const dailyBreakdown = await pool.query(
      `SELECT ${labelFormat} as label, COALESCE(SUM(s.total), 0) as total, COUNT(*) as sales_count
       FROM sales s WHERE 1=1 ${dateFilter}
       GROUP BY ${groupBy}
       ORDER BY label ASC`,
      params
    );

    const recentSales = await pool.query(
      `SELECT s.*, u.first_name || ' ' || u.last_name as seller_name,
              c.first_name || ' ' || c.last_name as client_name
       FROM sales s
       JOIN users u ON u.id = s.sold_by
       LEFT JOIN users c ON c.id = s.client_id
       WHERE 1=1 ${dateFilter}
       ORDER BY s.sold_at DESC
       LIMIT 100`,
      params
    );

    const activeMembersRow = await pool.query(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM user_memberships
      WHERE status = 'active' AND end_date > NOW()
    `);

    // New members interval
    const intervalMap = {
      year: '365 days',
      month: '30 days',
      week: '7 days',
      hour: '1 hour',
    };
    const intervalStr = intervalMap[period] || '1 day';

    const newMembersRow = await pool.query(
      `SELECT COUNT(*) as count FROM users
       WHERE role = 'user' AND created_at >= NOW() - INTERVAL '${intervalStr}'`
    );

    res.json({
      summary: {
        total_income: parseInt(totalRow.rows[0].total),
        by_type: byType.rows,
        active_members: parseInt(activeMembersRow.rows[0].count),
        new_members: parseInt(newMembersRow.rows[0].count)
      },
      top_items: topItems.rows,
      daily_breakdown: dailyBreakdown.rows,
      recent_sales: recentSales.rows
    });
  } catch (err) {
    console.error('Reports income error:', err);
    res.status(500).json({ error: 'Error al obtener reportes' });
  }
});

function daysBetween(from, to) {
  const d1 = new Date(from);
  const d2 = new Date(to);
  return Math.abs((d2 - d1) / (1000 * 60 * 60 * 24));
}

// GET /api/reports/employees — employee list
router.get('/employees', authenticateToken, isAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, email, first_name, last_name, phone, created_at
      FROM users WHERE role = 'employee'
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Employees error:', err);
    res.status(500).json({ error: 'Error al obtener empleados' });
  }
});

// POST /api/reports/employees — create employee (admin only)
router.post('/employees', authenticateToken, isAdmin, async (req, res) => {
  const bcrypt = require('bcryptjs');
  const { v4: uuidv4 } = require('uuid');
  const { email, password, first_name, last_name, phone } = req.body;

  if (!email || !password || !first_name || !last_name) {
    return res.status(400).json({ error: 'email, password, first_name, last_name son requeridos' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Email ya en uso' });

    const hash = await bcrypt.hash(password, 12);
    const qrCode = uuidv4();

    const result = await pool.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, phone, role, qr_code)
      VALUES ($1, $2, $3, $4, $5, 'employee', $6)
      RETURNING id
    `, [email.toLowerCase().trim(), hash, first_name.trim(), last_name.trim(), phone || null, qrCode]);

    const newEmployee = await pool.query(
      'SELECT id, email, first_name, last_name, phone, role, created_at FROM users WHERE id = $1',
      [result.rows[0].id]
    );
    res.status(201).json(newEmployee.rows[0]);
  } catch (err) {
    console.error('Create employee error:', err);
    res.status(500).json({ error: 'Error al crear empleado' });
  }
});

module.exports = router;
