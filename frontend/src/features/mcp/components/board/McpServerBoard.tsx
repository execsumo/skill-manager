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
import type { McpInventoryColumnDto, McpInventoryEntryDto } from "../../api/management-types";
import { bucketForMcpEntry, bucketMcpEntries, type McpBucket } from "../../model/bucketForEntry";
import { McpHarnessLogoStack } from "../McpHarnessLogoStack";

interface McpServerBoardProps {
  entries: McpInventoryEntryDto[];
  columns: McpInventoryColumnDto[];
  pendingServerKeys: ReadonlySet<string>;
  checkedNames: ReadonlySet<string>;
  onOpenDetail: (name: string) => void;
  onToggleChecked: (name: string) => void;
  onSetHarnesses: (name: string, target: "enabled" | "disabled") => void;
}

type McpTerminalBucket = "disabled" | "enabled";

const TERMINAL_BUCKETS: ReadonlySet<McpBucket> = new Set(["disabled", "enabled"]);

function isTerminalBucket(value: unknown): value is McpTerminalBucket {
  return value === "disabled" || value === "enabled";
}

export function McpServerBoard({
  entries,
  columns,
  pendingServerKeys,
  checkedNames,
  onOpenDetail,
  onToggleChecked,
  onSetHarnesses,
}: McpServerBoardProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const buckets = useMemo(() => bucketMcpEntries(entries, columns), [entries, columns]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || !isTerminalBucket(over.id)) return;

      const name = String(active.id);
      const entry = entries.find((candidate) => candidate.name === name);
      if (!entry || pendingServerKeys.has(name)) return;

      const targetBucket = over.id;
      const currentBucket = bucketForMcpEntry(entry, columns);
      if (TERMINAL_BUCKETS.has(currentBucket) && currentBucket === targetBucket) return;
      if (targetBucket === "enabled" && !entry.canEnable) return;

      onSetHarnesses(name, targetBucket);
    },
    [columns, entries, onSetHarnesses, pendingServerKeys],
  );

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="skill-board" role="group" aria-label="MCP servers board">
        <McpBoardColumn
          kind="disabled"
          title="Disabled everywhere"
          description="Not active on any harness."
          count={buckets.disabled.length}
          emptyMessage="No MCP servers are disabled everywhere."
        >
          {buckets.disabled.map((entry) => (
            <McpBoardCard
              key={entry.name}
              entry={entry}
              columns={columns}
              pending={pendingServerKeys.has(entry.name)}
              checked={checkedNames.has(entry.name)}
              onOpenDetail={onOpenDetail}
              onToggleChecked={onToggleChecked}
            />
          ))}
        </McpBoardColumn>

        <McpBoardColumn
          kind="selective"
          title="Selective"
          description="Enabled on some harnesses, not others."
          count={buckets.selective.length}
          emptyMessage="No MCP servers are partially enabled. Open a card to pick specific harnesses."
        >
          {buckets.selective.map((entry) => (
            <McpBoardCard
              key={entry.name}
              entry={entry}
              columns={columns}
              pending={pendingServerKeys.has(entry.name)}
              checked={checkedNames.has(entry.name)}
              onOpenDetail={onOpenDetail}
              onToggleChecked={onToggleChecked}
            />
          ))}
        </McpBoardColumn>

        <McpBoardColumn
          kind="enabled"
          title="Enabled everywhere"
          description="Active on every available harness."
          count={buckets.enabled.length}
          emptyMessage="No MCP servers are enabled everywhere yet."
        >
          {buckets.enabled.map((entry) => (
            <McpBoardCard
              key={entry.name}
              entry={entry}
              columns={columns}
              pending={pendingServerKeys.has(entry.name)}
              checked={checkedNames.has(entry.name)}
              onOpenDetail={onOpenDetail}
              onToggleChecked={onToggleChecked}
            />
          ))}
        </McpBoardColumn>
      </div>
    </DndContext>
  );
}

function McpBoardColumn({
  kind,
  title,
  description,
  count,
  emptyMessage,
  children,
}: {
  kind: McpBucket;
  title: string;
  description: string;
  count: number;
  emptyMessage: string;
  children: ReactNode;
}) {
  const labelId = `mcp-board-column-${kind}-label`;
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
            <span className="board-column__count" aria-label={`${count} MCP servers`}>
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

function McpBoardCard({
  entry,
  columns,
  pending,
  checked,
  onOpenDetail,
  onToggleChecked,
}: {
  entry: McpInventoryEntryDto;
  columns: McpInventoryColumnDto[];
  pending: boolean;
  checked: boolean;
  onOpenDetail: (name: string) => void;
  onToggleChecked: (name: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: entry.name,
    disabled: pending,
  });
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
  };
  const transport = entry.spec?.transport ?? "—";

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
        if (!isDragging) onOpenDetail(entry.name);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenDetail(entry.name);
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
          onToggle={() => onToggleChecked(entry.name)}
          label={checked ? `Deselect ${entry.displayName}` : `Select ${entry.displayName}`}
          disabled={pending}
        />
      </div>

      <p className="skill-card__description skill-card__description--compact">
        <code>{entry.name}</code> · {transport}
      </p>

      <McpHarnessLogoStack bindings={entry.sightings} columns={columns} />
    </article>
  );
}
