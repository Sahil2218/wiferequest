let currentUser = null;

async function checkAuth() {
  const res = await fetch('/api/auth/me');
  if (!res.ok) { window.location.href = '/'; return null; }
  return await res.json();
}

async function loadRequest() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) { window.location.href = '/'; return; }

  const res = await fetch(`/api/requests/${id}`);
  if (!res.ok) { window.location.href = '/'; return; }
  const req = await res.json();

  const letterEl = document.getElementById('letter-content');
  letterEl.innerHTML = `
    <p>Hi my cute wife,</p>
    <p>I need <span class="amount-highlight">₹${req.amount}</span> for <strong>${req.reason}</strong>.</p>
    <p>So can you send it to me so I can fulfil our dreams with it. Please find attached texts and approve it.</p>
    <br>
    <p><strong>AMT-</strong> <span class="amount-highlight">₹${req.amount}</span></p>
    <p><strong>REASON-</strong> ${req.reason}</p>
    <br>
    <p>I will always love you till eternity.</p>
    <div class="sign-off">
      <p>Ur husband</p>
      <p><strong>Sahil dino</strong></p>
    </div>
  `;

  const actions = document.getElementById('actions');
  const statusDisplay = document.getElementById('status-display');

  if (req.status !== 'pending') {
    statusDisplay.style.display = 'block';
    statusDisplay.innerHTML = `<span class="status-chip ${req.status}" style="font-size:1rem; padding:0.5rem 1.5rem;">${req.status === 'approved' ? 'Approved ✓' : 'Rejected ✗'}</span>`;
    return;
  }

  if (currentUser && currentUser.role === 'approver') {
    actions.style.display = 'block';
    actions.innerHTML = `
      <button class="approve-btn" onclick="handleAction(${req.id}, 'approved')">Approve ✓</button>
      <button class="reject-btn" onclick="handleAction(${req.id}, 'rejected')">Reject ✗</button>
    `;
  }
}

async function handleAction(id, status) {
  const res = await fetch(`/api/requests/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });

  if (res.ok) {
    document.getElementById('actions').style.display = 'none';
    const statusDisplay = document.getElementById('status-display');
    statusDisplay.style.display = 'block';

    if (status === 'approved') {
      statusDisplay.innerHTML = `<span class="status-chip approved" style="font-size:1rem; padding:0.5rem 1.5rem;">Approved ✓</span>`;
      launchConfetti();
    } else {
      statusDisplay.innerHTML = `<span class="status-chip rejected" style="font-size:1rem; padding:0.5rem 1.5rem;">Rejected ✗</span>`;
    }
  }
}

function launchConfetti() {
  const container = document.getElementById('confetti');
  const colors = ['#f093fb', '#764ba2', '#667eea', '#f5af19', '#38ef7d', '#ff4757'];

  for (let i = 0; i < 100; i++) {
    const piece = document.createElement('div');
    piece.style.cssText = `
      position: fixed;
      width: ${Math.random() * 10 + 5}px;
      height: ${Math.random() * 10 + 5}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      left: ${Math.random() * 100}vw;
      top: -10px;
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      animation: confettiFall ${Math.random() * 2 + 2}s linear forwards;
      animation-delay: ${Math.random() * 0.5}s;
    `;
    container.appendChild(piece);
  }

  const style = document.createElement('style');
  style.textContent = `
    @keyframes confettiFall {
      to {
        transform: translateY(110vh) rotate(${Math.random() * 720}deg);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);

  setTimeout(() => { container.innerHTML = ''; }, 4000);
}

function goBack() {
  if (currentUser && currentUser.role === 'approver') {
    window.location.href = '/dashboard.html';
  } else {
    window.location.href = '/requests.html';
  }
}

function logout() {
  window.location.href = '/api/auth/logout';
}

checkAuth().then(user => {
  currentUser = user;
  if (user) loadRequest();
});
