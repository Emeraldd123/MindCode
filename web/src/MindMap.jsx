import React, { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './mindmap.css';
import Attention from './Attention';

// Custom Node Component
function MindMapNode({ data }) {
  const {
    node,
    isHighlighted,
    isSelected,
    isPulsing,
  } = data;

  const source = node.source || 'user';
  const status = node.status || 'proposed';
  const inventiveness = Number(node.inventiveness ?? 0);

  let sourceClass = 'source-user';
  if (source === 'inferred') {
    sourceClass = inventiveness >= 0.5 ? 'source-inferred-high' : 'source-inferred-low';
  } else if (source === 'unknown') {
    sourceClass = 'source-unknown';
  }

  const isApproved = status === 'approved';
  const isLocked = status === 'locked';

  const rawImportance = Number(node.importance);
  const importance = Number.isInteger(rawImportance) && rawImportance >= 1 && rawImportance <= 5
    ? rawImportance
    : 3;

  return (
    <div
      className={`mindmap-node ${sourceClass} importance-${importance} ${isApproved ? 'status-approved' : ''} ${
        isSelected ? 'node-selected' : ''
      } ${isHighlighted ? 'node-highlighted' : ''} ${isPulsing ? 'node-pulsing' : ''}`}
    >
      <Handle type="target" position={Position.Top} className="mindmap-handle" />

      <div className="mindmap-node-label">{node.label}</div>

      <div className="mindmap-node-meta">
        <span className="mindmap-kind-tag">{node.kind || 'feature'}</span>

        <div className="mindmap-node-badges">
          {source === 'unknown' && !isApproved && (
            <span className="unknown-badge" title="Needs a decision">?</span>
          )}
          {isApproved && (
            <span className="approved-badge" title="User approved">✓ Approved</span>
          )}
          {isLocked && (
            <span className="locked-badge" title="Locked by user">🔒</span>
          )}
        </div>
      </div>

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

  // Calculate coordinates
  const NODE_WIDTH = 180;
  const H_GAP = 40;
  const V_GAP = 110;
  const positions = new Map();

  const maxLevelWidth = Math.max(...levels.map((lvl) => lvl.length * (NODE_WIDTH + H_GAP)));

  levels.forEach((lvlNodes, depth) => {
    const totalLevelWidth = lvlNodes.length * (NODE_WIDTH + H_GAP) - H_GAP;
    const startX = (maxLevelWidth - totalLevelWidth) / 2 + 50;
    const y = depth * V_GAP + 50;

    lvlNodes.forEach((nid, idx) => {
      const x = startX + idx * (NODE_WIDTH + H_GAP);
      positions.set(nid, { x, y });
    });
  });

  return { positions };
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
          isPulsing: changedSet.has(node.id),
        },
      };
    });
  }, [nodes, positions, selectedId, highlightedSet, changedSet]);

  const flowEdges = useMemo(() => {
    return edges.map((e, index) => ({
      id: `edge-${e.from}-${e.to}-${index}`,
      source: e.from,
      target: e.to,
      type: 'smoothstep',
      animated: e.relation === 'needs',
      style: { stroke: '#475569', strokeWidth: 2 },
    }));
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
        <Background color="#334155" gap={20} size={1} />
        <Controls showInteractive={false} />
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
          <span>Claude assumed (leap)</span>
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
