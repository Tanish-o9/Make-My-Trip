const express = require('express');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3005;
const SECRET = process.env.EMAIL_SERVICE_SECRET;

// State for diagnostics tracking
let lastSendStatus = 'none';
let lastErrorCategory = 'none';

const smtpConfigured = !!(
  process.env.SMTP_HOST &&
  process.env.SMTP_PORT &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS &&
  process.env.SMTP_FROM_EMAIL
);

let transporter = null;

if (smtpConfigured) {
  const secure = process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465';
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  // Verify SMTP server connection at startup
  transporter.verify((error) => {
    if (error) {
      console.error(`[DIAGNOSTICS] SMTP verification failed: ${error.message}`);
      lastErrorCategory = error.code || 'CONNECTION_ERROR';
    } else {
      console.log("[DIAGNOSTICS] SMTP server is connected and ready to send messages");
    }
  });
} else {
  console.warn("[DIAGNOSTICS] SMTP configuration is incomplete. Transport not initialized.");
}

function maskEmail(email) {
  try {
    const parts = email.split("@");
    if (parts.length !== 2) return "***";
    const [local, domain] = parts;
    const maskedLocal = local[0] + "***" + (local[local.length - 1] || "");
    const domainParts = domain.split(".");
    const maskedDomain = domainParts[0][0] + "***";
    return `${maskedLocal}@${maskedDomain}.${domainParts.slice(1).join('.')}`;
  } catch (e) {
    return "***";
  }
}

// Authentication middleware using header 'X-Email-Service-Secret' or 'Authorization'
function authenticate(req, res, next) {
  const reqSecret = req.headers['x-email-service-secret'] || req.headers['authorization'];
  if (!SECRET || reqSecret !== SECRET) {
    console.warn(`[SECURITY] Unauthorized access attempt from IP: ${req.ip}`);
    return res.status(401).json({ success: false, error: "Unauthorized: Invalid service secret." });
  }
  next();
}

app.get('/health', (req, res) => {
  res.json({ status: "ok" });
});

app.get('/diagnostics', authenticate, async (req, res) => {
  let connectionPass = false;
  if (transporter) {
    try {
      await transporter.verify();
      connectionPass = true;
    } catch (e) {
      connectionPass = false;
      lastErrorCategory = e.code || 'VERIFY_ERROR';
    }
  }

  res.json({
    smtp_configured: smtpConfigured ? "YES" : "NO",
    smtp_connection: connectionPass ? "PASS" : "FAIL",
    provider: "nodemailer",
    last_send_status: lastSendStatus,
    last_error_category: lastErrorCategory
  });
});

app.post('/send-verification-email', authenticate, async (req, res) => {
  const { email, otp, expires_in_minutes, purpose } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ success: false, error: "Missing email or otp parameter." });
  }

  if (!smtpConfigured || !transporter) {
    console.error("[EMAIL SERVICE] SMTP configuration is incomplete");
    return res.status(500).json({ success: false, error: "SMTP configuration is incomplete" });
  }

  const masked = maskEmail(email);
  const isReset = purpose === 'password_reset';
  const subject = isReset ? "Reset your Ghumne Chale password" : "Verify your Ghumne Chale account";

  const htmlBody = `
    <div style="font-family: sans-serif; padding: 20px; color: #111;">
      <h2>Ghumne Chale</h2>
      <p>Hello,</p>
      <p>Your Ghumne Chale ${isReset ? 'password reset' : 'verification'} code is:</p>
      <div style="font-size: 24px; font-weight: bold; margin: 20px 0; letter-spacing: 2px; color: #d97706;">
        ${otp}
      </div>
      <p>This code expires in <strong>${expires_in_minutes || 10}</strong> minutes.</p>
      <p>If you did not request this, you can ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #ccc; margin: 20px 0;" />
      <p style="font-size: 12px; color: #666;">
        Ghumne Chale<br />
        Plan karo. Book karo. Ghoom aao.
      </p>
    </div>
  `;

  const textBody = `
Hello,

Your Ghumne Chale ${isReset ? 'password reset' : 'verification'} code is: ${otp}

This code expires in ${expires_in_minutes || 10} minutes.

If you did not request this, you can ignore this email.

Ghumne Chale
Plan karo. Book karo. Ghoom aao.
  `.trim();

  try {
    console.log(`[EMAIL SERVICE] Sending OTP to recipient=${masked}`);
    const info = await transporter.sendMail({
      from: `Ghumne Chale <${process.env.SMTP_FROM_EMAIL}>`,
      to: email,
      subject: subject,
      text: textBody,
      html: htmlBody
    });

    console.log(`[EMAIL SERVICE] OTP email delivered to recipient=${masked} message_id=${info.messageId}`);
    lastSendStatus = 'success';
    return res.json({ success: true, message_id: info.messageId });
  } catch (error) {
    console.error(`[EMAIL SERVICE] Failed to deliver OTP to recipient=${masked}:`, error.message);
    lastSendStatus = 'failure';
    lastErrorCategory = error.code || 'SEND_ERROR';
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/send-email', authenticate, async (req, res) => {
  const { email, subject, text, html, attachments } = req.body;
  if (!email || !subject) {
    return res.status(400).json({ success: false, error: "Missing email or subject parameter." });
  }

  if (!smtpConfigured || !transporter) {
    return res.status(500).json({ success: false, error: "SMTP configuration is incomplete" });
  }

  const masked = maskEmail(email);

  const mailOptions = {
    from: `Ghumne Chale <${process.env.SMTP_FROM_EMAIL}>`,
    to: email,
    subject: subject,
    text: text,
    html: html
  };

  if (attachments && Array.isArray(attachments)) {
    mailOptions.attachments = attachments.map(att => ({
      filename: att.filename,
      content: Buffer.from(att.content, 'base64'),
      contentType: att.type
    }));
  }

  try {
    console.log(`[EMAIL SERVICE] Sending email to recipient=${masked} subject="${subject}"`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL SERVICE] Email delivered to recipient=${masked} message_id=${info.messageId}`);
    lastSendStatus = 'success';
    return res.json({ success: true, message_id: info.messageId });
  } catch (error) {
    console.error(`[EMAIL SERVICE] Failed to deliver email to recipient=${masked}:`, error.message);
    lastSendStatus = 'failure';
    lastErrorCategory = error.code || 'SEND_ERROR';
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Email microservice running on port ${PORT}`);
});
