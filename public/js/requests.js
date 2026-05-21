async function checkAuth() {
  const res = await fetch('/api/auth/me');
  if (!res.ok) { window.location.href = '/'; return null; }
  const user = await res.json();
  if (user.role !== 'requester') { window.location.href = '/dashboard.html'; return null; }
  document.getElementById('user-name').textContent = user.name;
  return user;
}

async function loadRequests() {
  const res = await fetch('/api/requests');
  if (!res.ok) return;
  const requests = await res.json();
  const list = document.getElementById('request-list');
  const empty = document.getElementById('empty-state');

  if (requests.length === 0) {
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  list.innerHTML = requests.map(r => `
    <li class="request-item" onclick="window.location.href='/letter.html?id=${r.id}'">
      <div>
        <div class="amount">₹${r.amount}</div>
        <div class="reason">${r.reason}</div>
      </div>
      <span class="status-chip ${r.status}">${r.status}</span>
    </li>
  `).join('');
}

document.getElementById('request-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const amount = document.getElementById('amount').value;
  const reason = document.getElementById('reason').value;
  const btn = document.getElementById('submit-btn');
  const msg = document.getElementById('message');

  btn.disabled = true;
  btn.textContent = 'Sending...';

  try {
    const res = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: parseFloat(amount), reason }),
    });
    const data = await res.json();

    msg.style.display = 'block';
    if (res.ok) {
      msg.className = 'message success';
      msg.textContent = 'Request sent to your wife!';
      document.getElementById('request-form').reset();
      loadRequests();
    } else {
      msg.className = 'message error';
      msg.textContent = data.error;
    }
  } catch (err) {
    msg.style.display = 'block';
    msg.className = 'message error';
    msg.textContent = 'Something went wrong!';
  }

  btn.disabled = false;
  btn.textContent = 'Send Request';
  setTimeout(() => { msg.style.display = 'none'; }, 3000);
});

function logout() {
  window.location.href = '/api/auth/logout';
}

checkAuth().then(user => { if (user) loadRequests(); });
