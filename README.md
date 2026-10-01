# Automated Invoice Processing and Review System

## 📌 Overview
This system automates invoice handling by integrating **UiPath RPA, Supabase, Google Drive, OCR, and email notifications**. It streamlines invoice ingestion, validation, flagging, and review processes, ensuring efficient financial management.

---

## 🚀 Features

### 1️⃣ Invoice Ingestion via Email  
- UiPath RPA bot monitors an email inbox for new invoices.  
- If an email has **no attachment**, the sender is notified automatically.  
- If an email has **no subject**, it is ignored.  
- Valid invoices are **saved to database** for further processing.  

### 2️⃣ Data Extraction & Storage  
- OCR extracts invoice details (invoice number, vendor, amount, taxes, etc.).  
- These are then matched with the `purchase_orders` table, if matched then it is sent to `invoices`, `accounts_payable` and if not then to `flagged database`.


### 3️⃣ Automated Invoice Flagging  
- Invoices are **automatically flagged** based on predefined rules like:  
  - Missing details  
  - Tax discrepancies  
  - Duplicate detection  
- Flagged invoices are inserted into the `flagged` table for review.  

### 4️⃣ Email Notification System  
- A Python script **checks for flagged invoices** in Supabase.  
- If a new invoice is flagged:  
  - It retrieves the appropriate **reviewer's email** based on `level`.  
  - Sends an **email notification** with invoice details.  

📧 **Example Email Notification**:  
Subject: New Flagged Invoice: INV-12345

🚨 A new invoice has been flagged for review:
-	•	Invoice ID: INV-12345
-	•	Order ID: ORD-67890
-	•	Vendor ID: VEND-001
-	•	Invoice Date: 2025-04-04
-	•	Reason: Tax Mismatch
### 5️⃣ Invoice Review & Approval  
- Reviewers access invoices via a **React-based dashboard**.  
- Actions available:  
  ✅ **Approve** – Moves the invoice to `invoices`,`accounts_payable`.  
  ❌ **Deny** – Invoices is marked as rejected.  

### 6️⃣ Accounts Payable & Payment Processing  
- Approved invoices are added to `accounts_payable`.  
- Here you get a mock interface how an accounts payable software can be connected to our system in the future


---

## 🚀 Running the Project  

### 1️⃣ Start the React Frontend  
```bash
cd src
npm run dev
```
### 2️⃣ Run the Python Scripts
```bash
cd Backend
python email.py
python ocr.py
```
---
### This project is using Supabase which will get inactive in a few days as a paid subsription is required, also for some of the pdfs due to confidentiality of invoices we were not allowed to share it publicly as declared by authors of invoices. So, we are providing you with csv for our tables.

