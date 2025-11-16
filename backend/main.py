import json
from typing import Dict
from fastapi import FastAPI, WebSocket, HTTPException, Depends, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from fastapi import Query

from database import init_db, engine, get_session
from models import User, Conversation, Message
from auth import hash_password, verify_password, create_access_token, decode_access_token

# Initialize DB
init_db()

app = FastAPI(title="Chat App API")

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active websockets: user_id -> websocket
active_connections: Dict[int, WebSocket] = {}


# ------------------------------------------------------
# AUTH MODULE
# ------------------------------------------------------

@app.post("/register")
async def register(payload: dict, session: Session = Depends(get_session)):
    username = payload.get("username")
    password = payload.get("password")

    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password required")

    # Check duplicate username
    exists = session.exec(select(User).where(User.username == username)).first()
    if exists:
        raise HTTPException(status_code=400, detail="Username already exists")

    user = User(username=username, password_hash=hash_password(password))
    session.add(user)
    session.commit()
    session.refresh(user)

    return {"id": user.id, "username": user.username}


@app.post("/login")
async def login(payload: dict, session: Session = Depends(get_session)):
    username = payload.get("username")
    password = payload.get("password")

    user = session.exec(select(User).where(User.username == username)).first()
    if not user:
        raise HTTPException(status_code=400, detail="User not found")

    if not verify_password(password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect password")

    token = create_access_token({"sub": str(user.id)})

    return {
        "access_token": token,
        "user": {"id": user.id, "username": user.username}
    }


# ------------------------------------------------------
# CONVERSATIONS & MESSAGES
# ------------------------------------------------------

@app.get("/conversations/{user_id}")
async def get_conversations(user_id: int, session: Session = Depends(get_session)):
    convs = session.exec(
        select(Conversation).where(
            (Conversation.user_a == user_id) | (Conversation.user_b == user_id)
        )
    ).all()

    return convs


@app.get("/messages/{conversation_id}")
async def get_messages(conversation_id: int, session: Session = Depends(get_session)):
    msgs = session.exec(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.timestamp)
    ).all()
    return msgs


# DELETE conversation + messages
@app.delete("/conversation/{conversation_id}")
async def delete_conversation(conversation_id: int, session: Session = Depends(get_session)):
    conv = session.exec(select(Conversation).where(Conversation.id == conversation_id)).first()

    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Delete all messages first
    msgs = session.exec(select(Message).where(Message.conversation_id == conversation_id)).all()
    for m in msgs:
        session.delete(m)

    # Delete conversation
    session.delete(conv)
    session.commit()

    return {"message": "Conversation deleted successfully"}


# ------------------------------------------------------
# USER SEARCH
# ------------------------------------------------------

@app.get("/search-users")
async def search_users(q: str = Query("")):
    with Session(engine) as session:
        users = session.exec(
            select(User).where(User.username.contains(q))
        ).all()
        return [{"id": u.id, "username": u.username} for u in users]


# ------------------------------------------------------
# WEBSOCKET REAL-TIME CHAT
# ------------------------------------------------------

@app.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    await websocket.accept()

    payload = decode_access_token(token)
    if not payload:
        await websocket.close(code=1008)
        return

    user_id = int(payload.get("sub"))
    active_connections[user_id] = websocket

    print(f"User {user_id} connected over WebSocket")

    try:
        while True:
            raw = await websocket.receive_text()
            obj = json.loads(raw)

            receiver_id = obj.get("to")
            content = obj.get("content")
            conv_id = obj.get("conversation_id")

            with Session(engine) as session:

                # Create new conversation if needed
                if conv_id is None:
                    conv = Conversation(user_a=user_id, user_b=receiver_id)
                    session.add(conv)
                    session.commit()
                    session.refresh(conv)
                    conv_id = conv.id

                # Create message
                msg = Message(
                    conversation_id=conv_id,
                    sender_id=user_id,
                    content=content
                )
                session.add(msg)
                session.commit()
                session.refresh(msg)

            # Output message
            payload_out = {
                "conversation_id": conv_id,
                "sender_id": user_id,
                "content": content,
                "timestamp": str(msg.timestamp)
            }

            # Send to receiver (if online)
            ws = active_connections.get(receiver_id)
            if ws:
                await ws.send_text(json.dumps(payload_out))

            # Echo to sender (important for sync)
            await websocket.send_text(json.dumps(payload_out))

    except WebSocketDisconnect:
        print(f"User {user_id} disconnected")
        if user_id in active_connections:
            del active_connections[user_id]

