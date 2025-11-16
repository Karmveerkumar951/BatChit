// src/components/Login.jsx
import React, { useState } from "react";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login"); // 'login' or 'register'
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setMsg(null);

    if (!username.trim() || !password.trim()) {
      setMsg({ type: "error", text: "Username and password are required." });
      return;
    }

    setLoading(true);
    try {
      const url = mode === "login" ? "/api/login" : "/api/register";
      const payload = { username: username.trim(), password: password };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        // backend returns 400 or 401 with detail
        const detail = data.detail || data.message || JSON.stringify(data);
        setMsg({ type: "error", text: detail });
      } else {
        if (mode === "register") {
          // registration successful, prompt to login automatically
          setMsg({ type: "success", text: "Registered successfully — logging you in..." });
          // auto login for convenience: call login immediately
          const loginRes = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const loginData = await loginRes.json();
          if (!loginRes.ok) {
            setMsg({ type: "error", text: loginData.detail || "Registration succeeded but auto-login failed." });
            setMode("login");
          } else {
            // login succeeded
            onLogin({ id: loginData.user.id, username: loginData.user.username, token: loginData.access_token || loginData.token || loginData.accessToken });
          }
        } else {
          // login success
          onLogin({ id: data.user.id, username: data.user.username, token: data.access_token || data.token || data.accessToken });
        }
      }
    } catch (err) {
      console.error(err);
      setMsg({ type: "error", text: "Network error. Is the backend running?" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>

        {msg && <div className={`notice ${msg.type}`}>{msg.text}</div>}

        <form onSubmit={submit} className="login-form">
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
          <button className="btn primary" type="submit" disabled={loading}>{loading ? "Please wait..." : (mode === "login" ? "Login" : "Register")}</button>
        </form>

        <div className="muted small">
          {mode === "login" ? "New here?" : "Already have an account?"}
          <button className="link" onClick={() => { setMode(mode === "login" ? "register" : "login"); setMsg(null); }}>
            {mode === "login" ? "Create an account" : "Login"}
          </button>
        </div>
      </div>
    </div>
  );
}
