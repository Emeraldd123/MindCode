import React, { useState, useEffect } from 'react';
import * as api from './api';
import Chat from './Chat';
import MindMap from './MindMap';
import TreeMap from './TreeMap';
import Preview from './Preview';
import NodeDrawer from './NodeDrawer';
import Checkpoints from './Checkpoints';
import { Plus } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/ui/primitives/resizable';

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
  // Two map views to compare: 'graph' (Oliver & Tenma's MindMap) and 'tree' (Claude's TreeMap).
  const [mapView, setMapView] = useState(() => {
    try { return localStorage.getItem('mindcode_map_view') || 'tree'; } catch { return 'tree'; }
  });
  const chooseView = (v) => {
    setMapView(v);
    try { localStorage.setItem('mindcode_map_view', v); } catch {}
  };

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
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setChatLoading(true);

    const applyChanged = (changed) => {
      if (changed && changed.length > 0) {
        setChangedIds(changed);
        setTimeout(() => setChangedIds([]), 4000);
      }
    };

    try {
      const res = await api.sendMessage(session.id, text);
      if (res.pending) {
        // A full build plan can take Opus longer than Netlify's 30 s sync limit, so the turn runs
        // in a background function and we poll the session until it's done.
        const started = Date.now();
        for (;;) {
          await new Promise((r) => setTimeout(r, 1500));
          const s = await api.getSession(session.id);
          const t = s.turn;
          if (t?.status === 'pending' && Date.now() - started < 4 * 60 * 1000) continue;
          if (t?.status === 'done') {
            setMessages(s.messages || []);
            setMap(s.map || { nodes: [], edges: [] });
            applyChanged(t.changed);
          } else {
            setMessages(s.messages || []);
            setError(`Failed to send message: ${t?.error || 'Claude took too long, please try again'}`);
          }
          break;
        }
      } else {
        if (res.reply) setMessages((prev) => [...prev, { role: 'assistant', text: res.reply }]);
        if (res.map) setMap(res.map);
        applyChanged(res.changed);
      }
    } catch (err) {
      setMessages((prev) => prev.slice(0, -1)); // the server didn't keep it
      setError(`Failed to send message: ${err.message}`);
    } finally {
      setChatLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background font-sans text-muted-foreground">
        <div className="size-6 animate-spin rounded-full border-2 border-hairline border-t-ai" />
        <p className="text-[13px]">Connecting to MindCode…</p>
      </div>
    );
  }

  const approvedCount = (map.nodes || []).filter((n) => n.status === 'approved').length;
  const lastBuild = [...builds].reverse().find((b) => b.status === 'done');

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background font-sans text-foreground">
      {/* Header: slim, hairline-separated (Obsidian / Claude style) */}
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-hairline px-4">
        <div className="flex items-baseline gap-2.5">
          <span className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
            <span className="inline-block size-2.5 rounded-full bg-gradient-to-br from-user to-ai" aria-hidden />
            MindCode
          </span>
          <span className="hidden text-xs text-dim md:inline">See every assumption before Claude builds</span>
        </div>
        <div className="hidden items-center gap-1.5 text-xs text-muted-foreground lg:flex" aria-live="polite">
          <span>{map.nodes?.length || 0} bubbles</span>
          <span className="text-dim">·</span>
          <span>{approvedCount} approved</span>
          {lastBuild && (
            <>
              <span className="text-dim">·</span>
              <span>last build {lastBuild.id}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {session && (
            <span className="font-mono text-[11px] text-dim" title={`Session ${session.id}`}>
              {session.id.slice(0, 8)}
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={handleNewSession} title="Start a fresh session">
            <Plus /> New session
          </Button>
        </div>
      </header>

      <main className="min-h-0 flex-1">
        <ResizablePanelGroup id="mc-layout">
          {/* Chat */}
          <ResizablePanel id="chat" defaultSize="28%" minSize="300px">
            <section className="flex h-full min-w-0 flex-col bg-surface" aria-label="Chat pane">
              <Chat
                messages={messages}
                onSendMessage={handleSendMessage}
                loading={chatLoading}
                error={error}
              />
            </section>
          </ResizablePanel>
          <ResizableHandle />

          {/* Mind map (bubbles are owned by Oliver & Tenma: MindMap.jsx / mindmap.css) */}
          <ResizablePanel id="map" defaultSize="44%" minSize="420px">
            <section className="relative flex h-full min-w-0 flex-col bg-background" aria-label="Mind map pane">
              <div className="flex h-10 shrink-0 items-center justify-between border-b border-hairline px-4">
                <h2 className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Mind map</h2>
                <div className="flex items-center gap-2">
                  <div className="flex rounded-md border border-hairline p-0.5" role="tablist" aria-label="Map view">
                    {[['tree', 'Tree'], ['graph', 'Graph']].map(([v, label]) => (
                      <button
                        key={v}
                        type="button"
                        role="tab"
                        aria-selected={mapView === v}
                        onClick={() => chooseView(v)}
                        className={`cursor-pointer rounded border-0 px-2 py-0.5 text-[11px] ${mapView === v ? 'bg-raised text-foreground' : 'bg-transparent text-muted-foreground hover:text-foreground'}`}
                        title={v === 'tree' ? "Claude's tree view: branches stay beside their parents" : "Oliver & Tenma's graph view"}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <span className="rounded-full border border-hairline px-2 py-0.5 text-[11px] text-muted-foreground">
                    {map.nodes?.length || 0} bubble{map.nodes?.length === 1 ? '' : 's'}
                  </span>
                </div>
              </div>
              <div className="relative min-h-0 flex-1">
                {mapView === 'tree' ? (
                  <TreeMap
                    map={viewMap}
                    highlighted={hoverNodes}
                    changedIds={activeCheckpoint ? [] : changedIds}
                    selectedId={selectedNodeId}
                    onSelect={(n) => setSelectedNodeId(n?.id ?? null)}
                  />
                ) : (
                  <MindMap
                    map={viewMap}
                    highlighted={hoverNodes}
                    changedIds={activeCheckpoint ? [] : changedIds}
                    selectedId={selectedNodeId}
                    onSelect={(n) => setSelectedNodeId(n?.id ?? null)}
                  />
                )}
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
                  map={map}
                  onMapChange={async (selectId) => {
                    // Bubbles were added / connected / deleted: reload the map from the server.
                    const fresh = await api.getSession(session.id);
                    setMap(fresh.map || { nodes: [], edges: [] });
                    if (selectId !== undefined) setSelectedNodeId(selectId);
                  }}
                />
              )}
            </section>
          </ResizablePanel>
          <ResizableHandle />

          {/* Preview */}
          <ResizablePanel id="preview" defaultSize="28%" minSize="320px">
            <section className="flex h-full min-w-0 flex-col bg-surface" aria-label="Preview pane">
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
          </ResizablePanel>
        </ResizablePanelGroup>
      </main>
    </div>
  );
}
