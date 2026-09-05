import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Anchor, GripVertical, Trash2 } from 'lucide-react';
import type { DraftWaypoint } from '@/types/domain.ts';
import { fmtUtc } from '@/lib/time.ts';
import { cn } from '@/lib/utils.ts';

export type ListItem = DraftWaypoint & { key: string; eta?: string; distanceNm?: number; stay_hours?: number };

function Row({ item, selected, onSelect, onDelete }: { item: ListItem; selected: boolean; onSelect: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.key });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} onClick={onSelect} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
      className={cn('group flex items-center gap-2 rounded-md border bg-bg-2 pl-1 pr-1.5 h-10 text-sm cursor-pointer transition-colors', selected ? 'border-accent/60 shadow-[inset_2px_0_0_#2DD4BF]' : 'border-border hover:border-text-3/50', isDragging && 'opacity-60 shadow-[0_8px_24px_rgba(0,0,0,0.5)]')}>
      <button type="button" {...attributes} {...listeners} className="inline-flex h-8 w-6 items-center justify-center text-text-3 cursor-grab active:cursor-grabbing hover:text-text-1" aria-label="Drag to reorder"><GripVertical className="h-4 w-4" /></button>
      <span className="num inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border bg-bg-1 text-[10.5px] text-text-2">{item.sequence}</span>
      <span className="flex-1 truncate flex items-center gap-1.5">{item.name || 'Waypoint'}{item.is_anchorage && <Anchor className="h-3 w-3 text-accent shrink-0" aria-label="anchorage" />}</span>
      <span className="num text-[11px] text-text-3 w-14 text-right whitespace-nowrap">{item.distanceNm !== undefined && item.sequence > 1 ? `${item.distanceNm.toFixed(1)} nm` : ''}</span>
      <span className="num text-[11px] text-text-2 w-[92px] text-right whitespace-nowrap">{item.eta ? fmtUtc(item.eta) : ''}</span>
      <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-text-3 opacity-60 group-hover:opacity-100 hover:text-risk-red hover:bg-risk-red/10" aria-label="Delete waypoint"><Trash2 className="h-3.5 w-3.5" /></button>
    </div>
  );
}

export function WaypointList({ items, selectedKey, onSelect, onDelete, onReorder }: { items: ListItem[]; selectedKey: string | null; onSelect: (k: string) => void; onDelete: (k: string) => void; onReorder: (items: ListItem[]) => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.key === active.id), to = items.findIndex((i) => i.key === over.id);
    // Sequence renumbers on the client; the save writes all rows in one request (deferred unique constraint).
    onReorder(arrayMove(items, from, to).map((it, i) => ({ ...it, sequence: i + 1 })));
  };
  if (items.length === 0) return <div className="gap-hatch rounded-md border border-dashed border-border p-4 text-center text-xs text-text-3">No waypoints yet. Click the map to drop the first pin, or import a GPX or CSV.</div>;
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.key)} strategy={verticalListSortingStrategy}>
        <div className="space-y-1">{items.map((it) => <Row key={it.key} item={it} selected={it.key === selectedKey} onSelect={() => onSelect(it.key)} onDelete={() => onDelete(it.key)} />)}</div>
      </SortableContext>
    </DndContext>
  );
}
