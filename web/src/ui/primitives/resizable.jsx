import React from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { cn } from '@/lib/utils';

// shadcn/ui "Resizable", adapted to react-resizable-panels v4 (Group/Panel/Separator).
export function ResizablePanelGroup({ className, orientation = 'horizontal', ...props }) {
  return <Group orientation={orientation} className={cn('flex h-full w-full', className)} {...props} />;
}

export const ResizablePanel = Panel;

/** Obsidian-style hairline divider with a wider invisible grab area. */
export function ResizableHandle({ className, ...props }) {
  return (
    <Separator
      className={cn(
        'group relative w-px shrink-0 bg-hairline outline-none transition-colors hover:bg-ai/60 data-[separator=active]:bg-ai',
        'after:absolute after:inset-y-0 after:-left-1.5 after:w-3 after:content-[""]',
        className,
      )}
      {...props}
    />
  );
}
