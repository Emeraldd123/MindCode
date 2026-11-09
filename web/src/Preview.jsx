import React, { useEffect, useRef, useState } from 'react';
import * as api from './api';
import { registerPreview } from './previewBridge';
import {
  BUILD_STAGES,
  buildStage,
  emptyStep,
  formatElapsed,
  formatQualityPill,
  isHoverMessage,
  latestDoneBuild,
  nodeLabels,
  pendingBuild,
  pollBuild,
  qualityIssues,
  qualityTone,
  titleFromHtml,
  traceCount,
  upsertBuild,
} from './previewLogic';
import { formatApiError, formatCooldown } from './chatLogic';
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
  const [qualityOpen, setQualityOpen] = useState(false);
  const qualityRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  const buildStartTimeRef = useRef(null);
  const prevPendingRef = useRef(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const cooldownTimerRef = useRef(null);

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
        const how = finishedBuild.mode === 'incremental' ? 'Updated' : finishedBuild.mode === 'edit' ? 'Edited' : 'Built';
        const what = finishedBuild.mode === 'incremental' ? ' (only the changes)' : '';
        const q = finishedBuild.quality?.score;
        const message = `${how} ${finishedBuild.id} in ${durationFormatted}${what} · ${count} traced element${count === 1 ? '' : 's'}${typeof q === 'number' ? ` · quality ${q}/100` : ''}`;
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
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, []);

  const startCooldown = (seconds) => {
    let remaining = seconds || 8;
    setCooldownSeconds(remaining);
    onError?.(formatCooldown(remaining));
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    cooldownTimerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
        setCooldownSeconds(0);
      } else {
        setCooldownSeconds(remaining);
        onError?.(formatCooldown(remaining));
      }
    }, 1000);
  };

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

  // Page -> map: hover messages from the iframe; right-click -> change request popover.
  const [inspect, setInspect] = useState(false);
  const [pinned, setPinned] = useState(null); // { nodes, text } while an element is pinned
  const pinnedRef = useRef([]);
  const sendInspect = (on) => iframeRef.current?.contentWindow?.postMessage({ type: 'mc-inspect', on }, '*');
  useEffect(() => {
    sendInspect(inspect);
    if (!inspect) {
      pinnedRef.current = [];
      setPinned(null);
    }
  }, [inspect]);
  const [editTarget, setEditTarget] = useState(null);
  const [editText, setEditText] = useState('');
  const [editSending, setEditSending] = useState(false);
  useEffect(() => {
    function onMessage(e) {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.data && e.data.type === 'mc-edit') {
        const frame = iframeRef.current?.getBoundingClientRect();
        const body = iframeRef.current?.closest('.preview-body')?.getBoundingClientRect();
        const left = frame && body ? frame.left - body.left + e.data.x : 16;
        const top = frame && body ? frame.top - body.top + e.data.y : 16;
        setEditTarget({ ...e.data, left, top });
        setEditText('');
        return;
      }
      if (e.data && e.data.type === 'mc-pin') {
        const nodes = Array.isArray(e.data.nodes) ? e.data.nodes : [];
        pinnedRef.current = nodes;
        setPinned(nodes.length ? { nodes, text: e.data.text || '' } : null);
        setHovered(nodes);
        onHoverNodes?.(nodes);
        return;
      }
      if (!isHoverMessage(e.data)) return;
      // While something is pinned, leaving an element falls back to the pinned bubbles, not to nothing.
      const next = e.data.nodes.length ? e.data.nodes : pinnedRef.current;
      setHovered(next);
      onHoverNodes?.(next);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onHoverNodes]);

  useEffect(() => () => registerPreview(null), []);

  // Map -> page: outline elements informed by the selected bubbles.
  const sendHighlight = () => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'mc-highlight', nodes: highlightNodes }, '*');
    sendInspect(inspect); // re-apply inspect mode after the iframe reloads
  };
  useEffect(sendHighlight, [highlightNodes.join(' '), shown?.id]);

  const closeEdit = () => {
    setEditTarget(null);
    iframeRef.current?.contentWindow?.postMessage({ type: 'mc-edit-clear' }, '*');
  };

  async function sendEdit(e) {
    e?.preventDefault();
    const instruction = editText.trim();
    if (!instruction || !shown || editSending || cooldownSeconds > 0) return;
    setEditSending(true);
    try {
      const b = await api.editBuild(sessionId, shown.id, {
        instruction,
        el: editTarget?.el ?? null,
        nodes: editTarget?.nodes ?? [],
        snippet: editTarget?.snippet ?? '',
      });
      setBuilds((prev) => upsertBuild(prev, b));
      closeEdit();
    } catch (err) {
      if (err.status === 429) {
        startCooldown(err.retry_after_s || 8);
      } else {
        onError?.(formatApiError(err));
      }
    } finally {
      setEditSending(false);
    }
  }

  async function handleBuild(full = false) {
    if (!sessionId || pending || cooldownSeconds > 0) return;
    try {
      const b = await api.build(sessionId, { full });
      setBuilds((prev) => upsertBuild(prev, b));
    } catch (e) {
      if (e.status === 429) {
        startCooldown(e.retry_after_s || 8);
      } else {
        onError?.(formatApiError(e));
      }
    }
  }

  // Close quality popover when clicking outside or pressing Escape
  useEffect(() => {
    if (!qualityOpen) return;
    function handleKeyDown(e) {
      if (e.key === 'Escape') setQualityOpen(false);
    }
    function handleClickOutside(e) {
      if (qualityRef.current && !qualityRef.current.contains(e.target)) {
        setQualityOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [qualityOpen]);

  const chips = nodeLabels(map, hovered);
  const isCoolingDown = cooldownSeconds > 0;
  const canBuild = !!sessionId && !pending && !isCoolingDown && (map?.nodes?.length ?? 0) > 0;

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
            <button
              type="button"
              onClick={() => setInspect((v) => !v)}
              aria-pressed={inspect}
              className={`preview-download ${inspect ? '!border-ai !text-ai' : ''}`}
              title={inspect ? 'Inspect is on: click an element to pin the bubbles behind it (normal clicks paused)' : 'Inspect: click an element to pin the bubbles behind it'}
            >
              {inspect ? '◉ Pin' : '◎ Pin'}
            </button>
          )}
          {shown && (
            <div className="preview-mode-toggle" role="group" aria-label="View mode">
              <button
                type="button"
                className={`mode-btn ${viewMode === 'desktop' ? 'active' : ''}`}
                onClick={() => setViewMode('desktop')}
                aria-pressed={viewMode === 'desktop'}
                title="Desktop view"
              >
                Desktop
              </button>
              <button
                type="button"
                className={`mode-btn ${viewMode === 'mobile' ? 'active' : ''}`}
                onClick={() => setViewMode('mobile')}
                aria-pressed={viewMode === 'mobile'}
                title="Mobile view (390px)"
              >
                Mobile
              </button>
            </div>
          )}
          {shown && (
            <a className="preview-open" href={api.getBuildAppUrl(sessionId, shown.id)} target="_blank" rel="noreferrer" title="Open the app in a new tab (no dev overlay, fully working)">
              Open app ↗
            </a>
          )}
          {shown && (
            <a
              className="preview-download"
              href={api.getBuildDownloadUrl(sessionId, shown.id)}
              download={`mindcode-${shown.id}.html`}
              aria-label="Download standalone HTML"
              title="Download standalone app HTML"
            >
              ↓
            </a>
          )}
          <button
            className="build-btn"
            onClick={() => handleBuild(false)}
            disabled={!canBuild || isCoolingDown}
            aria-busy={pending}
            title={isCoolingDown ? formatCooldown(cooldownSeconds) : !canBuild ? 'Describe your app first' : shown ? 'Apply your map changes (small changes are patched in seconds)' : 'Generate the app from the map'}
          >
            {isCoolingDown ? formatCooldown(cooldownSeconds) : pending ? 'Building…' : shown ? '⚡ Update' : '⚡ Build App'}
          </button>
          {shown && !pending && (
            <button
              type="button"
              className="preview-download"
              onClick={() => handleBuild(true)}
              disabled={!canBuild || isCoolingDown}
              aria-label="Regenerate whole app"
              title={isCoolingDown ? formatCooldown(cooldownSeconds) : "Regenerate the whole app from the map (slower)"}
            >
              Full
            </button>
          )}
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
                {shown.quality && typeof shown.quality.score === 'number' && (
                  <div className="browser-quality-wrapper" ref={qualityRef}>
                    <button
                      type="button"
                      className={`browser-quality-pill quality-${qualityTone(shown.quality.score)}`}
                      onClick={() => setQualityOpen((v) => !v)}
                      aria-expanded={qualityOpen}
                      aria-haspopup="true"
                      title="Inspect build quality report"
                    >
                      {formatQualityPill(shown.quality)}
                    </button>
                    {qualityOpen && (
                      <div className="quality-popover" role="dialog" aria-label="Build Quality Report">
                        <div className="quality-popover-header">
                          <div className="quality-popover-title">
                            <span className="quality-popover-badge">{shown.quality.score}/100</span>
                            <span className="quality-popover-heading">Build Quality</span>
                          </div>
                          <button
                            type="button"
                            className="quality-popover-close"
                            onClick={() => setQualityOpen(false)}
                            aria-label="Close quality report"
                          >
                            ×
                          </button>
                        </div>
                        <div className="quality-popover-body">
                          {qualityIssues(shown.quality).length === 1 && qualityIssues(shown.quality)[0] === 'Ship-ready, no issues' ? (
                            <div className="quality-empty-issues">
                              <span className="quality-empty-icon">✓</span>
                              <span>Ship-ready, no issues</span>
                            </div>
                          ) : (
                            <ul className="quality-issue-list">
                              {qualityIssues(shown.quality).map((issue, idx) => (
                                <li key={idx} className="quality-issue-item">
                                  <span className="quality-issue-bullet">•</span>
                                  <span className="quality-issue-text">{issue}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
                  sandbox="allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox"
                  onLoad={() => {
                    sendHighlight();
                    registerPreview({
                      win: iframeRef.current?.contentWindow,
                      sessionId,
                      buildId: html.id === shown.id ? shown.id : null,
                    });
                  }}
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
            <button type="button" className="retry-btn" onClick={() => handleBuild(true)} disabled={!canBuild}>
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

        {editTarget && (
          <form
            onSubmit={sendEdit}
            className="absolute z-30 w-[min(320px,90%)] rounded-xl border border-hairline bg-raised p-3 font-sans text-foreground shadow-2xl"
            style={{
              left: `clamp(8px, ${Math.round(editTarget.left)}px, calc(100% - 330px))`,
              top: `clamp(8px, ${Math.round(editTarget.top + 8)}px, calc(100% - 170px))`,
            }}
            onKeyDown={(e) => e.key === 'Escape' && closeEdit()}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="truncate text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                Change this {editTarget.tag}
                {editTarget.text ? `: "${editTarget.text.slice(0, 40)}${editTarget.text.length > 40 ? '…' : ''}"` : ''}
              </span>
              <button type="button" onClick={closeEdit} className="cursor-pointer border-0 bg-transparent text-dim hover:text-foreground" aria-label="Cancel">×</button>
            </div>
            <textarea
              autoFocus
              rows={2}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) sendEdit(e); }}
              placeholder="e.g. make this button scroll to the projects"
              aria-label="Describe requested changes"
              className="w-full resize-none rounded-lg border border-hairline bg-background px-2.5 py-2 font-sans text-[13px] text-foreground outline-none placeholder:text-dim focus:border-ai/50"
              disabled={editSending}
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] text-dim">Claude rebuilds just this part</span>
              <button
                type="submit"
                disabled={!editText.trim() || editSending || isCoolingDown}
                aria-busy={editSending}
                className="cursor-pointer rounded-md border-0 bg-ai px-3 py-1.5 text-xs font-semibold text-[#0b1a14] disabled:cursor-default disabled:opacity-40"
              >
                {isCoolingDown ? formatCooldown(cooldownSeconds) : editSending ? 'Sending…' : 'Request change'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
