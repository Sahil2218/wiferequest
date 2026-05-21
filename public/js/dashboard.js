let allRequests = [];
let currentFilter = 'all';

async function checkAuth() {
  const res = await fetch('/api/auth/me');
  if (!res.ok) { window.location.href = '/'; return null; }
  const user = await res.json();
  if (user.role !== 'approver') { window.location.href = '/requests.html'; return null; }
  document.getElementById('user-name').textContent = user.name;
  return user;
}

async function loadNotifications() {
  const res = await fetch('/api/notifications');
  if (!res.ok) return;
  const data = await res.json();
  const badge = document.getElementById('badge');
  if (data.unseen > 0) {
    badge.style.display = 'flex';
    badge.textContent = data.unseen;
  } else {
    badge.style.display = 'none';
  }
}

async function loadRequests() {
  const res = await fetch('/api/requests');
  if (!res.ok) return;
  allRequests = await res.json();
  renderRequests();
}

function renderRequests() {
  const filtered = currentFilter === 'all'
    ? allRequests
    : allRequests.filter(r => r.status === currentFilter);

  const list = document.getElementById('request-list');
  const empty = document.getElementById('empty-state');

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === currentFilter);
  });

  if (filtered.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  list.innerHTML = filtered.map(r => `
    <li class="request-item ${r.seen ? '' : 'unseen'}" onclick="window.location.href='/letter.html?id=${r.id}'">
      <div>
        <div class="amount">₹${r.amount}</div>
        <div class="reason">${r.reason}</div>
      </div>
      <span class="status-chip ${r.status}">${r.status}</span>
    </li>
  `).join('');
}

function filterRequests(filter) {
  currentFilter = filter;
  renderRequests();
}

function logout() {
  window.location.href = '/api/auth/logout';
}

checkAuth().then(user => {
  if (user) {
    loadRequests();
    loadNotifications();
  }
});
