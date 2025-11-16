// src/components/Chat.jsx
import React, { useState, useEffect, useRef } from "react";

/*
  Chat component
  - auto-reconnect WebSocket
  - heartbeat ping
  - fetch conversations & messages on connect/reconnect
  - delete conversation
  - search users & start chat
*/

export default function Chat({ user, onLogout }) {
  const [ws, setWs] = useState(null);
  const [connected, setConnected] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const msgsRef = useRef(null);
  const wsRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const reconnectRef = useRef({ attempts: 0, timer: null });

  // Helper: fetch conversations
  async function loadConversations() {
    try {
      const res = await fetch(`/api/conversations/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data || []);
      }
    } catch (e) {
      console.error("Failed to load conversations", e);
    }
  }

  // Helper: load messages for activeConv
  async function loadMessages(convId) {
    if (!convId) {
      setMessages([]);
      return;
    }
    try {
      const res = await fetch(`/api/messages/${convId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data || []);
        setTimeout(scrollBottom, 100);
      }
    } catch (e) {
      console.error("Failed to load messages", e);
    }
  }

  // connect WebSocket with reconnect logic
  function connectWebSocket() {
    // clear old timers
    if (reconnectRef.current.timer) {
      clearTimeout(reconnectRef.current.timer);
      reconnectRef.current.timer = null;
    }

    const url = `${window.location.protocol === "https:" ? "wss" : "ws"}://localhost:8000/ws/${user.token}`;
    const socket = new WebSocket(url);
    wsRef.current = socket;

    socket.onopen = () => {
      console.log("WS connected");
      setConnected(true);
      reconnectRef.current.attempts = 0;

      // fetch fresh lists/messages on connect
      loadConversations();
      if (activeConv) loadMessages(activeConv);

      // start heartbeat ping every 25s
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = setInterval(() => {
        try {
          socket.send(JSON.stringify({ type: "ping" }));
        } catch {}
      }, 25000);
    };

    socket.onmessage = (ev) => {
      // ignore ping/pong messages structure if any
      try {
        const data = JSON.parse(ev.data);
        // if message object contains conversation_id etc.
        if (data.conversation_id) {
          // if message belongs to active conv -> reload messages (authoritative)
          if (String(data.conversation_id) === String(activeConv)) {
            loadMessages(activeConv);
          } else {
            // update conversation list (new convo or last message changed)
            loadConversations();
          }
        }
      } catch (err) {
        console.warn("WS onmessage parse error", err);
      }
    };

    socket.onclose = (evt) => {
      console.log("WS closed", evt);
      cleanupSocket();
      scheduleReconnect();
    };

    socket.onerror = (err) => {
      console.log("WS error", err);
      cleanupSocket();
      scheduleReconnect();
    };

    setWs(socket);
  }

  function cleanupSocket() {
    setConnected(false);
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    wsRef.current = null;
  }

  function scheduleReconnect() {
    // exponential backoff with cap
    reconnectRef.current.attempts += 1;
    const attempt = reconnectRef.current.attempts;
    const delay = Math.min(30000, 1000 * Math.pow(2, Math.min(attempt, 6))); // up to 30s
    console.log(`Reconnecting in ${delay}ms (attempt ${attempt})`);

    reconnectRef.current.timer = setTimeout(() => {
      connectWebSocket();
    }, delay);
  }

  // initial setup: load conversations and open websocket
  useEffect(() => {
    loadConversations();
    connectWebSocket();

    // on unmount, cleanup
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (reconnectRef.current.timer) clearTimeout(reconnectRef.current.timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once

  // when activeConv changes, load messages
  useEffect(() => {
    if (activeConv) loadMessages(activeConv);
  }, [activeConv]);

  function scrollBottom() {
    if (msgsRef.current) {
      msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
    }
  }

  // Sending messages
  function sendMessage(e) {
    e.preventDefault();
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn("WebSocket not connected");
      return;
    }
    if (!activeConv) {
      alert("Open or start a conversation first.");
      return;
    }
    if (!input.trim()) return;

    const payload = {
      to: Number(getPeerFromConv(activeConv)),
      conversation_id: activeConv,
      content: input.trim(),
    };

    // optimistic UI
    setMessages((prev) => [
      ...prev,
      { conversation_id: activeConv, sender_id: user.id, content: input.trim(), timestamp: new Date().toISOString() },
    ]);
    setInput("");
    scrollBottom();

    try {
      wsRef.current.send(JSON.stringify(payload));
    } catch (err) {
      console.error("Failed to send WS message", err);
    }
  }

  // get peer id for a conversation
  function getPeerFromConv(convId) {
    const conv = conversations.find((c) => c.id === convId);
    if (!conv) return null;
    return conv.user_a === user.id ? conv.user_b : conv.user_a;
  }

  // Start new conversation (via clicking user search)
  function startChatWithUser(u) {
    setSearchTerm("");
    setSearchResults([]);
    // ensure websocket open
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const payload = { to: Number(u.id), conversation_id: null, content: "Hi" };
      wsRef.current.send(JSON.stringify(payload));
      // conversation will auto-open on incoming WS message (backend echoes)
    } else {
      // fallback: call backend to create conversation and open it
      fetch("/api/conversations/" + user.id)
        .then((r) => r.json())
        .then(() => {
          // refresh conversations; user will click to open
          loadConversations();
        });
    }
  }

  // Search users (live)
  let searchTimer = useRef(null);
  function handleSearch(q) {
    setSearchTerm(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search-users?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const users = await res.json();
          setSearchResults(users.filter((u) => u.id !== user.id));
        }
      } catch (e) {
        console.error("Search failed", e);
      }
    }, 300);
  }

  // Open conversation on click
  function openConversation(conv) {
    setActiveConv(conv.id);
    // messages will load via effect for activeConv
  }

  // Delete conversation
  async function confirmAndDelete(convId) {
    if (!convId) return;
    const ok = window.confirm("Delete this conversation and all messages? This cannot be undone.");
    if (!ok) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/conversation/${convId}`, { method: "DELETE" });
      if (res.ok) {
        // refresh conv list and clear activeConv if same
        await loadConversations();
        if (activeConv === convId) {
          setActiveConv(null);
          setMessages([]);
        }
      } else {
        const err = await res.json();
        alert(err.detail || "Failed to delete");
      }
    } catch (e) {
      console.error(e);
      alert("Delete failed");
    } finally {
      setIsDeleting(false);
    }
  }

  // UI components
  return (
    <div className="chat-app dark">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="profile">
            <div className="avatar">{user.username[0].toUpperCase()}</div>
            <div className="meta">
              <div className="name">{user.username}</div>
              <div className="status">{connected ? "Online" : "Connecting..."}</div>
            </div>
          </div>
          <button className="btn small" onClick={onLogout}>Logout</button>
        </div>

        <div className="search">
          <input placeholder="Search users..." value={searchTerm} onChange={(e) => handleSearch(e.target.value)} />
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

        <div className="conversations">
          {conversations.length === 0 && <div className="muted">No conversations yet</div>}
          {conversations.map((c) => {
            const peerId = c.user_a === user.id ? c.user_b : c.user_a;
            return (
              <div key={c.id} className={`conv ${activeConv === c.id ? "active" : ""}`} onClick={() => openConversation(c)}>
                <div className="conv-left">
                  <div className="avatar">{String(peerId)[0]}</div>
                </div>
                <div className="conv-body">
                  <div className="conv-title">Conv {c.id}</div>
                  <div className="conv-sub">Users: {c.user_a} & {c.user_b}</div>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      <main className="chat-window">
        <div className="chat-header">
          <div className="title">
            {activeConv ? `Conversation ${activeConv}` : "No conversation selected"}
          </div>
          <div className="header-actions">
            {activeConv && <button className="btn danger small" onClick={() => confirmAndDelete(activeConv)} disabled={isDeleting}>Delete Chat</button>}
            <button className="btn small" onClick={() => { loadConversations(); if (activeConv) loadMessages(activeConv); }}>Refresh</button>
          </div>
        </div>

        <div className="messages" ref={msgsRef}>
          {!activeConv && <div className="muted center">Select a conversation or start a new chat</div>}
          {messages.map((m, i) => (
            <div key={i} className={`message ${m.sender_id === user.id ? "out" : "in"}`}>
              <div className="bubble">
                <div className="content">{m.content}</div>
                <div className="ts">{new Date(m.timestamp).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>

        <form className="composer" onSubmit={sendMessage}>
          <input placeholder="Type a message..." value={input} onChange={(e) => setInput(e.target.value)} />
          <button className="btn primary" type="submit">Send</button>
        </form>
      </main>
    </div>
  );
}
