// src/components/Chat.jsx
import React, { useState, useEffect, useRef } from "react";

export default function Chat({ user, onLogout }) {
  const [ws, setWs] = useState(null);
  const [connected, setConnected] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  const [input, setInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const msgsRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  // ------------------------------
  // API HELPERS
  // ------------------------------

  async function loadConversations() {
    const r = await fetch(`/api/conversations/${user.id}`);
    if (r.ok) setConversations(await r.json());
  }

  async function loadMessages(convId) {
    if (!convId) {
      setMessages([]);
      return;
    }
    const r = await fetch(`/api/messages/${convId}`);
    if (r.ok) {
      setMessages(await r.json());
      scrollBottom();
    }
  }

  function scrollBottom() {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
  }

  // ------------------------------
  // WEBSOCKET CONNECTION
  // ------------------------------

  useEffect(() => {
    connectWS();

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, []);

  function connectWS() {
    const url = `ws://localhost:8000/ws/${user.token}`;
    const socket = new WebSocket(url);

    wsRef.current = socket;
    setWs(socket);

    socket.onopen = () => {
      console.log("🔥 WS Connected");
      setConnected(true);
      loadConversations();
      if (activeConv) loadMessages(activeConv);
    };

    socket.onclose = () => {
      console.log("❌ WS Closed");
      setConnected(false);
      retryConnect();
    };

    socket.onerror = (e) => {
      console.log("⚠ WS Error", e);
      setConnected(false);
      retryConnect();
    };

    // --------------- FIXED onmessage handler ---------------
    socket.onmessage = (ev) => {
      console.log("WS →", ev.data);
      let data;
      try {
        data = JSON.parse(ev.data);
      } catch {
        return;
      }

      // Auto-open NEW conversation
      if (!activeConv && data.conversation_id) {
        console.log("📥 Auto-opening new chat...");
        setActiveConv(data.conversation_id);
        loadConversations();
        loadMessages(data.conversation_id);
        return;
      }

      // Message for active conversation
      if (String(data.conversation_id) === String(activeConv)) {
        setMessages((prev) => [...prev, data]);
        scrollBottom();
      } else {
        // Update conversation list
        loadConversations();
      }
    };
  }

  // ------------------------------
  // RECONNECT LOGIC
  // ------------------------------

  function retryConnect() {
    if (reconnectTimer.current) return;
    reconnectTimer.current = setTimeout(() => {
      reconnectTimer.current = null;
      console.log("🔁 Reconnecting WebSocket...");
      connectWS();
    }, 1500);
  }

  // ------------------------------
  // CHAT ACTIONS
  // ------------------------------

  function sendMessage(e) {
    e.preventDefault();
    const socket = wsRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    const payload = {
      to: Number(getPeer(activeConv)),
      conversation_id: activeConv,
      content: input.trim(),
    };

    // optimistic render
    setMessages((prev) => [
      ...prev,
      {
        conversation_id: activeConv,
        sender_id: user.id,
        content: input.trim(),
        timestamp: new Date().toISOString(),
      },
    ]);

    socket.send(JSON.stringify(payload));
    setInput("");
    scrollBottom();
  }

  function getPeer(convId) {
    const c = conversations.find((c) => c.id === convId);
    return c.user_a === user.id ? c.user_b : c.user_a;
  }

  async function deleteConversation(convId) {
    if (!window.confirm("Delete this chat permanently?")) return;

    setIsDeleting(true);
    const r = await fetch(`/api/conversation/${convId}`, { method: "DELETE" });

    if (r.ok) {
      await loadConversations();
      setActiveConv(null);
      setMessages([]);
    } else {
      alert("Failed to delete chat.");
    }

    setIsDeleting(false);
  }

  // ------------------------------
  // USER SEARCH
  // ------------------------------

  async function handleSearch(q) {
    setSearchTerm(q);

    if (!q.trim()) {
      setSearchResults([]);
      return;
    }

    const r = await fetch(`/api/search-users?q=${q}`);
    if (!r.ok) return;

    const users = await r.json();
    setSearchResults(users.filter((u) => u.id !== user.id));
  }

  function startChatWithUser(u) {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    socket.send(
      JSON.stringify({
        to: Number(u.id),
        conversation_id: null,
        content: "Hi",
      })
    );

    setSearchTerm("");
    setSearchResults([]);
  }

  // ------------------------------
  // UI
  // ------------------------------

  return (
    <div className="chat-app dark">
      {/* SIDEBAR ---------------- */}
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="profile">
            <div className="avatar">{user.username[0].toUpperCase()}</div>
            <div className="meta">
              <div className="name">{user.username}</div>
              <div className="status">{connected ? "Online" : "Connecting..."}</div>
            </div>
          </div>
          <button className="btn small" onClick={onLogout}>
            Logout
          </button>
        </div>

        {/* Search */}
        <div className="search">
          <input
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map((u) => (
                <div key={u.id} className="search-item" onClick={() => startChatWithUser(u)}>
                  <div className="avatar small">{u.username[0].toUpperCase()}</div>
                  <div className="info">{u.username}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Conversations */}
        <div className="conversations">
          {conversations.map((c) => {
            const peer = getPeer(c.id);
            return (
              <div
                key={c.id}
                className={`conv ${activeConv === c.id ? "active" : ""}`}
                onClick={() => setActiveConv(c.id)}
              >
                <div className="avatar small">{String(peer)[0]}</div>
                <div>
                  <div className="conv-title">Chat {c.id}</div>
                  <div className="conv-sub">
                    {c.user_a} ↔ {c.user_b}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* CHAT WINDOW ---------------- */}
      <main className="chat-window">
        <div className="chat-header">
          <div className="title">
            {activeConv ? `Conversation ${activeConv}` : "Select a conversation"}
          </div>
          {activeConv && (
            <button
              className="btn danger small"
              onClick={() => deleteConversation(activeConv)}
              disabled={isDeleting}
            >
              Delete
            </button>
          )}
        </div>

        <div className="messages" ref={msgsRef}>
          {!activeConv && (
            <div className="muted center">Select or start a chat</div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`message ${m.sender_id === user.id ? "out" : "in"}`}>
              <div className="bubble">
                {m.content}
                <div className="ts">
                  {new Date(m.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Message composer */}
        {activeConv && (
          <form className="composer" onSubmit={sendMessage}>
            <input
              placeholder="Type a message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button className="btn primary">Send</button>
          </form>
        )}
      </main>
    </div>
  );
}
