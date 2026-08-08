from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
import smtplib
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

app = FastAPI(title="Bhaala Portfolio API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Email config ──────────────────────────────
GMAIL_SENDER   = os.getenv("GMAIL_SENDER")
GMAIL_APP_PASS = os.getenv("GMAIL_APP_PASSWORD")
NOTIFY_EMAIL   = "bhaalavishvanathan17@gmail.com"


class ContactForm(BaseModel):
    name:    str
    email:   EmailStr
    message: str


def send_email(subject: str, html_body: str) -> bool:
    if not GMAIL_SENDER or not GMAIL_APP_PASS:
        print("⚠️  Email not configured — skipping.")
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = f"Bhaala Portfolio <{GMAIL_SENDER}>"
        msg["To"]      = NOTIFY_EMAIL
        msg.attach(MIMEText(html_body, "html"))
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(GMAIL_SENDER, GMAIL_APP_PASS)
            server.sendmail(GMAIL_SENDER, NOTIFY_EMAIL, msg.as_string())
        print(f"✅ Email sent → {NOTIFY_EMAIL}")
        return True
    except Exception as e:
        print(f"⚠️  Email failed: {e}")
        return False


# ── Routes ────────────────────────────────────

@app.get("/")
@app.get("/api")
def root():
    return {"app": "Bhaala Portfolio API", "status": "running ✅", "version": "1.0.0"}


@app.get("/api/health")
def health():
    return {"status": "ok", "message": "Bhaala Portfolio API is running 🚀"}


@app.post("/api/contact")
async def contact(form: ContactForm):
    """
    Called after contact form — sends an email notification to the owner.
    """
    now = datetime.utcnow().strftime("%d-%m-%Y %H:%M:%S UTC")
    send_email(
        subject=f"📬 New Message from {form.name}",
        html_body=f"""
        <html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:24px;">
          <div style="max-width:520px;margin:auto;background:#fff;border-radius:10px;
                      box-shadow:0 2px 8px rgba(0,0,0,.12);overflow:hidden;">
            <div style="background:#6C0B0B;padding:20px 28px;">
              <h2 style="color:#fff;margin:0;">📬 New Contact Message — Bhaala Portfolio</h2>
            </div>
            <div style="padding:24px 28px;">
              <table style="width:100%;border-collapse:collapse;font-size:15px;">
                <tr><td style="padding:8px 0;color:#555;width:120px;"><b>From</b></td>
                    <td style="padding:8px 0;">{form.name}</td></tr>
                <tr style="background:#fafafa;"><td style="padding:8px 6px;color:#555;"><b>Email</b></td>
                    <td style="padding:8px 6px;">{form.email}</td></tr>
                <tr><td style="padding:8px 0;color:#555;vertical-align:top;"><b>Message</b></td>
                    <td style="padding:8px 0;">{form.message}</td></tr>
                <tr style="background:#fafafa;"><td style="padding:8px 6px;color:#555;"><b>Received At</b></td>
                    <td style="padding:8px 6px;">{now}</td></tr>
              </table>
            </div>
            <div style="padding:12px 28px;background:#f9f9f9;font-size:12px;color:#aaa;">
              Sent automatically by your Portfolio API
            </div>
          </div>
        </body></html>
        """
    )
    return {"success": True, "message": "Message received! I'll get back to you soon. 🙏"}
