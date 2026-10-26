import requests
import smtplib
import time
import logging
from email.mime.text import MIMEText
import os
from dotenv import load_dotenv

#Load the enviorment variables 
load_dotenv()
# Supabase Credentials (For Dev purpose)
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_API_KEY = os.environ["SUPABASE_KEY"]
# Email Credentials (For Dev purpose)
EMAIL_SENDER = os.environ["EMAIL_SENDER"]
EMAIL_PASSWORD = os.environ["EMAIL_PASSWORD"]
SMTP_SERVER = os.environ["SMTP_SERVER"]
SMTP_PORT = os.environ["SMTP_PORT"]

# Store processed invoices to avoid duplicate emails
processed_invoices = set()

# Setup Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(message)s")

def fetch_flagged_invoices():
    """Fetch newly flagged invoices from Supabase."""
    url = f"{SUPABASE_URL}/rest/v1/flagged?status=eq.Flagged"
    headers = {
        "apikey": SUPABASE_API_KEY,
        "Authorization": f"Bearer {SUPABASE_API_KEY}",
    }
    response = requests.get(url, headers=headers)
    return response.json()

def fetch_user_email(level):
    """Fetch user email based on matching level in users table."""
    url = f"{SUPABASE_URL}/rest/v1/users?level=eq.{level}"
    headers = {
        "apikey": SUPABASE_API_KEY,
        "Authorization": f"Bearer {SUPABASE_API_KEY}",
    }
    response = requests.get(url, headers=headers)
    users = response.json()
    return users[0]["email"] if users else None

def send_email(to_email, invoice):
    """Send email notification for a newly flagged invoice."""
    msg = MIMEText(f"""
     A new invoice has been flagged for review:
    - Invoice ID: {invoice['invoice_id']}
    - Order ID: {invoice['order_id']}
    - Vendor ID: {invoice['vendor_id']}
    - Invoice Date: {invoice['invoice_date']}
    - Reason: {invoice['reason']}
    """)
    
    msg["Subject"] = f"New Flagged Invoice: {invoice['invoice_id']}"
    msg["From"] = EMAIL_SENDER
    msg["To"] = to_email

    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(EMAIL_SENDER, EMAIL_PASSWORD)
            server.sendmail(msg["From"], msg["To"], msg.as_string())
        logging.info(f" Email sent to {to_email} for Invoice {invoice['invoice_id']}")
    except Exception as e:
        logging.error(f"Failed to send email: {e}")

def main():
    """Continuously check for new flagged invoices and notify relevant users."""
    while True:
        logging.info("🔍 Checking for new flagged invoices...")
        invoices = fetch_flagged_invoices()

        for invoice in invoices:
            if invoice["invoice_id"] not in processed_invoices:
                user_email = fetch_user_email(invoice["level"])
                
                if user_email:
                    send_email(user_email, invoice)
                    processed_invoices.add(invoice["invoice_id"])  # Mark as processed

        logging.info(" Waiting for the next check (30 seconds)...")
        time.sleep(30)  

if __name__ == "__main__":
    main()