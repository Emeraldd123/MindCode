import React, { useState, useEffect } from 'react';
import * as api from './api';
import Chat from './Chat';
import MindMap from './MindMap';
import Preview from './Preview';
import NodeDrawer from './NodeDrawer';
import Checkpoints from './Checkpoints';

const STORAGE_KEY = 'mindcode_session_id';

export default function App() {
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [map, setMap] = useState({ nodes: [], edges: [] });
  const [builds, setBuilds] = useState([]);
  const [checkpoints, setCheckpoints] = useState([]);
  const [hoverNodes, setHoverNodes] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [changedIds, setChangedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeCheckpointId, setActiveCheckpointId] = useState(null); // null = live

  // Checkpoint view: show that checkpoint's map (read-only) and its build, if any.
  const activeCheckpoint = activeCheckpointId ? checkpoints.find((c) => c.id === activeCheckpointId) : null;
  const viewMap = activeCheckpoint ? activeCheckpoint.map : map;
  const selectedNode = !activeCheckpoint && selectedNodeId ? map.nodes.find((n) => n.id === selectedNodeId) : null;

  // Refresh checkpoints after each chat turn and whenever a build finishes.
  const buildStatusKey = builds.map((b) => `${b.id}:${b.status}`).join(',');
  useEffect(() => {
    if (!session?.id) return;
    api.getCheckpoints(session.id).then(setCheckpoints).catch(() => {});
  }, [session?.id, messages.length, buildStatusKey]);

  const handleNodeChange = (node) => {
    if (!node) return;
    setMap((prev) => ({ ...prev, nodes: prev.nodes.map((n) => (n.id === node.id ? node : n)) }));
  };

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
      setSelectedNodeId(null);
      setActiveCheckpointId(null);
      setHoverNodes([]);
      setChangedIds([]);
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
      if (res.changed && res.changed.length > 0) {
        setChangedIds(res.changed);
        setTimeout(() => setChangedIds([]), 4000);
      }
    } catch (err) {
      setError(`Failed to send message: ${err.message}`);
    } finally {
      setChatLoading(false);
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

        {/* Center Pane: Mind Map (Task #7) */}
        <section className="pane mindmap-pane" aria-label="Mind map pane">
          <div className="pane-header">
            <h2>Mind Map</h2>
            <span className="node-count">
              {map.nodes?.length || 0} bubble{map.nodes?.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="pane-body">
            <MindMap
              map={viewMap}
              highlighted={hoverNodes}
              changedIds={activeCheckpoint ? [] : changedIds}
              selectedId={selectedNodeId}
              onSelect={(n) => setSelectedNodeId(n?.id ?? null)}
            />
          </div>
          <Checkpoints
            checkpoints={checkpoints}
            activeId={activeCheckpointId}
            onSelect={(cp) => setActiveCheckpointId(cp ? cp.id : null)}
          />
          {selectedNode && (
            <NodeDrawer
              key={selectedNode.id}
              sessionId={session?.id}
              node={selectedNode}
              onNodeChange={handleNodeChange}
              onClose={() => setSelectedNodeId(null)}
              onError={setError}
            />
          )}
        </section>

        {/* Right Pane: build preview with two-way trace highlighting (#9) */}
        <section className="pane preview-pane" aria-label="Preview pane">
          <Preview
            sessionId={session?.id}
            map={viewMap}
            builds={builds}
            setBuilds={setBuilds}
            buildId={activeCheckpoint?.build_id}
            highlightNodes={selectedNodeId ? [selectedNodeId] : []}
            onHoverNodes={setHoverNodes}
            onError={setError}
          />
        </section>
      </main>
    </div>
  );
}
