import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ReactFlow, Background, Controls, Handle, Position, useReactFlow, ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Check, Lock, Minus, Plus, X } from 'lucide-react';
import MindMap from './MindMap';
import { cn } from '@/lib/utils';
import { ancestorsOf, descendantsOf, layoutTree } from './treeLayout';

/**
 * Tree map view (Claude's alternative to MindMap.jsx; toggle in the map header).
 * - Left-to-right tidy tree: every child sits beside its own parent, so branches are easy to follow.
 * - Hover a node: preview its bubble level in a small overlay without moving the tree.
 * - Click a leaf: open details; the selected path/subtree lights up and everything else dims.
 * - Collapse/expand any branch. Cross-links (informs/needs) only show for the selected bubble.
 * Props match MindMap: map, highlighted, changedIds, selectedId, onSelect.
 */

const SOURCE = {
  user: { bar: 'bg-user', ring: 'ring-user/70', text: 'You said it' },
  inferred: { bar: 'bg-ai', ring: 'ring-ai/70', text: 'Claude assumed' },
  unknown: { bar: 'bg-unknown', ring: 'ring-unknown/70', text: 'Open question' },
};
const RELATION_COLOR = { informs: '#38bdf8', needs: '#cbd5e1', has: '#6f6b64' };

function BubbleNode({ data }) {
  const { node, state, hidden, onToggle, hasKids, collapsed } = data;
  const src = SOURCE[node.source] || SOURCE.unknown;
  const inferredAlpha = node.source === 'inferred' ? 0.35 + 0.65 * Math.max(0, Math.min(1, node.inventiveness ?? 0)) : 1;
  return (
    <div
      className={cn(
        'group relative flex w-[244px] cursor-pointer items-stretch overflow-hidden rounded-lg border bg-surface font-sans text-foreground transition-all duration-200',
        node.status === 'approved' ? 'border-approved/70' : 'border-hairline',
        state === 'selected' && 'ring-2 ring-white shadow-[0_0_0_4px_rgba(255,255,255,0.08),0_10px_30px_-10px_rgba(0,0,0,0.8)]',
        state === 'path' && cn('ring-1', src.ring),
        state === 'dim' && 'opacity-30',
        data.highlighted && 'shadow-[0_0_0_3px_rgba(23,200,148,0.55),0_0_24px_rgba(23,200,148,0.45)]',
        data.changed && 'animate-pulse',
      )}
      title={node.detail || node.label}
    >
      <Handle type="target" position={Position.Left} className="!size-1.5 !border-0 !bg-transparent" />
      <span className={cn('w-1 shrink-0', src.bar)} style={{ opacity: inferredAlpha }} aria-hidden />
      <div className="min-w-0 flex-1 px-2.5 py-1.5">
        <div className="flex items-center gap-1.5">
          {node.source === 'unknown' && <span className="text-[11px] font-bold text-unknown">?</span>}
          <span className="truncate text-[12.5px] font-medium leading-tight">{node.label}</span>
          {node.status === 'approved' && <Check className="ml-auto size-3 shrink-0 text-approved" strokeWidth={3} />}
          {node.status === 'locked' && <Lock className="ml-auto size-3 shrink-0 text-muted-foreground" />}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] text-dim">
          <span>{node.facet && node.facet !== 'goal' ? node.facet : node.kind}</span>
          {hidden > 0 && <span className="normal-case tracking-normal text-muted-foreground">· {hidden} hidden</span>}
        </div>
      </div>
      {hasKids && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(node.id);
          }}
          className="flex w-6 shrink-0 cursor-pointer items-center justify-center border-0 border-l border-hairline bg-transparent text-dim hover:bg-accent hover:text-foreground"
          title={collapsed ? 'Expand branch' : 'Collapse branch'}
          aria-label={collapsed ? 'Expand branch' : 'Collapse branch'}
        >
          {collapsed ? <Plus className="size-3" /> : <Minus className="size-3" />}
        </button>
      )}
      <Handle type="source" position={Position.Right} className="!size-1.5 !border-0 !bg-transparent" />
    </div>
  );
}

const nodeTypes = { bubble: BubbleNode };

function TreeInner({ map = { nodes: [], edges: [] }, highlighted = [], changedIds = [], selectedId = null, onSelect, onHoverNode }) {
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [measurements, setMeasurements] = useState(() => new Map());
  // Controlled nodes must retain React Flow's measurements when hover/selection
  // replaces their data. Dropping them hides cards and invalidates edge endpoints.
  const onNodesChange = useCallback((changes) => {
    const dimensions = changes.filter((change) => change.type === 'dimensions' && change.dimensions);
    if (!dimensions.length) return;
    setMeasurements((prev) => {
      let next = prev;
      for (const { id, dimensions: size } of dimensions) {
        const old = prev.get(id);
        if (old?.width === size.width && old?.height === size.height) continue;
        if (next === prev) next = new Map(prev);
        next.set(id, size);
      }
      return next;
    });
  }, []);
  const { fitView } = useReactFlow();
  const toggle = (id) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // A selected bubble inside a collapsed branch: expand its path so it's visible.
  useEffect(() => {
    if (!selectedId) return;
    const path = ancestorsOf(map, selectedId).slice(0, -1);
    if (path.some((id) => collapsed.has(id))) setCollapsed((prev) => new Set([...prev].filter((id) => !path.includes(id))));
  }, [selectedId]);

  const { nodes, edges } = useMemo(() => {
    const { pos, hiddenCount } = layoutTree(map, collapsed);
    const path = selectedId ? new Set(ancestorsOf(map, selectedId)) : null;
    const sub = selectedId ? new Set(descendantsOf(map, selectedId)) : null;
    const hl = new Set(highlighted);
    const ch = new Set(changedIds);
    const hasKids = new Set((map.nodes || []).filter((n) => n.parent).map((n) => n.parent));
    const rfNodes = (map.nodes || [])
      .filter((n) => pos.has(n.id))
      .map((n) => {
        const state = !selectedId ? 'normal' : n.id === selectedId ? 'selected' : path.has(n.id) || sub.has(n.id) ? 'path' : 'dim';
        return {
          id: n.id,
          type: 'bubble',
          position: { x: pos.get(n.id).x, y: pos.get(n.id).y },
          measured: measurements.get(n.id),
          data: { node: n, state, highlighted: hl.has(n.id), changed: ch.has(n.id), hidden: hiddenCount.get(n.id) || 0, hasKids: hasKids.has(n.id), collapsed: collapsed.has(n.id), onToggle: toggle },
          draggable: false,
        };
      });
    const visible = new Set(rfNodes.map((n) => n.id));
    const tree = (map.nodes || [])
      .filter((n) => n.parent && visible.has(n.id) && visible.has(n.parent))
      .map((n) => {
        const onPath = path && path.has(n.id) && path.has(n.parent);
        const inSub = sub && (sub.has(n.id) && (sub.has(n.parent) || n.parent === selectedId));
        return {
          id: `t-${n.parent}-${n.id}`,
          source: n.parent,
          target: n.id,
          type: 'smoothstep',
          style: {
            stroke: onPath || inSub ? '#ffffff' : '#4a4743',
            strokeWidth: onPath ? 2.5 : inSub ? 1.75 : 1.25,
            opacity: selectedId && !onPath && !inSub ? 0.25 : 1,
          },
        };
      });
    const cross = selectedId
      ? (map.edges || [])
          .filter((e) => e.relation !== 'has' && (e.from === selectedId || e.to === selectedId) && visible.has(e.from) && visible.has(e.to))
          .map((e) => ({
            id: `x-${e.from}-${e.to}-${e.relation}`,
            source: e.from,
            target: e.to,
            type: 'default',
            animated: true,
            label: e.relation,
            labelStyle: { fill: '#a6a29a', fontSize: 10 },
            labelBgStyle: { fill: '#1c1b1a' },
            style: { stroke: RELATION_COLOR[e.relation] || '#38bdf8', strokeDasharray: '5 4', strokeWidth: 1.5 },
          }))
      : [];
    return { nodes: rfNodes, edges: [...tree, ...cross] };
  }, [map, collapsed, selectedId, highlighted.join(' '), changedIds.join(' '), measurements]);

  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.15, duration: 300 }), 50);
    return () => clearTimeout(t);
  }, [nodes.length]);

  // Selecting a bubble: zoom to its path (root -> bubble -> children), kept clear of the side panel
  // that opens over the right of the map.
  useEffect(() => {
    if (!selectedId) return undefined;
    const focus = [...ancestorsOf(map, selectedId), ...descendantsOf(map, selectedId).slice(0, 12)].map((id) => ({ id }));
    const t = setTimeout(
      () => fitView({ nodes: focus, duration: 350, maxZoom: 1, padding: { top: '40px', bottom: '60px', left: '30px', right: '400px' } }),
      60,
    );
    return () => clearTimeout(t);
  }, [selectedId]);

  if (!map.nodes?.length) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center font-sans text-[13px] text-dim">
        Describe your app in the chat. Every page, feature, API and decision Claude plans will appear here as a tree.
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes}
      onNodesChange={onNodesChange}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeMouseEnter={(_, n) => onHoverNode?.(n.data.node)}
      onNodeClick={(_, n) => onSelect?.(map.nodes.find((x) => x.id === n.id) || null)}
      onPaneClick={() => onSelect?.(null)}
      nodesConnectable={false}
      minZoom={0.15}
      maxZoom={1.75}
      fitView
      proOptions={{ hideAttribution: true }}
      className="bg-background"
    >
      <Background color="#2a2926" gap={22} size={1} />
      <Controls showInteractive={false} className="!border-hairline !bg-surface !shadow-none [&>button]:!border-hairline [&>button]:!bg-surface [&>button]:!fill-muted-foreground" />
      <div className="pointer-events-none absolute bottom-3 left-14 z-10 flex gap-3 rounded-md border border-hairline bg-surface/90 px-2.5 py-1.5 font-sans text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-1 rounded-sm bg-user" /> you said it</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-1 rounded-sm bg-ai" /> Claude assumed</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-1 rounded-sm bg-unknown" /> open question</span>
        <span className="flex items-center gap-1.5"><Check className="size-3 text-approved" strokeWidth={3} /> approved</span>
      </div>
    </ReactFlow>
  );
}

export default function TreeMap(props) {
  const [preview, setPreview] = useState(null);
  const closeTimer = useRef(null);
  const wrapper = useRef(null);
  const map = props.map || { nodes: [], edges: [] };
  const hovered = preview && map.nodes.find((node) => node.id === preview.hoveredId);
  const cancelClose = () => clearTimeout(closeTimer.current);
  const close = () => { cancelClose(); setPreview(null); };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setPreview(null), 500);
  };
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  useEffect(() => {
    if (!preview) return undefined;
    const onEscape = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      clearTimeout(closeTimer.current);
      setPreview(null);
      if (document.activeElement?.closest('[aria-label="Bubble graph preview"]')) wrapper.current?.focus();
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [preview]);

  const showPreview = (node) => {
    cancelClose();
    const hasKids = map.nodes.some((child) => child.parent === node.id);
    const parent = map.nodes.some((candidate) => candidate.id === node.parent) ? node.parent : null;
    setPreview({ hoveredId: node.id, levelId: hasKids ? node.id : parent });
  };

  return (
    <div
      ref={wrapper}
      tabIndex={-1}
      className="relative h-full w-full outline-none"
      onMouseEnter={cancelClose}
      onMouseLeave={scheduleClose}
      onFocusCapture={(event) => {
        const el = event.target.closest('.react-flow__node');
        if (event.target.closest('[aria-label="Bubble graph preview"]')) return;
        const node = map.nodes.find((candidate) => candidate.id === el?.dataset.id);
        if (node) showPreview(node);
      }}
    >
      <ReactFlowProvider>
        <TreeInner {...props} onHoverNode={showPreview} />
      </ReactFlowProvider>
      {hovered && createPortal(
        <section
          aria-label="Bubble graph preview"
          className="fixed left-4 top-[60px] z-40 flex h-[760px] max-h-[calc(100dvh-76px)] w-[640px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-xl border border-hairline bg-background text-foreground shadow-2xl"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <header className="flex shrink-0 items-center justify-between gap-2 border-b border-hairline px-4 py-3">
            <div className="min-w-0">
              <h3 className="m-0 truncate text-sm font-semibold">{hovered.label}</h3>
              <p className="m-0 mt-1 text-xs text-muted-foreground">Bubble preview · hover another Tree node to explore</p>
            </div>
            <button type="button" aria-label="Close bubble preview" onClick={close} className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded border-0 bg-transparent text-foreground hover:bg-accent">
              <X size={14} />
            </button>
          </header>
          <div className="min-h-0 flex-1">
            <MindMap
              compact
              map={map}
              activeId={preview.levelId}
              onNavigate={(levelId) => setPreview((prev) => prev && { ...prev, levelId })}
              highlighted={[preview.hoveredId, ...(props.highlighted || [])]}
              changedIds={props.changedIds}
              onSelect={props.onSelect}
            />
          </div>
        </section>,
        document.body,
      )}
    </div>
  );
}
