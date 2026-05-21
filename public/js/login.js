document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const btn = document.getElementById('submit-btn');
  const msg = document.getElementById('message');

  btn.disabled = true;
  btn.textContent = 'Sending...';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();

    msg.style.display = 'block';
    if (res.ok) {
      msg.className = 'message success';
      msg.textContent = data.message;
    } else {
      msg.className = 'message error';
      msg.textContent = data.error;
    }
  } catch (err) {
    msg.style.display = 'block';
    msg.className = 'message error';
    msg.textContent = 'Something went wrong. Try again!';
  }

  btn.disabled = false;
  btn.textContent = 'Send Magic Link';
});

// If already logged in, redirect
fetch('/api/auth/me').then(res => {
  if (res.ok) return res.json();
}).then(user => {
  if (user) {
    window.location.href = user.role === 'approver' ? '/dashboard.html' : '/requests.html';
  }
});
