const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Helper ─────────────────────────────────────────────
async function recordActivity(bookId, bookTitle, userName, action) {
  await db.execute(
    'INSERT INTO activity (bookId, bookTitle, userName, action) VALUES (?, ?, ?, ?)',
    [bookId, bookTitle, userName, action]
  );
}

// ─── AUTH ────────────────────────────────────────────────
app.post('/api/signup', async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: 'Missing fields' });
  const userRole = role === 'admin' ? 'admin' : 'user';
  try {
    const [result] = await db.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, password, userRole]
    );
    res.json({ message: 'User created successfully', user: { id: result.insertId, name, email, role: userRole } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Email already exists' });
    res.status(500).json({ message: 'Database error', error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await db.execute(
      'SELECT id, name, email, role FROM users WHERE email = ? AND password = ?',
      [email, password]
    );
    if (rows.length === 0) return res.status(401).json({ message: 'Invalid credentials' });
    res.json({ message: 'Login successful', user: rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Database error' });
  }
});

// Google OAuth — auto register or login
app.post('/api/google-auth', async (req, res) => {
  const { name, email, googleId } = req.body;
  if (!email) return res.status(400).json({ message: 'Invalid Google credentials' });
  try {
    // Check if user already exists
    const [existing] = await db.execute('SELECT id, name, email, role FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.json({ message: 'Login successful', user: existing[0] });
    }
    // Auto-register
    const [result] = await db.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name || email.split('@')[0], email, `google_${googleId}`, 'user']
    );
    res.json({ message: 'Account created', user: { id: result.insertId, name: name || email, email, role: 'user' } });
  } catch (err) {
    res.status(500).json({ message: 'Database error', error: err.message });
  }
});

// ─── BOOKS ──────────────────────────────────────────────
app.get('/api/books', async (req, res) => {
  const { query = '', genre, available, sortBy, sortOrder, page = 1, limit = 20 } = req.query;
  let sql = 'SELECT * FROM books WHERE 1=1';
  let params = [];

  if (query) {
    sql += ' AND (LOWER(title) LIKE ? OR LOWER(author) LIKE ?)';
    params.push(`%${query.toLowerCase()}%`, `%${query.toLowerCase()}%`);
  }
  if (genre) { sql += ' AND genre = ?'; params.push(genre); }
  if (available !== undefined && available !== '') {
    sql += ' AND available = ?'; params.push(available === 'true' ? 1 : 0);
  }

  const allowedSort = ['title', 'author', 'year', 'genre'];
  if (sortBy && allowedSort.includes(sortBy)) {
    sql += ` ORDER BY ${sortBy} ${sortOrder === 'desc' ? 'DESC' : 'ASC'}`;
  }

  try {
    const [rows] = await db.execute(sql, params);
    const p = parseInt(page), l = parseInt(limit);
    const paginated = rows.slice((p - 1) * l, p * l);
    res.json({ total: rows.length, page: p, limit: l, results: paginated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/inventory', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM books ORDER BY id ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── AI RECOMMENDATIONS ──────────────────────────────────
app.get('/api/recommendations', async (req, res) => {
  const { userName } = req.query;
  try {
    let recommendations = [];
    let basis = 'popular';

    if (userName) {
      // 1. Get genres from books the user has ever borrowed (via activity log)
      const [genreRows] = await db.execute(
        `SELECT DISTINCT b.genre
         FROM activity a
         INNER JOIN books b ON b.id = a.bookId
         WHERE a.userName = ?
           AND a.bookId IS NOT NULL
           AND b.genre IS NOT NULL
           AND b.genre != 'Unknown'`,
        [userName]
      );
      const genres = genreRows.map(r => r.genre).filter(Boolean);

      // 2. IDs of books already borrowed by this user (exclude from recs)
      const [borrowedRows] = await db.execute(
        `SELECT DISTINCT bookId FROM activity WHERE userName = ? AND bookId IS NOT NULL`,
        [userName]
      );
      const excludeIds = borrowedRows.map(r => r.bookId);

      if (genres.length > 0) {
        const gmPlaceholders = genres.map(() => '?').join(',');
        let sql = `SELECT * FROM books WHERE available = 1 AND genre IN (${gmPlaceholders})`;
        const params = [...genres];
        if (excludeIds.length > 0) {
          sql += ` AND id NOT IN (${excludeIds.map(() => '?').join(',')})`;
          params.push(...excludeIds);
        }
        sql += ' ORDER BY id DESC LIMIT 4';
        const [recs] = await db.execute(sql, params);
        if (recs.length > 0) {
          recommendations = recs;
          basis = 'history';
        }
      }
    }

    // If fewer than 4, top up with other available books
    if (recommendations.length < 4) {
      const existingIds = recommendations.map(r => r.id);
      const [borrowedRows] = recommendations.length === 0 && userName
        ? await db.execute(`SELECT DISTINCT bookId FROM activity WHERE userName = ? AND bookId IS NOT NULL`, [userName])
        : [[]] ;
      const skipIds = [...existingIds, ...borrowedRows.map(r => r.bookId)].filter(Boolean);
      const needed = 4 - recommendations.length;
      let topSql = 'SELECT * FROM books WHERE available = 1';
      const topParams = [];
      if (skipIds.length > 0) {
        topSql += ` AND id NOT IN (${skipIds.map(() => '?').join(',')})`;
        topParams.push(...skipIds);
      }
      topSql += ` ORDER BY id DESC LIMIT ${needed}`;
      const [topUp] = await db.execute(topSql, topParams);
      recommendations = [...recommendations, ...topUp];
      if (recommendations.length === 0) {
        const [any] = await db.execute('SELECT * FROM books ORDER BY id DESC LIMIT 4');
        recommendations = any;
      }
      if (basis !== 'history') basis = 'popular';
    }

    res.json({ recommendations, basis });

  } catch (err) {
    console.error('Recommendations error:', err.message);
    // Even on error, return popular books
    try {
      const [fallback] = await db.execute(
        'SELECT * FROM books WHERE available = 1 ORDER BY id DESC LIMIT 4'
      );
      res.json({ recommendations: fallback, basis: 'popular' });
    } catch (e2) {
      res.status(500).json({ recommendations: [], basis: 'popular', error: err.message });
    }
  }
});


app.post('/api/addBook', async (req, res) => {
  const { title, author, genre, year, isbn, quantity } = req.body;
  if (!title || !author) return res.status(400).json({ message: 'Title and Author required' });
  try {
    const [result] = await db.execute(
      'INSERT INTO books (title, author, genre, year, isbn, quantity, available) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [title, author, genre || 'Unknown', year || new Date().getFullYear(), isbn || null, quantity || 1]
    );
    res.json({ message: 'Book added successfully', book: { id: result.insertId, title, author } });
  } catch (err) {
    res.status(500).json({ message: 'Error adding book', error: err.message });
  }
});

app.put('/api/books/:id', async (req, res) => {
  const { title, author, genre, year, isbn, quantity, available } = req.body;
  const bookId = parseInt(req.params.id);
  const fields = [];
  const values = [];

  if (title !== undefined)     { fields.push('title = ?');     values.push(title); }
  if (author !== undefined)    { fields.push('author = ?');    values.push(author); }
  if (genre !== undefined)     { fields.push('genre = ?');     values.push(genre); }
  if (year !== undefined)      { fields.push('year = ?');      values.push(year); }
  if (isbn !== undefined)      { fields.push('isbn = ?');      values.push(isbn); }
  if (quantity !== undefined)  { fields.push('quantity = ?');  values.push(quantity); }
  if (available !== undefined) { fields.push('available = ?'); values.push(available ? 1 : 0); }

  if (fields.length === 0) return res.json({ message: 'No changes provided' });
  values.push(bookId);

  try {
    await db.execute(`UPDATE books SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json({ message: 'Book updated successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Update failed', error: err.message });
  }
});

app.delete('/api/books/:id', async (req, res) => {
  const bookId = parseInt(req.params.id);
  try {
    const [result] = await db.execute('DELETE FROM books WHERE id = ?', [bookId]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Book not found' });
    res.json({ message: 'Book deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Delete failed', error: err.message });
  }
});

// ─── BORROW / RETURN ────────────────────────────────────
app.post('/api/borrow', async (req, res) => {
  const { bookId, userName } = req.body;
  try {
    const [rows] = await db.execute('SELECT * FROM books WHERE id = ?', [bookId]);
    if (rows.length === 0) return res.status(404).json({ message: 'Book not found' });
    const book = rows[0];
    if (!book.available) return res.status(400).json({ message: 'Book is currently unavailable' });
    await db.execute('UPDATE books SET available = 0, borrowedBy = ? WHERE id = ?', [userName, bookId]);
    await recordActivity(bookId, book.title, userName, 'borrowed');
    res.json({ message: `"${book.title}" borrowed successfully!` });
  } catch (err) {
    res.status(500).json({ message: 'Error', error: err.message });
  }
});

app.post('/api/return', async (req, res) => {
  const { bookId, userName } = req.body;
  try {
    const [rows] = await db.execute('SELECT * FROM books WHERE id = ?', [bookId]);
    if (rows.length === 0) return res.status(404).json({ message: 'Book not found' });
    const book = rows[0];
    if (book.available) return res.status(400).json({ message: 'Book is not borrowed' });
    if (book.borrowedBy !== userName) return res.status(400).json({ message: 'This book was not borrowed by you' });
    await db.execute('UPDATE books SET available = 1, borrowedBy = NULL WHERE id = ?', [bookId]);
    await recordActivity(bookId, book.title, userName, 'returned');
    res.json({ message: `"${book.title}" returned successfully!` });
  } catch (err) {
    res.status(500).json({ message: 'Error', error: err.message });
  }
});

// ─── MISC ────────────────────────────────────────────────
app.get('/api/activity', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM activity ORDER BY date DESC LIMIT 10');
    res.json(rows);
  } catch (err) {
    res.json([]);
  }
});



app.get('/api/borrowedBooks', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM books WHERE available = 0 AND borrowedBy IS NOT NULL');
    res.json(rows);
  } catch (err) {
    res.json([]);
  }
});

app.get('/api/myBorrowings', async (req, res) => {
  const { userName } = req.query;
  if (!userName) return res.status(400).json({ message: 'userName required' });
  try {
    const [rows] = await db.execute('SELECT * FROM books WHERE borrowedBy = ?', [userName]);
    res.json(rows);
  } catch (err) {
    res.json([]);
  }
});

// ─── ADMIN-SPECIFIC ENDPOINTS ────────────────────────────
app.get('/api/admin/stats', async (req, res) => {
  try {
    const [[{ total }]] = await db.execute('SELECT COUNT(*) as total FROM books');
    const [[{ issued }]] = await db.execute('SELECT COUNT(*) as issued FROM books WHERE available = 0');
    const [[{ available }]] = await db.execute('SELECT COUNT(*) as available FROM books WHERE available = 1');
    const [[{ users }]] = await db.execute('SELECT COUNT(*) as users FROM users WHERE role = "user"');
    const [[{ genres }]] = await db.execute('SELECT COUNT(DISTINCT genre) as genres FROM books');
    res.json({ total, issued, available, users, genres });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/genre-breakdown', async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT genre, COUNT(*) as count FROM books GROUP BY genre ORDER BY count DESC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/borrow-history', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT DATE(date) as day, COUNT(*) as count
      FROM activity
      WHERE action = 'borrowed' AND date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(date)
      ORDER BY day ASC
    `);
    res.json(rows);
  } catch (err) {
    res.json([]);
  }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/users/:id', async (req, res) => {
  const userId = parseInt(req.params.id);
  try {
    await db.execute('DELETE FROM users WHERE id = ? AND role != "admin"', [userId]);
    res.json({ message: 'User removed successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error removing user' });
  }
});

app.get('/api/admin/all-borrowed', async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, title, author, genre, borrowedBy FROM books WHERE available = 0 ORDER BY title'
    );
    res.json(rows);
  } catch (err) {
    res.json([]);
  }
});

// Force return a book (admin only)
app.post('/api/admin/force-return', async (req, res) => {
  const { bookId } = req.body;
  try {
    const [rows] = await db.execute('SELECT * FROM books WHERE id = ?', [bookId]);
    if (!rows.length) return res.status(404).json({ message: 'Book not found' });
    const book = rows[0];
    await db.execute('UPDATE books SET available = 1, borrowedBy = NULL WHERE id = ?', [bookId]);
    await recordActivity(bookId, book.title, book.borrowedBy || 'Admin', 'returned');
    res.json({ message: `"${book.title}" forcefully returned.` });
  } catch (err) {
    res.status(500).json({ message: 'Error', error: err.message });
  }
});

app.listen(PORT, () => console.log(`🚀  Server running → http://localhost:${PORT}`));
