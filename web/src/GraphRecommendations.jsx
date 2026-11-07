import React from 'react';
import { graphRecommendations } from './graphRecommendations';

export default function GraphRecommendations({ map }) {
  const recommendations = graphRecommendations(map);
  if (!recommendations.length) return null;

  return (
    <details className="shrink-0 border-t border-hairline bg-surface" open>
      <summary className="cursor-pointer px-4 py-2 text-xs font-medium">
        Design recommendations · {recommendations.length}
      </summary>
      <section aria-label="Graph design recommendations" className="max-h-44 overflow-y-auto px-4 pb-3">
        <p className="mb-2 text-[11px] text-muted-foreground">Suggestions based on this graph’s structure. Updates automatically; changes are not applied.</p>
        <ul className="m-0 list-none space-y-2 p-0">
          {recommendations.map(({ id, title, detail }) => (
            <li key={id}>
              <h3 className="text-xs font-medium">{title}</h3>
              <p className="text-[11px] leading-relaxed text-muted-foreground">{detail}</p>
            </li>
          ))}
        </ul>
      </section>
    </details>
  );
}
