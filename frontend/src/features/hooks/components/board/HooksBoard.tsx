import { useCallback, useMemo, type CSSProperties, type ReactNode } from "react";
import {
  DndContext,
  PointerSensor,
  useDndContext,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import { CardSelectCheckbox } from "../../../../components/cards/CardSelectCheckbox";
import { OverflowTooltipText } from "../../../../components/ui/OverflowTooltipText";
import type { HookInventoryColumnDto, HookInventoryEntryDto } from "../../api/management-types";
import { bucketForHookEntry, bucketHookEntries, type HooksBucket } from "../../model/bucketForEntry";
import { HooksHarnessLogoStack } from "../HooksHarnessLogoStack";

interface HooksBoardProps {
  entries: HookInventoryEntryDto[];
  columns: HookInventoryColumnDto[];
  pendingHookKeys: ReadonlySet<string>;
  checkedIds: ReadonlySet<string>;
  onOpenDetail: (id: string) => void;
  onToggleChecked: (id: string) => void;
  onSetHarnesses: (id: string, target: "enabled" | "disabled") => void;
}

type HooksTerminalBucket = "disabled" | "enabled";

const TERMINAL_BUCKETS: ReadonlySet<HooksBucket> = new Set(["disabled", "enabled"]);

function isTerminalBucket(value: unknown): value is HooksTerminalBucket {
  return value === "disabled" || value === "enabled";
}

export function HooksBoard({
  entries,
  columns,
  pendingHookKeys,
  checkedIds,
  onOpenDetail,
  onToggleChecked,
  onSetHarnesses,
}: HooksBoardProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const buckets = useMemo(() => bucketHookEntries(entries, columns), [entries, columns]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || !isTerminalBucket(over.id)) return;

      const id = String(active.id);
      const entry = entries.find((candidate) => candidate.id === id);
      if (!entry || pendingHookKeys.has(id)) return;

      const targetBucket = over.id;
      const currentBucket = bucketForHookEntry(entry, columns);
      if (TERMINAL_BUCKETS.has(currentBucket) && currentBucket === targetBucket) return;
      if (targetBucket === "enabled" && !entry.canEnable) return;

      onSetHarnesses(id, targetBucket);
    },
    [columns, entries, onSetHarnesses, pendingHookKeys],
  );

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="skill-board" role="group" aria-label="Hooks board">
        <HooksBoardColumn
          kind="disabled"
          title="Disabled everywhere"
          description="Not active on any harness."
          count={buckets.disabled.length}
          emptyMessage="No hooks are disabled everywhere."
        >
          {buckets.disabled.map((entry) => (
            <HooksBoardCard
              key={entry.id}
              entry={entry}
              columns={columns}
              pending={pendingHookKeys.has(entry.id)}
              checked={checkedIds.has(entry.id)}
              onOpenDetail={onOpenDetail}
              onToggleChecked={onToggleChecked}
            />
          ))}
        </HooksBoardColumn>

        <HooksBoardColumn
          kind="selective"
          title="Selective"
          description="Enabled on some harnesses, not others."
          count={buckets.selective.length}
          emptyMessage="No hooks are partially enabled. Open a card to pick specific harnesses."
        >
          {buckets.selective.map((entry) => (
            <HooksBoardCard
              key={entry.id}
              entry={entry}
              columns={columns}
              pending={pendingHookKeys.has(entry.id)}
              checked={checkedIds.has(entry.id)}
              onOpenDetail={onOpenDetail}
              onToggleChecked={onToggleChecked}
            />
          ))}
        </HooksBoardColumn>

        <HooksBoardColumn
          kind="enabled"
          title="Enabled everywhere"
          description="Active on every available harness."
          count={buckets.enabled.length}
          emptyMessage="No hooks are enabled everywhere yet."
        >
          {buckets.enabled.map((entry) => (
            <HooksBoardCard
              key={entry.id}
              entry={entry}
              columns={columns}
              pending={pendingHookKeys.has(entry.id)}
              checked={checkedIds.has(entry.id)}
              onOpenDetail={onOpenDetail}
              onToggleChecked={onToggleChecked}
            />
          ))}
        </HooksBoardColumn>
      </div>
    </DndContext>
  );
}

function HooksBoardColumn({
  kind,
  title,
  description,
  count,
  emptyMessage,
  children,
}: {
  kind: HooksBucket;
  title: string;
  description: string;
  count: number;
  emptyMessage: string;
  children: ReactNode;
}) {
  const labelId = `hooks-board-column-${kind}-label`;
  const isDropTarget = kind !== "selective";
  const { setNodeRef, isOver } = useDroppable({ id: kind, disabled: !isDropTarget });
  const { active } = useDndContext();
  const dragInProgress = active !== null;

  return (
    <div
      ref={setNodeRef}
      className={`board-column-slot board-column-slot--${kind}`}
      data-kind={kind}
      data-drop-active={isDropTarget && isOver ? "true" : undefined}
      data-drop-target={isDropTarget ? "true" : "false"}
      data-drag-global={dragInProgress ? "true" : undefined}
    >
      <section className={`board-column board-column--${kind}`} aria-labelledby={labelId}>
        <header className="board-column__head">
          <div className="board-column__title-row">
            <h3 className="board-column__title" id={labelId}>
              {title}
            </h3>
            <span className="board-column__count" aria-label={`${count} hooks`}>
              {count}
            </span>
          </div>
          <p className="board-column__description">{description}</p>
        </header>
        <div className="board-column__body">
          {count === 0 ? <p className="board-column__empty">{emptyMessage}</p> : children}
        </div>
      </section>
    </div>
  );
}

function HooksBoardCard({
  entry,
  columns,
  pending,
  checked,
  onOpenDetail,
  onToggleChecked,
}: {
  entry: HookInventoryEntryDto;
  columns: HookInventoryColumnDto[];
  pending: boolean;
  checked: boolean;
  onOpenDetail: (id: string) => void;
  onToggleChecked: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: entry.id,
    disabled: pending,
  });
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <article
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="skill-card skill-card--board"
      data-checked={checked}
      data-dragging={isDragging ? "true" : undefined}
      data-pending={pending ? "true" : undefined}
      style={style}
      onClick={() => {
        if (!isDragging) onOpenDetail(entry.id);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenDetail(entry.id);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="skill-card__head">
        <OverflowTooltipText as="h3" className="skill-card__name">
          {entry.displayName}
        </OverflowTooltipText>
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <CardSelectCheckbox
          checked={checked}
          onToggle={() => onToggleChecked(entry.id)}
          label={checked ? `Deselect ${entry.displayName}` : `Select ${entry.displayName}`}
          disabled={pending}
        />
      </div>

      <p className="skill-card__description skill-card__description--compact">
        <code>{entry.spec?.command ?? "—"}</code>
      </p>

      <HooksHarnessLogoStack bindings={entry.sightings} columns={columns} />
    </article>
  );
}
