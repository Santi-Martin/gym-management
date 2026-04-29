const express = require('express');
const { pool } = require('../database/db');
const { authenticateToken, isEmployeeOrAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/products — list active products (authenticated)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE active = TRUE ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error('List products error:', err);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

// POST /api/sales — register a sale (employee+)
router.post('/', authenticateToken, isEmployeeOrAdmin, async (req, res) => {
  const { items, client_id } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Se requiere al menos un artículo' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ids = [];

    for (const item of items) {
      const total = (item.item_price || 0) * (item.quantity || 1);
      const result = await client.query(`
        INSERT INTO sales (sold_by, item_type, item_name, item_price, quantity, total, client_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [
        req.user.id,
        item.item_type || 'product',
        item.item_name,
        item.item_price || 0,
        item.quantity || 1,
        total,
        client_id || null
      ]);
      ids.push(result.rows[0].id);
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Venta registrada', sale_ids: ids });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Sale error:', err);
    res.status(500).json({ error: 'Error al registrar venta' });
  } finally {
    client.release();
  }
});

// GET /api/sales — list sales (employee+)
router.get('/list', authenticateToken, isEmployeeOrAdmin, async (req, res) => {
  const { from, to, limit: lim } = req.query;
  const limit = parseInt(lim) || 50;

  let query = `
    SELECT s.*,
           u.first_name as seller_first, u.last_name as seller_last,
           c.first_name as client_first, c.last_name as client_last
    FROM sales s
    JOIN users u ON u.id = s.sold_by
    LEFT JOIN users c ON c.id = s.client_id
    WHERE 1=1
  `;
  const params = [];
  let paramIndex = 1;

  if (from) { query += ` AND DATE(s.sold_at) >= DATE($${paramIndex++})`; params.push(from); }
  if (to) { query += ` AND DATE(s.sold_at) <= DATE($${paramIndex++})`; params.push(to); }

  query += ` ORDER BY s.sold_at DESC LIMIT $${paramIndex}`;
  params.push(limit);

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('List sales error:', err);
    res.status(500).json({ error: 'Error al obtener ventas' });
  }
});

module.exports = router;
