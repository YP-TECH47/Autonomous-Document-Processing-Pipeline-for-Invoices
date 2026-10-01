
import time
import io
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
import pytesseract
from pdf2image import convert_from_bytes
import matplotlib.pyplot as plt
import json
import re
import gc
import torch
import google.generativeai as genai
from datetime import datetime
from dateutil import parser  
from doctr.io import DocumentFile
from doctr.models import ocr_predictor
import json
import supabase
from datetime import datetime
import cv2
import numpy as np
from PIL import Image
from doctr.io import DocumentFile
import re
from fuzzywuzzy import fuzz  
from fuzzywuzzy import process


# Supabase connection settings
SUPABASE_URL = "https://jkbeqyjthkgjgdgivrzu.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprYmVxeWp0aGtnamdkZ2l2cnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4NjI4ODEsImV4cCI6MjA1NzQzODg4MX0.1GVcC8ByoN5z8SDLSAfZweR5ML8RCRfSI8Vvi2STaAo"

supabase_client = supabase.create_client(SUPABASE_URL, SUPABASE_KEY)
#  Load Google Drive API Credentials
SERVICE_ACCOUNT_FILE = "/Users/jatinaggarwal/Desktop/New/doctr_env/wide-retina-451409-a8-0e8089c04dc3.json"
SCOPES = ["https://www.googleapis.com/auth/drive"]
creds = service_account.Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=SCOPES)
drive_service = build("drive", "v3", credentials=creds)


genai.configure(api_key="AIzaSyBT-X0MdhHOo-snj26x3_6CDk1J4t09PZc")
predictor = ocr_predictor(pretrained=True)
model = genai.GenerativeModel('models/gemini-1.5-pro-latest')


FOLDER_ID = "15_fWWBm68Kokr90AXRwzwCgtGDDuwdH-"

# Store processed file IDs to avoid duplicate processing
processed_files = set()




def list_initial_pdfs():
    #Fetch and store all existing PDFs when the script starts.
    query = f"'{FOLDER_ID}' in parents and mimeType='application/pdf' and trashed=false"
    results = drive_service.files().list(q=query, fields="files(id, name)").execute()
    
    files = results.get("files", [])
    for file in files:
        processed_files.add(file["id"])  # Mark all existing PDFs as processed


def list_new_pdfs():
    #Fetch only new PDFs that appear after the script starts.
    query = f"'{FOLDER_ID}' in parents and mimeType='application/pdf' and trashed=false"
    results = drive_service.files().list(q=query, fields="files(id, name)").execute()
    
    return results.get("files", [])




# Read the file
def clear_cache():
    gc.collect()  
    if torch.cuda.is_available():
        torch.cuda.empty_cache()  
    print("Cache cleared.")


# 1. OCR Pre-processing 
def clean_ocr_text(ocr_text):
    cleaned_text = re.sub(r"[^a-zA-Z0-9#.,:;!?/\-\s']", "", ocr_text) 

    cleaned_text = cleaned_text.replace("\n", " ").replace("\r", " ")  
    cleaned_text = re.sub(r"\s+", " ", cleaned_text).strip()  
    return cleaned_text

# 2. Define your JSON schema
schema = """
{
  "Invoice No": "string",
  "Order No": "string",
  "vendor": {
    "vendor_id": "string",
    "vendor_name": "string",
    "gst_number": "string"
  },
  "order_date": "string",
  "products": [
    {
      "HSN_SAC": "string",
      "product_name": "string",
      "discount:": "number",
      "cgst_rate": "number",
      "sgst_rate": "number",
      "igst_rate": "number",
      "quantity": "number",
      "unit_price": "number",
      "total_price": "number"
    }
  ],
  "sub_total": "number",
  "total_cgst_amount": "number",
  "total_sgst_amount": "number",
  "total_igst_amount": "number",
  "total_tax_amount": "number",
  "shipping_cost": "number",
  "total_discount": "number",
  "grand_total": "number",
  "mode_of_payment": "string",
  "payment_time": "number",
  "penalty_rate": "number",
  "currency": "string"
}
"""

# 3. Date Format Correction Function
def format_date(date_str):
    try:
        
        parsed_date = parser.parse(date_str, dayfirst=True)
        return parsed_date.strftime("%d-%m-%Y")  
    except ValueError:
        return date_str
    

def extract(schema,cleaned):
    prompt = f"""
    The OCR has read the text row-wise. Correct any OCR errors in the following invoice text and extract structured details.
    Ensure:
    - Do not repeat the vendor name, Dont read it from logo.
    - Extract the vendor details from the section marked "From:".
    - Extract the customer details from the section marked "Billed to:".
    - If explicit labels are missing, assume the first address block is the vendor.
    - Taxes are categorized properly as SGST, CGST, and IGST (if available). If missing, assume 0.
    - If "Total Price" or "Total" or "TotalPrice" is present instead of "Grand Total", use it as the total amount.
    - "order_date" must be strictly in **DD-MM-YYYY** format with hyphens.
    - If "NO." or "NO" or "Invoice No." is given, use it as the Invoice number.
    - If terms mention payment within a specific number of days, use that integer as the 'payment_time' (in number of days).
    - If a penalty interest rate applies for late payment, use that in 'penalty_rate'.
    - If 'payment_time' is 'None', write it as NULL.
    - If urgency is 'None', write it as 0.
    - Return only valid **JSON output** according to this schema:

    Schema:
    {schema}

    OCR Text:
    {cleaned}
    """
    try:
          # Use Gemini 1.5 Pro
        response = model.generate_content(prompt)

        if response.text:
            # Extract JSON using regex 
            match = re.search(r"\{.*\}", response.text, re.DOTALL)
            if match:
                json_text = match.group(0)  # Extracts only the JSON part
                try:
                    json_output = json.loads(json_text)  # Convert to JSON
                    if "order_date" in json_output:
                        json_output["order_date"] = format_date(json_output["order_date"])
                except json.JSONDecodeError as e:
                    print(f" Invalid JSON from Gemini: {e}")
                    print(f"Gemini's raw output: {response.text}")
                    json_output = {}
            else:
                print(" No valid JSON detected in Gemini's response.")
                json_output = {}
        else:
            print(" Gemini returned an empty result.")
            json_output = {}

    except Exception as e:
        print(f" Error during Gemini API call: {e}")
        print(f"Full exception details: {repr(e)}")  
        json_output = {}

    # 4. Final JSON Output
    json_invoice=json_output
    print(json.dumps(json_output, indent=4))

    # Save JSON output to a file
    output_file_path = "invoice_output.json"
    with open(output_file_path, "w") as json_file:
        json.dump(json_output, json_file, indent=4)
    print(f"JSON output saved to {output_file_path}")

    
    clear_cache()
    return json_output,json_invoice

def fetch_purchase_order(order_id):
    #5.Fetch purchase order details from Supabase
    response = supabase_client.table("purchase_orders").select("*").eq("order_id", order_id).maybe_single().execute()
    if response and response.data:
        return response.data
    else:
        return None

def fetch_purchase_order_items(order_id):
    #Fetch purchase order items from Supabase.
    response = supabase_client.table("purchase_order_item").select("*").eq("order_id", order_id).execute()
    return response.data if response.data else []

def insert_invoice_into_db(invoice_data, validated_items,urgency):
    response = supabase_client.table("invoices").select("*").eq("order_id", invoice_data.get("Order No")).eq("invoice_no", invoice_data.get("Invoice No")).maybe_single().execute()
    if response and response.data:
        print(f" Invoice already exists for Order ID {invoice_data.get('Order No')} and Invoice No {invoice_data.get('Invoice No')}.")
        return
    #Insert validated invoices into the invoice table.
    vendor_name = invoice_data["vendor"]["vendor_name"]
    vendor_id = fetch_vendor_id(vendor_name)
    invoice_pdf_path = f"https://drive.google.com/file/d/{file_id}/preview"
    invoice_record = {
        "order_id": invoice_data.get("Order No"),
        "invoice_no": invoice_data.get("Invoice No"),
        "vendor_id": vendor_id,
         "order_date": invoice_data.get("Invoice Date", datetime.utcnow().strftime("%Y-%m-%d")),
        "total_amount": round(float(invoice_data["grand_total"]),2),
        "cgst_amount":round(float(invoice_data.get("total_cgst_amount", 0)),2),
        "sgst_amount":round(float(invoice_data.get("total_sgst_amount", 0)),2),
        "igst_amount":round(float(invoice_data.get("total_igst_amount", 0)),2),
        "urgency":urgency,
        "pdf_url":invoice_pdf_path
    }

    print(" Inserting validated invoice:", json.dumps(invoice_record, indent=4))

    response = supabase_client.table("invoices").insert(invoice_record).execute()
    if hasattr(response, 'error') and response.error:
        print(" Failed to insert invoice.", response.error)

    # Insert invoice items
    for item in validated_items:
        response = supabase_client.table("invoice_items").insert(item).execute()
        if hasattr(response, 'error') and response.error:
            print(" Failed to insert invoice item.", response.error)
        else:
            print(" Inserted invoice item:", item)

def fetch_vendor_id(vendor_name):
    #Fetch vendor ID from vendors_db based on vendor name.
    response = supabase_client.table("vendors_db").select("vendor_id").eq("vendor_name", vendor_name).maybe_single().execute()
    return response.data["vendor_id"] if response.data else None


def insert_flagged_invoice(invoice_data, mismatch_reasons,level):
    #Insert mismatched invoices into the flagged table.

    # Extract vendor ID from the vendors_db table
    vendor_name = invoice_data["vendor"]["vendor_name"]
    vendor_id = fetch_vendor_id(vendor_name)
    total_amount=invoice_data["grand_total"]
    cgst_amount=invoice_data["total_cgst_amount"]
    sgst_amount=invoice_data["total_sgst_amount"]
    igst_amount=invoice_data["total_igst_amount"]

    # Extract only unique mismatch reasons
    unique_reasons = list(set(mismatch_reasons))

    flagged_record = {
        "order_id": invoice_data.get("Order No"),
        "invoice_id": invoice_data.get("Invoice No"),
        "vendor_id": vendor_id,
        "invoice_date": invoice_data.get("Invoice Date", datetime.utcnow().strftime("%Y-%m-%d")),
        "reason": ", ".join(unique_reasons),
        "level":level,
        "total_amount":total_amount,
        "cgst_amount":cgst_amount,
        "sgst_amount":sgst_amount,
        "igst_amount":igst_amount
    }

    print(" Inserting flagged invoice:", json.dumps(flagged_record, indent=4))

    response = supabase_client.table("flagged").insert(flagged_record).execute()

    if hasattr(response, 'error') and response.error:
        print(" Failed to insert flagged invoice:", response.error)
    else:
        print(" Successfully inserted flagged invoice:", response.data)


def validate_invoice(invoice_data):
    #Validate invoice data against purchase order records.
    report = {
        "invoice_no": invoice_data.get("Invoice No"),
        "order_id": invoice_data.get("Order No"),
        "status": "Failed",
        "issues": [],
        "comparisons": []
    }

    order_id = invoice_data.get("Order No")
    urgency = invoice_data.get("payment_time")
    validated_items = []
    
    # Check if order_id exists in the invoice data
    if not order_id:
        report["issues"].append({
            "error": "Missing order number",
            "comparison": {
                "field": "order_id",
                "product": "null",
                "po_value": "null",
                "invoice_value": "null",
                "status": "Mismatch"
            }
        })
        mismatch_reasons = ["Missing order number"]
        level = 1
        insert_flagged_invoice(invoice_data, mismatch_reasons, level)
        return report, order_id, urgency
    
    po_data = fetch_purchase_order(order_id)
    mismatch_reasons = []
    level = 0
    
    if not po_data:
        mismatch_reasons.append("Order number not matching")
        level = 1
        report["issues"].append({
            "error": "Order number not matching",
            "comparison": {
                "field": "order_id",
                "product": "null",
                "po_value": "null",
                "invoice_value": order_id,
                "status": "Mismatch"
            }
        })
        insert_flagged_invoice(invoice_data, mismatch_reasons, level)
        return report, order_id, urgency

    po_items = fetch_purchase_order_items(order_id)
    
    total_amount_mismatch = abs(round(float(po_data["total_amount"])) - round(float(invoice_data["grand_total"]), 2))
    if total_amount_mismatch > 10000:
        level = 4
    elif total_amount_mismatch > 0.01:
        level = 3
        
    # Validate total amounts
    amount_comparison = {
        "field": "total_amount",
        "product": "null",
        "po_value": round(float(po_data["total_amount"]), 2),
        "invoice_value": round(float(invoice_data["grand_total"]), 2),
        "status": "Mismatch" if abs(round(float(po_data["total_amount"])) - round(float(invoice_data["grand_total"]), 2)) > 0.01 else "Match"
    }
    report["comparisons"].append(amount_comparison)
    if amount_comparison["status"] == "Mismatch":
        report["issues"].append({
            "error": "Total amount mismatch",
            "comparison": amount_comparison
        })
        mismatch_reasons.append("Total amount mismatch")

    # Validate CGST, SGST, IGST
    for tax_type in ["cgst", "sgst", "igst"]:
        po_value = round(float(po_data.get(f"{tax_type}_amount", 0)), 2)
        invoice_value = round(float(invoice_data.get(f"total_{tax_type}_amount", 0)), 2)
        status = "Mismatch" if abs(po_value - invoice_value) > 0.01 else "Match"
        if abs(po_value - invoice_value) > 0.01:
            level = max(level, 2)
        tax_comparison = {
            "field": f"{tax_type}_amount",
            "product": "null",
            "po_value": po_value,
            "invoice_value": invoice_value,
            "status": status
        }
        report["comparisons"].append(tax_comparison)
        if status == "Mismatch":
            report["issues"].append({
                "error": f"{tax_type.upper()} mismatch",
                "comparison": tax_comparison
            })
            mismatch_reasons.append(f"{tax_type.upper()} mismatch")

    # Create dictionaries for better product matching
    po_items_by_hsn = {}
    po_items_by_name = {}
    po_items_by_both = {}
    
    for item in po_items:
        hsn = str(item.get("product_id", "")).strip()
        name = item.get("product_description", "").strip().lower()
        
        # Store items by HSN code
        if hsn:
            po_items_by_hsn[hsn] = item
        
        # Store items by product name
        if name:
            po_items_by_name[name] = item
        
        # Store items by both HSN and name
        if hsn and name:
            po_items_by_both[(hsn, name)] = item

    # Validate products
    for product in invoice_data["products"]:
        product_id = str(product.get("HSN_SAC", "")).strip()
        product_name = product.get("product_name", "").strip().lower()
        
        # Try matching by both HSN and name first
        po_item = None
        match_type = None
        
        if product_id and product_name and (product_id, product_name) in po_items_by_both:
            po_item = po_items_by_both[(product_id, product_name)]
            match_type = "exact"
        # If HSN exists in invoice but doesn't match exactly, check if product name matches
        elif product_id and product_name:
            if product_id in po_items_by_hsn:
                po_item = po_items_by_hsn[product_id]
                match_type = "hsn_only"
            elif product_name in po_items_by_name:
                po_item = po_items_by_name[product_name]
                match_type = "name_only"
        # If HSN is null in invoice, try matching by name only
        elif not product_id and product_name and product_name in po_items_by_name:
            po_item = po_items_by_name[product_name]
            match_type = "name_only"
        # If name is null in invoice, try matching by HSN only
        elif product_id and not product_name and product_id in po_items_by_hsn:
            po_item = po_items_by_hsn[product_id]
            match_type = "hsn_only"

        if not po_item:
            # Product not found in PO at all
            report["issues"].append({
                "error": "Product not found in PO",
                "comparison": {
                    "field": "product",
                    "product": product_name or product_id,
                    "po_value": "null",
                    "invoice_value": product_name or product_id,
                    "status": "Mismatch"
                }
            })
            level = max(level, 1)
            mismatch_reasons.append(f"Product '{product_name or product_id}' not found in PO")
            continue
        
        # Check if HSN codes match when both exist
        po_hsn = str(po_item.get("product_id", "")).strip()
        if product_id and po_hsn and product_id != po_hsn:
            report["issues"].append({
                "error": "HSN code mismatched",
                "comparison": {
                    "field": "hsn_code",
                    "product": product_name,
                    "po_value": po_hsn,
                    "invoice_value": product_id,
                    "status": "Mismatch"
                }
            })
            level = max(level, 1)
            mismatch_reasons.append(f"HSN code mismatched for product '{product_name}'")

        # Validate unit price
        unit_price_comparison = {
            "field": "unit_price",
            "product": product_name,
            "po_value": po_item["unit_price"],
            "invoice_value": product["unit_price"],
            "status": "Match" if abs(po_item["unit_price"] - product["unit_price"]) <= 0.01 else "Mismatch"
        }
        report["comparisons"].append(unit_price_comparison)
        if unit_price_comparison["status"] == "Mismatch":
            report["issues"].append({
                "error": "Unit price mismatch",
                "comparison": unit_price_comparison
            })
            mismatch_reasons.append("Unit price mismatch")
            level = max(level, 1)
        
        # Prepare validated item for database insertion
        validated_item = {
            "order_id": order_id,
            "product_description": product_name,
            "product_id": product_id,
            "quantity": product.get("quantity", 0),
            "unit_price": product.get("unit_price", 0),
            "line_total": product["quantity"] * product["unit_price"],
            "cgst_amount": product.get("cgst_amount", 0),
            "sgst_amount": product.get("sgst_amount", 0),
            "igst_amount": product.get("igst_amount", 0)
        }
        validated_items.append(validated_item)

    if mismatch_reasons:
        insert_flagged_invoice(invoice_data, mismatch_reasons, level)
    else:
        # If no mismatches, process the invoice directly with validated items
        insert_invoice_into_db(invoice_data, validated_items, urgency)
        report["status"] = "Success"
        report["message"] = "✔ Invoice validation successful. No mismatches found."
        
    print("urgency:", urgency)
    return report, order_id, urgency

def normalize_text(text):
    # Remove unwanted special characters but allow single quotes
    cleaned_text = re.sub(r"[^a-zA-Z0-9/'\-\s.]", "", text).strip().lower()

    # Check for decimal values and process them
    if re.fullmatch(r"\d+\.\d+", cleaned_text):  
        float_val = float(cleaned_text)
        int_val = int(float_val)
        return str(int_val) if float_val == int_val else str(float_val)

    return cleaned_text



# Define function to overlay highlights
def highlight_text(image, text,result, color=(255, 0, 0)):
    #Draw bounding box around mismatched text.
    h, w, _ = image.shape
    print("/text/",text)
    text_normalized = normalize_text(text).lower()
    print("/normalized text/",text_normalized)
    for page in result.pages:
        for block in page.blocks:
            for line in block.lines:
                for word in line.words:
                    word_normalized = normalize_text(word.value).lower()
                    if word_normalized == text_normalized:
                        print(f"Word: {word.value}, Geometry: {word.geometry}")
                        (x1, y1), (x2, y2) = word.geometry  
                        x1, y1, x2, y2 = int(x1 * w), int(y1 * h), int(x2 * w), int(y2 * h)
                        cv2.rectangle(image, (x1, y1), (x2, y2), color, 2)
                        




def extract_words_with_positions(page, img):
    #Extracts words and their bounding boxes from a single page's OCR results.
    words_data = []
    h, w, _ = img.shape  

    for block in page.blocks:  
        for line in block.lines:
            for word in line.words:
                word_text = normalize_text(word.value)
                (x1, y1), (x2, y2) = word.geometry
                x1, y1, x2, y2 = int(x1 * w), int(y1 * h), int(x2 * w), int(y2 * h)
                words_data.append({"text": word_text, "bbox": (x1, y1, x2, y2)})

    return words_data


def find_bounding_boxes(words_data, search_value):
    #Finds all bounding boxes for a given value in OCR results.
    search_value = normalize_text(str(search_value))
    return [word for word in words_data if fuzz.ratio(word["text"], search_value) > 85]

def product_to_left(words_data, target_index, product):
    #Searches for all words of the product name to the left of a given value's index.
    product_words = normalize_text(product).split()
    found_words = set()

    for i in range(target_index - 1, -1, -1):
        for word in product_words:
            if fuzz.ratio(words_data[i]["text"], word) > 85:
                found_words.add(word)

        if len(found_words) == len(product_words):
            return True  # Highlight only if all words match

    return False  # Not all words found

def highlight_mismatched_values(image, words_data, product, field_value, color=(255, 0, 0)):
    #Finds and highlights the first valid occurrence of field_value.
    occurrences = find_bounding_boxes(words_data, field_value)

    for occ in occurrences:
        target_index = words_data.index(occ)  

        if product_to_left(words_data, target_index, product):
            x1, y1, x2, y2 = occ["bbox"]
            cv2.rectangle(image, (x1, y1), (x2, y2), color, 2)
            print(f" Highlighted '{field_value}' at {occ['bbox']} due to '{product}' match.")
            return  # Stop after first match
    print(f" No valid match found for '{field_value}' with product '{product}'")

def save_highlighted_pdf(images, invoice_filename):
    #Save all highlighted pages as a single PDF with a name based on the invoice filename.
    pil_images = []

    # Convert numpy arrays to PIL images and collect them
    for img in images:
        if isinstance(img, np.ndarray):
            pil_img = Image.fromarray(img)
        else:
            pil_img = img
        pil_images.append(pil_img.convert("RGB")) 

    # Generate the output filename based on the invoice filename
    output_filename = f"highlights_{invoice_filename}"

    # Save all images as a single PDF
    if pil_images:
        pil_images[0].save(output_filename, save_all=True, append_images=pil_images[1:])
        print(f"\n Complete PDF saved as '{output_filename}'")
    else:
        print(" No images to save as PDF.")

    return output_filename


def upload_to_drive(file_path, folder_id, order_id, invoice_file_id, urgency):
    file_metadata = {
        "name": file_path.split("/")[-1],  
        "parents": [folder_id],            
    }

    media = MediaFileUpload(file_path, mimetype="application/pdf")

    try:
        file = drive_service.files().create(
            body=file_metadata,
            media_body=media,
            fields="id"
        ).execute()
        file_id = file.get("id")
        print(f" File uploaded successfully with ID: {file_id}")
        flagged_pdf_path = f"https://drive.google.com/file/d/{file_id}/preview"
        invoice_pdf_path = f"https://drive.google.com/file/d/{invoice_file_id}/preview"
        print("invoice_pdf_path:",invoice_pdf_path)

        # Update the flagged invoice entry in the Supabase database with the file path
        response = supabase_client.table("flagged").update({
            "Report_pdfs": flagged_pdf_path,
            "Invoices_pdf": invoice_pdf_path,
            "urgency": urgency
        }).eq("order_id", order_id).execute()

        if response.get("status") == 200:
            print(f" Supabase entry updated with file path: {flagged_pdf_path}")
        else:
            print(f" Failed to update Supabase entry: {response.get('data')}, Error: {response.get('error')}")
        return file_id

    except Exception as e:
        print(f" An error occurred during upload or database update: {str(e)}")
        return None










def extract_text_from_pdf_stream(file_id):
    #Extract text from a PDF file stream from Google Drive.
    request = drive_service.files().get_media(fileId=file_id)
    pdf_stream = io.BytesIO()
    downloader = MediaIoBaseDownload(pdf_stream, request)

    done = False
    while not done:
        status, done = downloader.next_chunk()
        print(f"🔽 Downloading PDF - {int(status.progress() * 100)}% complete")

    pdf_stream.seek(0)  

    print("🔍 Extracting text from PDF...")
    doc = DocumentFile.from_pdf(pdf_stream)
    print(f"Number of pages: {len(doc)}")
    result = predictor(doc)
    string_result = result.render()
    cleaned_ocr_text = clean_ocr_text(string_result)
    print(cleaned_ocr_text)
    return extract(schema,cleaned_ocr_text),doc,result


def process_pdf(file_id, file_name):
    #Process the detected new PDF.
    print(f"New PDF Detected: {file_name} (ID: {file_id})")
    (invoice_data, json_invoice), doc, result = extract_text_from_pdf_stream(file_id)
    print(f" Extracted Text from {file_name}:\n{invoice_data}...")  
    report, order_id, urgency = validate_invoice(invoice_data)
    print(urgency)
    if report["issues"]:
        print("\nValidation Report (Mismatches Only):")
        for issue in report["issues"]:
            print("-", issue)
    else:
        print("\n Invoice validation successful. No mismatches found.")
    img_pages = [np.array(page) for page in doc]

    for page_idx, img in enumerate(img_pages):
        # Convert image to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # Extract OCR results
        ocr_json = json_invoice  
        mismatches = report["issues"]  

    images = []
    for page_idx, (img, result_page) in enumerate(zip(img_pages, result.pages)):
        print(f"\n📝 Processing Page {page_idx + 1}...\n")
        words_data = extract_words_with_positions(result_page, img)

        # Process each mismatch entry for the current page
        for mismatch in mismatches:
            product_name = mismatch["comparison"]["product"]
            field_value = mismatch["comparison"]["invoice_value"]
            print(f"\nChecking for mismatch - Product: {product_name}, Value: {field_value}")
            if product_name == "null":
                highlight_text(img, str(field_value), result=result)
            else:
                highlight_mismatched_values(img, words_data, product_name, field_value)

        # Add highlighted image to the list
        images.append(img)

    # Create PDF from highlighted pages with a name based on the invoice filename
    highlighted_pdf_filename = save_highlighted_pdf(images, file_name)
    print(f"\n Highlighted PDF saved as '{highlighted_pdf_filename}'")

    # Upload the highlighted PDF to the specified folder
    folder_id = "1VvTQLni_5fjURqhTepRimau-4IIn_93U" 
    upload_to_drive(highlighted_pdf_filename, folder_id, order_id, file_id, urgency)


#  Initialize by storing all existing PDFs
list_initial_pdfs()
print(" Watching for new PDFs in Google Drive folder...")


#  Monitor Google Drive for new PDFs
try:
    while True:
        pdf_files = list_new_pdfs()
        for file in pdf_files:
            file_id, file_name = file["id"], file["name"]

            # Skip processing if the file is the highlighted report
            if file_name == "highlighted_invoice_report.pdf":
                print(f"⏭️ Skipping processing for {file_name} (ID: {file_id}) as it is the highlighted report.")
                continue

            if file_id not in processed_files:
                process_pdf(file_id, file_name)
                processed_files.add(file_id)  # Mark as processed

        time.sleep(30)  # Adjust interval as needed
except KeyboardInterrupt:
    print(" Monitoring stopped.")
