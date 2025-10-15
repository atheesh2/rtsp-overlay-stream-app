# Livestream Overlay App

## 📖 Project Overview
This project is a **Livestream Overlay Web Application** that allows users to view a livestream video from an **RTSP URL** and add **custom overlays** (text and logo) dynamically. Users can position, resize, and style overlays as desired and manage them with full **CRUD functionality**.

---

## 🚀 Features
- 🎥 **RTSP Livestream Player** – Play a live video feed from an RTSP source.
- 🧩 **Custom Overlays** – Add text and image overlays on the video.
- ⚙️ **CRUD API for Overlays** – Create, Read, Update, and Delete overlay configurations.
- 🖱️ **Position & Resize Controls** – Move overlays using intuitive arrow buttons and resize dynamically.
- 🎨 **Text Color Picker** – Dynamically change text overlay colors.
- 💾 **Persistent Storage** – Overlay settings saved in MongoDB.

---

## 🧠 Tech Stack
| Layer | Technology |
|--------|-------------|
| **Frontend** | React.js |
| **Backend** | Python (Flask) |
| **Database** | MongoDB |
| **Streaming** | RTSP (via HLS.js / ffmpeg) |

---

## 🗂️ Folder Structure
```
Livestream-Overlay-App/
│
├── backend/
│   ├── app.py
│   ├── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── App.js
│   │   ├── index.js
│   ├── package.json
│
└── README.md
```

---

## 🧩 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Endpoints
| Method | Endpoint | Description |
|--------|-----------|-------------|
| `POST` | `/overlays` | Create a new overlay |
| `GET` | `/overlays` | Retrieve all overlays |
| `PUT` | `/overlays/<id>` | Update an overlay by ID |
| `DELETE` | `/overlays/<id>` | Delete an overlay by ID |

---

## ⚙️ Setup Guide

### 🖥️ Backend (Flask)
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the Flask app:
   ```bash
   python app.py
   ```

### 🌐 Frontend (React)
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the React app:
   ```bash
   npm start
   ```

---

## 🧾 User Instructions
- Input the **RTSP URL** on the landing page.
- Click **Play** to start the livestream.
- Use the **Overlay Panel** to:
  - Add new text or logo overlays.
  - Adjust position using arrow controls.
  - Change text color dynamically.
  - Save overlay settings (stored in MongoDB).

---

## 🧰 Deliverables
- Complete **Code Repository**
- **API Documentation** (CRUD endpoints)
- **User Documentation** explaining setup and usage

---

## 📦 Repository Information
**Repository Name:** `livestream-overlay-app`  
**Description:** Web application to stream RTSP video and manage overlays dynamically using Flask, MongoDB, and React.

---

## 🧑‍💻 Author
**Atheesh**  
📧 atheesh200@gmail.com  




