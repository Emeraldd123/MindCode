/** Graph presentation advice derived from the currently displayed map. */
export function graphRecommendations(map) {
  const nodes = map?.nodes || [];
  if (!nodes.length) return [];
  const ids = new Set(nodes.map((node) => node.id));
  const edges = (map.edges || []).filter((edge) => ids.has(edge.from) && ids.has(edge.to));
  const recommendations = [];
  const add = (id, title, detail) => recommendations.push({ id, title, detail });

  if (nodes.length > 15) {
    add('density', 'Show one branch at a time', `${nodes.length} bubbles can make the overview crowded. Use the Graph view to explore a branch, keeping related ideas together.`);
  } else {
    add('spacing', 'Keep related bubbles together', 'Leave consistent space between bubbles and group children near their parent so the reading order is clear.');
  }

  const longLabels = nodes.filter((node) => [...(node.label || '')].length > 32);
  if (longLabels.length) {
    add('labels', 'Shorten long labels', `${longLabels.length} bubble${longLabels.length === 1 ? ' has' : 's have'} a long label. Keep a short phrase on the bubble and move the explanation into its detail.`);
  }

  const sources = new Set(nodes.map((node) => node.source).filter(Boolean));
  if (sources.size > 1) {
    add('color', 'Keep source colors consistent', 'Use the same color for each source throughout the graph. Retain borders and status labels so meaning does not depend on color alone.');
  }

  const crossLinks = edges.filter((edge) => edge.relation !== 'contains' &&
    !nodes.some((node) => node.id === edge.to && node.parent === edge.from));
  if (crossLinks.length > 3) {
    add('connections', 'Reduce competing connections', `${crossLinks.length} cross-links can compete with the hierarchy. Make parent links prominent and reveal secondary connections when a bubble is selected.`);
  }

  const undecided = nodes.filter((node) => node.source === 'unknown' && node.status !== 'approved');
  if (undecided.length) {
    add('attention', 'Make open decisions easy to find', `${undecided.length} unresolved bubble${undecided.length === 1 ? '' : 's'} should keep a visible question mark and a distinct border. Reserve strong emphasis for these decisions.`);
  }
  return recommendations;
}
