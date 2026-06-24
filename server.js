/**
 * ═══════════════════════════════════════════════════════════════
 *  BHAALA Portfolio — Express Backend
 *  Features:
 *    • Static file serving
 *    • POST /register  — save user to Excel
 *    • POST /login     — verify user from Excel
 *    • POST /contact   — send email via Nodemailer (Gmail SMTP)
 * ═══════════════════════════════════════════════════════════════
 */

'use strict';

require('dotenv').config();                      // Load .env secrets

const express    = require('express');
const cors       = require('cors');
const ExcelJS    = require('exceljs');
const path       = require('path');
const fs         = require('fs');
const nodemailer = require('nodemailer');
const rateLimit  = require('express-rate-limit');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Excel storage path ────────────────────────────────────────
const EXCEL_FILE = path.join(__dirname, 'users.xlsx');

// Column positions (1-indexed) — MUST match the header order below
const COL     = { NAME: 1, EMAIL: 2, PASSWORD: 3, PHONE: 4, REGISTERED_AT: 5 };
const HEADERS = ['Full Name', 'Email', 'Password', 'Phone', 'Registered At'];

// ─── Core middleware ───────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Redirect root → login page ───────────────────────────────
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

// ─── Serve all static files (HTML, CSS, images, videos) ───────
app.use(express.static(__dirname));

// ═══════════════════════════════════════════════════════════════
//  RATE LIMITER — /contact  (max 3 submissions per 15 minutes)
// ═══════════════════════════════════════════════════════════════
const contactLimiter = rateLimit({
    windowMs : 15 * 60 * 1000,   // 15 minutes
    max      : 3,                 // limit each IP to 3 requests per window
    message  : {
        success : false,
        message : 'Too many messages sent from your IP. Please wait 15 minutes before trying again.'
    },
    standardHeaders : true,
    legacyHeaders   : false
});

// ═══════════════════════════════════════════════════════════════
//  NODEMAILER — Gmail SMTP transporter
// ═══════════════════════════════════════════════════════════════
const transporter = nodemailer.createTransport({
    service : 'gmail',
    auth    : {
        user : process.env.GMAIL_USER,
        pass : process.env.GMAIL_APP_PASS
    }
});

// Verify transporter config on startup (non-fatal if app password not set yet)
transporter.verify((err) => {
    if (err) {
        console.warn('⚠️  Nodemailer: Email transporter not ready —', err.message);
        console.warn('   Make sure GMAIL_USER and GMAIL_APP_PASS are set in your .env file.');
    } else {
        console.log('✅  Nodemailer: Email transporter is ready.');
    }
});

// ─────────────────────────────────────────────
// Helper: sanitise a string (strip HTML tags)
// ─────────────────────────────────────────────
function sanitise(str = '') {
    return String(str)
        .replace(/<[^>]*>/g, '')   // strip HTML tags
        .replace(/\n{4,}/g, '\n\n') // collapse excessive newlines
        .trim()
        .slice(0, 2000);            // hard cap length
}

// ─────────────────────────────────────────────
// Helper: validate email format
// ─────────────────────────────────────────────
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ═══════════════════════════════════════════════════════════════
//  POST /contact — Send message to bhaalavishvanathan17@gmail.com
// ═══════════════════════════════════════════════════════════════
app.post('/contact', contactLimiter, async (req, res) => {
    const { name, email, subject, message, _hp } = req.body;

    // ── Honeypot bot trap (bots fill hidden fields; humans don't) ──
    if (_hp && _hp.trim() !== '') {
        // Silently accept to not alert bots, but don't send email
        return res.json({ success: true, message: 'Message sent successfully!' });
    }

    // ── Field validation ──────────────────────────────────────────
    if (!name || !email || !subject || !message) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    if (!isValidEmail(email)) {
        return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    // ── Sanitise all inputs ───────────────────────────────────────
    const safeName    = sanitise(name);
    const safeEmail   = sanitise(email);
    const safeSubject = sanitise(subject);
    const safeMessage = sanitise(message);

    if (safeName.length < 2)    return res.status(400).json({ success: false, message: 'Name is too short.' });
    if (safeSubject.length < 3) return res.status(400).json({ success: false, message: 'Subject is too short.' });
    if (safeMessage.length < 10) return res.status(400).json({ success: false, message: 'Message is too short (min 10 characters).' });

    // ── Compose email ──────────────────────────────────────────────
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body       { font-family: 'Segoe UI', Arial, sans-serif; background: #0f0f0f; margin: 0; padding: 0; }
    .wrapper   { max-width: 620px; margin: 32px auto; background: #1a0505; border-radius: 16px; overflow: hidden; border: 1px solid #3d0a0a; }
    .header    { background: linear-gradient(135deg, #f81313, #c0030e); padding: 32px 36px; text-align: center; }
    .header h1 { margin: 0; color: #fff; font-size: 26px; font-weight: 800; letter-spacing: 1px; }
    .header p  { margin: 6px 0 0; color: rgba(255,255,255,0.75); font-size: 14px; }
    .body      { padding: 36px; }
    .field     { margin-bottom: 22px; }
    .label     { font-size: 11px; font-weight: 700; color: #ffd369; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 6px; }
    .value     { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 14px 18px; color: #fff; font-size: 15px; line-height: 1.7; word-break: break-word; }
    .msg-value { min-height: 100px; white-space: pre-wrap; }
    .footer    { padding: 22px 36px; background: rgba(0,0,0,0.4); text-align: center; color: rgba(255,255,255,0.35); font-size: 13px; border-top: 1px solid rgba(255,255,255,0.06); }
    .reply-btn { display: inline-block; margin-top: 20px; padding: 12px 28px; background: linear-gradient(135deg,#f81313,#c0030e); color:#fff; text-decoration:none; border-radius: 30px; font-weight: 700; font-size: 14px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>📬 New Message — Bhaala Portfolio</h1>
      <p>Someone reached out through your contact form</p>
    </div>
    <div class="body">
      <div class="field">
        <div class="label">👤 Full Name</div>
        <div class="value">${safeName}</div>
      </div>
      <div class="field">
        <div class="label">📧 Email Address</div>
        <div class="value">${safeEmail}</div>
      </div>
      <div class="field">
        <div class="label">📌 Subject</div>
        <div class="value">${safeSubject}</div>
      </div>
      <div class="field">
        <div class="label">💬 Message</div>
        <div class="value msg-value">${safeMessage}</div>
      </div>
      <div style="text-align:center;">
        <a href="mailto:${safeEmail}?subject=Re: ${encodeURIComponent(safeSubject)}" class="reply-btn">↩ Reply to ${safeName}</a>
      </div>
    </div>
    <div class="footer">
      Sent on ${timestamp} · via Bhaala Portfolio Contact Form<br>
      Sender IP: ${req.ip}
    </div>
  </div>
</body>
</html>
`;

    const mailOptions = {
        from    : `"Bhaala Portfolio" <${process.env.GMAIL_USER}>`,
        to      : process.env.GMAIL_USER,                  // deliver to yourself
        replyTo : safeEmail,                               // reply goes to sender
        subject : `[Portfolio] ${safeSubject} — from ${safeName}`,
        html    : htmlBody,
        text    : `New contact form message\n\nFrom: ${safeName} <${safeEmail}>\nSubject: ${safeSubject}\n\n${safeMessage}\n\nSent: ${timestamp}`
    };

    // ── Send ───────────────────────────────────────────────────────
    try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ Contact email sent from ${safeName} (${safeEmail})`);
        return res.json({ success: true, message: 'Message sent successfully! I will get back to you soon.' });
    } catch (err) {
        console.error('❌ Contact email error:', err.message);
        return res.status(500).json({
            success : false,
            message : 'Failed to send message. Please try emailing directly at bhaalavishvanathan17@gmail.com'
        });
    }
});

// ═══════════════════════════════════════════════════════════════
//  POST /register — Save new user to Excel
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────
// Helper: get or create workbook + worksheet
// ─────────────────────────────────────────────
async function getWorkbook() {
    const wb = new ExcelJS.Workbook();

    if (fs.existsSync(EXCEL_FILE)) {
        await wb.xlsx.readFile(EXCEL_FILE);
    }

    let ws = wb.getWorksheet('Users');

    if (!ws) {
        ws = wb.addWorksheet('Users');

        // Write header row using array (no key reliance)
        const headerRow = ws.addRow(HEADERS);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = {
            type    : 'pattern',
            pattern : 'solid',
            fgColor : { argb: 'FF6C0B0B' }
        };
        headerRow.alignment = { horizontal: 'center' };

        // Set column widths
        ws.getColumn(COL.NAME).width          = 25;
        ws.getColumn(COL.EMAIL).width         = 32;
        ws.getColumn(COL.PASSWORD).width      = 20;
        ws.getColumn(COL.PHONE).width         = 18;
        ws.getColumn(COL.REGISTERED_AT).width = 26;

        await wb.xlsx.writeFile(EXCEL_FILE);
    }

    return { wb, ws };
}

app.post('/register', async (req, res) => {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password || !phone) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    try {
        const { wb, ws } = await getWorkbook();

        // Check if email already exists (skip header row 1)
        let emailExists = false;
        ws.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            const cellVal = row.getCell(COL.EMAIL).value;
            if (cellVal && cellVal.toString().toLowerCase() === email.toLowerCase()) {
                emailExists = true;
            }
        });

        if (emailExists) {
            return res.status(409).json({ success: false, message: 'Email already registered. Please login.' });
        }

        // Add new row using array — reliable regardless of key mapping
        ws.addRow([
            name,
            email,
            password,
            phone,
            new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
        ]);

        await wb.xlsx.writeFile(EXCEL_FILE);
        console.log(`✅ Registered: ${name} (${email})`);
        return res.json({ success: true, message: 'Registration successful! You can now login.' });

    } catch (err) {
        console.error('Register error:', err.message);
        return res.status(500).json({ success: false, message: 'Server error during registration. Please try again.' });
    }
});

// ═══════════════════════════════════════════════════════════════
//  POST /login — Verify user credentials from Excel
// ═══════════════════════════════════════════════════════════════
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    if (!fs.existsSync(EXCEL_FILE)) {
        return res.status(401).json({ success: false, message: 'No users found. Please register first.' });
    }

    try {
        const { ws } = await getWorkbook();
        let found    = false;
        let userName = '';

        ws.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // skip header
            const storedEmail    = (row.getCell(COL.EMAIL).value    || '').toString().toLowerCase();
            const storedPassword = (row.getCell(COL.PASSWORD).value || '').toString();
            const storedName     = (row.getCell(COL.NAME).value     || '').toString();

            if (storedEmail === email.toLowerCase() && storedPassword === password) {
                found    = true;
                userName = storedName;
            }
        });

        if (found) {
            console.log(`✅ Login: ${userName} (${email})`);
            return res.json({ success: true, message: `Welcome back, ${userName}!`, name: userName });
        } else {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

    } catch (err) {
        console.error('Login error:', err.message);
        return res.status(500).json({ success: false, message: 'Server error during login. Please try again.' });
    }
});

// ═══════════════════════════════════════════════════════════════
//  Start Server
// ═══════════════════════════════════════════════════════════════
app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║   BHAALA Portfolio — Server Running      ║');
    console.log(`║   http://localhost:${PORT}                   ║`);
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
});
