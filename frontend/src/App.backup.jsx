import { useState } from "react";
import "./App.css";

const API_URL = "http://localhost:3000";

const INITIAL_MESSAGE = {
  role: "assistant",
  text:
    "Hello. I'm MemoryDesk — an AI support agent that remembers useful context across conversations, so you don't have to start over."
};

const DEMO_FIRST =
  "My Wi-Fi keeps disconnecting on my Dell laptop. I already restarted the router but the issue continues.";

const DEMO_SECOND =
  "It is happening again. What did we try last time?";

export default function App() {
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");

  const [device, setDevice] = useState("");
  const [issue, setIssue] = useState("");

  const [customerId, setCustomerId] = useState("chaos-demo-01");

  const [loading, setLoading] = useState(false);

  const [activeTab, setActiveTab] = useState("profile");
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const [memoryUpdated, setMemoryUpdated] = useState(false);
  const [demoStage, setDemoStage] = useState(0);
  const [statusText, setStatusText] = useState("");

  async function askAgent(message, id = customerId) {
    const response = await fetch(`${API_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        customerId: id,
        message
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Request failed");
    }

    return data;
  }

  async function sendMessage(customMessage = null) {
    const message = customMessage || input.trim();

    if (!message || loading) return;

    const normalized = message.toLowerCase().trim();

    const greetings = [
      "hi",
      "hello",
      "hey",
      "hii",
      "hiii",
      "good morning",
      "good evening"
    ];

    setMessages((current) => [
      ...current,
      {
        role: "user",
        text: message
      }
    ]);

    if (!customMessage) {
      setInput("");
    }

    // Greetings stay local and natural.
    if (greetings.includes(normalized)) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text:
            "Hi! 👋 I'm MemoryDesk. Before we get started, choose your device and issue above, then tell me what's happening."
        }
      ]);

      return;
    }

    const lowerMessage = message.toLowerCase();

    if (
      lowerMessage.includes("last time") ||
      lowerMessage.includes("previous") ||
      lowerMessage.includes("earlier") ||
      lowerMessage.includes("remember")
    ) {
      setStatusText("Let me check what we discussed before…");
    } else if (
      lowerMessage.includes("problem") ||
      lowerMessage.includes("issue") ||
      lowerMessage.includes("not working") ||
      lowerMessage.includes("error")
    ) {
      setStatusText("Checking a few things for you…");
    } else {
      setStatusText("Let me look into that…");
    }

    setLoading(true);
    setMemoryUpdated(false);

    try {
      const contextualMessage =
        `[Device: ${device || "Not selected"}] ` +
        `[Issue: ${issue || "Not selected"}] ` +
        message;

      const data = await askAgent(contextualMessage);

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: data.response
        }
      ]);

      setMemoryUpdated(true);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text:
            `MemoryDesk could not connect to the support service. ` +
            `${error.message}`
        }
      ]);
    } finally {
      setLoading(false);
      setStatusText("");
    }
  }

  async function loadHistory() {
    setActiveTab("history");

    if (historyLoaded) return;

    setHistoryLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/history`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load history");
      }

      setHistory(data.memories || []);
      setHistoryLoaded(true);
    } catch (error) {
      console.error(error);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function clearHistory() {
    const confirmed = window.confirm(
      "Clear all MemoryDesk memories from Hindsight? This cannot be undone."
    );

    if (!confirmed) return;

    setHistoryLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/history`, {
        method: "DELETE"
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not clear history");
      }

      setHistory([]);
      setHistoryLoaded(true);
      setMemoryUpdated(false);
      setDemoStage(0);

      alert("Hindsight history cleared.");
    } catch (error) {
      alert(`Could not clear history: ${error.message}`);
    } finally {
      setHistoryLoading(false);
    }
  }

  function resetSession() {
    setMessages([INITIAL_MESSAGE]);
    setInput("");
    setDevice("");
    setIssue("");
    setMemoryUpdated(false);
    setDemoStage(0);
  }

  async function runDemo() {
    if (loading) return;

    const demoCustomer = "chaos-demo-01";

    setCustomerId(demoCustomer);
    setDevice("Laptop");
    setIssue("Wi-Fi");
    setMessages([INITIAL_MESSAGE]);
    setHistory([]);
    setHistoryLoaded(false);
    setMemoryUpdated(false);
    setDemoStage(1);
    setLoading(true);

    try {
      const first = await askAgent(
        `[Device: Laptop] [Issue: Wi-Fi] ${DEMO_FIRST}`,
        demoCustomer
      );

      setMessages([
        INITIAL_MESSAGE,
        {
          role: "user",
          text: DEMO_FIRST
        },
        {
          role: "assistant",
          text: first.response
        }
      ]);

      setMemoryUpdated(true);

      await new Promise((resolve) => setTimeout(resolve, 1000));

      setDemoStage(2);

      const second = await askAgent(
        `[Device: Laptop] [Issue: Wi-Fi] ${DEMO_SECOND}`,
        demoCustomer
      );

      setMessages((current) => [
        ...current,
        {
          role: "user",
          text: DEMO_SECOND
        },
        {
          role: "assistant",
          text: second.response
        }
      ]);

      setDemoStage(3);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: `Demo failed: ${error.message}`
        }
      ]);

      setDemoStage(0);
    } finally {
      setLoading(false);
      setStatusText("");
    }
  }

  function showProfile() {
    setActiveTab("profile");
  }

  return (
    <div className="site">

      {/* HERO */}
      <section className="hero">

        <nav className="masthead">
          <div className="masthead-search">
            <span>⌕</span>
            <span>Search</span>
          </div>

          <div className="wordmark">MEMORYDESK</div>

          <div className="nav-links">
            <a href="#workspace">Workspace</a>
            <a href="#memory">Memory</a>
            <a href="#about">About</a>
            <a href="#team">Chaos & Co. ↗</a>
          </div>
        </nav>

        <div className="hero-content">
          <div className="hero-label">
            AI SUPPORT · PERSISTENT MEMORY
          </div>

          <h1>
            Support that
            <em> remembers.</em>
          </h1>

          <p>
            An AI customer-support agent that carries useful context
            from one conversation into the next.
          </p>

          <div className="hero-actions">
            <button onClick={runDemo} disabled={loading}>
              {loading ? "Running..." : "Run memory demo ↗"}
            </button>

            <span>Powered by Hindsight</span>
          </div>
        </div>

        <div className="hero-bottom">
          <span>CHAOS & CO.</span>
          <span>HACK WITH HYDERABAD 3.0</span>
          <span>2026</span>
        </div>
      </section>

      {/* INTRO */}
      <section className="intro" id="about">
        <div className="section-kicker">THE IDEA</div>

        <h2>
          What changes when
          <br />
          an AI agent can remember?
        </h2>

        <p>
          MemoryDesk keeps useful customer context across interactions
          so support can continue instead of starting over.
        </p>
      </section>

      {/* WORKSPACE */}
      <section className="workspace" id="workspace">

        <div className="workspace-header">
          <div>
            <span className="section-kicker">LIVE WORKSPACE</span>
            <h2>MemoryDesk</h2>
          </div>

          <button
            className="text-button"
            onClick={resetSession}
          >
            New session ↺
          </button>
        </div>

        {/* DEVICE + ISSUE */}
        <div className="selection-bar">
          <div className="selection-intro">
            <span className="section-kicker">
              START A SUPPORT SESSION
            </span>

            <p>
              Give MemoryDesk the context it should remember.
            </p>
          </div>

          <div className="selection-controls">
            <label>
              DEVICE
              <select
                value={device}
                onChange={(e) => {
                  setDevice(e.target.value);
                  setMessages([INITIAL_MESSAGE]);
                  setMemoryUpdated(false);
                }}
              >
                <option value="">Select device</option>
                <option>Laptop</option>
                <option>Desktop</option>
                <option>Smartphone</option>
                <option>Tablet</option>
                <option>Printer</option>
                <option>Other</option>
              </select>
            </label>

            <label>
              ISSUE
              <select
                value={issue}
                onChange={(e) => {
                  setIssue(e.target.value);
                  setMessages([INITIAL_MESSAGE]);
                  setMemoryUpdated(false);
                }}
              >
                <option value="">Select issue</option>
                <option>Wi-Fi</option>
                <option>Battery</option>
                <option>Bluetooth</option>
                <option>Screen / Display</option>
                <option>Keyboard / Trackpad</option>
                <option>Software / App</option>
                <option>Other</option>
              </select>
            </label>
          </div>
        </div>

        <div className="workspace-grid">

          {/* CHAT */}
          <section className="chat-area">

            <div className="chat-meta">
              <span className="live-dot"></span>
              AI SUPPORT AGENT
            </div>

            <div className="messages">
              {messages.map((message, index) => (
                <div
                  className={`conversation ${message.role}`}
                  key={index}
                >
                  <div className="conversation-label">
                    {message.role === "user"
                      ? "CUSTOMER"
                      : "MEMORYDESK"}
                  </div>

                  <div className="conversation-text">
                    {message.text}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="conversation assistant">
                  <div className="conversation-label">
                    MEMORYDESK
                  </div>

                  <div className="conversation-text muted">
                    {statusText || "Let me look into that…"}
                  </div>
                </div>
              )}
            </div>

            <div className="prompt-row">
              <span>TRY</span>

              <button
                onClick={() => sendMessage("What did we try last time?")}
                disabled={loading}
              >
                What did we try last time?
              </button>

              <button
                onClick={() =>
                  sendMessage("Summarize my previous issue.")
                }
                disabled={loading}
              >
                Summarize my issue
              </button>
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
                placeholder="Tell MemoryDesk what's happening…"
              />

              <button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
              >
                ↗
              </button>
            </div>
          </section>

          {/* SIDEBAR */}
          <aside className="memory-area" id="memory">

            <div className="sidebar-tabs">
              <button
                className={
                  activeTab === "profile" ? "tab active" : "tab"
                }
                onClick={showProfile}
              >
                Profile
              </button>

              <button
                className={
                  activeTab === "history" ? "tab active" : "tab"
                }
                onClick={loadHistory}
              >
                History
                {historyLoaded && (
                  <span>{history.length}</span>
                )}
              </button>
            </div>

            {activeTab === "profile" && (
              <>
                <div className="memory-header">
                  <div>
                    <span className="section-kicker">
                      CUSTOMER CONTEXT
                    </span>

                    <h3>Support profile</h3>
                  </div>

                  <span className="memory-live">
                    SESSION
                  </span>
                </div>

                <label className="customer-input">
                  CUSTOMER ID

                  <input
                    value={customerId}
                    onChange={(e) =>
                      setCustomerId(e.target.value)
                    }
                  />
                </label>

                <div className="profile">
                  <div>
                    <span>DEVICE</span>
                    <strong>
                      {device || "Not selected"}
                    </strong>
                  </div>

                  <div>
                    <span>ISSUE</span>
                    <strong>
                      {issue || "Not selected"}
                    </strong>
                  </div>

                  <div>
                    <span>MEMORY</span>
                    <strong>
                      Hidden until History is opened
                    </strong>
                  </div>

                  <div>
                    <span>STATUS</span>
                    <strong>
                      {memoryUpdated
                        ? "Context recorded"
                        : "Ready"}
                    </strong>
                  </div>
                </div>

                <div className="profile-message">
                  <span>PERSISTENT MEMORY</span>

                  <p>
                    MemoryDesk remembers in the background.
                    Open the <strong>History</strong> tab whenever
                    you want to inspect what Hindsight has stored.
                  </p>
                </div>

                <div className="demo-state">
                  <div>
                    <strong>Memory Learning Loop</strong>
                    <span>
                      {demoStage === 3
                        ? "Complete"
                        : demoStage === 2
                        ? "Returning customer"
                        : demoStage === 1
                        ? "First interaction"
                        : "Ready"}
                    </span>
                  </div>

                  <div className="mini-steps">
                    <span className={demoStage >= 1 ? "done" : ""}>
                      01
                    </span>

                    <span className={demoStage >= 2 ? "done" : ""}>
                      02
                    </span>

                    <span className={demoStage >= 3 ? "done" : ""}>
                      03
                    </span>
                  </div>
                </div>
              </>
            )}

            {activeTab === "history" && (
              <>
                <div className="memory-header">
                  <div>
                    <span className="section-kicker">
                      PERSISTENT MEMORY
                    </span>

                    <h3>History</h3>
                  </div>

                  <button
                    className="clear-button"
                    onClick={clearHistory}
                    disabled={historyLoading}
                  >
                    Clear all
                  </button>
                </div>

                <div className="history-note">
                  Hindsight memories are shown only in this tab.
                </div>

                {historyLoading && (
                  <div className="history-empty">
                    <div>○</div>
                    <p>Loading Hindsight history…</p>
                  </div>
                )}

                {!historyLoading && history.length === 0 && (
                  <div className="history-empty">
                    <div>○</div>
                    <p>No memories stored.</p>
                    <span>
                      Start a support conversation to build
                      persistent context.
                    </span>
                  </div>
                )}

                {!historyLoading && history.length > 0 && (
                  <div className="history-list">
                    {history.map((memory, index) => (
                      <div className="history-item" key={index}>
                        <div className="history-number">
                          {String(index + 1).padStart(2, "0")}
                        </div>

                        <div>
                          <span>
                            {memory.type === "observation"
                              ? "OBSERVATION"
                              : memory.type === "experience"
                              ? "EXPERIENCE"
                              : "MEMORY"}
                          </span>

                          <p>{memory.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            <div className="memory-explanation">
              <span>WHY MEMORY MATTERS</span>

              <p>
                The value isn't just answering the current question.
                It is remembering what happened before.
              </p>
            </div>

          </aside>
        </div>
      </section>

      {/* LEARNING LOOP */}
      <section className="memory-loop">

        <div className="section-kicker">
          THE LEARNING LOOP
        </div>

        <h2>
          From one conversation
          <br />
          to the next.
        </h2>

        <div className="loop-grid">

          <div
            className={
              demoStage >= 1
                ? "loop-step active"
                : "loop-step"
            }
          >
            <span>01</span>

            <h3>Interact</h3>

            <p>
              The customer explains an issue and shares useful context.
            </p>
          </div>

          <div
            className={
              demoStage >= 2
                ? "loop-step active"
                : "loop-step"
            }
          >
            <span>02</span>

            <h3>Remember</h3>

            <p>
              Hindsight retains information that can matter later.
            </p>
          </div>

          <div
            className={
              demoStage >= 3
                ? "loop-step active"
                : "loop-step"
            }
          >
            <span>03</span>

            <h3>Recall</h3>

            <p>
              The returning customer gets a response grounded in history.
            </p>
          </div>

        </div>

        <div className="demo-caption">
          {demoStage === 3
            ? "Memory loop complete — open History to inspect what Hindsight remembered."
            : "Run the memory demo to see the loop in action."}
        </div>
      </section>

      {/* ATMOSPHERE */}
      <section className="atmosphere">
        <p>
          The best support conversation is not always the one
          with the fastest answer — it is the one that already
          knows what happened last time.
        </p>
      </section>

      {/* FOOTER */}
      <footer id="team">

        <div className="footer-brand">
          MEMORYDESK
          <span>by Chaos & Co.</span>
        </div>

        <div className="footer-links">
          <span>HINDSIGHT MEMORY</span>
          <span>AI SUPPORT</span>
          <span>HACK WITH HYDERABAD 3.0</span>
        </div>

      </footer>

    </div>
  );
}
