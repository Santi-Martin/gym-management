require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { pool, initializeDatabase } = require('./db');

async function seed() {
  await initializeDatabase();

  console.log('🌱 Seeding database...');

  // -- MEMBERSHIPS --
  const membershipsCount = await pool.query('SELECT COUNT(*) as c FROM memberships');
  if (parseInt(membershipsCount.rows[0].c) === 0) {
    await pool.query(`
      INSERT INTO memberships (name, price, duration_days, visits_per_week, description) VALUES
      ('Pase Libre (30 días)', 40000, 30, NULL, 'Acceso ilimitado durante 30 días corridos.'),
      ('3 Veces por Semana', 34000, 30, 3, 'Hasta 3 visitas por semana durante 30 días.'),
      ('15 Días Seguidos', 30000, 15, NULL, 'Acceso ilimitado durante 15 días corridos.'),
      ('1 Semana', 20000, 7, NULL, 'Acceso ilimitado durante 7 días corridos.')
    `);
    console.log('✅ Memberships seeded');
  } else {
    console.log('⏭️  Memberships already exist, skipping');
  }

  // -- PRODUCTS --
  const productsCount = await pool.query('SELECT COUNT(*) as c FROM products');
  if (parseInt(productsCount.rows[0].c) === 0) {
    await pool.query(`
      INSERT INTO products (name, price) VALUES
      ('Agua 500ml', 1500),
      ('Agua 1500ml', 2500),
      ('Monster', 3000),
      ('Whey Protein', 35000),
      ('Creatina', 25000)
    `);
    console.log('✅ Products seeded');
  } else {
    console.log('⏭️  Products already exist, skipping');
  }

  // -- ADMIN USER --
  const adminExists = await pool.query("SELECT id FROM users WHERE email = 'admin@gymmanagement.com'");
  if (adminExists.rows.length === 0) {
    const passwordHash = await bcrypt.hash('admin123', 12);
    await pool.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, role, qr_code)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, ['admin@gymmanagement.com', passwordHash, 'Admin', 'System', 'admin', uuidv4()]);
    console.log('✅ Admin user created: admin@gymmanagement.com / admin123');
  } else {
    console.log('⏭️  Admin user already exists, skipping');
  }

  console.log('✅ Seed complete!');
  await pool.end();
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
