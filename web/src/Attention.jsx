import React, { useState, useMemo } from 'react';
import './attention.css';

export function filterAndSortAttentionNodes(nodes = []) {
  if (!Array.isArray(nodes)) return [];

  // Filtering rule:
  // Only show nodes where status !== 'approved' AND source is either 'unknown' or 'inferred'.
  // Approved nodes must NOT appear in the list.
  // User-specified nodes are excluded.
  const filtered = nodes.filter((node) => {
    if (!node) return false;
    const isApproved = node.status === 'approved';
    const isTargetSource = node.source === 'unknown' || node.source === 'inferred';
    return !isApproved && isTargetSource;
  });

  // Sorting order:
  // 1. importance descending (5 to 1, default 3 if omitted)
  // 2. inventiveness descending (1.0 to 0.0, default 0 if omitted)
  return filtered.sort((a, b) => {
    const impA = Number.isInteger(Number(a.importance)) ? Number(a.importance) : 3;
    const impB = Number.isInteger(Number(b.importance)) ? Number(b.importance) : 3;

    if (impB !== impA) {
      return impB - impA;
    }

    const invA = typeof a.inventiveness === 'number' ? a.inventiveness : 0;
    const invB = typeof b.inventiveness === 'number' ? b.inventiveness : 0;

    return invB - invA;
  });
}

export default function Attention({
  nodes = [],
  onSelect = () => {},
  selectedId = null,
  defaultOpen = true, // the map passes false so the list never covers the bubbles
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const attentionItems = useMemo(() => filterAndSortAttentionNodes(nodes), [nodes]);

  return (
    <div className={`attention-panel ${isOpen ? 'open' : 'collapsed'}`}>
      <div className="attention-header" onClick={() => setIsOpen((prev) => !prev)}>
        <div className="attention-title">
          <span className="attention-icon">⚠️</span>
          <span>Needs Attention</span>
          <span className="attention-badge">{attentionItems.length}</span>
        </div>
        <button
          type="button"
          className="attention-toggle-btn"
          aria-label={isOpen ? 'Collapse panel' : 'Expand panel'}
        >
          {isOpen ? '▾' : '▸'}
        </button>
      </div>

      {isOpen && (
        <div className="attention-body">
          {attentionItems.length === 0 ? (
            <div className="attention-empty">
              All key assumptions and unknowns resolved! ✓
            </div>
          ) : (
            <ul className="attention-list">
              {attentionItems.map((node) => {
                const importance = Number.isInteger(Number(node.importance)) ? Number(node.importance) : 3;
                const isSelected = node.id === selectedId;

                return (
                  <li
                    key={node.id}
                    className={`attention-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => onSelect(node)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelect(node);
                      }
                    }}
                  >
                    <div className="attention-item-content">
                      <div className="attention-item-label">{node.label}</div>
                      <div className="attention-item-badges">
                        <span className={`source-pill ${node.source}`}>
                          {node.source}
                        </span>
                        <span className="importance-stars" title={`Importance: ${importance}/5`}>
                          {'★'.repeat(importance)}
                          <span className="stars-empty">{'★'.repeat(Math.max(0, 5 - importance))}</span>
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
