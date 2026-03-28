const currentUser = JSON.parse(localStorage.getItem('currentUser'));

// Ensure redirect if on library page without login
if (window.location.pathname.includes('library.html') && !currentUser) {
    window.location.href = 'index.html';
}

if (window.location.pathname.includes('library.html') && currentUser) {
    const userNameSpan = document.getElementById('currentUserName');
    if (userNameSpan) userNameSpan.innerText = currentUser.name;

    // Role badge: show 'ADMIN' or 'USER' pill for everyone
    const roleBadge = document.getElementById('roleBadge');
    if (roleBadge) {
        if (currentUser.role === 'admin') {
            roleBadge.innerText = 'ADMIN';
            roleBadge.style.background = 'rgba(248,113,113,0.15)';
            roleBadge.style.color = 'var(--accent)';
            roleBadge.style.border = '1px solid rgba(248,113,113,0.3)';
        } else {
            roleBadge.innerText = 'USER';
            roleBadge.style.background = 'rgba(52,211,153,0.12)';
            roleBadge.style.color = 'var(--green)';
            roleBadge.style.border = '1px solid rgba(52,211,153,0.25)';
        }
    }

    // Show/hide admin elements
    const adminEls = document.querySelectorAll('.admin-nav, .admin-section, .admin-only');
    if (currentUser.role === 'admin') {
        adminEls.forEach(el => {
            el.style.display = el.tagName === 'LI' ? 'block' : '';
        });
        // Also show the Actions column header
        const actionsHeader = document.getElementById('actionsHeader');
        if (actionsHeader) actionsHeader.style.display = '';
    } else {
        adminEls.forEach(el => el.classList.add('admin-hidden'));
    }
}

// Toast Notification System
function showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => {
        if(toast.parentElement) toast.remove();
    }, 3000);
}

// Wait for DOM to handle all visual logic
document.addEventListener('DOMContentLoaded', () => {

    // === INTERSECTION OBSERVER ANIMATIONS ===
    const observerOptions = { threshold: 0.15, rootMargin: "0px 0px -50px 0px" };
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.scroll-reveal').forEach((el, i) => {
        // Option to add stagger delay here if needed, or rely on base class
        el.style.transitionDelay = `${(i % 3) * 0.1}s`;
        observer.observe(el);
    });

    // === NAVBAR ACTIVE STATE ON SCROLL ===
    const sections = document.querySelectorAll('.saas-section');
    const navLinks = document.querySelectorAll('.saas-nav-links a');

    window.addEventListener('scroll', () => {
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            // Adjusting 120px to trigger slightly earlier
            if (scrollY >= sectionTop - 120) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(a => {
            a.classList.remove('active');
            if (a.getAttribute('href').includes(current) && current !== '') {
                a.classList.add('active');
            }
        });
    });

    // === SMOOTH SCROLL FOR NAVBAR ===
    document.querySelectorAll('a[href^="#"]').forEach(a => {
        a.addEventListener('click', e => {
            e.preventDefault();
            const targetId = a.getAttribute('href');
            if (targetId === '#') return;
            const target = document.querySelector(targetId);
            if (target) {
                const offset = 64; // Navbar height
                window.scrollTo({ top: target.offsetTop - offset, behavior: 'smooth' });
            }
        });
    });

    // === COUNT UP ANIMATION FOR STATS ===
    function animateValue(obj, start, end, duration) {
        if (!obj) return;
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.innerHTML = Math.floor(progress * (end - start) + start);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }

    // === UPDATE DASHBOARD DATA & CHARTS ===
    function updateDashboardAPI() {
        if(window.location.pathname.includes('index.html')) return;
        
        fetch("/api/inventory")
            .then(res => res.json())
            .then(data => {
                const totalBooks = data.length;
                const issuedBooks = data.filter(book => !book.available).length;
                const percentage = totalBooks ? Math.round((issuedBooks / totalBooks) * 100) : 0;
                
                // Animate Numbers
                const totalEl = document.getElementById('totalBooks');
                const issuedEl = document.getElementById('issuedBooks');
                if(totalEl && totalEl.innerText === "0") {
                    animateValue(totalEl, 0, totalBooks, 1500);
                    animateValue(issuedEl, 0, issuedBooks, 1500);
                } else {
                    if(totalEl) totalEl.innerText = totalBooks;
                    if(issuedEl) issuedEl.innerText = issuedBooks;
                }

                // Update SVG Donut (Circumference 251.2 for r=40)
                const donutInner = document.getElementById('donut-progress');
                const chartText = document.getElementById('chartText');
                if (donutInner) {
                    const offset = 251.2 - (251.2 * (percentage / 100));
                    donutInner.style.strokeDashoffset = offset;
                }
                if (chartText) chartText.innerText = `${percentage}%`;
                
                // Repopulate Tables
                populateInventoryTable(data);
                
                // Update My Borrowings if needed
                if(currentUser) {
                    fetch(`/api/myBorrowings?userName=${encodeURIComponent(currentUser.name)}`)
                    .then(r=>r.json()).then(myB => populateMyBorrowings(myB));
                }
            });
            
        fetch("/api/activity")
            .then(res => res.json())
            .then(data => {
                const recentActivityList = document.getElementById("recentActivityList");
                if(!recentActivityList) return;
                recentActivityList.innerHTML = '';
                if(data.length === 0) {
                    recentActivityList.innerHTML = '<li>No recent activity.</li>';
                    return;
                }
                // Show only the 5 most recent entries
                data.slice(0, 5).forEach(act => {
                    const d = new Date(act.date).toLocaleDateString();
                    recentActivityList.innerHTML += `<li><span style="font-weight:600; color:var(--text-primary)">${act.bookTitle}</span> was ${act.action} by ${act.userName} <span style="font-size:11px; color:var(--text-muted); float:right;">${d}</span></li>`;
                });
            });
    }
    
    // Initial fetch
    updateDashboardAPI();

    // ── AI Recommendations ─────────────────────────────────
    function loadRecommendations() {
        const grid = document.getElementById('recoGrid');
        if (!grid || !currentUser) return;

        const url = '/api/recommendations?userName=' + encodeURIComponent(currentUser.name);
        fetch(url)
            .then(function(r) { return r.json(); })
            .then(function(data) {
                var recs  = data.recommendations || [];
                var basis = data.basis || 'popular';
                grid.innerHTML = '';
                // Update subtitle
                var subtitle = document.querySelector('.reco-subtitle');
                if (subtitle) {
                    subtitle.textContent = basis === 'history'
                        ? 'Picked by AI based on your reading history'
                        : 'Popular picks \u2014 borrow books to get personalised recommendations';
                }
                if (recs.length === 0) {
                    grid.innerHTML = '<div class="reco-empty">No books available right now.</div>';
                    return;
                }
                recs.forEach(function(book) {
                    var card = document.createElement('div');
                    card.className = 'reco-card';
                    card.innerHTML =
                        '<div class="reco-card-spine"></div>' +
                        '<div class="reco-card-body">' +
                            '<div class="reco-card-title">' + book.title + '</div>' +
                            '<div class="reco-card-author">' + book.author + '</div>' +
                            '<div class="reco-card-footer">' +
                                '<span class="reco-genre">' + (book.genre || 'General') + '</span>' +
                                '<span class="reco-available">\u2713 Available</span>' +
                            '</div>' +
                        '</div>';
                    card.addEventListener('click', function() {
                        var inp = document.getElementById('borrowBookId');
                        if (inp) {
                            inp.value = book.id;
                            var sec = document.getElementById('borrow-return');
                            if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            showToast('Selected "' + book.title + '" \u2014 click Borrow to confirm.');
                        }
                    });
                    grid.appendChild(card);
                });
            })
            .catch(function() {
                if (grid) grid.innerHTML = '<div class="reco-empty">Could not load recommendations. Check server connection.</div>';
            });
    }

    loadRecommendations();

    // Auto-refresh hooks
    window.updateDashboardAPI = updateDashboardAPI;
    window.loadRecommendations = loadRecommendations;


    // Table populators
    let _allInventoryBooks = [];
    let _showAllBooks = false;

    function populateInventoryTable(data) {
        const tbody = document.getElementById('inventoryTable');
        if(!tbody) return;
        _allInventoryBooks = data;
        const isAdmin = currentUser && currentUser.role === 'admin';
        const displayData = _showAllBooks ? data : data.slice(0, 5);
        tbody.innerHTML = '';
        displayData.forEach(book => {
            const statusBadge = book.available ? '<span class="badge-green">Available</span>' : '<span class="badge-amber">Issued</span>';
            const actionTd = isAdmin
               ? `<td>
                    <button class="table-action-btn" onclick="promptEdit(${book.id}, '${book.title.replace(/'/g,"'")}', '${book.author.replace(/'/g,"'")}', '${(book.genre||'').replace(/'/g,"'")}', '${book.year||''}')">Edit</button>
                    <button class="table-action-btn danger" onclick="promptDelete(${book.id},'${book.title.replace(/'/g,"'")}')">Delete</button>
                  </td>`
               : '';
            tbody.innerHTML += `<tr>
                <td>#${book.id}</td>
                <td><strong>${book.title}</strong></td>
                <td>${book.author}</td>
                <td>${book.year}</td>
                <td>${statusBadge}</td>
                ${actionTd}
            </tr>`;
        });

        // Show / hide the "Show All" button
        const showAllBtn = document.getElementById('showAllBooksBtn');
        if (showAllBtn) {
            if (!_showAllBooks && data.length > 5) {
                showAllBtn.style.display = 'inline-flex';
                showAllBtn.innerText = `Show All ${data.length} Books`;
            } else if (_showAllBooks) {
                showAllBtn.style.display = 'inline-flex';
                showAllBtn.innerText = 'Show Less';
            } else {
                showAllBtn.style.display = 'none';
            }
        }
    }

    // Show All / Show Less toggle
    const showAllBtn = document.getElementById('showAllBooksBtn');
    if (showAllBtn) {
        showAllBtn.addEventListener('click', () => {
            _showAllBooks = !_showAllBooks;
            populateInventoryTable(_allInventoryBooks);
        });
    }

    function populateMyBorrowings(data) {
        const tbody = document.getElementById('myBorrowingsTable');
        if(!tbody) return;
        tbody.innerHTML = '';
        if(data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3">No books borrowed currently.</td></tr>';
            return;
        }
        data.forEach(book => {
            tbody.innerHTML += `<tr>
                <td>#${book.id}</td>
                <td>${book.title}</td>
                <td>${book.author}</td>
            </tr>`;
        });
    }

    // SEARCH LISTENER
    window.searchBooks = function() {
        const q = document.getElementById('searchInput').value;
        fetch(`/api/books?query=${encodeURIComponent(q)}`)
            .then(r=>r.json()).then(data => {
                const tbody = document.getElementById('searchResultsTable');
                tbody.innerHTML = '';
                if(data.results.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="4">No results found.</td></tr>';
                    return;
                }
                data.results.forEach(book => {
                    const statusBadge = book.available ? '<span class="badge-green">Available</span>' : '<span class="badge-amber">Issued</span>';
                    tbody.innerHTML += `<tr>
                        <td>#${book.id}</td>
                        <td><strong>${book.title}</strong></td>
                        <td>${book.author}</td>
                        <td>${statusBadge}</td>
                    </tr>`;
                });
            });
    };

    // INLINE BORROW BUTTON LOGIC (REPLACING MODAL)
    const btnBorrowBook = document.getElementById('btnBorrowBook');
    const modalBorrowBtn = document.getElementById('modalBorrowBtn'); // Also catch old modal if mixed
    const actualBorrowBtn = btnBorrowBook || modalBorrowBtn;
    
    if (actualBorrowBtn) {
        actualBorrowBtn.addEventListener('click', () => {
            const bIdInput = document.getElementById('borrowBookId') || document.getElementById('modalBookId');
            const bookId = parseInt(bIdInput.value);
            if(!bookId) return showToast('Please enter a valid Book ID.');
            
            fetch("/api/borrow", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bookId, userName: currentUser.name })
            }).then(r=>r.json()).then(data => {
                showToast(data.message);
                updateDashboardAPI();
                bIdInput.value = '';
            });
        });
    }

    // INLINE RETURN BUTTON LOGIC
    const btnReturnBook = document.getElementById('btnReturnBook');
    const modalReturnBtn2 = document.getElementById('modalReturnBtn2'); 
    const actualReturnBtn = btnReturnBook || modalReturnBtn2;

    if (actualReturnBtn) {
        actualReturnBtn.addEventListener('click', () => {
            const rIdInput = document.getElementById('returnBookId');
            const bookId = parseInt(rIdInput.value);
            if(!bookId) return showToast('Please enter a valid Book ID.');

            fetch("/api/return", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bookId, userName: currentUser.name })
            }).then(r=>r.json()).then(data => {
                showToast(data.message);
                updateDashboardAPI();
                rIdInput.value = '';
            });
        });
    }

    // LOGOUT LOGIC
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('currentUser');
            window.location.href = 'index.html';
        });
    }

    // AUTH FORM LOGIC
    const authForm = document.getElementById('authForm');
    if (authForm) {
      if(currentUser && window.location.pathname.includes('index.html')) {
          window.location.href = 'library.html';
      }

      // ── Password eye toggle (SVG-based) ──────────────────
      const togglePwdBtn = document.getElementById('togglePassword');
      const pwdInput     = document.getElementById('authPassword');
      const EYE_OPEN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
      const EYE_SHUT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
      if (togglePwdBtn && pwdInput) {
        togglePwdBtn.addEventListener('click', () => {
          const isHidden = pwdInput.type === 'password';
          pwdInput.type = isHidden ? 'text' : 'password';
          togglePwdBtn.innerHTML = isHidden ? EYE_SHUT : EYE_OPEN;
          togglePwdBtn.style.opacity = isHidden ? '0.7' : '0.3';
        });
      }

      let isLoginMode = true;
      const toggleAuthMode = document.getElementById('toggleAuthMode');
      const authTitle = document.getElementById('authTitle');
      const nameWrapper = document.getElementById('nameWrapper');
      const toggleText = document.getElementById('toggleText');
      const authSubmitBtn = document.getElementById('authSubmitBtn');

      if(toggleAuthMode) {
        toggleAuthMode.addEventListener('click', (e) => {
            e.preventDefault();
            isLoginMode = !isLoginMode;
            const authSubtitle = document.getElementById('authSubtitle');
            if (isLoginMode) {
              authTitle.innerText = 'Welcome back';
              if (authSubtitle) authSubtitle.innerText = 'Sign in to your LibraryNxt account';
              nameWrapper.style.display = 'none';
              authSubmitBtn.innerText = 'Log In';
              toggleText.innerText = "Don't have an account? ";
              toggleAuthMode.innerText = "Sign up here";
              const nameEl = document.getElementById('authName');
              if (nameEl) nameEl.removeAttribute('required');
            } else {
              authTitle.innerText = 'Create account';
              if (authSubtitle) authSubtitle.innerText = 'Join LibraryNxt — it\'s free';
              nameWrapper.style.display = 'block';
              authSubmitBtn.innerText = 'Create Account';
              toggleText.innerText = "Already have an account? ";
              toggleAuthMode.innerText = "Log in here";
              const nameEl = document.getElementById('authName');
              if (nameEl) nameEl.setAttribute('required', 'true');
            }
        });
      }

      authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('authEmail').value;
        const password = document.getElementById('authPassword').value;
        const name = document.getElementById('authName').value;
        const messageEl = document.getElementById('authMessage');

        try {
          const url = isLoginMode ? '/api/login' : '/api/signup';
          const bodyData = isLoginMode ? { email, password } : { name, email, password, role: 'user' };
          
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyData)
          });
          const data = await response.json();
          if (response.ok) {
            localStorage.setItem('currentUser', JSON.stringify(data.user));
            messageEl.style.color = 'var(--green)';
            messageEl.innerText = 'Success! Redirecting...';
            setTimeout(() => window.location.href = 'library.html', 1000);
          } else {
            messageEl.style.color = 'var(--accent)';
            messageEl.innerText = data.message;
          }
        } catch (err) {
          messageEl.style.color = 'var(--accent)';
          messageEl.innerText = 'Network error.';
        }
      });
      
      // --- Google OAuth via Google Identity Services ---
      // Triggered by Google's JWT credential callback
      window.handleGoogleCredential = function(response) {
        if (!response.credential) return;
        // Decode payload from the JWT
        const base64Url = response.credential.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(atob(base64));

        // Send to backend for verification / auto-register
        fetch('/api/google-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: payload.name, email: payload.email, googleId: payload.sub })
        })
        .then(r => r.json())
        .then(data => {
          if (data.user) {
            localStorage.setItem('currentUser', JSON.stringify(data.user));
            window.location.href = 'library.html';
          } else {
            const msg = document.getElementById('authMessage');
            if (msg) { msg.style.color = 'var(--accent)'; msg.innerText = data.message || 'Google login failed'; }
          }
        })
        .catch(() => {
          const msg = document.getElementById('authMessage');
          if (msg) { msg.style.color = 'var(--accent)'; msg.innerText = 'Network error with Google login'; }
        });
      };

      // Wire the manual Google button to trigger the GIS popup
      const googleBtn = document.getElementById('googleLoginBtn');
      if (googleBtn) {
        googleBtn.addEventListener('click', () => {
          if (typeof google !== 'undefined' && google.accounts) {
            google.accounts.id.prompt(); // Trigger the One Tap / popup
          } else {
            const msg = document.getElementById('authMessage');
            if (msg) { msg.style.color = 'var(--accent)'; msg.innerText = '⚠️ Google login requires a valid Client ID in index.html'; }
          }
        });
      }
    }
});

// Admin Globals
window.adminAddBook = function() {
    const title = document.getElementById("newBookTitle").value;
    const author = document.getElementById("newBookAuthor").value;
    const genre = document.getElementById("newBookGenre").value;
    const year = parseInt(document.getElementById("newBookYear").value);
    
    const btn = document.getElementById("addBookBtn");
    btn.innerHTML = `<span style="display:inline-block; width:16px; height:16px; border:2px solid #fff; border-bottom-color:transparent; border-radius:50%; animation:spin 1s linear infinite;"></span> Adding...`;
    
    fetch("/api/addBook", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, author, genre, year })
    })
    .then(r => r.json())
    .then(data => {
      showToast(data.message);
      window.updateDashboardAPI();
      btn.innerHTML = 'Add Book';
      document.getElementById("newBookTitle").value = '';
      document.getElementById("newBookAuthor").value = '';
    }).catch(e => { showToast('Error adding book!'); btn.innerHTML = 'Add Book'; });
}

// ── Edit Book (proper modal) ───────────────────────────
window.promptEdit = function(bookId, title, author, genre, year) {
    const modal = document.getElementById('libEditModal');
    if (!modal) return;
    document.getElementById('libEditBookId').value  = bookId;
    document.getElementById('libEditTitle').value   = title  || '';
    document.getElementById('libEditAuthor').value  = author || '';
    document.getElementById('libEditGenre').value   = genre  || '';
    document.getElementById('libEditYear').value    = year   || '';
    modal.classList.add('active');
}

// Wire modal events once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const modal     = document.getElementById('libEditModal');
    const closeBtn  = document.getElementById('libEditModalClose');
    const saveBtn   = document.getElementById('libEditSaveBtn');
    if (!modal) return;

    // Close on X or backdrop click
    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('active'); });

    // Save handler
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const id     = document.getElementById('libEditBookId').value;
            const title  = document.getElementById('libEditTitle').value.trim();
            const author = document.getElementById('libEditAuthor').value.trim();
            const genre  = document.getElementById('libEditGenre').value.trim();
            const year   = document.getElementById('libEditYear').value.trim();
            if (!title || !author) return showToast('Title and Author are required.');
            saveBtn.innerText = 'Saving…';
            try {
                const r = await fetch(`/api/books/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, author, genre, year })
                });
                const data = await r.json();
                showToast(data.message || 'Book updated!');
                modal.classList.remove('active');
                window.updateDashboardAPI();
            } catch(e) { showToast('Update failed.'); }
            saveBtn.innerText = 'Save Changes';
        });
    }
});

// ── Delete Book ────────────────────────────────────────
window.promptDelete = function(bookId, title) {
    const label = title ? `"${title}"` : `#${bookId}`;
    if (!confirm(`Delete book ${label}? This cannot be undone.`)) return;
    fetch(`/api/books/${bookId}`, { method: 'DELETE' })
        .then(r => r.json())
        .then(data => {
            showToast(data.message || 'Book deleted.');
            window.updateDashboardAPI();
        })
        .catch(() => showToast('Delete failed.'));
}
