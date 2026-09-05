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
    <div ref={setNodeRef} style={style} onClick={onSelect} className={cn('flex items-center gap-2 rounded-md border border-border bg-bg-2 px-2 py-1.5 text-sm cursor-pointer', selected && 'ring-1 ring-accent', isDragging && 'opacity-60')}>
      <button type="button" {...attributes} {...listeners} className="text-text-3 cursor-grab" aria-label="Drag to reorder"><GripVertical className="h-4 w-4" /></button>
      <span className="num text-text-3 w-5">{item.sequence}</span>
      <span className="flex-1 truncate">{item.name || 'Waypoint'}{item.is_anchorage && <Anchor className="inline h-3 w-3 ml-1 text-accent" />}</span>
      <span className="num text-[11px] text-text-3">{item.distanceNm !== undefined && item.sequence > 1 ? `${item.distanceNm.toFixed(1)} nm` : ''}</span>
      <span className="num text-[11px] text-text-2 w-24 text-right">{item.eta ? fmtUtc(item.eta) : ''}</span>
      <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-text-3 hover:text-risk-red" aria-label="Delete waypoint"><Trash2 className="h-3.5 w-3.5" /></button>
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
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.key)} strategy={verticalListSortingStrategy}>
        <div className="space-y-1">{items.map((it) => <Row key={it.key} item={it} selected={it.key === selectedKey} onSelect={() => onSelect(it.key)} onDelete={() => onDelete(it.key)} />)}</div>
      </SortableContext>
    </DndContext>
  );
}
