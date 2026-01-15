# 🖊️ E-Sign MVP Platform

> A lightweight, web-based electronic signature solution designed to digitize document workflows. Built as a 3-day MVP sprint.

## 📋 Project Overview

### 1. What is this project?
This is a streamlined E-Signing platform that allows users to sign documents digitally. It focuses on speed and simplicity, stripping away enterprise bloat to allow users to sign and download documents in seconds.

### 2. Who is it for?
* **Freelancers:** For quickly signing contracts and NDAs.
* **Small Business Owners:** For approving invoices or internal memos.
* **Individuals:** For signing tenancy agreements, waivers, or permission slips.

### 3. What problem does it solve?
It eliminates the "Print-Sign-Scan" friction. Traditional physical signing requires hardware (printers/scanners) and significant time. This MVP allows a user to upload, sign, and export a legally binding PDF entirely within the browser.

---

## 🚀 Key Features (The MVP Scope)

The scope is defined as follows:

* **🔐 User Authentication:** Secure sign-up/login (Email & Password / OAuth).
* **📂 Document Management:** Drag-and-drop PDF upload.
* **✍️ Signature Pad:** Draw signatures using a mouse or touch interface, or type with cursive fonts.
* **🖱️ Drag-and-Drop Editor:** Place signatures, dates, and text fields precisely onto the document.
* **⬇️ PDF Flattening & Export:** Merges the signature layer with the PDF for a secure, non-editable download.
* **⬇️ Audtit Trail:** Automatic logging of key signing activities such as Document upload date and time and Signature applied.
* **⬇️ Dashboard:** A simple dashboard displaying a list of documents signed by the user.
---

## 🛠️ Tech Stack

* **Frontend:** React.js / Next.js
* **Styling:** Tailwind CSS (for rapid UI development)
* **Backend/BaaS:** Firebase (Auth, Firestore, Storage) *[Recommended for speed]*
* **PDF Manipulation:** `pdf-lib` (for modifying PDFs) and `react-pdf` (for rendering).
* **Signature Pad:** `react-signature-canvas`

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