import { useState } from "react";
import "./App.css";

const API_URL = "http://localhost:3000";

export default function App() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Hi! I'm MemoryDesk 👋 I remember previous support conversations, so you don't have to repeat yourself."
    }
  ]);

  const [input, setInput] = useState("");
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(false);

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const message = input.trim();

    setMessages((m) => [...m, { role: "user", text: message }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: "fasiha-demo",
          message
        })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Request failed");

      setMessages((m) => [
        ...m,
        { role: "assistant", text: data.response }
      ]);

      setMemories(data.memories || []);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: `Connection error: ${err.message}`
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  function resetChat() {
    setMessages([
      {
        role: "assistant",
        text: "Hi! I'm MemoryDesk 👋 I remember previous support conversations, so you don't have to repeat yourself."
      }
    ]);
    setMemories([]);
  }

  return (
    <div className="app">
      <header>
        <div className="brand">
          <div className="logo">🧠</div>
          <div>
            <h1>MemoryDesk</h1>
            <p>Persistent AI Customer Support</p>
          </div>
        </div>
        <div className="team">✦ Chaos & Co.</div>
      </header>

      <main>
        <section className="chat">
          <div className="chatTop">
            <div><span className="dot"></span> AI Support Agent</div>
            <button onClick={resetChat}>↻ Reset</button>
          </div>

          <div className="messages">
            {messages.map((m, i) => (
              <div key={i} className={`row ${m.role}`}>
                <div className="avatar">{m.role === "user" ? "👤" : "🧠"}</div>
                <div className="bubble">{m.text}</div>
              </div>
            ))}

            {loading && (
              <div className="row assistant">
                <div className="avatar">🧠</div>
                <div className="bubble typing">MemoryDesk is thinking...</div>
              </div>
            )}
          </div>

          <div className="composer">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Describe your issue..."
            />
            <button onClick={sendMessage} disabled={!input.trim() || loading}>
              ➤
            </button>
          </div>
        </section>

        <aside>
          <div className="memoryHead">
            <div className="memoryLogo">🧠</div>
            <div>
              <h2>Memory</h2>
              <p>Powered by Hindsight</p>
            </div>
          </div>

          <div className="status">
            <span></span> Persistent memory active
          </div>

          {memories.length === 0 ? (
            <div className="empty">
              <div>💬</div>
              <strong>No memories recalled yet</strong>
              <p>Start chatting and MemoryDesk will build customer context.</p>
            </div>
          ) : (
            <div className="memoryList">
              <h3>RECALLED CONTEXT</h3>
              {memories.map((m, i) => (
                <div className="memory" key={i}>
                  <b>{m.type}</b>
                  <p>{m.text}</p>
                </div>
              ))}
            </div>
          )}

          <div className="why">
            <strong>Why memory matters</strong>
            <p>
              MemoryDesk recalls relevant past interactions so customers don't
              have to repeat themselves.
            </p>
          </div>
        </aside>
      </main>

      <footer>Built by Chaos & Co. • Hack With Hyderabad 3.0</footer>
    </div>
  );
}
