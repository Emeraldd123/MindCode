import React, { useState, useEffect } from 'react';
import * as api from './api';
import Chat from './Chat';

const STORAGE_KEY = 'mindcode_session_id';

export default function App() {
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [map, setMap] = useState({ nodes: [], edges: [] });
  const [builds, setBuilds] = useState([]);
  const [checkpoints, setCheckpoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [buildLoading, setBuildLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize or restore session from localStorage
  useEffect(() => {
    async function initSession() {
      setLoading(true);
      setError(null);
      const storedId = localStorage.getItem(STORAGE_KEY);
      if (storedId) {
        try {
          const existing = await api.getSession(storedId);
          setSession(existing);
          setMessages(existing.messages || []);
          setMap(existing.map || { nodes: [], edges: [] });
          setBuilds(existing.builds || []);
          setCheckpoints(existing.checkpoints || []);
          setLoading(false);
          return;
        } catch (e) {
          console.warn('Could not restore session, creating a new one', e);
        }
      }

      try {
        const fresh = await api.createSession();
        localStorage.setItem(STORAGE_KEY, fresh.id);
        setSession(fresh);
        setMessages(fresh.messages || []);
        setMap(fresh.map || { nodes: [], edges: [] });
        setBuilds(fresh.builds || []);
        setCheckpoints(fresh.checkpoints || []);
      } catch (err) {
        setError(`Failed to create session: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }

    initSession();
  }, []);

  const handleNewSession = async () => {
    try {
      setLoading(true);
      setError(null);
      const fresh = await api.createSession();
      localStorage.setItem(STORAGE_KEY, fresh.id);
      setSession(fresh);
      setMessages([]);
      setMap({ nodes: [], edges: [] });
      setBuilds([]);
      setCheckpoints([]);
    } catch (err) {
      setError(`Failed to create new session: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (text) => {
    if (!session?.id) return;
    setError(null);
    const userMsg = { role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setChatLoading(true);

    try {
      const res = await api.sendMessage(session.id, text);
      if (res.reply) {
        setMessages((prev) => [...prev, { role: 'assistant', text: res.reply }]);
      }
      if (res.map) {
        setMap(res.map);
      }
    } catch (err) {
      setError(`Failed to send message: ${err.message}`);
    } finally {
      setChatLoading(false);
    }
  };

  const handleBuild = async () => {
    if (!session?.id || buildLoading) return;
    setError(null);
    setBuildLoading(true);
    try {
      const buildRes = await api.build(session.id);
      setBuilds((prev) => [...prev, buildRes]);
    } catch (err) {
      setError(`Build failed: ${err.message}`);
    } finally {
      setBuildLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner" />
        <p>Connecting to MindCode session...</p>
      </div>
    );
  }

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="brand">
          <h1 className="logo-title">MindCode</h1>
          <span className="tagline">Prompt Engineering via Mind Map</span>
        </div>
        <div className="header-meta">
          {session && (
            <span className="session-pill" title={`Session: ${session.id}`}>
              Session: <code>{session.id.slice(0, 8)}</code>
            </span>
          )}
          <button className="new-session-btn" onClick={handleNewSession} title="Start fresh session">
            + New Session
          </button>
        </div>
      </header>

      <main className="three-pane-layout">
        {/* Left Pane: Chat */}
        <section className="pane chat-pane" aria-label="Chat pane">
          <Chat
            messages={messages}
            onSendMessage={handleSendMessage}
            loading={chatLoading}
            error={error}
          />
        </section>

        {/* Center Pane: Mind Map (placeholder for Task #7) */}
        <section className="pane mindmap-pane" aria-label="Mind map pane">
          <div className="pane-header">
            <h2>Mind Map</h2>
            <span className="node-count">
              {map.nodes?.length || 0} bubble{map.nodes?.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="pane-body placeholder-container">
            <div className="placeholder-card">
              <div className="placeholder-icon">🧠</div>
              <h3>Live Mind Map</h3>
              <p>Bubbles will appear here as you chat (Task #7).</p>
              {map.nodes?.length > 0 && (
                <div className="map-summary-preview">
                  <p><strong>{map.nodes.length} nodes loaded:</strong></p>
                  <ul>
                    {map.nodes.slice(0, 5).map((n) => (
                      <li key={n.id}>
                        [{n.source}] {n.label}
                      </li>
                    ))}
                    {map.nodes.length > 5 && <li>...and {map.nodes.length - 5} more</li>}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Right Pane: Preview (placeholder for Task #9) */}
        <section className="pane preview-pane" aria-label="Preview pane">
          <div className="pane-header">
            <h2>App Preview</h2>
            <button
              className="build-btn"
              onClick={handleBuild}
              disabled={buildLoading || !session}
            >
              {buildLoading ? 'Building...' : '⚡ Build App'}
            </button>
          </div>
          <div className="pane-body placeholder-container">
            <div className="placeholder-card">
              <div className="placeholder-icon">🖥️</div>
              <h3>Generated App Preview</h3>
              <p>Traced preview iframe with hover connections (Task #9).</p>
              {builds.length > 0 && (
                <div className="builds-summary">
                  <p>Latest build: <code>{builds[builds.length - 1].id}</code></p>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
