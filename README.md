# 🔐 Project Network E2EE (End-to-End Encrypted Chat)
## ✨ Key Features

* **🔒 End-to-End Encryption (E2EE):**
    * All messages are encrypted on the client-side using **AES-GCM (256-bit)** before being sent.
    * **ECDH (Elliptic Curve Diffie-Hellman)** is used for secure key exchange.
    * The server never sees the plaintext or the private keys.
* **👥 Secure Group Chat:** Supports encrypted group messaging using efficient group key distribution.
* **📁 Encrypted File Sharing:** Images and files are encrypted before upload. The server stores only encrypted blobs.
* **🔑 Secure Key Management:**
    * Private keys are stored locally in the browser's **IndexedDB**.
    * Keys are protected at rest using **PBKDF2** (derived from the user's password).
* **📞 Voice Calls:** Real-time peer-to-peer communication using **WebRTC**.
* **🎨 Modern UI:** Responsive and clean interface built with **React 19** and **Tailwind CSS**.

---

## 🛠️ Tech Stack

### Frontend
* **Framework:** React 19 (Vite)
* **Styling:** Tailwind CSS
* **State/Logic:** Context API, Custom Hooks
* **Cryptography:** Web Crypto API (`window.crypto.subtle`), Node-Forge
* **Communication:** Socket.io-client, WebRTC

### Backend
* **Runtime:** Node.js (Compatible with Bun)
* **Framework:** Express.js
* **Database:** MySQL (using Connection Pooling)
* **Authentication:** JWT (JSON Web Tokens)
* **Real-time:** Socket.io

---

## 🛡️ Security Architecture

This project implements a **Hybrid Encryption** scheme to ensure performance and security:

1.  **Key Generation:** Upon registration, the client generates an ECDH Key Pair (Curve P-256).
2.  **Key Exchange:** Public keys are published to the server. Users fetch peer's public keys to derive a shared secret.
3.  **Message Encryption:**
    * **Algorithm:** AES-GCM (Galois/Counter Mode) 256-bit.
    * **Integrity:** GCM provides built-in authentication tags to detect tampering.
4.  **Local Storage Security:**
    * The user's Private Key is **never** sent to the server in plaintext.
    * It is encrypted using a key derived from the user's password (PBKDF2-HMAC-SHA256 with 100,000 iterations) and stored in IndexedDB.

---

## 🚀 Getting Started

### Prerequisites
* Node.js (v18+) or Bun
* MySQL Server

### Installation

1.  **Clone the repository**
    ```bash
    git clone [https://github.com/Nanthasit-S/Project_Network_E2EE.git](https://github.com/Nanthasit-S/Project_Network_E2EE.git)
    cd Project_Network_E2EE
    ```

2.  **Database Setup**
    * Create a MySQL database named `pj_network`.
    * Import the schema from `SQL_PJNETWORK.sql`.

3.  **Backend Setup**
    ```bash
    cd backend
    npm install  # or bun install
    
    # Create .env file
    cp .env.example .env
    # Edit .env with your DB credentials
    
    npm start    # or bun start
    ```

4.  **Frontend Setup**
    ```bash
    cd frontend
    npm install  # or bun install
    npm run dev
    ```

---

## 👨‍💻 Author

**Nanthasit-S**
* GitHub: [Nanthasit-S](https://github.com/Nanthasit-S)

---

*This project was created for educational purposes to demonstrate secure communication protocols.*
