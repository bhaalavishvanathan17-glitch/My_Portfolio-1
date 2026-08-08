/**
 * ═══════════════════════════════════════════════════════════════════
 *  BHAALA Portfolio — Vercel Serverless Backend  (v6)
 *
 *  Routes:
 *    POST /register              — register user
 *    POST /login                 — authenticate + login activity tracking
 *    POST /contact               — send contact form email
 *    GET  /health                — SMTP/Resend status + env check (public)
 *    GET  /test-email            — admin: send live test email
 *    GET  /admin/login-history   — secure admin: view login history
 *    GET  /email-log             — secure admin: view email delivery log
 * ══════════════════════════════════════════════════════════════
 */

'use strict';

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const { Pool }   = require('pg');
const { Resend } = require('resend');
const path       = require('path');
const fs         = require('fs');
const https      = require('https');
const nodemailer = require('nodemailer');
const rateLimit  = require('express-rate-limit');

const app  = express();
const PORT = process.env.PORT || 3000;

// ──────────────────────────────────────────────────────────────
//  File paths & DB configs
// ──────────────────────────────────────────────────────────────

const EMAIL_LOG       = path.join(__dirname, '..', 'email_log.jsonl');

const MAX_EMAIL_LOG_LINES = 500;

// Hardcoded owner email
const OWNER_EMAIL = 'bhaalavishvanathan17@gmail.com';

// Live SMTP/Resend health flag
let smtpReady = false;
let smtpError = null;
let lastEmailSentAt = null;

// ──────────────────────────────────────────────────────────────
//  Core middleware
// ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.set('trust proxy', true);

// Serve static files from parent directory (local fallback)
app.use(express.static(path.join(__dirname, '..')));

// ──────────────────────────────────────────────────────────────
//  Rate limiter — /contact (3 per 15 min per IP)
// ──────────────────────────────────────────────────────────────
const contactLimiter = rateLimit({
    windowMs       : 15 * 60 * 1000,
    max            : 3,
    message        : { success: false, message: 'Too many messages. Please wait 15 minutes before trying again.' },
    standardHeaders: true,
    legacyHeaders  : false,
    validate       : { trustProxy: false }
});

// ──────────────────────────────────────────────────────────────
//  Nodemailer — Gmail SMTP transporter (Fallback)
// ──────────────────────────────────────────────────────────────
function createTransporter() {
    return nodemailer.createTransport({
        service          : 'gmail',
        auth             : {
            user: process.env.GMAIL_USER  || '',
            pass: process.env.GMAIL_APP_PASS || ''
        },
        connectionTimeout: 15000,
        greetingTimeout  : 15000,
        socketTimeout    : 20000,
        pool             : false
    });
}

// ──────────────────────────────────────────────────────────────
//  Resend Client Initialization
// ──────────────────────────────────────────────────────────────
let resendClient = null;
if (process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
    smtpReady = true;
    console.log('✅ Resend HTTP API client initialized.');
}

// Startup SMTP verification (only if Resend is not configured)
function verifySmtp() {
    if (resendClient) return;

    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASS;

    if (!gmailUser || !gmailPass) {
        smtpReady = false;
        smtpError = 'Email credentials missing (GMAIL_USER or RESEND_API_KEY).';
        console.warn('⚠️  Neither RESEND_API_KEY nor GMAIL credentials set.');
        logEmail({ type: 'STARTUP', status: 'FAIL', error: smtpError });
        return;
    }

    const transporter = createTransporter();
    transporter.verify((err) => {
        if (err) {
            smtpReady = false;
            smtpError = err.message;
            console.error(`❌ SMTP Verify Failed: ${err.message}`);
            logEmail({ type: 'STARTUP', status: 'FAIL', error: err.message });
        } else {
            smtpReady = true;
            smtpError = null;
            console.log(`✅ SMTP verified as fallback: ${gmailUser}`);
            logEmail({ type: 'STARTUP', status: 'OK', to: gmailUser });
        }
    });
}

function ts() {
    return new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });
}

// ──────────────────────────────────────────────────────────────
//  Database connection & Helpers
// ──────────────────────────────────────────────────────────────
let pool = null;
if (process.env.DATABASE_URL) {
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
    });
}

let dbInitialized = false;
async function ensureDbInit() {
    if (!dbInitialized) {
        await dbInit();
        dbInitialized = true;
    }
}

async function dbInit() {
    if (process.env.DATABASE_URL) {
        console.log(`🔌 Attempting to connect to PostgreSQL...`);
        try {
            await pool.query('SELECT NOW()');
            console.log('✅ PostgreSQL database connected successfully.');

            await pool.query(`
                CREATE TABLE IF NOT EXISTS email_logs (
                    id SERIAL PRIMARY KEY,
                    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    type VARCHAR(50) NOT NULL,
                    recipient VARCHAR(255) NOT NULL,
                    subject VARCHAR(255) NOT NULL,
                    status VARCHAR(50) NOT NULL,
                    message_id VARCHAR(255),
                    attempt INT NOT NULL,
                    error_message TEXT
                );
            `);
            console.log('✅ PostgreSQL tables verified/created.');
        } catch (err) {
            console.error('❌ Failed to initialize PostgreSQL:', err.message);
            console.error('⚠️ Falling back to local JSON files.');
            process.env.DATABASE_URL = '';
            initJsonDb();
        }
    } else {
        initJsonDb();
    }
}

function initJsonDb() {
    console.warn('⚠️ Using local JSON files database.');
    if (!fs.existsSync(EMAIL_LOG)) {
        fs.writeFileSync(EMAIL_LOG, '', 'utf8');
    }
}


async function dbLogEmail(entry) {
    const timestamp = new Date().toISOString();
    const type = entry.type || 'generic';
    const recipient = entry.to || OWNER_EMAIL;
    const subject = entry.subject || '';
    const status = entry.status || 'UNKNOWN';
    const messageId = entry.messageId || null;
    const attempt = entry.attempt || 1;
    const errorMessage = entry.error || null;

    if (status === 'SUCCESS' || status === 'OK') {
        if (type !== 'STARTUP') {
            console.log(`📧 [${ts()}] [${type}] ✅ Email sent (attempt ${attempt}) → ${recipient} | ID: ${messageId}`);
        }
    } else {
        console.error(`❌ [${ts()}] [${type}] Action failed: ${errorMessage || 'Unknown error'}`);
    }

    if (process.env.DATABASE_URL) {
        try {
            await pool.query(
                `INSERT INTO email_logs (timestamp, type, recipient, subject, status, message_id, attempt, error_message)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [timestamp, type, recipient, subject, status, messageId, attempt, errorMessage]
            );
        } catch (err) {
            console.error('⚠️  Could not write email log to PG:', err.message);
        }
    } else {
        const line = JSON.stringify({
            timestamp,
            type,
            to: recipient,
            subject,
            status,
            messageId,
            attempt,
            error: errorMessage
        }) + '\n';
        try {
            fs.appendFileSync(EMAIL_LOG, line, 'utf8');
        } catch (e) {
            console.error('⚠️  Could not write email_log.jsonl:', e.message);
        }
    }
}

async function dbGetEmailLogs() {
    if (process.env.DATABASE_URL) {
        const res = await pool.query('SELECT * FROM email_logs ORDER BY id DESC LIMIT 200');
        return res.rows.map(row => ({
            timestamp: row.timestamp,
            type: row.type,
            to: row.recipient,
            subject: row.subject,
            status: row.status,
            messageId: row.message_id,
            attempt: row.attempt,
            error: row.error_message
        }));
    } else {
        if (!fs.existsSync(EMAIL_LOG)) return [];
        try {
            const raw = fs.readFileSync(EMAIL_LOG, 'utf8');
            const lines = raw.trim().split('\n').filter(Boolean);
            const entries = lines.map(line => {
                try { return JSON.parse(line); } catch { return null; }
            }).filter(Boolean);
            entries.reverse();
            return entries.slice(0, 200);
        } catch (err) {
            console.error('Email log read error:', err.message);
            return [];
        }
    }
}

function logEmail(entry) {
    dbLogEmail(entry);
}

// ──────────────────────────────────────────────────────────────
//  sendMailWithRetry — HTTP Resend API with Nodemailer fallback
// ──────────────────────────────────────────────────────────────
async function sendMailWithRetry(mailOptions, type = 'generic', maxRetries = 3) {
    let lastError;

    if (!mailOptions.to || mailOptions.to === 'undefined') {
        mailOptions.to = OWNER_EMAIL;
        console.warn(`⚠️  [${type}] 'to' was undefined — using hardcoded owner email.`);
    }

    const fromAddress = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            let info;
            if (resendClient) {
                const data = await resendClient.emails.send({
                    from: `Bhaala Portfolio <${fromAddress}>`,
                    to: mailOptions.to,
                    replyTo: mailOptions.replyTo || OWNER_EMAIL,
                    subject: mailOptions.subject,
                    html: mailOptions.html,
                    text: mailOptions.text
                });

                if (data.error) {
                    throw new Error(data.error.message || 'Resend API error');
                }

                info = { messageId: data.data.id };
            } else {
                const freshTransporter = createTransporter();
                info = await freshTransporter.sendMail(mailOptions);
            }

            smtpReady = true;
            smtpError = null;
            lastEmailSentAt = new Date().toISOString();

            logEmail({
                type,
                status   : 'SUCCESS',
                to       : mailOptions.to,
                subject  : mailOptions.subject,
                messageId: info.messageId,
                attempt
            });
            return info;

        } catch (err) {
            lastError = err;
            smtpReady = false;
            smtpError = err.message;

            logEmail({
                type,
                status : 'FAIL',
                to     : mailOptions.to,
                subject: mailOptions.subject,
                attempt,
                error  : err.message
            });

            if (attempt < maxRetries) {
                const delay = attempt * 3000;
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }

    throw lastError;
}

// ──────────────────────────────────────────────────────────────
//  Helper utilities
// ──────────────────────────────────────────────────────────────
function sanitise(str = '', maxLen = 2000) {
    return String(str)
        .replace(/<[^>]*>/g, '')
        .replace(/\n{4,}/g, '\n\n')
        .trim()
        .slice(0, maxLen);
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getDeviceType(uaString) {
    if (/ipad|tablet|(android(?!.*mobile))/i.test(uaString)) return 'Tablet';
    if (/mobile|android|iphone|ipod|blackberry|windows phone|opera mini/i.test(uaString)) return 'Mobile';
    return 'Desktop';
}

function cleanIp(raw) {
    return (raw || 'Unknown').replace(/^::ffff:/, '').trim();
}

function getGeoLocation(ip) {
    return new Promise((resolve) => {
        const clean = cleanIp(ip);
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
//  Email HTML Templates
// ──────────────────────────────────────────────────────────────

function buildContactEmail({ name, email, subject, message, date, time, ip }) {
    return `<!DOCTYPE html>
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
  .meta-row{display:flex;gap:16px;margin-bottom:22px}
  .meta-field{flex:1;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:12px 16px}
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
    <div class="field"><div class="label">👤 Full Name</div><div class="value">${name}</div></div>
    <div class="field"><div class="label">📧 Email Address</div><div class="value">${email}</div></div>
    <div class="field"><div class="label">📌 Subject</div><div class="value">${subject}</div></div>
    <div class="field"><div class="label">💬 Message</div><div class="value msg-val">${message}</div></div>
    <div class="meta-row">
      <div class="meta-field"><div class="label">📅 Date</div><div class="value" style="font-size:13px">${date}</div></div>
      <div class="meta-field"><div class="label">⏰ Time (IST)</div><div class="value" style="font-size:13px">${time}</div></div>
    </div>
    <div style="text-align:center">
      <a href="mailto:${email}?subject=Re: ${encodeURIComponent(subject)}" class="reply-btn">↩ Reply to ${name}</a>
    </div>
  </div>
  <div class="foot">Sent on ${date} at ${time} · Bhaala Portfolio Contact Form · IP: ${ip}</div>
</div>
</body>
</html>`;
}

// ══════════════════════════════════════════════════════════════
//  POST /contact — Send contact form email
// ══════════════════════════════════════════════════════════════
app.post('/contact', contactLimiter, async (req, res) => {
    await ensureDbInit();
    const { name, email, subject, message, _hp } = req.body;

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

    const now       = new Date();
    const dateIST   = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
    const timeIST   = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    const ip        = cleanIp(req.ip || 'Unknown');

    console.log(`📨 [${ts()}] Contact form submission from ${safeName} <${safeEmail}> — subject: "${safeSubject}"`);

    try {
        await sendMailWithRetry({
            from   : `"Bhaala Portfolio" <${process.env.GMAIL_USER || OWNER_EMAIL}>`,
            to     : OWNER_EMAIL,
            replyTo: safeEmail,
            subject: `[Portfolio] ${safeSubject} — from ${safeName}`,
            html   : buildContactEmail({ name: safeName, email: safeEmail, subject: safeSubject, message: safeMessage, date: dateIST, time: timeIST, ip }),
            text   : `From: ${safeName} <${safeEmail}>\nSubject: ${safeSubject}\n\n${safeMessage}\n\nSent: ${dateIST} ${timeIST}`
        }, 'CONTACT_FORM');

        return res.json({ success: true, message: 'Message sent successfully! I will get back to you soon.' });

    } catch (err) {
        console.error('❌ Contact email permanently failed:', err.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to send message after multiple attempts. Please email directly: bhaalavishvanathan17@gmail.com'
        });
    }
});

// ══════════════════════════════════════════════════════════════
//  GET /health — Public: health checks
// ══════════════════════════════════════════════════════════════
app.get('/health', async (req, res) => {
    await ensureDbInit();
    const status = {
        server      : 'online',
        version     : 'v6-vercel',
        timestamp   : new Date().toISOString(),
        smtp: {
            ready       : smtpReady,
            error       : smtpError || null,
            lastSentAt  : lastEmailSentAt || null,
            emailProvider: resendClient ? 'Resend HTTP API' : 'Nodemailer SMTP Fallback',
            recipient   : OWNER_EMAIL
        }
    };
    const httpStatus = smtpReady ? 200 : 503;
    return res.status(httpStatus).json(status);
});

// ══════════════════════════════════════════════════════════════
//  GET /test-email — Admin: Send live test email
// ══════════════════════════════════════════════════════════════
app.get('/test-email', async (req, res) => {
    await ensureDbInit();
    const providedKey = req.query.key || req.headers['x-admin-key'] || '';

    if (!process.env.ADMIN_PASSWORD || providedKey !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }

    const now     = new Date();
    const dateIST = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
    const timeIST = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });

    try {
        const info = await sendMailWithRetry({
            from   : `"Bhaala Portfolio Test" <${process.env.GMAIL_USER || OWNER_EMAIL}>`,
            to     : OWNER_EMAIL,
            subject: `🔧 Production Email Test — ${dateIST} ${timeIST}`,
            html   : `<div style="font-family:Arial,sans-serif;background:#111;color:#fff;padding:32px;border-radius:12px;max-width:500px;margin:auto">
                        <h2 style="color:#4ade80">✅ Email Test Passed!</h2>
                        <p>This test email was sent directly from your hosting platform.</p>
                        <table style="width:100%;border-collapse:collapse;margin-top:16px">
                          <tr><td style="padding:8px;color:#aaa">Email Provider:</td><td style="padding:8px">${resendClient ? 'Resend HTTP API' : 'SMTP Fallback'}</td></tr>
                          <tr><td style="padding:8px;color:#aaa">Sent At:</td><td style="padding:8px">${dateIST} ${timeIST} IST</td></tr>
                          <tr><td style="padding:8px;color:#aaa">MessageID:</td><td style="padding:8px;font-size:11px;word-break:break-all">${info.messageId}</td></tr>
                        </table>
                      </div>`,
            text: `Email Test Passed!\nSent at ${dateIST} ${timeIST} IST.`
        }, 'TEST_EMAIL');

        return res.json({
            success  : true,
            message  : `✅ Test email sent to ${OWNER_EMAIL}`,
            messageId: info.messageId,
            sentAt   : `${dateIST} ${timeIST}`
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: `❌ Test email failed: ${err.message}`
        });
    }
});

// ══════════════════════════════════════════════════════════════
//  GET /email-log — Secure admin: email delivery log
// ══════════════════════════════════════════════════════════════
app.get('/email-log', async (req, res) => {
    await ensureDbInit();
    const providedKey = req.query.key || req.headers['x-admin-key'] || '';

    if (!process.env.ADMIN_PASSWORD || providedKey !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }

    try {
        const entries = await dbGetEmailLogs();
        return res.json({
            success: true,
            entries: entries,
            total  : entries.length,
            showing: entries.length
        });
    } catch (err) {
        console.error('Email log read error:', err.message);
        return res.status(500).json({ success: false, message: 'Error reading email log.' });
    }
});


// ══════════════════════════════════════════════════════════════
//  Start Server (for local standalone testing)
// ══════════════════════════════════════════════════════════════
if (require.main === module || !process.env.VERCEL) {
    app.listen(PORT, async () => {
        console.log('');
        console.log('╔══════════════════════════════════════════╗');
        console.log('║   BHAALA Portfolio — Server Running  v6  ║');
        console.log(`║   http://localhost:${PORT}                   ║`);
        console.log('╚══════════════════════════════════════════╝');
        console.log('');
        console.log(`📁 Email log  → ${EMAIL_LOG}`);
        console.log(`📧 Owner mail → ${OWNER_EMAIL}`);
        console.log(`🔍 Health     → http://localhost:${PORT}/health`);
        console.log('');

        // Initialize database
        await dbInit();

        // Verify SMTP fallback
        verifySmtp();
    });
}

module.exports = app;
