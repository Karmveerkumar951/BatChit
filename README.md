
# ⚡ Real-Time Chat Application  
## **FastAPI • React • WebSockets • SQLModel**

A **production-grade**, **real-time**, **WebSocket-driven** chat application built with a clean microservice-like architecture, modular backend, and a highly responsive React frontend.

This project demonstrates modern full‑stack engineering patterns used in industry-level messaging platforms.

---

# 🚀 Core Capabilities

### 🔐 **Authentication**
- JWT-based login & session handling  
- Secure password hashing (`bcrypt_sha256`)  
- Clean auth middleware structure  

### ⚡ **Real-Time Messaging**
- WebSocket-driven, low-latency messaging  
- Automatic conversation creation  
- Auto-refreshing chat threads  
- Optimistic message updates  
- Instant conversation syncing  

### 🔎 **Username-Based User Search**
- Fast, indexed username search  
- Click to start a new chat instantly  
- No peer IDs required  

### 💬 **Conversation System**
- Persistent conversation history  
- Auto-updating chat list  
- Auto-open new conversations  
- Scroll-to-bottom real-time UX  

### 🖥️ **Frontend**
- React + Vite  
- WebSocket client  
- High-performance rendering  
- Modular component structure  

### 🧠 **Backend**
- FastAPI  
- SQLModel ORM  
- WebSocket router  
- JWT-secured endpoints  
- Database-driven messaging  

---

# 🧩 Modular Project Architecture

```md
chat-app/
├── backend/
│   ├── main.py               # FastAPI app + routers
│   ├── models.py             # SQLModel ORM entities
│   ├── database.py           # DB engine + session helpers
│   ├── auth.py               # JWT + security utils
│   ├── requirements.txt      # Python dependencies
│   └── chat.db               # SQLite database
│
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js        # Vite + WebSocket proxy
    └── src/
        ├── App.jsx
        ├── main.jsx
        ├── styles.css
        └── components/
            ├── Login.jsx
            └── Chat.jsx
```

Professional, consistent, GitHub‑friendly formatting that renders perfectly in dark & light mode.

---

# ⚙️ Backend Setup (FastAPI)

```bash
cd backend
python -m venv venv
.\venv\Scripts\activate      # Windows
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend runs at:  
**http://localhost:8000**

API Documentation:  
**http://localhost:8000/docs**

---

# 🖥️ Frontend Setup (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at:  
**http://localhost:5173**

---

# 🔌 WebSocket Connection Architecture

```txt
ws://localhost:8000/ws/{token}
```

- Token acquired on login  
- WebSocket identifies user instantly  
- Backend validates identity on every packet  

---

# 🔄 Message Lifecycle

1. User authenticates → receives JWT  
2. Frontend establishes WebSocket session  
3. User selects or searches a recipient  
4. Message payload sent → validated → stored  
5. Backend pushes real-time updates to both clients  
6. UI updates instantly without refresh  

---

# 📘 API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register` | Register a new user |
| POST | `/login` | Login & receive JWT |
| GET | `/conversations/{id}` | Fetch user conversations |
| GET | `/messages/{id}` | Retrieve messages |
| GET | `/search-users?q=` | Username-based search |
| WS | `/ws/{token}` | Real-time WebSocket messaging |

---

# 🔮 Future Enhancements

- Typing indicators  
- Online/offline presence tracking  
- Message read receipts  
- File & image sharing  
- Chat theme customization  
- Push notifications  
- Mobile-first UI redesign  

---

# 📄 License  
Released under the **MIT License** — free for personal and commercial usage.

---

