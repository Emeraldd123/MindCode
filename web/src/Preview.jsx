import React, { useEffect, useRef, useState } from 'react';
import * as api from './api';
import {
  BUILD_STAGES,
  buildStage,
  emptyStep,
  formatElapsed,
  isHoverMessage,
  latestDoneBuild,
  nodeLabels,
  pendingBuild,
  pollBuild,
  titleFromHtml,
  traceCount,
  upsertBuild,
} from './previewLogic';
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
  const [viewMode, setViewMode] = useState('desktop'); // 'desktop' | 'mobile'
  const [elapsedMs, setElapsedMs] = useState(0);
  const [toast, setToast] = useState(null); // { message: string, id: number }
  const toastTimeoutRef = useRef(null);
  const buildStartTimeRef = useRef(null);
  const prevPendingRef = useRef(null);

  const pending = pendingBuild(builds);
  const shown = (buildId && builds.find((b) => b.id === buildId && b.status === 'done')) || latestDoneBuild(builds);
  const lastError = builds.length && builds[builds.length - 1].status === 'error' ? builds[builds.length - 1] : null;

  // Track pending build duration and timer
  useEffect(() => {
    if (pending) {
      if (!buildStartTimeRef.current) {
        buildStartTimeRef.current = Date.now();
      }
      setElapsedMs(Date.now() - buildStartTimeRef.current);
      const timer = setInterval(() => {
        if (buildStartTimeRef.current) {
          setElapsedMs(Date.now() - buildStartTimeRef.current);
        }
      }, 500);
      return () => clearInterval(timer);
    } else {
      buildStartTimeRef.current = null;
      setElapsedMs(0);
    }
  }, [pending?.id]);

  // Handle build completion toast
  useEffect(() => {
    if (prevPendingRef.current && !pending) {
      const prevId = prevPendingRef.current.id;
      const finishedBuild = builds.find((b) => b.id === prevId);
      if (finishedBuild && finishedBuild.status === 'done') {
        const durationFormatted = formatElapsed(elapsedMs || 1000);
        const count = traceCount(finishedBuild);
        const message = `Built ${finishedBuild.id} in ${durationFormatted} · ${count} traced element${count === 1 ? '' : 's'}`;
        setToast({ message, id: Date.now() });
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = setTimeout(() => {
          setToast(null);
        }, 5000);
      }
    }
    prevPendingRef.current = pending;
  }, [pending, builds]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

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

  // Approved bubbles being built
  const approvedNodes = (map?.nodes ?? []).filter((n) => n.status === 'approved' || n.status === 'locked');
  const bubbleCount = approvedNodes.length > 0 ? approvedNodes.length : (map?.nodes?.length ?? 0);
  const currentStageIndex = buildStage(elapsedMs);

  // Preview title
  const appTitle = (html.id === shown?.id ? titleFromHtml(html.text) : '') || 'App Preview';

  // Empty state step
  const activeEmptyStep = emptyStep(map);

  return (
    <div className="preview-container">
      <div className="pane-header">
        <h2>App Preview</h2>
        <div className="preview-actions">
          {shown && (
            <div className="preview-mode-toggle" role="group" aria-label="View mode">
              <button
                type="button"
                className={`mode-btn ${viewMode === 'desktop' ? 'active' : ''}`}
                onClick={() => setViewMode('desktop')}
                title="Desktop view"
              >
                Desktop
              </button>
              <button
                type="button"
                className={`mode-btn ${viewMode === 'mobile' ? 'active' : ''}`}
                onClick={() => setViewMode('mobile')}
                title="Mobile view (390px)"
              >
                Mobile
              </button>
            </div>
          )}
          {shown && (
            <a className="preview-open" href={api.getBuildPreviewUrl(sessionId, shown.id)} target="_blank" rel="noreferrer" title="Open in a new tab">
              {shown.id} ↗
            </a>
          )}
          {shown && (
            <a
              className="preview-download"
              href={api.getBuildDownloadUrl(sessionId, shown.id)}
              download={`mindcode-${shown.id}.html`}
              title="Download standalone app HTML"
            >
              ↓ HTML
            </a>
          )}
          <button className="build-btn" onClick={handleBuild} disabled={!canBuild} title={canBuild ? 'Generate the app from the map' : 'Describe your app first'}>
            {pending ? 'Building…' : shown ? '⚡ Rebuild' : '⚡ Build App'}
          </button>
        </div>
      </div>

      <div className="preview-body">
        {shown ? (
          <div className="preview-browser-wrapper">
            <div className="preview-browser-chrome">
              <div className="browser-dots" aria-hidden="true">
                <span className="dot dot-close" />
                <span className="dot dot-minimize" />
                <span className="dot dot-maximize" />
              </div>
              <div className="browser-url-bar" title={appTitle}>
                <span className="browser-url-lock">🔒</span>
                <span className="browser-url-text">{appTitle}</span>
              </div>
              <div className="browser-chrome-actions">
                <span className="browser-build-tag">{shown.id}</span>
              </div>
            </div>

            <div className={`preview-viewport ${viewMode === 'mobile' ? 'viewport-mobile' : 'viewport-desktop'}`}>
              <div className="preview-frame-container">
                <iframe
                  key={shown.id}
                  ref={iframeRef}
                  className="preview-frame"
                  title={appTitle}
                  srcDoc={html.id === shown.id ? html.text : ''}
                  sandbox="allow-scripts allow-forms allow-modals"
                  onLoad={sendHighlight}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="preview-empty">
            <div className="empty-steps-card">
              <div className="empty-steps-header">
                <h3>Build your product</h3>
                <p>Follow three simple steps to generate an interactive app</p>
              </div>
              <div className="empty-steps-list">
                <div className={`empty-step-item ${activeEmptyStep === 1 ? 'current' : activeEmptyStep > 1 ? 'done' : ''}`}>
                  <div className="empty-step-badge">{activeEmptyStep > 1 ? '✓' : '1'}</div>
                  <div className="empty-step-content">
                    <span className="empty-step-title">Describe</span>
                    <span className="empty-step-desc">Chat about your idea to form bubbles</span>
                  </div>
                </div>
                <div className="empty-step-arrow">→</div>
                <div className={`empty-step-item ${activeEmptyStep === 2 ? 'current' : activeEmptyStep > 2 ? 'done' : ''}`}>
                  <div className="empty-step-badge">{activeEmptyStep > 2 ? '✓' : '2'}</div>
                  <div className="empty-step-content">
                    <span className="empty-step-title">Approve bubbles</span>
                    <span className="empty-step-desc">Refine and approve key decisions</span>
                  </div>
                </div>
                <div className="empty-step-arrow">→</div>
                <div className={`empty-step-item ${activeEmptyStep === 3 ? 'current' : ''}`}>
                  <div className="empty-step-badge">3</div>
                  <div className="empty-step-content">
                    <span className="empty-step-title">Build</span>
                    <span className="empty-step-desc">One-click generate traceable app</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {pending && (
          <div className="preview-overlay" role="status" aria-live="polite">
            <div className="progress-card">
              <div className="progress-header">
                <div className="progress-title-row">
                  <span className="progress-title">Building {pending.id} with Claude Opus</span>
                  <span className="progress-timer">{formatElapsed(elapsedMs)}</span>
                </div>
                <div className="progress-bar-container">
                  <div className="progress-bar-indeterminate" />
                </div>
                <p className="progress-note">Usually 1–2 minutes with Claude Opus</p>
              </div>

              <div className="progress-checklist">
                {BUILD_STAGES.map((stageText, idx) => {
                  const label = stageText.replace('N', bubbleCount.toString());
                  const isDone = idx < currentStageIndex;
                  const isCurrent = idx === currentStageIndex;
                  return (
                    <div
                      key={stageText}
                      className={`checklist-item ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}`}
                    >
                      <span className="checklist-icon">
                        {isDone ? '✓' : isCurrent ? '●' : '○'}
                      </span>
                      <span className="checklist-label">{label}</span>
                    </div>
                  );
                })}
              </div>

              {approvedNodes.length > 0 && (
                <div className="progress-bubbles">
                  <span className="progress-bubbles-label">Building with:</span>
                  <div className="progress-bubble-tags">
                    {approvedNodes.slice(0, 5).map((n) => (
                      <span key={n.id} className="progress-bubble-tag">
                        {n.label}
                      </span>
                    ))}
                    {approvedNodes.length > 5 && (
                      <span className="progress-bubble-tag more">
                        +{approvedNodes.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {lastError && !pending && (
          <div className="preview-error-card" role="alert">
            <div className="preview-error-header">
              <span className="error-icon">⚠️</span>
              <h4>Build Failed</h4>
            </div>
            <p className="error-text">{lastError.error || 'An unexpected error occurred during build.'}</p>
            <button type="button" className="retry-btn" onClick={handleBuild} disabled={!canBuild}>
              Retry build
            </button>
          </div>
        )}

        {toast && (
          <div className="preview-toast" role="status">
            <span className="toast-icon">✨</span>
            <span className="toast-message">{toast.message}</span>
            <button type="button" className="toast-dismiss" onClick={() => setToast(null)} aria-label="Close notification">
              ×
            </button>
          </div>
        )}

        {shown && (
          <div className={`trace-chip ${chips.length ? 'visible' : ''}`} aria-live="polite">
            <span className="trace-chip-title">Informed by</span>
            {chips.slice(0, 4).map((c) => (
              <span key={c.id} className={`trace-tag trace-${c.status === 'approved' || c.status === 'locked' ? 'approved' : c.source}`}>
                {c.label}
              </span>
            ))}
            {chips.length > 4 && (
              <span className="trace-tag trace-more" title={chips.slice(4).map((c) => c.label).join(', ')}>
                +{chips.length - 4} more
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
