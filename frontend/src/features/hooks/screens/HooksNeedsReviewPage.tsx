import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { ErrorBanner } from "../../../components/ErrorBanner";
import { FilterBar } from "../../../components/FilterBar";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import { PageHeader } from "../../../components/PageHeader";
import { getHarnessPresentation } from "../../../components/harness/harnessPresentation";
import { OverflowTooltipText } from "../../../components/ui/OverflowTooltipText";
import { UiTooltip } from "../../../components/ui/UiTooltip";
import { hooksRoutes } from "../public";
import {
  useHooksInventoryQuery,
  usePromoteHookMutation,
} from "../api/management-queries";
import { filterHooksNeedsReview } from "../model/selectors";
import { HooksStatusChip } from "../components/HooksStatusChip";

export default function HooksNeedsReviewPage() {
  const inventoryQuery = useHooksInventoryQuery();
  const promoteMutation = usePromoteHookMutation();

  const [search, setSearch] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const inventory = inventoryQuery.data ?? null;
  const entries = useMemo(() => filterHooksNeedsReview(inventory, search), [inventory, search]);
  const totalReview = useMemo(() => filterHooksNeedsReview(inventory, "").length, [inventory]);
  const columns = inventory?.columns ?? [];
  const labelByHarness = useMemo(() => new Map(columns.map((c) => [c.harness, c.label])), [columns]);
  const logoByHarness = useMemo(
    () => new Map(columns.map((c) => [c.harness, c.logoKey ?? c.harness])),
    [columns],
  );

  const isInitialLoading = inventoryQuery.isPending && !inventory;
  const loadError = inventoryQuery.error instanceof Error ? inventoryQuery.error.message : "";

  const handlePromote = async (id: string) => {
    setPendingId(id);
    setErrorMessage("");
    try {
      await promoteMutation.mutateAsync({ id });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not promote hook");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <>
      <div className="page-chrome">
        <PageHeader
          title="Hooks to review"
          subtitle="Hooks found in your harness configs that skill-manager does not yet track. Promote the ones you want to manage globally."
        />
        {totalReview > 0 ? (
          <FilterBar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by event or command..."
            searchLabel="Search hooks to review"
          />
        ) : null}
      </div>

      {errorMessage ? <ErrorBanner message={errorMessage} onDismiss={() => setErrorMessage("")} /> : null}

      {isInitialLoading ? (
        <div className="panel-state">
          <LoadingSpinner size="md" label="Loading hooks" />
        </div>
      ) : loadError ? (
        <div className="panel-state">{loadError}</div>
      ) : totalReview === 0 ? (
        <div className="empty-panel">
          <h3 className="empty-panel__title">No hooks need review</h3>
          <p className="empty-panel__body">
            Your harness configs only reference hooks that skill-manager already tracks.
          </p>
          <div className="empty-panel__actions">
            <Link to={hooksRoutes.inUse} className="action-pill action-pill--md action-pill--accent">
              View Hooks in Use
            </Link>
          </div>
        </div>
      ) : entries.length === 0 ? (
        <div className="empty-panel">
          <h3 className="empty-panel__title">No matches</h3>
          <p className="empty-panel__body">Adjust the search to see other hooks.</p>
          <div className="empty-panel__actions">
            <button type="button" className="action-pill action-pill--md" onClick={() => setSearch("")}>
              Clear search
            </button>
          </div>
        </div>
      ) : (
        <div className="skill-grid">
          {entries.map((entry) => {
            const observed = entry.sightings.filter((b) => b.state === "unmanaged");
            const pending = pendingId === entry.id;
            return (
              <article key={entry.id} className="skill-card hook-card">
                <div className="skill-card__head hook-card__head">
                  <OverflowTooltipText as="h3" className="skill-card__name">
                    {entry.displayName}
                  </OverflowTooltipText>
                  {entry.spec && <HooksStatusChip event={entry.spec.event} />}
                </div>

                <p className="hook-card__command">
                  <code>{entry.spec?.command ?? "—"}</code>
                </p>

                <div className="skill-card__footer">
                  <div className="harness-stack" aria-label={`Found on ${observed.length} harness(es)`}>
                    {observed.map((binding, index) => {
                      const presentation = getHarnessPresentation(
                        logoByHarness.get(binding.harness) ?? null,
                      );
                      const label = labelByHarness.get(binding.harness) ?? binding.harness;
                      return (
                        <UiTooltip key={binding.harness} content={`Found in ${label} config`}>
                          <span
                            className="harness-stack__item"
                            style={{ zIndex: observed.length - index }}
                          >
                            {presentation ? (
                              <img src={presentation.logoSrc} alt="" aria-hidden="true" />
                            ) : (
                              <span className="harness-stack__fallback">{label.slice(0, 1)}</span>
                            )}
                          </span>
                        </UiTooltip>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    className="action-pill action-pill--accent"
                    disabled={pending}
                    onClick={() => void handlePromote(entry.id)}
                  >
                    {pending ? (
                      <Loader2 size={12} className="card-action-spinner" aria-hidden="true" />
                    ) : null}
                    Promote to global
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
