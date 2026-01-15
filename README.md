# 🖊️ E-Sign MVP Platform

> A lightweight, web-based electronic signature solution designed to digitize document workflows. Built as a 3-day MVP sprint.

## 📋 Project Overview

### 1. What is this project?
This is a streamlined E-Signing platform (similar to DocuSign or Zoho Sign). It focuses on speed and simplicity, allowing users to upload, sign, track, and email documents in a legally binding format without enterprise bloat.

### 2. Who is it for?
* **Freelancers & Consultants:** To sign and send contracts immediately.
* **Small Business Owners:** For approving and tracking internal documents.
* **Individuals:** For quick signing of personal agreements.

### 3. What problem does it solve?
It eliminates the "Print-Sign-Scan-Email" friction. Traditional signing requires hardware and multiple steps. This MVP creates a unified digital workflow: Upload -> Sign -> Audit -> Email.

---

## 🚀 Key Features (The MVP Scope)

To ensure delivery within the **3-day timeline**, the scope is defined as follows:

* **🔐 User Authentication:** Secure login to ensure identity verification for the audit trail.
* **📂 Document Management:** Drag-and-drop PDF upload.
* **✍️ Signature Pad:** Draw signatures or type with cursive fonts; drag-and-drop placement.
* **📊 User Dashboard:** A central hub displaying a list of all signed documents and their status.
* **📜 Audit Trail:** * Automatic logging of key activities (Upload time, Sign time).
    * Display of metadata (Timestamp, Signer Email) for tracking purposes.
* **📧 Send to Recipient:** Integrated feature to email the final PDF or a download link directly to a recipient.

---

## 🛠️ Tech Stack Strategy

* **Frontend:** React.js / Next.js
* **Backend:** Firebase (Auth & Firestore for Audit Logs)
* **Storage:** Firebase Storage (For keeping the signed PDFs)
* **Email Service:** EmailJS (Client-side) or Nodemailer (Server-side)
* **PDF Manipulation:** `pdf-lib` (Essential for flattening signatures onto the PDF)

---

## 🧩 User Flow & Architecture

The application follows a linear, single-user flow designed for efficiency.

```mermaid
graph TD
    A[User Log In] --> B[Upload PDF Document]
    B --> C[Document Rendered in Editor]
    C --> D{Choose Action}
    D -->|Draw| E[Create Signature on Canvas]
    D -->|Type| F[Generate Cursive Text]
    E --> G[Drag Signature to Position]
    F --> G
    G --> H[Click 'Finish & Sign']
    H --> I[System Flattens Layer onto PDF]
    I --> J[Download Signed PDF]