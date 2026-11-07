import React, { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { ReactFlow, Background, Controls, MiniMap, NodeToolbar, Position, useReactFlow, useStore } from '@xyflow/react';
import { Info } from 'lucide-react';
import '@xyflow/react/dist/style.css';
import './mindmap.css';
import Attention from './Attention';
import {
  STATUS_LABELS, mapStatus, buildTree, effectiveLevel, levelChildren, breadcrumbs, collapseCrumbs,
  parentLevel, levelOf, descendantCounts, countsText, visibleMarks, bubbleRadius, levelLayout,
} from './hierarchyLogic';

// Hierarchical bubble explorer: one level of the map at a time. The active bubble is the big light
// lens; only its direct children are drawn inside it. Clicking a bubble that has children opens it
// as the next level; clicking a leaf opens its details (onSelect → side panel).

export { STATUS_LABELS, mapStatus, buildTree };

// Pure helper: kinds to icons
export const KIND_ICONS = {
  goal: '🎯',
  feature: '✨',
  page: '📄',
  component: '🧩',
  data: '🗄️',
  api: '🔌',
  style: '🎨',
  constraint: '⚖️',
};

export function getKindIcon(kind) {
  return KIND_ICONS[kind] || '✨';
}

// Pure helper: bubbleClass(node, options)
export function bubbleClass(node, { isSelected = false, isHighlighted = false, isChanged = false } = {}) {
  const classes = ['mindmap-node', `map-status-${mapStatus(node)}`];
  const source = node?.source || 'user';
  const status = node?.status || 'proposed';
  const inventiveness = Number(node?.inventiveness ?? 0);

  if (source === 'user') {
    classes.push('source-user');
  } else if (source === 'inferred') {
    classes.push('source-inferred');
    classes.push(inventiveness >= 0.5 ? 'source-inferred-high' : 'source-inferred-low');
    if (inventiveness >= 0.6) classes.push('has-creative-leap');
  } else if (source === 'unknown') {
    classes.push('source-unknown');
  }

  const rawImportance = Number(node?.importance);
  const importance = Number.isInteger(rawImportance) && rawImportance >= 1 && rawImportance <= 5 ? rawImportance : 3;
  classes.push(`importance-${importance}`);

  if (status === 'approved') classes.push('status-approved');
  if (status === 'locked') classes.push('status-locked');
  if (isSelected) classes.push('node-selected');
  if (isHighlighted) classes.push('node-highlighted');
  if (isChanged) classes.push('node-changed');

  return classes.join(' ');
}

// Pure helper: inferredFill(inventiveness)
// Warm accent tint (#C6613F) that deepens with inventiveness: 0 = plain bubble, 1 = light terracotta.
export function inferredFill(inventiveness) {
  const inv = typeof inventiveness === 'number' ? Math.max(0, Math.min(1, inventiveness)) : 0;
  const alpha = inv * 0.16;
  return `rgba(198, 97, 63, ${Number(alpha.toFixed(3))})`;
}

const TRANSITION_OUT_MS = 170;

function StatusChip({ status, children }) {
  return (
    <span className={`status-chip ${status}`} title={STATUS_LABELS[status]}>
      <span className="marker" />
      <span className="status-chip-label">{children ?? STATUS_LABELS[status]}</span>
    </span>
  );
}

// Hover card: everything that isn't the title. Rendered by NodeToolbar so neighbours never cover it.
function HoverCard({ node, isBranch, kids, counts, visible }) {
  const evidence = Array.isArray(node?.evidence) ? node.evidence.filter(Boolean) : [];
  const status = mapStatus(node);
  return (
    <NodeToolbar isVisible={visible} position={Position.Top} offset={10} className="mindmap-hovercard">
      <div className="hc-head">
        {!isBranch && <StatusChip status={status} />}
        <span className="hc-title">{node?.label}</span>
      </div>
      {isBranch && countsText(counts) && <p className="hc-meta">Inside: {countsText(counts)}</p>}
      {node?.detail && <p className="hc-detail">{node.detail}</p>}
      {evidence.length > 0 && (
        <div className="hc-evidence">
          {evidence.slice(0, 2).map((q, i) => <p key={i} className="tooltip-quote">&ldquo;{q}&rdquo;</p>)}
        </div>
      )}
      <p className="hc-hint">{isBranch ? 'Click to explore' : 'Click for details'}</p>
    </NodeToolbar>
  );
}

// One bubble on the current level, title-first. Two shapes:
// - Branch (has bubbles inside): bigger, light grey, double ring, title + "N bubbles →". Click = go in.
// - Leaf (one decision): smaller, white, single ring in its status style, title + status dot.
//   Click = open details. Everything else is in the hover card.
function BubbleNode({ data }) {
  const { node, size, kids = 0, counts, isFocus, isSelected, isHighlighted, isChanged, onDetails } = data;
  const [hover, setHover] = useState(false);
  const source = node?.source || 'user';
  const status = node?.status || 'proposed';
  const inventiveness = Number(node?.inventiveness ?? 0);
  const isBranch = kids > 0;

  // Leaf fill comes from its status (mindmap.css), so it's the same everywhere.
  const style = { width: `${size}px`, height: `${size}px` };

  const className = [
    bubbleClass(node, { isSelected, isHighlighted, isChanged }),
    isBranch ? 'is-branch' : 'is-leaf',
    isFocus ? 'is-focus' : '',
  ].join(' ');

  return (
    <div
      className={className}
      style={style}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={isBranch ? `${node?.label}: ${kids} bubbles inside, explore` : `${node?.label}: ${STATUS_LABELS[mapStatus(node)]}`}
    >
      <HoverCard node={node} isBranch={isBranch} kids={kids} counts={counts} visible={hover && !isFocus} />
      {isBranch && <span className="branch-inner-ring" aria-hidden />}
      {!isBranch && status === 'approved' && <div className="approved-corner-badge" title="Approved">✓</div>}
      {!isBranch && <span className={`status-dot ${mapStatus(node)}`} aria-hidden>{mapStatus(node) === 'needs' ? '?' : ''}</span>}
      <div className="mindmap-node-label">
        {node?.label}
        {!isBranch && source === 'inferred' && inventiveness >= 0.6 && <span className="creative-leap-badge"> ✦</span>}
        {status === 'locked' && <span className="locked-badge"> 🔒</span>}
      </div>
      {isBranch && (
        <>
          <span className="branch-explore">{kids} bubble{kids === 1 ? '' : 's'} <span aria-hidden>→</span></span>
          <button
            type="button"
            className="mindmap-details nodrag"
            title="Details"
            aria-label={`Details of ${node?.label}`}
            onClick={(e) => { e.stopPropagation(); onDetails(node); }}
          >
            <Info size={14} aria-hidden />
          </button>
        </>
      )}
    </div>
  );
}

// The light circular canvas: the bubble you're inside.
function LensNode({ data }) {
  return (
    <div className="mindmap-lens" style={{ width: data.size, height: data.size }}>
      {data.onTitle ? (
        <button type="button" className="mindmap-lens-title nodrag nopan" onClick={data.onTitle} title="Show details">
          {data.label}
        </button>
      ) : (
        <div className="mindmap-lens-title">{data.label}</div>
      )}
      {data.empty && (
        <div className="mindmap-lens-empty">
          <p>Nothing inside yet.</p>
          <p>Ask Claude about {data.label} in the chat, or add a bubble from the side panel.</p>
        </div>
      )}
    </div>
  );
}

const nodeTypes = { bubble: BubbleNode, lens: LensNode };
const MINIMAP_COLORS = { clear: '#141413', assumed: '#73726C', needs: '#B4532F' };

// Re-fit when bubbles are added to / removed from the level being viewed (not on mount: the
// ReactFlow instance fits or restores the viewport itself then).
// Also re-fit when the pane gets a real size or its size changes a lot (a fit computed while the pane
// was hidden or 0px wide — background tab, hot reload, panel resize — leaves the camera pointing at
// nothing), when the tab becomes visible again, and whenever the viewport isn't a finite number.
export function needsRefit(prev, next) {
  if (!next.w || !next.h) return false;
  if (!prev.w || !prev.h) return true;
  return Math.abs(next.w - prev.w) / prev.w > 0.25 || Math.abs(next.h - prev.h) / prev.h > 0.25;
}

function RefitOnChange({ count }) {
  const { fitView, getViewport } = useReactFlow();
  const width = useStore((st) => st.width);
  const height = useStore((st) => st.height);
  const prev = useRef(count);
  const fittedSize = useRef({ w: width, h: height });
  const refit = useCallback((duration = 0) => {
    fittedSize.current = { w: width, h: height };
    fitView({ padding: 0.08, duration, maxZoom: 1.2, minZoom: 0.2 });
  }, [fitView, width, height]);

  useEffect(() => {
    if (prev.current !== count) refit(300);
    prev.current = count;
  }, [count, refit]);

  useEffect(() => {
    const vp = getViewport();
    const broken = ![vp.x, vp.y, vp.zoom].every(Number.isFinite) || vp.zoom <= 0;
    if (broken || needsRefit(fittedSize.current, { w: width, h: height })) {
      // Let React Flow measure the new size first.
      const id = requestAnimationFrame(() => refit(0));
      return () => cancelAnimationFrame(id);
    }
    return undefined;
  }, [width, height, getViewport, refit]);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') refit(0); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refit]);
  return null;
}

function Breadcrumbs({ crumbs, onGo, onBack, canGoBack }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { head, hidden, tail } = collapseCrumbs(crumbs);
  const last = crumbs[crumbs.length - 1];

  useEffect(() => setMenuOpen(false), [last?.id]);

  const crumb = (c) => {
    const current = c === last;
    return (
      <li key={c.id ?? '__top'} className="mm-crumb-item">
        {current ? (
          <span className="mm-crumb current" aria-current="page">{c.label}</span>
        ) : (
          <button type="button" className="mm-crumb" onClick={() => onGo(c.id)}>{c.label}</button>
        )}
      </li>
    );
  };

  return (
    <nav className="mm-breadcrumb" aria-label="Map location">
      <button
        type="button"
        className="mm-back"
        onClick={onBack}
        disabled={!canGoBack}
        aria-label="Back to parent bubble"
        title="Back (Backspace)"
      >
        ‹
      </button>
      <ol>
        {head.map(crumb)}
        {hidden.length > 0 && (
          <li className="mm-crumb-item mm-crumb-more">
            <button
              type="button"
              className="mm-crumb"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={`Show ${hidden.length} hidden levels`}
              onClick={() => setMenuOpen((o) => !o)}
            >
              …
            </button>
            {menuOpen && (
              <ul className="mm-crumb-menu" role="menu">
                {hidden.map((c) => (
                  <li key={c.id} role="none">
                    <button type="button" role="menuitem" onClick={() => onGo(c.id)}>{c.label}</button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        )}
        {tail.map(crumb)}
      </ol>
    </nav>
  );
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export default function MindMap({
  map = { nodes: [], edges: [] },
  highlighted = [],
  highlightedIds = highlighted,
  changedIds = [],
  selectedId = null,
  onSelect = () => {},
  activeId: controlledActiveId, // bubble whose children are shown; null = top level. Omit to let MindMap own it.
  onNavigate,
  rootLabel = 'Project',
  compact = false,
}) {
  const nodes = map.nodes || [];
  const edges = map.edges || [];
  const [ownActiveId, setOwnActiveId] = useState(null);
  const isControlled = controlledActiveId !== undefined;
  const activeId = isControlled ? controlledActiveId : ownActiveId;
  const commitNavigate = useCallback((id) => {
    if (!isControlled) setOwnActiveId(id);
    onNavigate?.(id);
  }, [isControlled, onNavigate]);

  const tree = useMemo(() => buildTree(nodes, edges), [nodes, edges]);
  const levelId = effectiveLevel(tree, activeId);
  const levelNode = levelId ? tree.byId.get(levelId) : null;
  const visibleIds = levelChildren(tree, levelId);
  const crumbs = useMemo(() => breadcrumbs(tree, levelId, rootLabel), [tree, levelId, rootLabel]);
  const levelKey = levelId ?? '__top';
  const levelCounts = useMemo(
    () => (levelId ? descendantCounts(tree, levelId) : nodes.reduce((c, n) => {
      c.total += 1; c[mapStatus(n)] += 1; return c;
    }, { total: 0, clear: 0, assumed: 0, needs: 0 })),
    [tree, levelId, nodes],
  );

  // ----- transitions -----
  const [leaving, setLeaving] = useState(null); // { dir: 'in' | 'back', focusId }
  const [enterDir, setEnterDir] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const navigate = useCallback((target, dir, focusId = null) => {
    clearTimeout(timer.current);
    if (prefersReducedMotion()) {
      setEnterDir(null);
      commitNavigate(target);
      return;
    }
    setLeaving({ dir, focusId });
    timer.current = setTimeout(() => {
      setEnterDir(dir);
      setLeaving(null);
      commitNavigate(target);
    }, TRANSITION_OUT_MS);
  }, [commitNavigate]);

  const goBack = useCallback(() => {
    if (crumbs.length > 1) navigate(parentLevel(tree, levelId), 'back');
  }, [crumbs.length, navigate, tree, levelId]);

  const goTo = useCallback((id) => {
    if (effectiveLevel(tree, id) === levelId) return;
    navigate(id, 'back');
  }, [navigate, tree, levelId]);

  // Backspace = up one level (not while typing).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Backspace' || e.defaultPrevented) return;
      const t = e.target;
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
      if (t !== document.body && !t.closest?.('.mindmap-wrapper')) return;
      e.preventDefault();
      goBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goBack]);

  // Something outside the map (attention list, side panel, chat) selected a bubble that isn't on
  // this level: go to the level that shows it.
  const prevSelected = useRef(selectedId);
  useEffect(() => {
    if (prevSelected.current === selectedId) return;
    prevSelected.current = selectedId;
    if (!selectedId || !tree.byId.has(selectedId) || selectedId === levelId) return;
    if (visibleIds.includes(selectedId)) return;
    setEnterDir(null);
    commitNavigate(levelOf(tree, selectedId));
  }, [selectedId, tree, levelId, visibleIds, commitNavigate]);

  // ----- layout for this level -----
  const activeHighlighted = highlighted && highlighted.length > 0 ? highlighted : highlightedIds;
  const highlightedSet = useMemo(() => visibleMarks(tree, visibleIds, activeHighlighted || []), [tree, visibleIds, activeHighlighted]);
  const changedSet = useMemo(() => visibleMarks(tree, visibleIds, changedIds || []), [tree, visibleIds, changedIds]);

  const items = useMemo(() => visibleIds.map((id) => {
    const counts = descendantCounts(tree, id);
    const kids = (tree.children.get(id) || []).length;
    return { id, counts, kids, r: bubbleRadius(tree.byId.get(id), kids > 0) };
  }), [tree, visibleIds]);
  const layout = useMemo(() => levelLayout(items), [items]);

  const flowNodes = useMemo(() => {
    const { lens } = layout;
    const out = [{
      id: '__lens',
      type: 'lens',
      position: { x: lens.x - lens.r, y: lens.y - lens.r },
      // Keep dimensions across controlled-node updates (including preview hover).
      // Otherwise React Flow hides nodes until ResizeObserver measures them again.
      width: lens.r * 2,
      height: lens.r * 2,
      selectable: false,
      focusable: false,
      draggable: false,
      zIndex: 0,
      data: {
        size: lens.r * 2,
        label: levelNode?.label || rootLabel,
        onTitle: levelNode ? () => onSelect(levelNode) : null,
        empty: items.length === 0,
      },
    }];
    items.forEach(({ id, counts, kids }) => {
      const p = layout.bubbles.get(id);
      out.push({
        id,
        type: 'bubble',
        position: { x: p.x - p.r, y: p.y - p.r },
        width: p.r * 2,
        height: p.r * 2,
        draggable: false,
        zIndex: 1,
        data: {
          node: tree.byId.get(id),
          size: p.r * 2,
          counts,
          kids,
          isFocus: leaving?.focusId === id,
          isSelected: id === selectedId,
          isHighlighted: highlightedSet.has(id),
          isChanged: changedSet.has(id),
          onDetails: onSelect,
        },
      });
    });
    return out;
  }, [layout, items, tree, levelNode, rootLabel, leaving, selectedId, highlightedSet, changedSet, onSelect]);

  const handleNodeClick = useCallback((_, flowNode) => {
    if (!flowNode || flowNode.type !== 'bubble' || leaving) return;
    const node = flowNode.data.node;
    if (flowNode.data.kids > 0) navigate(node.id, 'in', node.id);
    else onSelect(node);
  }, [leaving, navigate, onSelect]);

  // Per-level viewport memory, so Back returns to where you were.
  const viewports = useRef(new Map());
  const saved = viewports.current.get(levelKey);

  if (nodes.length === 0) {
    return (
      <div className="mindmap-wrapper">
        <div className="mindmap-empty">
          <div className="mindmap-empty-icon">🧠</div>
          <h3>Your Mind Map is Empty</h3>
          <p>Send a message in the chat to start mapping ideas.</p>
        </div>
      </div>
    );
  }

  const stageClass = [
    'mindmap-stage',
    leaving ? `leaving leaving-${leaving.dir}` : '',
    !leaving && enterDir ? `entering-${enterDir}` : '',
  ].join(' ');

  return (
    <div className="mindmap-wrapper">
      <header className="mm-header">
        <Breadcrumbs crumbs={crumbs} onGo={goTo} onBack={goBack} canGoBack={crumbs.length > 1} />
        {!compact && <div className="mm-legend" aria-label="Status of everything below this level">
          {['clear', 'assumed', 'needs'].map((k) => levelCounts[k] > 0 && (
            <StatusChip key={k} status={k}>{levelCounts[k]} {k === 'needs' ? 'need info' : STATUS_LABELS[k].toLowerCase()}</StatusChip>
          ))}
        </div>}
      </header>

      <div className="mindmap-body">
        {!compact && <Attention nodes={nodes} onSelect={onSelect} selectedId={selectedId} defaultOpen={false} />}
        <div className={stageClass} onAnimationEnd={(e) => { if (e.target === e.currentTarget) setEnterDir(null); }}>
          <ReactFlow
            key={levelKey}
            nodes={flowNodes}
            edges={[]}
            nodeTypes={nodeTypes}
            onNodeClick={handleNodeClick}
            onMoveEnd={(_, vp) => viewports.current.set(levelKey, vp)}
            defaultViewport={saved}
            fitView={!saved}
            fitViewOptions={{ padding: 0.08, maxZoom: 1.2, minZoom: 0.4 }}
            minZoom={0.2}
            maxZoom={3}
            zoomOnDoubleClick={false}
            nodesDraggable={false}
            nodesConnectable={false}
          >
            <RefitOnChange count={items.length} />
            <Background color="rgba(255, 255, 255, 0.07)" gap={20} size={1} />
            <Controls showInteractive={false} className="mindmap-controls" />
            {!compact && <MiniMap
              className="mindmap-minimap"
              nodeColor={(n) => (n.type === 'lens' ? '#F1F0EB' : MINIMAP_COLORS[mapStatus(n.data?.node)])}
              maskColor="rgba(31, 30, 29, 0.55)"
            />}
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}
