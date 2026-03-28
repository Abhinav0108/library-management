# 📚 LibraryNxt

> **Next-Gen Library Management System** with AI-powered book recommendations, admin analytics, and a premium dark-mode UI.

![LibraryNxt](https://img.shields.io/badge/LibraryNxt-v1.0-f87171?style=for-the-badge&logo=bookstack&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-XAMPP-00758F?style=for-the-badge&logo=mysql&logoColor=white)

---

## Features

### AI-Powered Book Recommendations
The **"For You ✦"** section uses a smart genre-based recommendation engine that:
- Analyses your **personal borrowing history** to identify your preferred genres
- Recommends **available books in your favourite genres** that you haven't read yet
- Automatically **tops up to 4 cards** with other available books if genre picks run short
- Falls back to **popular/newest books** for new users with no history
- Updates dynamically - the more you borrow, the smarter it gets

### Authentication
- Email + password login & registration
- Google Sign-In (OAuth via Google Identity Services)
- Role-based access: **Admin** vs **User**

### Library Features
- Full **book catalog** with search & pagination
- **Borrow & Return** system with real-time availability update
- **My Borrowings** - personal borrow history per user
- **Inventory view** with 5-book preview + "Show All" toggle
- **Recent Activity** feed (last 5 actions, live)

### Admin Panel
- KPI dashboard: Total Books, Available, Issued, Users, Genres
- **Books by Genre** bar chart (Chart.js)
- **Borrow Activity** line chart (last 30 days)
- Add / Edit / Delete books via modal
- View all issued books + **Force Return**
- User management (view & remove users)

### Design
- Premium **dark-mode SaaS aesthetic**
- Glassmorphism cards with backdrop blur
- Animated SVG book illustration on login
- Lora (serif) + Inter (sans) typography system
- Smooth scroll-reveal animations & micro-interactions

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, Vanilla CSS, Vanilla JS |
| Backend | Node.js + Express |
| Database | MySQL (via XAMPP) |
| Charts | Chart.js |
| Auth | Custom + Google Identity Services |
| Fonts | Google Fonts (Lora + Inter) |

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v16+
- [XAMPP](https://www.apachefriends.org/) (for MySQL)

### 1. Clone the repo
```bash
git clone https://github.com/Abhinav0108/library-management.git
cd library-management
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up the database
1. Start **XAMPP** → start **Apache** and **MySQL**
2. Open **phpMyAdmin** → `http://localhost/phpmyadmin`
3. Import `library_db.sql` (creates `library_db` with seeded books & default admin)

### 4. Start the server
```bash
node server.js
```

### 5. Open in browser
```
http://localhost:3000
```

---

## Default Login

| Role | Email | Password |
|---|---|---|
| Admin | admin@library.com | admin123 |

> Register a new account for a regular user experience.

---

##  How AI Recommendations Work

```
User borrows books
       ↓
Activity table logs: bookId + userName + genre
       ↓
/api/recommendations?userName=...
       ↓
1. Query genres user has borrowed  → ['Classic', 'Romance']
2. Find available books in those genres not yet borrowed
3. If < 4 results → top up with other available books
4. If no history → return 4 newest available books
       ↓
Frontend renders 4 recommendation cards
Clicking a card → auto-fills Borrow Book ID field
```

---

## 📁 Project Structure

```
library-management/
├── server.js          # Express server + all API routes
├── database.js        # MySQL connection pool
├── library_db.sql     # Database schema + seed data
├── package.json
└── public/
    ├── index.html     # Login / Register page
    ├── library.html   # Main library dashboard
    ├── admin.html     # Admin panel
    ├── login.css      # Login page styles
    ├── styles.css     # Global styles
    ├── script.js      # Main frontend logic
    └── admin.js       # Admin panel logic
```

---

##  Pages

| Page | Description |
|---|---|
| `/` | Login & Register with Google OAuth |
| `/library.html` | User dashboard — search, borrow, recommendations |
| `/admin.html` | Admin panel — analytics, book management, users |

---

## 📄 License

MIT © [Abhinav0108](https://github.com/Abhinav0108)
