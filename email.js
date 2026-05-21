// email.js
const nodemailer = require('nodemailer');

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

async function sendMagicLink(email, token) {
  const url = `${process.env.SITE_URL}/api/auth/verify?token=${token}`;
  await getTransporter().sendMail({
    from: `"WifeRequest" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Your Magic Login Link',
    html: `<p>Click here to login:</p><a href="${url}">${url}</a><p>Expires in 15 minutes.</p>`,
  });
}

async function sendNewRequestNotification(email, amount, reason) {
  const url = `${process.env.SITE_URL}/dashboard.html`;
  await getTransporter().sendMail({
    from: `"WifeRequest" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Sahil dino has a new request for you!',
    html: `<p>Sahil needs <strong>₹${amount}</strong> for <strong>${reason}</strong>.</p><p><a href="${url}">View request</a></p>`,
  });
}

async function sendApprovalNotification(email, amount, reason) {
  await getTransporter().sendMail({
    from: `"WifeRequest" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `Your request for ₹${amount} was approved! 🎉`,
    html: `<p>Your request for <strong>₹${amount}</strong> (${reason}) was approved!</p>`,
  });
}

module.exports = { sendMagicLink, sendNewRequestNotification, sendApprovalNotification };
