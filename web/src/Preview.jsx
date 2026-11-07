import React, { useEffect, useRef, useState } from 'react';
import * as api from './api';
import { isHoverMessage, latestDoneBuild, nodeLabels, pendingBuild, pollBuild, upsertBuild } from './previewLogic';
import './preview.css';

/**
 * Right pane: Build button, live preview of the generated app, and two-way trace highlighting.
 *
 * Props:
 *  - sessionId, map
 *  - builds, setBuilds         (App state; Preview polls and updates it)
 *  - buildId                   optional: show this build instead of the latest (checkpoints, #10)
 *  - highlightNodes: string[]  bubbles selected/hovered in the map -> outlined in the page
 *  - onHoverNodes(ids)         page element hovered -> bubbles to light up in the map ([] on leave)
 *  - onError(message)
 */
export default function Preview({ sessionId, map, builds = [], setBuilds, buildId, highlightNodes = [], onHoverNodes, onError }) {
  const iframeRef = useRef(null);
  const [hovered, setHovered] = useState([]);
  const [html, setHtml] = useState({ id: null, text: '' });
  const pending = pendingBuild(builds);
  const shown = (buildId && builds.find((b) => b.id === buildId && b.status === 'done')) || latestDoneBuild(builds);
  const lastError = builds.length && builds[builds.length - 1].status === 'error' ? builds[builds.length - 1] : null;

  // Poll any pending build (also resumes after a page reload).
  useEffect(() => {
    if (!sessionId || !pending) return undefined;
    const signal = { cancelled: false };
    pollBuild(api.getBuild, sessionId, pending.id, {
      signal,
      onUpdate: (b) => !signal.cancelled && setBuilds((prev) => upsertBuild(prev, b)),
    }).then((b) => {
      if (b?.status === 'error') onError?.(`Build failed: ${b.error || 'unknown error'}`);
    }).catch((e) => !signal.cancelled && onError?.(`Build status check failed: ${e.message}`));
    return () => { signal.cancelled = true; };
  }, [sessionId, pending?.id]);

  // Load the preview HTML (with the server-injected trace script) and render it via srcdoc.
  // srcdoc avoids a sub-frame request, which some browsers/extensions block.
  useEffect(() => {
    if (!sessionId || !shown || html.id === shown.id) return undefined;
    let cancelled = false;
    fetch(api.getBuildPreviewUrl(sessionId, shown.id))
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((text) => !cancelled && setHtml({ id: shown.id, text }))
      .catch((e) => !cancelled && onError?.(`Could not load preview: ${e.message}`));
    return () => { cancelled = true; };
  }, [sessionId, shown?.id]);

  // Page -> map: hover messages from the iframe.
  useEffect(() => {
    function onMessage(e) {
      if (e.source !== iframeRef.current?.contentWindow || !isHoverMessage(e.data)) return;
      setHovered(e.data.nodes);
      onHoverNodes?.(e.data.nodes);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onHoverNodes]);

  // Map -> page: outline elements informed by the selected bubbles.
  const sendHighlight = () => iframeRef.current?.contentWindow?.postMessage({ type: 'mc-highlight', nodes: highlightNodes }, '*');
  useEffect(sendHighlight, [highlightNodes.join(' '), shown?.id]);

  async function handleBuild() {
    if (!sessionId || pending) return;
    try {
      const b = await api.build(sessionId);
      setBuilds((prev) => upsertBuild(prev, b));
    } catch (e) {
      onError?.(`Build failed: ${e.message}`);
    }
  }

  const chips = nodeLabels(map, hovered);
  const canBuild = !!sessionId && !pending && (map?.nodes?.length ?? 0) > 0;

  return (
    <div className="preview-container">
      <div className="pane-header">
        <h2>App Preview</h2>
        <div className="preview-actions">
          {shown && (
            <a className="preview-open" href={api.getBuildPreviewUrl(sessionId, shown.id)} target="_blank" rel="noreferrer" title="Open in a new tab">
              {shown.id} ↗
            </a>
          )}
          <button className="build-btn" onClick={handleBuild} disabled={!canBuild} title={canBuild ? 'Generate the app from the map' : 'Describe your app first'}>
            {pending ? 'Building…' : shown ? '⚡ Rebuild' : '⚡ Build App'}
          </button>
        </div>
      </div>

      <div className="preview-body">
        {shown ? (
          <iframe
            key={shown.id}
            ref={iframeRef}
            className="preview-frame"
            title={`Generated app ${shown.id}`}
            srcDoc={html.id === shown.id ? html.text : ''}
            sandbox="allow-scripts allow-forms allow-modals"
            onLoad={sendHighlight}
          />
        ) : (
          <div className="preview-empty">
            <div className="preview-empty-icon">🖥️</div>
            <h3>No build yet</h3>
            <p>Chat about your app, approve the bubbles you agree with, then press <strong>Build</strong>.</p>
          </div>
        )}

        {pending && (
          <div className="preview-overlay" role="status">
            <div className="spinner" />
            <p>Claude is building {pending.id} from the map…</p>
          </div>
        )}

        {lastError && !pending && (
          <div className="preview-error" role="alert">Last build failed: {lastError.error || 'unknown error'}</div>
        )}

        {shown && (
          <div className={`trace-chip ${chips.length ? 'visible' : ''}`} aria-live="polite">
            <span className="trace-chip-title">Informed by</span>
            {chips.map((c) => (
              <span key={c.id} className={`trace-tag trace-${c.status === 'approved' || c.status === 'locked' ? 'approved' : c.source}`}>
                {c.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
