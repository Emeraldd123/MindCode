import React, { useMemo, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './mindmap.css';
import Attention from './Attention';

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
  const classes = ['mindmap-node'];
  const source = node?.source || 'user';
  const status = node?.status || 'proposed';
  const inventiveness = Number(node?.inventiveness ?? 0);

  // Source styling
  if (source === 'user') {
    classes.push('source-user');
  } else if (source === 'inferred') {
    classes.push('source-inferred');
    if (inventiveness >= 0.5) {
      classes.push('source-inferred-high');
    } else {
      classes.push('source-inferred-low');
    }
    if (inventiveness >= 0.6) {
      classes.push('has-creative-leap');
    }
  } else if (source === 'unknown') {
    classes.push('source-unknown');
  }

  // Importance class
  const rawImportance = Number(node?.importance);
  const importance = Number.isInteger(rawImportance) && rawImportance >= 1 && rawImportance <= 5
    ? rawImportance
    : 3;
  classes.push(`importance-${importance}`);

  // Status styling
  if (status === 'approved') {
    classes.push('status-approved');
  }
  if (status === 'locked') {
    classes.push('status-locked');
  }

  // Interaction states
  if (isSelected) {
    classes.push('node-selected');
  }
  if (isHighlighted) {
    classes.push('node-highlighted');
  }
  if (isChanged) {
    classes.push('node-changed');
  }

  return classes.join(' ');
}

// Pure helper: bubbleWidth(importance)
// Scales linearly from 160px (importance 1) to 240px (importance 5)
export function bubbleWidth(importance) {
  const raw = Number(importance);
  const imp = Number.isInteger(raw) && raw >= 1 && raw <= 5 ? raw : 3;
  return 160 + (imp - 1) * 20; // 1: 160, 2: 180, 3: 200, 4: 220, 5: 240
}

// Pure helper: inferredFill(inventiveness)
// Opacity scales with inventiveness (0 = very pale, 1 = deep amber)
export function inferredFill(inventiveness) {
  const inv = typeof inventiveness === 'number' ? Math.max(0, Math.min(1, inventiveness)) : 0;
  // Pale: ~0.08 alpha, Deep: ~0.42 alpha
  const alpha = 0.08 + inv * 0.34;
  return `rgba(245, 158, 11, ${Number(alpha.toFixed(3))})`;
}

// Pure helper: edgeStyle(relation)
// has = slate, needs = amber, informs = blue dashed
export function edgeStyle(relation) {
  switch (relation) {
    case 'needs':
      return {
        stroke: '#f59e0b',
        strokeWidth: 2,
        strokeDasharray: undefined,
        animated: true,
      };
    case 'informs':
      return {
        stroke: '#3b82f6',
        strokeWidth: 2,
        strokeDasharray: '5,5',
        animated: false,
      };
    case 'has':
    default:
      return {
        stroke: '#64748b',
        strokeWidth: 2,
        strokeDasharray: undefined,
        animated: false,
      };
  }
}

// Custom Node Component
function MindMapNode({ data }) {
  const {
    node,
    isHighlighted,
    isSelected,
    isChanged,
  } = data;

  const source = node?.source || 'user';
  const status = node?.status || 'proposed';
  const inventiveness = Number(node?.inventiveness ?? 0);
  const kind = node?.kind || 'feature';
  const kindIcon = getKindIcon(kind);
  const width = bubbleWidth(node?.importance);

  const isApproved = status === 'approved';
  const isLocked = status === 'locked';

  const nodeClassName = bubbleClass(node, {
    isSelected,
    isHighlighted,
    isChanged,
  });

  const nodeStyle = {
    width: `${width}px`,
  };

  if (source === 'inferred') {
    nodeStyle.backgroundColor = inferredFill(inventiveness);
  }

  const evidenceQuotes = Array.isArray(node?.evidence) ? node.evidence.filter(Boolean) : [];
  const hasTooltip = Boolean(node?.detail || evidenceQuotes.length > 0);

  return (
    <div
      className={nodeClassName}
      style={nodeStyle}
    >
      <Handle type="target" position={Position.Top} className="mindmap-handle" />

      {isApproved && (
        <div className="approved-corner-badge" title="Approved">
          ✓
        </div>
      )}

      <div className="mindmap-node-header">
        <span className="mindmap-kind-icon" title={kind}>
          {kindIcon}
        </span>
        <div className="mindmap-node-label" title={node?.label}>
          {node?.label}
        </div>
        {source === 'inferred' && inventiveness >= 0.6 && (
          <span className="creative-leap-badge" title={`Creative leap (${Math.round(inventiveness * 100)}%)`}>
            ✦
          </span>
        )}
      </div>

      {node?.detail && (
        <div className="mindmap-node-detail-preview">
          {node.detail}
        </div>
      )}

      <div className="mindmap-node-meta">
        <span className="mindmap-kind-tag">
          {kind}
        </span>

        <div className="mindmap-node-badges">
          {source === 'unknown' && !isApproved && (
            <span className="unknown-badge" title="Needs a decision">?</span>
          )}
          {isApproved && (
            <span className="approved-badge" title="User approved">✓</span>
          )}
          {isLocked && (
            <span className="locked-badge" title="Locked by user">🔒</span>
          )}
        </div>
      </div>

      {hasTooltip && (
        <div className="mindmap-tooltip">
          {node.detail && (
            <div className="tooltip-detail">{node.detail}</div>
          )}
          {evidenceQuotes.length > 0 && (
            <div className="tooltip-evidence">
              <div className="tooltip-evidence-title">Evidence:</div>
              {evidenceQuotes.map((quote, idx) => (
                <div key={idx} className="tooltip-quote">
                  &ldquo;{quote}&rdquo;
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="mindmap-handle" />
    </div>
  );
}

const nodeTypes = {
  mindmapNode: MindMapNode,
};

// Hierarchical layout calculator (top-to-bottom tree)
function calculateLayout(rawNodes = [], rawEdges = []) {
  if (!rawNodes || rawNodes.length === 0) {
    return { positions: new Map() };
  }

  const nodeMap = new Map(rawNodes.map((n) => [n.id, n]));
  const childrenMap = new Map();

  rawNodes.forEach((n) => {
    childrenMap.set(n.id, []);
  });

  // Build tree hierarchy from edges or parent pointers
  rawNodes.forEach((n) => {
    if (n.parent && nodeMap.has(n.parent)) {
      childrenMap.get(n.parent).push(n.id);
    }
  });

  rawEdges.forEach((e) => {
    if (nodeMap.has(e.from) && nodeMap.has(e.to)) {
      const list = childrenMap.get(e.from);
      if (list && !list.includes(e.to)) {
        list.push(e.to);
      }
    }
  });

  // Determine root nodes
  const childSet = new Set();
  childrenMap.forEach((children) => {
    children.forEach((c) => childSet.add(c));
  });

  const roots = rawNodes.filter((n) => !childSet.has(n.id) || n.parent === null);
  const actualRoots = roots.length > 0 ? roots : [rawNodes[0]];

  // Assign depth / levels via BFS
  const levels = [];
  const visited = new Set();
  let currentLevel = actualRoots.map((r) => r.id);

  while (currentLevel.length > 0) {
    const nextLevel = [];
    const validLevelNodes = [];

    currentLevel.forEach((id) => {
      if (!visited.has(id) && nodeMap.has(id)) {
        visited.add(id);
        validLevelNodes.push(id);
        const children = childrenMap.get(id) || [];
        children.forEach((cid) => {
          if (!visited.has(cid)) {
            nextLevel.push(cid);
          }
        });
      }
    });

    if (validLevelNodes.length > 0) {
      levels.push(validLevelNodes);
    }
    currentLevel = nextLevel;
  }

  // Any orphaned nodes
  rawNodes.forEach((n) => {
    if (!visited.has(n.id)) {
      if (levels.length === 0) levels.push([]);
      levels[levels.length - 1].push(n.id);
      visited.add(n.id);
    }
  });

  // Calculate coordinates with variable bubbleWidth
  const H_GAP = 36;
  const V_GAP = 125;
  const positions = new Map();

  // Width of each level is sum of node widths + gaps
  const levelWidths = levels.map((lvlNodes) => {
    return lvlNodes.reduce((sum, nid, idx) => {
      const n = nodeMap.get(nid);
      const w = bubbleWidth(n?.importance);
      return sum + w + (idx > 0 ? H_GAP : 0);
    }, 0);
  });

  const maxLevelWidth = Math.max(...levelWidths, 0);

  levels.forEach((lvlNodes, depth) => {
    const totalLevelWidth = levelWidths[depth];
    let curX = (maxLevelWidth - totalLevelWidth) / 2 + 50;
    const y = depth * V_GAP + 50;

    lvlNodes.forEach((nid) => {
      const n = nodeMap.get(nid);
      const w = bubbleWidth(n?.importance);
      positions.set(nid, { x: curX, y });
      curX += w + H_GAP;
    });
  });

  return { positions };
}

// Inner helper component to handle fitView on load & node count changes
function ViewportHandler({ nodeCount }) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (nodeCount > 0) {
      fitView({ padding: 0.2, duration: 400 });
    }
  }, [nodeCount, fitView]);

  return null;
}

export default function MindMap({
  map = { nodes: [], edges: [] },
  highlighted = [],
  highlightedIds = highlighted,
  changedIds = [],
  selectedId = null,
  onSelect = () => {},
}) {
  const nodes = map.nodes || [];
  const edges = map.edges || [];

  const { positions } = useMemo(
    () => calculateLayout(nodes, edges),
    [nodes, edges]
  );

  const activeHighlighted = (highlighted && highlighted.length > 0) ? highlighted : highlightedIds;
  const highlightedSet = useMemo(() => new Set(activeHighlighted || []), [activeHighlighted]);
  const changedSet = useMemo(() => new Set(changedIds || []), [changedIds]);

  const flowNodes = useMemo(() => {
    return nodes.map((node) => {
      const pos = positions.get(node.id) || { x: 50, y: 50 };
      return {
        id: node.id,
        type: 'mindmapNode',
        position: pos,
        data: {
          node,
          isSelected: node.id === selectedId,
          isHighlighted: highlightedSet.has(node.id),
          isChanged: changedSet.has(node.id),
        },
      };
    });
  }, [nodes, positions, selectedId, highlightedSet, changedSet]);

  const flowEdges = useMemo(() => {
    return edges.map((e, index) => {
      const styleConfig = edgeStyle(e.relation);
      return {
        id: `edge-${e.from}-${e.to}-${index}`,
        source: e.from,
        target: e.to,
        type: 'smoothstep',
        animated: styleConfig.animated,
        style: {
          stroke: styleConfig.stroke,
          strokeWidth: styleConfig.strokeWidth,
          strokeDasharray: styleConfig.strokeDasharray,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: styleConfig.stroke,
          width: 14,
          height: 14,
        },
      };
    });
  }, [edges]);

  const handleNodeClick = useCallback(
    (_, flowNode) => {
      if (flowNode?.data?.node) {
        onSelect(flowNode.data.node);
      }
    },
    [onSelect]
  );

  if (nodes.length === 0) {
    return (
      <div className="mindmap-wrapper">
        <div className="mindmap-empty">
          <div className="mindmap-empty-icon">🧠</div>
          <h3>Your Mind Map is Empty</h3>
          <p>Send a message in the chat to start mapping ideas.</p>
        </div>
        <Attention
          nodes={nodes}
          onSelect={onSelect}
          selectedId={selectedId}
        />
      </div>
    );
  }

  return (
    <div className="mindmap-wrapper">
      <Attention
        nodes={nodes}
        onSelect={onSelect}
        selectedId={selectedId}
      />
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={true}
        nodesConnectable={false}
      >
        <ViewportHandler nodeCount={nodes.length} />
        <Background color="#1e293b" gap={20} size={1} />
        <Controls showInteractive={false} className="mindmap-controls" />
        <MiniMap
          className="mindmap-minimap"
          nodeColor={(n) => {
            const node = n.data?.node;
            if (node?.status === 'approved') return '#10b981';
            if (node?.source === 'user') return '#3b82f6';
            if (node?.source === 'inferred') return '#f59e0b';
            if (node?.source === 'unknown') return '#ef4444';
            return '#64748b';
          }}
          maskColor="rgba(11, 17, 32, 0.75)"
        />
      </ReactFlow>

      {/* Legend */}
      <div className="mindmap-legend">
        <div className="legend-title">Mind Map Legend</div>
        <div className="legend-item">
          <span className="legend-bullet user" />
          <span>User (specified)</span>
        </div>
        <div className="legend-item">
          <span className="legend-bullet inferred-low" />
          <span>Claude assumed (obvious)</span>
        </div>
        <div className="legend-item">
          <span className="legend-bullet inferred-high" />
          <span>Claude assumed (leap ✦)</span>
        </div>
        <div className="legend-item">
          <span className="legend-bullet unknown" />
          <span>Unknown (?)</span>
        </div>
        <div className="legend-item">
          <span className="legend-bullet approved" />
          <span>Approved (✓)</span>
        </div>
      </div>
    </div>
  );
}
