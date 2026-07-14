import { useMemo, useState } from "react";
import { PageHeader } from "../../../components/PageHeader";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import { useAgentsQuery } from "../api/queries";
import { AgentCard } from "../components/AgentCard";
import { HireAgentDialog } from "../components/HireAgentDialog";
import { ErrorBanner } from "../../../components/ErrorBanner";
import { AlertTriangle } from "lucide-react";

export default function AgentsPage() {
  const { data, isLoading, error } = useAgentsQuery();
  const [selectedAgentRef, setSelectedAgentRef] = useState<string | null>(null);

  const selectedAgent = useMemo(() => {
    if (!data || !selectedAgentRef) return null;
    return data.agents.find(a => a.ref === selectedAgentRef) || null;
  }, [data, selectedAgentRef]);

  return (
    <>
      <div className="page-chrome">
        <PageHeader
          title="Agents"
          subtitle="Hire autonomous agents for your workspaces."
        />
      </div>

      {data?.issues && data.issues.length > 0 && (
        <div style={{ margin: "0 24px 16px", padding: "16px", backgroundColor: "#fff8f1", border: "1px solid #ffdec2", borderRadius: "6px", color: "#8a4d1f" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", fontWeight: 600 }}>
            <AlertTriangle size={16} />
            Review Issues
          </div>
          <ul style={{ margin: 0, paddingLeft: "24px" }}>
            {data.issues.map((issue, idx) => (
              <li key={idx}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      {error ? (
        <ErrorBanner message={error instanceof Error ? error.message : "Failed to load agents"} />
      ) : null}

      {isLoading ? (
        <div className="panel-state">
          <LoadingSpinner size="md" label="Loading agents..." />
        </div>
      ) : data ? (
        data.agents.length > 0 ? (
          <div className="skill-card-grid" style={{ padding: "0 24px 24px" }}>
            {data.agents.map((agent) => (
              <AgentCard
                key={agent.ref}
                agent={agent}
                onHire={(ref) => setSelectedAgentRef(ref)}
              />
            ))}
          </div>
        ) : (
          <div className="empty-panel">
            <h3 className="empty-panel__title">No Agents Found</h3>
            <p className="empty-panel__body">
              Agents live in <code>packages/&lt;slug&gt;/agents/*.md</code>. Add some agents to your packages to see them here.
            </p>
          </div>
        )
      ) : null}

      <HireAgentDialog
        agent={selectedAgent}
        open={selectedAgent !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedAgentRef(null);
        }}
      />
    </>
  );
}
