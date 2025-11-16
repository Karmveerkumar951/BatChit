// src/App.jsx
import React, { useState } from "react";
import Login from "./components/Login";
import Chat from "./components/Chat";

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const s = localStorage.getItem("user");
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  });

  function handleLogin(userObj) {
    localStorage.setItem("user", JSON.stringify(userObj));
    setUser(userObj);
  }

  function handleLogout() {
    localStorage.removeItem("user");
    setUser(null);
    // optionally notify backend / close websockets handled in Chat
  }

  return (
    <>
      {user ? (
        <Chat user={user} onLogout={handleLogout} />
      ) : (
        <Login onLogin={handleLogin} />
      )}
    </>
  );
}
