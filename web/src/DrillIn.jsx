import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as api from './api';
import { mapStatus, STATUS_LABELS } from './MindMap';
import {
  LENS, DECISION, childrenOf, hasChildren, pathTo, drillCounts, summaryText, decisionLayout, normalizeDecision,
} from './drillLogic';
import './drillin.css';

/**
 * DrillIn: one topic opened up (Figma "Branding drill-in"). The topic is a big lens; each child node is a
 * decision bubble inside it. A child with a `decision` payload shows its picker (option tiles, 5-point
 * scales, drafted options); without one it shows the node's detail text.
 *
 * Picks made here are local to this view for now (the API has no route to store them yet).
 *
 * Props: map, nodeId, sessionId, readOnly, onOpen(id), onBack(), onSelect(node), onNodeChange(node), onError(msg)
 */

function StatusChip({ status, children }) {
  return (
    <span className={`status-chip ${status}`}>
      <span className="marker" />
      {children ?? STATUS_LABELS[status]}
    </span>
  );
}

function OptionTiles({ options, pick, onPick }) {
  return (
    <div className={`dr-options ${options.length <= 2 ? 'wide' : ''}`}>
      {options.map((o, i) => (
        <button
          key={i}
          type="button"
          className={`dr-tile ${i === pick ? 'selected' : ''}`}
          aria-pressed={i === pick}
          onClick={() => onPick(i)}
        >
          <span className={`dr-glyph ${o.font ? `font-${o.font}` : ''} ${options.length <= 2 ? 'big' : ''}`}>
            {o.glyph ?? o.label.slice(0, 2)}
          </span>
          <span className="dr-tile-label">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

function Scale({ scale, value, onChange }) {
  const set = (v) => onChange(Math.max(0, Math.min(4, v)));
  return (
    <div className="dr-slider">
      <span className="dr-pole left">{scale.left}</span>
      <span
        className="dr-track"
        role="slider"
        tabIndex={0}
        aria-label={`${scale.left} to ${scale.right}`}
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={value}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); set(value - 1); }
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); set(value + 1); }
        }}
        onPointerDown={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const move = (ev) => set(Math.round(((ev.clientX - rect.left) / rect.width) * 4));
          move(e);
          const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
          window.addEventListener('pointermove', move);
          window.addEventListener('pointerup', up);
        }}
      >
        <span className="dr-rail" />
        {[0, 1, 2, 3, 4].map((t) => <span key={t} className="dr-tick" style={{ left: `${t * 19}px` }} />)}
        <span className="dr-knob" style={{ left: `${value * 19 - 6}px` }} />
      </span>
      <span className="dr-pole">{scale.right}</span>
    </div>
  );
}

function Drafts({ drafts, pick, onPick, onAdd }) {
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState('');
  return (
    <div className="dr-drafts">
      {drafts.map((t, i) => (
        <label key={i} className="dr-radio">
          <input type="radio" checked={i === pick} onChange={() => onPick(i)} />
          <span className="dr-dot" />
          <span className="dr-radio-text">{t}</span>
        </label>
      ))}
      {writing ? (
        <form
          className="dr-write"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) onAdd(text.trim());
            setText('');
            setWriting(false);
          }}
        >
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)} onBlur={() => setWriting(false)} placeholder="Your own…" aria-label="Write your own idea" />
        </form>
      ) : (
        <button type="button" className="dr-link" onClick={() => setWriting(true)}>+ Write my own</button>
      )}
    </div>
  );
}

function Decision({ node, status, local, setLocal, canOpen, onOpen, onSelect }) {
  const decision = normalizeDecision(node.decision);
  const guess = node.decision?.guess;
  // An explicit `note: null` hides the line; a missing note falls back to a status hint.
  const note = node.decision && 'note' in node.decision
    ? node.decision.note
    : status === 'assumed' ? 'Guessed from your prompt' : status === 'needs' ? 'Needs your answer' : null;

  let body = null;
  if (decision?.type === 'choice') {
    body = <OptionTiles options={decision.options} pick={local.pick ?? decision.pick} onPick={(pick) => setLocal({ pick })} />;
  } else if (decision?.type === 'scale') {
    const values = local.values ?? decision.scales.map((s) => s.value);
    body = (
      <div className="dr-scales">
        {decision.scales.map((s, i) => (
          <Scale key={i} scale={s} value={values[i]} onChange={(v) => setLocal({ values: values.map((x, j) => (j === i ? v : x)) })} />
        ))}
      </div>
    );
  } else if (decision?.type === 'drafts') {
    const drafts = [...decision.drafts, ...(local.extra || [])];
    body = (
      <Drafts
        drafts={drafts}
        pick={local.pick ?? decision.pick}
        onPick={(pick) => setLocal({ pick })}
        onAdd={(t) => setLocal({ extra: [...(local.extra || []), t], pick: drafts.length })}
      />
    );
  } else if (node.detail) {
    body = <p className="dr-detail">{node.detail}</p>;
  }

  return (
    <>
      <div className="dr-heading">
        <StatusChip status={status} />
        <button type="button" className="dr-title" onClick={() => onSelect(node)} title="Discuss with Claude">
          {node.label}
        </button>
      </div>
      {body}
      {guess && <p className="dr-guess">Claude&apos;s guess: {guess}</p>}
      {note && <p className="dr-note">{note}</p>}
      {canOpen && (
        <button type="button" className="dr-link" onClick={() => onOpen(node.id)}>Open inside ›</button>
      )}
    </>
  );
}

// Scale the 960px Figma lens to whatever room the pane has.
function useFitScale(ref) {
  const [scale, setScale] = useState(0.6);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setScale(Math.max(0.2, Math.min(width, height) / LENS));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return scale;
}

export default function DrillIn({
  map,
  nodeId,
  sessionId = null,
  readOnly = false,
  onOpen = () => {},
  onBack = () => {},
  onSelect = () => {},
  onNodeChange = () => {},
  onError = () => {},
}) {
  const stageRef = useRef(null);
  const scale = useFitScale(stageRef);
  const [locals, setLocals] = useState({});
  const [confirming, setConfirming] = useState(false);

  const topic = map.nodes.find((n) => n.id === nodeId);
  const path = useMemo(() => pathTo(map, nodeId), [map, nodeId]);
  const children = useMemo(() => childrenOf(map, nodeId), [map, nodeId]);
  const counts = drillCounts(children);
  const layout = decisionLayout(children.length);
  const guesses = children.filter((n) => mapStatus(n) === 'assumed');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && e.target === document.body) onBack(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  if (!topic) return null;

  const confirmGuesses = async () => {
    if (!sessionId || guesses.length === 0) return;
    setConfirming(true);
    try {
      for (const n of guesses) onNodeChange(await api.approveNode(sessionId, n.id));
    } catch (e) {
      onError(e?.message || 'Could not confirm guesses');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="drill">
      <header className="dr-header">
        <div className="dr-header-title">
          <nav className="dr-breadcrumb" aria-label="Breadcrumb">
            <button type="button" className="dr-icon-btn" onClick={onBack} aria-label="Back to map">‹</button>
            <button type="button" className="dr-crumb" onClick={onBack}>Project map</button>
            {path.slice(0, -1).map((p) => (
              <React.Fragment key={p.id}>
                <span aria-hidden>/</span>
                <button type="button" className="dr-crumb" onClick={() => onOpen(p.id)}>{p.label}</button>
              </React.Fragment>
            ))}
            <span aria-hidden>/</span>
            <span className="dr-crumb current" aria-current="page">{topic.label}</span>
          </nav>
          <h1 className="dr-h1">{topic.label}</h1>
          <p className="dr-summary">{summaryText(counts)}</p>
        </div>
        <div className="dr-legend">
          {counts.assumed > 0 && <StatusChip status="assumed">{counts.assumed} assumed</StatusChip>}
          {counts.needs > 0 && <StatusChip status="needs">{counts.needs} need{counts.needs === 1 ? 's' : ''} info</StatusChip>}
          {counts.clear > 0 && <StatusChip status="clear">{counts.clear} clear</StatusChip>}
        </div>
      </header>

      <div className="dr-stage" ref={stageRef}>
        <div className="dr-lens" style={{ width: LENS, height: LENS, transform: `scale(${scale})` }}>
          <div className="dr-overline">Inside {topic.label}</div>
          {children.length === 0 && <p className="dr-empty">Nothing inside yet. Ask Claude about {topic.label} in the chat.</p>}
          {children.map((child, i) => {
            const { x, y, d } = layout[i];
            const status = mapStatus(child);
            return (
              <div
                key={child.id}
                className={`dr-decision ${status}`}
                style={{
                  width: DECISION,
                  height: DECISION,
                  left: x - DECISION / 2,
                  top: y - DECISION / 2,
                  transform: `scale(${d / DECISION})`,
                }}
              >
                <Decision
                  node={child}
                  status={status}
                  local={locals[child.id] || {}}
                  setLocal={(patch) => setLocals((prev) => ({ ...prev, [child.id]: { ...prev[child.id], ...patch } }))}
                  canOpen={hasChildren(map, child.id)}
                  onOpen={onOpen}
                  onSelect={onSelect}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="dr-actions">
        {guesses.length > 0 && !readOnly && (
          <button type="button" className="dr-btn primary" onClick={confirmGuesses} disabled={confirming || !sessionId}>
            {confirming ? 'Confirming…' : `Confirm ${guesses.length} guess${guesses.length === 1 ? '' : 'es'}`}
          </button>
        )}
        <button type="button" className="dr-btn ghost" onClick={onBack}>Back to map</button>
      </div>
    </div>
  );
}
