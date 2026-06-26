import { useState, useRef } from 'react';
import emailjs from '@emailjs/browser';
import './Contact.css';

// ── EmailJS credentials (set these in frontend/.env) ──────────────────────────
// VITE_EMAILJS_SERVICE_ID   = your EmailJS service ID  (e.g. service_xxxxxxx)
// VITE_EMAILJS_TEMPLATE_ID  = your EmailJS template ID (e.g. template_xxxxxxx)
// VITE_EMAILJS_PUBLIC_KEY   = your EmailJS public key  (e.g. aBcDeFgHiJkLmNoP)
const EJS_SERVICE  = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const EJS_TEMPLATE = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const EJS_KEY      = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

const LINKS = [
  { icon: '📧', label: 'Email Me',  href: 'mailto:bhaalavishvanathan17@gmail.com', type: 'email'  },
  { icon: '💼', label: 'LinkedIn',  href: 'https://www.linkedin.com/in/bhaalavishvanathan-c-59576a312/', type: 'social' },
  { icon: '🐙', label: 'GitHub',    href: 'https://github.com/bhaalavishvanathan17-glitch', type: 'social' },
  { icon: '📞', label: 'Call',      href: 'tel:+919361000742', type: 'phone'  },
  { icon: '💬', label: 'WhatsApp',  href: 'https://wa.me/919361000742', type: 'chat'   },
  { icon: '📸', label: 'Instagram', href: 'https://www.instagram.com/_bhaala_/', type: 'social' },
];

export default function Contact() {
  const formRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');

    // Guard: make sure EmailJS keys are configured
    if (!EJS_SERVICE || !EJS_TEMPLATE || !EJS_KEY) {
      setErrorMsg(
        '⚠️ Email not configured yet. Please add VITE_EMAILJS_SERVICE_ID, ' +
        'VITE_EMAILJS_TEMPLATE_ID, and VITE_EMAILJS_PUBLIC_KEY to your frontend/.env file.'
      );
      setStatus('error');
      setTimeout(() => setStatus('idle'), 6000);
      return;
    }

    setStatus('sending');

    try {
      await emailjs.sendForm(EJS_SERVICE, EJS_TEMPLATE, formRef.current, { publicKey: EJS_KEY });
      setStatus('sent');
      formRef.current.reset();
    } catch (err) {
      console.error('EmailJS error:', err);
      setErrorMsg(`❌ Failed to send: ${err?.text || err?.message || 'Unknown error'}`);
      setStatus('error');
    }

    setTimeout(() => { setStatus('idle'); setErrorMsg(''); }, 5000);
  }

  const btnLabel = {
    idle:    '🚀 Send Message',
    sending: '⏳ Sending…',
    sent:    '✅ Message Sent!',
    error:   '❌ Failed — try again',
  }[status];

  return (
    <section className="contact-section section-pad" id="contact">
      <div className="contact-overlay" />
      <div className="container" style={{ position: 'relative', zIndex: 1 }}>

        <div className="text-center animate-fade-up">
          <p className="section-label">Get In Touch</p>
          <h2 className="section-title" style={{ color: '#fff' }}>Let's Connect</h2>
          <p className="section-subtitle" style={{ color: 'rgba(255,255,255,.6)' }}>
            Feel free to reach out — I'm always open to opportunities, collaboration, and conversation.
          </p>
          <div className="divider-bar" />
        </div>

        {/* Social / contact quicklinks */}
        <div className="contact-links animate-fade-up delay-1">
          {LINKS.map(l => (
            <a
              key={l.label}
              href={l.href}
              className="contact-link"
              target={l.href.startsWith('http') ? '_blank' : undefined}
              rel="noreferrer"
            >
              {l.icon} {l.label}
            </a>
          ))}
        </div>

        {/* Contact form */}
        <div className="contact-form-wrap animate-fade-up delay-2">
          <h3>Send a Message</h3>

          {/* Status banners */}
          {status === 'sent' && (
            <div className="ejs-banner ejs-success">
              ✅ Your message has been sent! I'll get back to you soon. 🙏
            </div>
          )}
          {status === 'error' && errorMsg && (
            <div className="ejs-banner ejs-error">{errorMsg}</div>
          )}

          <form className="contact-form" ref={formRef} onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-field">
                <label htmlFor="cf-name">Full Name</label>
                {/* name="from_name" maps to {{from_name}} in EmailJS template */}
                <input id="cf-name" name="from_name" type="text" placeholder="Your name" required />
              </div>
              <div className="form-field">
                <label htmlFor="cf-email">Email</label>
                {/* name="reply_to" maps to {{reply_to}} in EmailJS template */}
                <input id="cf-email" name="reply_to" type="email" placeholder="you@example.com" required />
              </div>
            </div>
            <div className="form-field">
              <label htmlFor="cf-message">Message</label>
              {/* name="message" maps to {{message}} in EmailJS template */}
              <textarea id="cf-message" name="message" rows={5} placeholder="Write your message here…" required />
            </div>
            <button
              type="submit"
              className="btn-primary submit-btn"
              disabled={status === 'sending'}
            >
              {btnLabel}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
