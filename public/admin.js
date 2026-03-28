// ─── GUARD: admin only ───────────────────────────────────────────────────────
const currentUser = JSON.parse(localStorage.getItem('currentUser'));
if (!currentUser || currentUser.role !== 'admin') {
  window.location.href = 'index.html';
}

// Set user name in navbar
const nameEl = document.getElementById('currentUserName');
if (nameEl) nameEl.innerText = currentUser.name;

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('currentUser');
  window.location.href = 'index.html';
});

// ─── TOAST ───────────────────────────────────────────────────────────────────
function showToast(message, isError = false) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.style.borderLeft = `3px solid ${isError ? 'var(--accent)' : 'var(--green)'}`;
  toast.innerText = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

// ─── INTERSECTION OBSERVER ────────────────────────────────────────────────────
const revealObs = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-visible'); revealObs.unobserve(e.target); } });
}, { threshold: 0.1 });
document.querySelectorAll('.scroll-reveal').forEach(el => revealObs.observe(el));

// ─── COUNT-UP ─────────────────────────────────────────────────────────────────
function animateValue(el, start, end, duration = 1200) {
  if (!el) return;
  let startTs = null;
  const step = ts => {
    if (!startTs) startTs = ts;
    const p = Math.min((ts - startTs) / duration, 1);
    el.textContent = Math.floor(p * (end - start) + start);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ─── CHART.JS DEFAULTS ────────────────────────────────────────────────────────
Chart.defaults.color = 'rgba(255,255,255,0.5)';
Chart.defaults.font.family = "'DM Sans', sans-serif";
Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';

let genreChartInst = null;
let activityChartInst = null;

// ─── LOAD ALL DATA ────────────────────────────────────────────────────────────
async function loadDashboard() {
  await Promise.all([
    loadKPIs(),
    loadGenreChart(),
    loadActivityChart(),
    loadBooksTable(),
    loadIssuedTable(),
    loadUsersTable()
  ]);
}

// ─── KPI CARDS ───────────────────────────────────────────────────────────────
async function loadKPIs() {
  try {
    const res = await fetch('/api/admin/stats');
    const data = await res.json();
    animateValue(document.getElementById('kpiTotal'), 0, data.total);
    animateValue(document.getElementById('kpiAvailable'), 0, data.available);
    animateValue(document.getElementById('kpiIssued'), 0, data.issued);
    animateValue(document.getElementById('kpiUsers'), 0, data.users);
    animateValue(document.getElementById('kpiGenres'), 0, data.genres);
  } catch (e) { console.error('KPI error:', e); }
}

// ─── GENRE CHART ─────────────────────────────────────────────────────────────
async function loadGenreChart() {
  try {
    const res = await fetch('/api/admin/genre-breakdown');
    const data = await res.json();
    const labels = data.map(r => r.genre);
    const counts = data.map(r => r.count);

    const palette = [
      '#f87171','#34d399','#60a5fa','#fcd34d','#a78bfa',
      '#fb923c','#38bdf8','#4ade80','#e879f9','#f472b6'
    ];

    if (genreChartInst) genreChartInst.destroy();
    genreChartInst = new Chart(document.getElementById('genreChart'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Books',
          data: counts,
          backgroundColor: palette.slice(0, labels.length).map(c => c + 'AA'),
          borderColor: palette.slice(0, labels.length),
          borderWidth: 1.5,
          borderRadius: 8,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.5)' } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.5)', precision: 0 } }
        }
      }
    });
  } catch (e) { console.error('Genre chart error:', e); }
}

// ─── ACTIVITY CHART ──────────────────────────────────────────────────────────
async function loadActivityChart() {
  try {
    const res = await fetch('/api/admin/borrow-history');
    const data = await res.json();
    const labels = data.map(r => new Date(r.day).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }));
    const counts = data.map(r => r.count);

    if (activityChartInst) activityChartInst.destroy();
    activityChartInst = new Chart(document.getElementById('activityChart'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Borrows',
          data: counts,
          fill: true,
          borderColor: '#f87171',
          backgroundColor: 'rgba(248,113,113,0.1)',
          tension: 0.4,
          pointBackgroundColor: '#f87171',
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.5)' } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.5)', precision: 0 }, beginAtZero: true }
        }
      }
    });
  } catch (e) { console.error('Activity chart error:', e); }
}

// ─── BOOKS TABLE ─────────────────────────────────────────────────────────────
let allBooks = [];

async function loadBooksTable(filter = '') {
  try {
    const res = await fetch('/api/inventory');
    allBooks = await res.json();
    const label = document.getElementById('bookCountLabel');
    if (label) label.textContent = `${allBooks.length} books in catalog`;
    renderBooksTable(filter);
  } catch (e) { console.error('Books table error:', e); }
}

function renderBooksTable(filter = '') {
  const tbody = document.getElementById('adminBooksTable');
  if (!tbody) return;
  const filtered = filter
    ? allBooks.filter(b => b.title.toLowerCase().includes(filter) || b.author.toLowerCase().includes(filter))
    : allBooks;

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No books found.</td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map(book => `
    <tr>
      <td>#${book.id}</td>
      <td><strong>${escHtml(book.title)}</strong></td>
      <td>${escHtml(book.author)}</td>
      <td>${escHtml(book.genre || '—')}</td>
      <td>${book.year || '—'}</td>
      <td>${book.available ? '<span class="badge-green">Available</span>' : '<span class="badge-amber">Issued</span>'}</td>
      <td>
        <button class="table-action-btn" onclick="openEditModal(${book.id})">Edit</button>
        <button class="table-action-btn danger" onclick="deleteBook(${book.id})">Delete</button>
      </td>
    </tr>
  `).join('');
}

// Book search input
document.getElementById('bookSearchInput').addEventListener('input', function () {
  renderBooksTable(this.value.toLowerCase());
});

// ─── ISSUED TABLE ─────────────────────────────────────────────────────────────
async function loadIssuedTable() {
  try {
    const res = await fetch('/api/admin/all-borrowed');
    const data = await res.json();
    const tbody = document.getElementById('issuedTable');
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No books currently issued.</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(b => `
      <tr>
        <td>#${b.id}</td>
        <td><strong>${escHtml(b.title)}</strong></td>
        <td>${escHtml(b.author)}</td>
        <td>${escHtml(b.genre || '—')}</td>
        <td>${escHtml(b.borrowedBy || '—')}</td>
        <td><button class="table-action-btn success" onclick="forceReturn(${b.id})">Force Return</button></td>
      </tr>
    `).join('');
  } catch (e) { console.error('Issued table error:', e); }
}

// ─── USERS TABLE ──────────────────────────────────────────────────────────────
async function loadUsersTable() {
  try {
    const res = await fetch('/api/admin/users');
    const data = await res.json();
    const tbody = document.getElementById('usersTable');
    tbody.innerHTML = data.map(u => `
      <tr>
        <td>#${u.id}</td>
        <td>${escHtml(u.name)}</td>
        <td>${escHtml(u.email)}</td>
        <td>${u.role === 'admin'
          ? '<span class="badge-amber">Admin</span>'
          : '<span class="badge-green">User</span>'}</td>
        <td>${new Date(u.created_at).toLocaleDateString()}</td>
        <td>
          ${u.role !== 'admin'
            ? `<button class="table-action-btn danger" onclick="deleteUser(${u.id})">Remove</button>`
            : '<span style="color:var(--text-muted); font-size:13px;">Protected</span>'}
        </td>
      </tr>
    `).join('');
  } catch (e) { console.error('Users table error:', e); }
}

// ─── ADD BOOK FORM ────────────────────────────────────────────────────────────
document.getElementById('addBookForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('addBookSubmit');
  btn.innerHTML = 'Adding…';
  btn.disabled = true;

  const body = {
    title: document.getElementById('abTitle').value,
    author: document.getElementById('abAuthor').value,
    genre: document.getElementById('abGenre').value,
    year: parseInt(document.getElementById('abYear').value) || null,
    isbn: document.getElementById('abIsbn').value,
    quantity: parseInt(document.getElementById('abQty').value) || 1
  };

  try {
    const res = await fetch('/api/addBook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    showToast(data.message, !res.ok);
    if (res.ok) {
      document.getElementById('addBookForm').reset();
      loadDashboard();
    }
  } catch { showToast('Error adding book', true); }
  btn.innerHTML = 'Add to Catalog';
  btn.disabled = false;
});

// ─── DELETE BOOK ──────────────────────────────────────────────────────────────
async function deleteBook(id) {
  if (!confirm(`Delete book #${id}? This cannot be undone.`)) return;
  const res = await fetch(`/api/books/${id}`, { method: 'DELETE' });
  const data = await res.json();
  showToast(data.message, !res.ok);
  if (res.ok) loadDashboard();
}

// ─── FORCE RETURN ─────────────────────────────────────────────────────────────
async function forceReturn(id) {
  const res = await fetch('/api/admin/force-return', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookId: id }) });
  const data = await res.json();
  showToast(data.message, !res.ok);
  if (res.ok) loadDashboard();
}

// ─── DELETE USER ──────────────────────────────────────────────────────────────
async function deleteUser(id) {
  if (!confirm(`Remove user #${id}?`)) return;
  const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
  const data = await res.json();
  showToast(data.message, !res.ok);
  if (res.ok) loadUsersTable();
}

// ─── EDIT MODAL ───────────────────────────────────────────────────────────────
function openEditModal(id) {
  const book = allBooks.find(b => b.id === id);
  if (!book) return;
  document.getElementById('editBookId').value = book.id;
  document.getElementById('editTitle').value  = book.title;
  document.getElementById('editAuthor').value = book.author;
  document.getElementById('editGenre').value  = book.genre || '';
  document.getElementById('editYear').value   = book.year || '';
  document.getElementById('editIsbn').value   = book.isbn || '';
  document.getElementById('editModal').classList.add('open');
}
document.getElementById('editModalClose').onclick = () => document.getElementById('editModal').classList.remove('open');
document.getElementById('editModal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('editModal')) document.getElementById('editModal').classList.remove('open');
});
document.getElementById('editSaveBtn').addEventListener('click', async () => {
  const id = document.getElementById('editBookId').value;
  const body = {
    title:  document.getElementById('editTitle').value,
    author: document.getElementById('editAuthor').value,
    genre:  document.getElementById('editGenre').value,
    year:   parseInt(document.getElementById('editYear').value) || null,
    isbn:   document.getElementById('editIsbn').value
  };
  try {
    const res = await fetch(`/api/books/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    showToast(data.message, !res.ok);
    if (res.ok) { document.getElementById('editModal').classList.remove('open'); loadDashboard(); }
  } catch { showToast('Update failed', true); }
});

// ─── UTILS ───────────────────────────────────────────────────────────────────
function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Make functions global (called from inline HTML)
window.deleteBook    = deleteBook;
window.openEditModal = openEditModal;
window.forceReturn   = forceReturn;
window.deleteUser    = deleteUser;

// ─── INIT ────────────────────────────────────────────────────────────────────
loadDashboard();
