const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',         // Default XAMPP has no password
  database: 'library_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test the connection on startup
pool.getConnection()
  .then(conn => {
    console.log('✅  MySQL (XAMPP) connected successfully!');
    conn.release();
  })
  .catch(err => {
    console.error('❌  MySQL connection failed:', err.message);
    console.error('👉  Make sure XAMPP is running and you have imported library_db.sql');
  });

module.exports = pool;
