function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

function validatePassword(password) {
  return typeof password === 'string' && password.length >= 6;
}

function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str.trim().replace(/[<>]/g, '');
}

function validateRequired(fields, body) {
  const missing = [];
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      missing.push(field);
    }
  }
  return missing;
}

function validateUserCreate(req, res, next) {
  const { email, password, first_name, last_name } = req.body;
  const missing = validateRequired(['email', 'password', 'first_name', 'last_name'], req.body);
  if (missing.length > 0) {
    return res.status(400).json({ error: `Campos requeridos: ${missing.join(', ')}` });
  }
  if (!validateEmail(email)) {
    return res.status(400).json({ error: 'Email inválido' });
  }
  if (!validatePassword(password)) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }
  req.body.first_name = sanitizeString(first_name);
  req.body.last_name = sanitizeString(last_name);
  next();
}

function validateLogin(req, res, next) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' });
  }
  if (!validateEmail(email)) {
    return res.status(400).json({ error: 'Email inválido' });
  }
  next();
}

module.exports = { validateUserCreate, validateLogin, sanitizeString, validateEmail };
