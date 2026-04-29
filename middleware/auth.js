require('dotenv').config();
const jwt = require('jsonwebtoken');
const { pool } = require('../database/db');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'Token de acceso requerido' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado', code: 'TOKEN_EXPIRED' });
    }
    return res.status(403).json({ error: 'Token inválido' });
  }

  pool.query(
    'SELECT id, email, role, first_name, last_name FROM users WHERE id = $1',
    [decoded.userId]
  )
    .then(result => {
      const dbUser = result.rows[0];
      if (!dbUser) {
        return res.status(401).json({ error: 'Usuario no encontrado' });
      }
      req.user = dbUser;
      next();
    })
    .catch(err => {
      console.error('Auth middleware DB error:', err);
      res.status(500).json({ error: 'Error de autenticación' });
    });
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acceso denegado: permisos insuficientes' });
    }
    next();
  };
}

// Shortcut middlewares
const isAdmin = requireRole('admin');
const isEmployeeOrAdmin = requireRole('employee', 'admin');
const isAuthenticated = authenticateToken;

module.exports = { authenticateToken, requireRole, isAdmin, isEmployeeOrAdmin, isAuthenticated };
