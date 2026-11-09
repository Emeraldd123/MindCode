// web/src/Checkpoints.jsx
import React, { useRef } from 'react';
import './checkpoints.css';
import { checkpointKind, diffMaps, formatDiff, neighbor } from './checkpointLogic';

/**
 * Checkpoints timeline strip component.
 *
 * @param {object} props
 * @param {Array<{id: string, label: string, turn: number, map: object, build_id?: string}>} props.checkpoints
 * @param {string|null} props.activeId - ID of active checkpoint, or null for live
 * @param {(checkpoint: object|null) => void} props.onSelect - Callback with selected checkpoint or null for live
 */
export default function Checkpoints({ checkpoints = [], activeId = null, onSelect, onRestore }) {
  const stripRef = useRef(null);

  const activeCheckpoint =
    activeId !== null
      ? checkpoints.find((cp) => cp && String(cp.id) === String(activeId)) || null
      : null;

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onSelect?.(null);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const target = neighbor(checkpoints, activeId, -1);
      onSelect?.(target);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const target = neighbor(checkpoints, activeId, 1);
      onSelect?.(target);
    }
  };

  return (
    <div className="checkpoints-container" role="region" aria-label="Checkpoint timeline">
      {/* Banner when viewing an older checkpoint */}
      {activeCheckpoint && (
        <div className="checkpoint-banner" role="status">
          <div className="checkpoint-banner-info">
            <span>Viewing checkpoint: <strong>{activeCheckpoint.label}</strong></span>
            <span className="checkpoint-badge-readonly">read-only</span>
          </div>
          <div className="checkpoint-banner-actions">
            <button
              type="button"
              className="restore-checkpoint-btn"
              onClick={() => onRestore?.(activeCheckpoint)}
              title="Roll back the mind map to this checkpoint"
              aria-label="Restore to this version"
            >
              ↺ Restore this version
            </button>
            <button
              type="button"
              className="back-to-live-btn"
              onClick={() => onSelect?.(null)}
              title="Return to live map"
              aria-label="Return to live map"
            >
              ← Back to live
            </button>
          </div>
        </div>
      )}

      {/* Horizontal timeline strip */}
      <div
        ref={stripRef}
        className="checkpoints-strip"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        aria-label="Timeline navigation: use Left/Right arrows to move, Escape for live"
      >
        <div className="checkpoints-track">
          <div className="checkpoints-line" aria-hidden="true" />

          {checkpoints.map((cp, idx) => {
            const kind = checkpointKind(cp);
            const isBuild = kind === 'build';
            const isActive = activeId !== null && String(activeId) === String(cp.id);
            const prevCp = idx > 0 ? checkpoints[idx - 1] : null;
            const diff = diffMaps(prevCp ? prevCp.map : null, cp.map);
            const diffText = formatDiff(diff);

            return (
              <div key={cp.id} className="checkpoint-item">
                <button
                  type="button"
                  className={`checkpoint-dot kind-${kind} ${isActive ? 'is-active' : ''}`}
                  onClick={() => onSelect?.(cp)}
                  aria-label={`${cp.label}, Turn ${cp.turn ?? '?'}, ${diffText}`}
                  aria-pressed={isActive}
                >
                  {isBuild && <span className="checkpoint-icon">⚡</span>}
                </button>
                <div className="checkpoint-tooltip" role="tooltip">
                  <span className="tooltip-header">{cp.label}</span>
                  <span className="tooltip-turn">Turn {cp.turn ?? 0}</span>
                  <span className="tooltip-diff">{diffText}</span>
                </div>
              </div>
            );
          })}

          {/* Final Live dot */}
          <div className="checkpoint-item">
            <button
              type="button"
              className={`checkpoint-dot kind-live ${activeId === null ? 'is-active' : ''}`}
              onClick={() => onSelect?.(null)}
              aria-label="Live map"
              aria-pressed={activeId === null}
            >
              <span className="live-indicator" />
              <span>Live</span>
            </button>
            <div className="checkpoint-tooltip" role="tooltip">
              <span className="tooltip-header">Live Mind Map</span>
              <span className="tooltip-turn">Latest changes</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
