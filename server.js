/**
 * ═══════════════════════════════════════════════════════════════════
 *  BHAALA Portfolio — Express Backend  (v3)
 *
 *  Routes:
 *    POST /register              — register user (bcrypt hashed password)
 *    POST /login                 — authenticate + login activity tracking
 *    POST /contact               — send contact email via Nodemailer
 *    GET  /admin/login-history   — secure admin: view login history
 *
 *  Security:
 *    • bcryptjs    — password hashing (saltRounds=12)
 *    • Hybrid pw   — auto-upgrades legacy plain-text passwords silently
 *    • Rate limit  — /contact: 3 req/15 min per IP
 *    • Honeypot    — bot trap on contact form
 *    • Sanitise    — strips HTML tags from all text inputs
 *    • UA parser   — device/browser/OS detection on login
 *    • Geolocation — ip-api.com (free, no key) for country/city on login
 * ═══════════════════════════════════════════════════════════════════
 */

'use strict';

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const ExcelJS    = require('exceljs');
const path       = require('path');
const fs         = require('fs');
const https      = require('https');
const nodemailer = require('nodemailer');
const rateLimit  = require('express-rate-limit');
const bcrypt     = require('bcryptjs');
const UAParser   = require('ua-parser-js');

const app  = express();
const PORT = process.env.PORT || 3000;

// ──────────────────────────────────────────────────────────────
//  Excel file paths & column maps
// ──────────────────────────────────────────────────────────────

// Users workbook
const USERS_FILE = path.join(__dirname, 'users.xlsx');
const U_COL      = { NAME: 1, EMAIL: 2, PASSWORD: 3, PHONE: 4, REGISTERED_AT: 5 };
const U_HEADERS  = ['Full Name', 'Email', 'Password', 'Phone', 'Registered At'];

// Login history workbook
const HIST_FILE    = path.join(__dirname, 'login_history.xlsx');
const H_COL        = { NAME: 1, EMAIL: 2, DATE: 3, TIME: 4, DEVICE: 5, BROWSER: 6, OS: 7, IP: 8, COUNTRY: 9, CITY: 10 };
const H_HEADERS    = ['Name', 'Email', 'Date (IST)', 'Time (IST)', 'Device Type', 'Browser', 'OS', 'IP Address', 'Country', 'City'];
const BCRYPT_ROUNDS = 12;

// ──────────────────────────────────────────────────────────────
//  Core middleware
// ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.set('trust proxy', true);   // trust X-Forwarded-For on Render/reverse proxy

// Redirect root → login page
app.get('/', (req, res) => res.redirect('/login.html'));

// Serve static files
app.use(express.static(__dirname));

// ──────────────────────────────────────────────────────────────
//  Rate limiter — /contact (3 per 15 min per IP)
// ──────────────────────────────────────────────────────────────
const contactLimiter = rateLimit({
    windowMs       : 15 * 60 * 1000,
    max            : 3,
    message        : { success: false, message: 'Too many messages. Please wait 15 minutes before trying again.' },
    standardHeaders: true,
    legacyHeaders  : false
});

// ──────────────────────────────────────────────────────────────
//  Nodemailer — Gmail SMTP transporter
// ──────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
    service : 'gmail',
    auth    : { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASS }
});

transporter.verify((err) => {
    if (err) {
        console.warn('⚠️  Nodemailer not ready —', err.message);
        console.warn('   Set GMAIL_USER and GMAIL_APP_PASS in .env');
    } else {
        console.log('✅  Nodemailer: Email transporter is ready.');
    }
});

// ──────────────────────────────────────────────────────────────
//  Helper utilities
// ──────────────────────────────────────────────────────────────

/** Strip HTML tags, collapse newlines, trim, cap length */
function sanitise(str = '', maxLen = 2000) {
    return String(str)
        .replace(/<[^>]*>/g, '')
        .replace(/\n{4,}/g, '\n\n')
        .trim()
        .slice(0, maxLen);
}

/** Basic email format check */
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Detect device type from raw User-Agent string */
function getDeviceType(uaString) {
    const ua = uaString.toLowerCase();
    if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) return 'Tablet';
    if (/mobile|android|iphone|ipod|blackberry|windows phone|opera mini/i.test(ua)) return 'Mobile';
    return 'Desktop';
}

/**
 * Fetch country + city from ip-api.com (free, no API key).
 * Falls back gracefully on timeout / localhost / private IPs.
 */
function getGeoLocation(ip) {
    return new Promise((resolve) => {
        const clean = (ip || '').replace(/^::ffff:/, '');

        // Private / loopback → no real geo data
        if (!clean || clean === '127.0.0.1' || clean === '::1'
            || clean.startsWith('192.168.') || clean.startsWith('10.')
            || clean.startsWith('172.')) {
            return resolve({ country: 'Localhost', city: 'Local Network' });
        }

        const url = `https://ip-api.com/json/${clean}?fields=status,country,city`;
        const req = https.get(url, (res) => {
            let raw = '';
            res.on('data', chunk => (raw += chunk));
            res.on('end', () => {
                try {
                    const json = JSON.parse(raw);
                    resolve(json.status === 'success'
                        ? { country: json.country || 'Unknown', city: json.city || 'Unknown' }
                        : { country: 'Unknown', city: 'Unknown' });
                } catch {
                    resolve({ country: 'Unknown', city: 'Unknown' });
                }
            });
        });
        req.on('error', () => resolve({ country: 'Unknown', city: 'Unknown' }));
        req.setTimeout(4000, () => { req.destroy(); resolve({ country: 'Unknown', city: 'Unknown' }); });
    });
}

// ──────────────────────────────────────────────────────────────
//  Excel workbook helpers
// ──────────────────────────────────────────────────────────────

/** Get or create the Users workbook + worksheet */
async function getUsersWorkbook() {
    const wb = new ExcelJS.Workbook();
    if (fs.existsSync(USERS_FILE)) await wb.xlsx.readFile(USERS_FILE);

    let ws = wb.getWorksheet('Users');
    if (!ws) {
        ws = wb.addWorksheet('Users');
        const hdr = ws.addRow(U_HEADERS);
        hdr.font      = { bold: true, color: { argb: 'FFFFFFFF' } };
        hdr.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6C0B0B' } };
        hdr.alignment = { horizontal: 'center' };
        ws.getColumn(U_COL.NAME).width          = 25;
        ws.getColumn(U_COL.EMAIL).width         = 32;
        ws.getColumn(U_COL.PASSWORD).width      = 65;   // wider for bcrypt hashes
        ws.getColumn(U_COL.PHONE).width         = 18;
        ws.getColumn(U_COL.REGISTERED_AT).width = 26;
        await wb.xlsx.writeFile(USERS_FILE);
    }
    return { wb, ws };
}

/** Get or create the Login History workbook + worksheet */
async function getHistoryWorkbook() {
    const wb = new ExcelJS.Workbook();
    if (fs.existsSync(HIST_FILE)) await wb.xlsx.readFile(HIST_FILE);

    let ws = wb.getWorksheet('Login History');
    if (!ws) {
        ws = wb.addWorksheet('Login History');
        const hdr = ws.addRow(H_HEADERS);
        hdr.font      = { bold: true, color: { argb: 'FFFFFFFF' } };
        hdr.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6C0B0B' } };
        hdr.alignment = { horizontal: 'center' };
        [25, 32, 16, 12, 12, 20, 20, 18, 18, 18].forEach((w, i) => {
            ws.getColumn(i + 1).width = w;
        });
        await wb.xlsx.writeFile(HIST_FILE);
    }
    return { wb, ws };
}

/**
 * Append a login event to login_history.xlsx.
 * Non-fatal: logs error but does not crash the login response.
 */
async function saveLoginHistory({ name, email, device, browser, os, ip, country, city }) {
    try {
        const { wb, ws } = await getHistoryWorkbook();
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
        const timeStr = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });

        const row = ws.addRow([name, email, dateStr, timeStr, device, browser, os, ip, country, city]);
        row.alignment = { vertical: 'middle' };

        await wb.xlsx.writeFile(HIST_FILE);
    } catch (err) {
        console.error('⚠️  Login history save error:', err.message);
    }
}

// ──────────────────────────────────────────────────────────────
//  Login notification email template
// ──────────────────────────────────────────────────────────────
function buildLoginEmail({ name, email, date, time, device, browser, os, ip, country, city }) {
    const field = (icon, label, value) => `
      <div class="field">
        <div class="label">${icon} ${label}</div>
        <div class="value">${value}</div>
      </div>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;background:#0a0a0a;margin:0;padding:0}
  .wrap{max-width:640px;margin:32px auto;background:#120202;border-radius:18px;overflow:hidden;border:1px solid #3d0a0a;box-shadow:0 20px 60px rgba(0,0,0,0.8)}
  .head{background:linear-gradient(135deg,#f81313,#c0030e);padding:30px 36px;text-align:center}
  .head h1{margin:0;color:#fff;font-size:24px;font-weight:800;letter-spacing:0.5px}
  .head p{margin:8px 0 0;color:rgba(255,255,255,0.75);font-size:14px}
  .alert-badge{display:inline-block;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);border-radius:30px;padding:5px 16px;font-size:12px;color:#fff;font-weight:700;letter-spacing:1px;margin-bottom:10px}
  .body{padding:32px 36px}
  .section-title{font-size:11px;font-weight:800;color:#ffd369;text-transform:uppercase;letter-spacing:2px;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.08)}
  .fields-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px}
  .field{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px 16px}
  .label{font-size:10px;font-weight:700;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1.2px;margin-bottom:5px}
  .value{font-size:14px;font-weight:600;color:#fff;word-break:break-all}
  .field.full{grid-column:1/-1}
  .warning{background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:12px;padding:16px 20px;margin-top:8px;color:rgba(255,255,255,0.7);font-size:13px;line-height:1.6}
  .warning strong{color:#ffd369}
  .foot{padding:20px 36px;background:rgba(0,0,0,0.5);text-align:center;color:rgba(255,255,255,0.3);font-size:12px;border-top:1px solid rgba(255,255,255,0.05)}
  @media(max-width:480px){.fields-grid{grid-template-columns:1fr}.body{padding:24px 20px}}
</style>
</head>
<body>
<div class="wrap">
  <div class="head">
    <div class="alert-badge">🔐 LOGIN ALERT</div>
    <h1>New Login Detected</h1>
    <p>Someone just signed in to your Bhaala Portfolio</p>
  </div>
  <div class="body">
    <div class="section-title">👤 User Details</div>
    <div class="fields-grid">
      ${field('👤','Full Name', name)}
      ${field('📧','Email', email)}
    </div>
    <div class="section-title">🕐 Login Time</div>
    <div class="fields-grid">
      ${field('📅','Date', date)}
      ${field('⏰','Time (IST)', time)}
    </div>
    <div class="section-title">💻 Device & Browser</div>
    <div class="fields-grid">
      ${field('📱','Device Type', device)}
      ${field('🌐','Browser', browser)}
      ${field('🖥️','Operating System', os)}
      ${field('🔌','IP Address', ip)}
      ${field('🌍','Country', country)}
      ${field('📍','City', city)}
    </div>
    <div class="warning">
      ⚠️ <strong>Not you?</strong> If this login looks unfamiliar, review your account activity immediately and consider changing your password.
    </div>
  </div>
  <div class="foot">Bhaala Portfolio · Login Notification · ${date} ${time}</div>
</div>
</body>
</html>`;
}

// ══════════════════════════════════════════════════════════════
//  POST /register — Register new user (bcrypt password hashing)
// ══════════════════════════════════════════════════════════════
app.post('/register', async (req, res) => {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password || !phone) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
    if (!isValidEmail(email)) {
        return res.status(400).json({ success: false, message: 'Invalid email address.' });
    }
    if (password.length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const safeName  = sanitise(name, 100);
    const safeEmail = sanitise(email, 150).toLowerCase();
    const safePhone = sanitise(phone, 20);

    try {
        const { wb, ws } = await getUsersWorkbook();

        // Check duplicate email
        let exists = false;
        ws.eachRow((row, n) => {
            if (n === 1) return;
            const cell = (row.getCell(U_COL.EMAIL).value || '').toString().toLowerCase();
            if (cell === safeEmail) exists = true;
        });

        if (exists) {
            return res.status(409).json({ success: false, message: 'Email already registered. Please login.' });
        }

        // Hash password with bcrypt (12 rounds)
        const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

        ws.addRow([
            safeName,
            safeEmail,
            hashedPassword,
            safePhone,
            new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
        ]);

        await wb.xlsx.writeFile(USERS_FILE);
        console.log(`✅ Registered: ${safeName} (${safeEmail})`);
        return res.json({ success: true, message: 'Registration successful! You can now login.' });

    } catch (err) {
        console.error('Register error:', err.message);
        return res.status(500).json({ success: false, message: 'Server error during registration. Please try again.' });
    }
});

// ══════════════════════════════════════════════════════════════
//  POST /login — Authenticate user + track login activity
// ══════════════════════════════════════════════════════════════
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }
    if (!isValidEmail(email)) {
        return res.status(400).json({ success: false, message: 'Invalid email format.' });
    }
    if (!fs.existsSync(USERS_FILE)) {
        return res.status(401).json({ success: false, message: 'No users found. Please register first.' });
    }

    try {
        const { wb, ws } = await getUsersWorkbook();

        // Collect all user rows for comparison
        const users = [];
        ws.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            users.push({
                rowNumber,
                name     : (row.getCell(U_COL.NAME).value     || '').toString(),
                email    : (row.getCell(U_COL.EMAIL).value    || '').toString().toLowerCase(),
                password : (row.getCell(U_COL.PASSWORD).value || '').toString(),
                row
            });
        });

        // Find the user by email first
        const user = users.find(u => u.email === email.toLowerCase());

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        // ── Hybrid bcrypt check ─────────────────────────────────────
        // Hashes produced by bcryptjs start with $2b$ or $2a$
        const isHashed = user.password.startsWith('$2b$') || user.password.startsWith('$2a$');
        let passwordMatch = false;

        if (isHashed) {
            passwordMatch = await bcrypt.compare(password, user.password);
        } else {
            // Legacy plain-text password — compare directly
            passwordMatch = (user.password === password);

            if (passwordMatch) {
                // ── Silent auto-upgrade to bcrypt ──────────────────
                const newHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
                ws.getRow(user.rowNumber).getCell(U_COL.PASSWORD).value = newHash;
                await wb.xlsx.writeFile(USERS_FILE);
                console.log(`🔒 Auto-upgraded password to bcrypt for: ${user.email}`);
            }
        }

        if (!passwordMatch) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        // ── Login successful — gather activity data ─────────────────
        const uaString  = req.headers['user-agent'] || '';
        const parser    = new UAParser(uaString);
        const uaResult  = parser.getResult();
        const browser   = [uaResult.browser.name, uaResult.browser.version?.split('.')[0]].filter(Boolean).join(' ') || 'Unknown';
        const os        = [uaResult.os.name, uaResult.os.version].filter(Boolean).join(' ') || 'Unknown';
        const device    = getDeviceType(uaString);
        const rawIp     = req.ip || req.connection.remoteAddress || 'Unknown';
        const ip        = rawIp.replace(/^::ffff:/, '');

        const now       = new Date();
        const dateIST   = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
        const timeIST   = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

        // ── Geo lookup + history save + email (all async, don't block login) ──
        getGeoLocation(ip).then(async ({ country, city }) => {

            // 1. Save to login_history.xlsx
            await saveLoginHistory({
                name    : user.name,
                email   : user.email,
                device, browser, os, ip, country, city
            });

            // 2. Send login notification email
            try {
                const htmlBody = buildLoginEmail({
                    name    : user.name,
                    email   : user.email,
                    date    : dateIST,
                    time    : timeIST,
                    device, browser, os, ip, country, city
                });

                await transporter.sendMail({
                    from    : `"Bhaala Portfolio 🔐" <${process.env.GMAIL_USER}>`,
                    to      : process.env.GMAIL_USER,
                    subject : `🔐 Login Alert — ${user.name} signed in (${dateIST}, ${timeIST})`,
                    html    : htmlBody,
                    text    : `Login detected\n\nUser: ${user.name} (${user.email})\nDate: ${dateIST}  Time: ${timeIST}\nDevice: ${device}  Browser: ${browser}  OS: ${os}\nIP: ${ip}  Location: ${city}, ${country}`
                });

                console.log(`📧 Login notification sent for: ${user.name} (${user.email})`);
            } catch (mailErr) {
                console.error('⚠️  Login email error:', mailErr.message);
            }

        }).catch(err => console.error('⚠️  Geo lookup error:', err.message));

        // ── Respond to the client immediately (don't await email/geo) ──
        console.log(`✅ Login: ${user.name} (${user.email}) — ${device} / ${browser} / ${os}`);
        return res.json({
            success : true,
            message : `Welcome back, ${user.name}!`,
            name    : user.name
        });

    } catch (err) {
        console.error('Login error:', err.message);
        return res.status(500).json({ success: false, message: 'Server error during login. Please try again.' });
    }
});

// ══════════════════════════════════════════════════════════════
//  POST /contact — Send contact form email via Nodemailer
// ══════════════════════════════════════════════════════════════
app.post('/contact', contactLimiter, async (req, res) => {
    const { name, email, subject, message, _hp } = req.body;

    // Honeypot bot trap
    if (_hp && _hp.trim() !== '') {
        return res.json({ success: true, message: 'Message sent successfully!' });
    }

    if (!name || !email || !subject || !message) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
    if (!isValidEmail(email)) {
        return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    const safeName    = sanitise(name, 100);
    const safeEmail   = sanitise(email, 150);
    const safeSubject = sanitise(subject, 200);
    const safeMessage = sanitise(message, 2000);

    if (safeName.length < 2)     return res.status(400).json({ success: false, message: 'Name is too short.' });
    if (safeSubject.length < 3)  return res.status(400).json({ success: false, message: 'Subject is too short.' });
    if (safeMessage.length < 10) return res.status(400).json({ success: false, message: 'Message is too short (min 10 characters).' });

    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8">
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;background:#0f0f0f;margin:0;padding:0}
  .wrap{max-width:620px;margin:32px auto;background:#1a0505;border-radius:16px;overflow:hidden;border:1px solid #3d0a0a}
  .head{background:linear-gradient(135deg,#f81313,#c0030e);padding:32px 36px;text-align:center}
  .head h1{margin:0;color:#fff;font-size:26px;font-weight:800}
  .head p{margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:14px}
  .body{padding:36px}
  .field{margin-bottom:22px}
  .label{font-size:11px;font-weight:700;color:#ffd369;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px}
  .value{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:14px 18px;color:#fff;font-size:15px;line-height:1.7;word-break:break-word}
  .msg-val{min-height:100px;white-space:pre-wrap}
  .foot{padding:22px 36px;background:rgba(0,0,0,0.4);text-align:center;color:rgba(255,255,255,0.35);font-size:13px;border-top:1px solid rgba(255,255,255,0.06)}
  .reply-btn{display:inline-block;margin-top:20px;padding:12px 28px;background:linear-gradient(135deg,#f81313,#c0030e);color:#fff;text-decoration:none;border-radius:30px;font-weight:700;font-size:14px}
</style>
</head>
<body>
<div class="wrap">
  <div class="head">
    <h1>📬 New Message — Bhaala Portfolio</h1>
    <p>Someone reached out through your contact form</p>
  </div>
  <div class="body">
    <div class="field"><div class="label">👤 Full Name</div><div class="value">${safeName}</div></div>
    <div class="field"><div class="label">📧 Email</div><div class="value">${safeEmail}</div></div>
    <div class="field"><div class="label">📌 Subject</div><div class="value">${safeSubject}</div></div>
    <div class="field"><div class="label">💬 Message</div><div class="value msg-val">${safeMessage}</div></div>
    <div style="text-align:center">
      <a href="mailto:${safeEmail}?subject=Re: ${encodeURIComponent(safeSubject)}" class="reply-btn">↩ Reply to ${safeName}</a>
    </div>
  </div>
  <div class="foot">Sent on ${timestamp} · Bhaala Portfolio Contact Form · IP: ${req.ip}</div>
</div>
</body>
</html>`;

    try {
        await transporter.sendMail({
            from    : `"Bhaala Portfolio" <${process.env.GMAIL_USER}>`,
            to      : process.env.GMAIL_USER,
            replyTo : safeEmail,
            subject : `[Portfolio] ${safeSubject} — from ${safeName}`,
            html    : htmlBody,
            text    : `From: ${safeName} <${safeEmail}>\nSubject: ${safeSubject}\n\n${safeMessage}\n\nSent: ${timestamp}`
        });
        console.log(`✅ Contact email from ${safeName} (${safeEmail})`);
        return res.json({ success: true, message: 'Message sent successfully! I will get back to you soon.' });
    } catch (err) {
        console.error('❌ Contact email error:', err.message);
        return res.status(500).json({
            success : false,
            message : 'Failed to send message. Please email directly: bhaalavishvanathan17@gmail.com'
        });
    }
});

// ══════════════════════════════════════════════════════════════
//  GET /admin/login-history — Secure admin endpoint
//  Usage: /admin/login-history?key=YOUR_ADMIN_PASSWORD
// ══════════════════════════════════════════════════════════════
app.get('/admin/login-history', async (req, res) => {
    const providedKey = req.query.key || req.headers['x-admin-key'] || '';

    if (!process.env.ADMIN_PASSWORD || providedKey !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }

    if (!fs.existsSync(HIST_FILE)) {
        return res.json({ success: true, records: [], total: 0 });
    }

    try {
        const { ws } = await getHistoryWorkbook();
        const records = [];

        ws.eachRow((row, n) => {
            if (n === 1) return; // skip header
            records.push({
                name    : (row.getCell(H_COL.NAME).value    || '').toString(),
                email   : (row.getCell(H_COL.EMAIL).value   || '').toString(),
                date    : (row.getCell(H_COL.DATE).value    || '').toString(),
                time    : (row.getCell(H_COL.TIME).value    || '').toString(),
                device  : (row.getCell(H_COL.DEVICE).value  || '').toString(),
                browser : (row.getCell(H_COL.BROWSER).value || '').toString(),
                os      : (row.getCell(H_COL.OS).value      || '').toString(),
                ip      : (row.getCell(H_COL.IP).value      || '').toString(),
                country : (row.getCell(H_COL.COUNTRY).value || '').toString(),
                city    : (row.getCell(H_COL.CITY).value    || '').toString()
            });
        });

        // Return most recent first
        records.reverse();
        return res.json({ success: true, records, total: records.length });

    } catch (err) {
        console.error('Admin history error:', err.message);
        return res.status(500).json({ success: false, message: 'Error reading login history.' });
    }
});

// ══════════════════════════════════════════════════════════════
//  Start Server
// ══════════════════════════════════════════════════════════════
app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║   BHAALA Portfolio — Server Running  v3  ║');
    console.log(`║   http://localhost:${PORT}                   ║`);
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
});
