# Autonomous Document Processing Pipeline for Invoices

## Overview

An automated invoice processing and review system designed to streamline the complete invoice lifecycle—from ingestion and data extraction to validation, exception handling, review, and accounts payable processing.

## Features

### 1. Automated Invoice Ingestion

* Automatically processes incoming invoice emails.
* Detects and handles emails without attachments.
* Ignores emails without a subject.
* Captures valid invoices for downstream processing.

### 2. Intelligent Invoice Data Extraction

* Extracts key invoice information using OCR.
* Processes details such as:

  * Invoice number
  * Vendor information
  * Invoice date
  * Amounts
  * Taxes
  * Purchase order details
* Validates extracted information against existing purchase orders.

### 3. Automated Validation & Matching

* Matches invoices against purchase orders.
* Routes successfully validated invoices to the appropriate processing workflow.
* Identifies inconsistencies and exceptions automatically.

### 4. Automated Exception & Flagging System

* Flags invoices based on predefined validation rules.
* Detects issues such as:

  * Missing information
  * Tax discrepancies
  * Duplicate invoices
  * Purchase order mismatches
* Maintains flagged invoices separately for manual review.

### 5. Automated Review Notifications

* Detects newly flagged invoices.
* Identifies the appropriate reviewer based on the configured approval level.
* Sends automated email notifications containing relevant invoice information.

### 6. Invoice Review & Approval Dashboard

* Provides a centralized web-based interface for invoice reviewers.
* Allows reviewers to inspect flagged invoices and associated information.
* Supports invoice approval and rejection workflows.
* Automatically updates invoice status based on the review decision.

### 7. Accounts Payable Processing

* Routes approved invoices into the accounts payable workflow.
* Maintains processed invoice information for payment management.
* Includes an accounts payable interface demonstrating potential integration with payment-processing infrastructure.

### 8. End-to-End Automated Workflow

```text
Email Ingestion
      ↓
OCR Data Extraction
      ↓
Purchase Order Matching
      ↓
Invoice Validation
      ↓
Exception Detection
      ↓
Reviewer Notification
      ↓
Review & Approval
      ↓
Accounts Payable
```

## Data & Availability

* The system uses Supabase for database and application data management.
* Some production invoice documents cannot be included in the public repository due to confidentiality restrictions.
* Sample CSV data is provided where applicable to demonstrate the database structure and workflow.
* Some externally hosted services may require active subscriptions or credentials to operate the complete workflow.
