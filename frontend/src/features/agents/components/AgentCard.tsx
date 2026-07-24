import { Bot, Terminal, Code2, Settings2, Sparkles, UserCheck } from "lucide-react";
import { OverflowTooltipText } from "../../../components/ui/OverflowTooltipText";
import type { AgentSummaryResponse } from "../api/types";

interface AgentCardProps {
  agent: AgentSummaryResponse;
  onHire: (agentRef: string) => void;
  onEdit: (agentRef: string) => void;
}

export function AgentCard({ agent, onHire, onEdit }: AgentCardProps) {
  return (
    <article
      className="skill-card agent-card-enhanced"
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "20px",
        borderRadius: "12px",
        background: "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.9) 100%)",
        border: "1px solid rgba(226, 232, 240, 0.8)",
        boxShadow: "0 4px 12px -2px rgba(0, 0, 0, 0.04), 0 2px 4px -1px rgba(0, 0, 0, 0.02)",
        transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative gradient bar on top edge */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "3px",
          background: "linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)",
        }}
      />

      <div>
        <div className="skill-card__head" style={{ marginBottom: "8px", alignItems: "flex-start" }}>
          <div>
            <OverflowTooltipText as="h3" className="skill-card__name" style={{ fontSize: "16px", fontWeight: 600, color: "#0f172a" }}>
              {agent.name || agent.slug}
            </OverflowTooltipText>
          </div>

          <button
            type="button"
            className="action-pill action-pill--sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(agent.ref);
            }}
            title="Manage Skills & MCPs"
            style={{
              padding: "4px 8px",
              fontSize: "11px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              backgroundColor: "#f1f5f9",
              border: "1px solid #cbd5e1",
              color: "#334155",
            }}
          >
            <Settings2 size={12} />
            Edit
          </button>
        </div>

        <p
          className="skill-card__description"
          style={{
            fontSize: "13px",
            lineHeight: "1.5",
            color: "#475569",
            margin: "8px 0 16px",
            minHeight: "38px",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {agent.description || "No description provided for this agent persona."}
        </p>

        {/* Connected Skills preview */}
        <div style={{ marginBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "#0284c7", display: "flex", alignItems: "center", gap: "4px" }}>
              <Bot size={12} />
              Connected Skills ({agent.skills.length})
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
            {agent.skills.length > 0 ? (
              agent.skills.slice(0, 3).map((skill) => (
                <span
                  key={skill}
                  style={{
                    fontSize: "11px",
                    padding: "2px 8px",
                    borderRadius: "12px",
                    backgroundColor: "#e0f2fe",
                    color: "#0369a1",
                    fontWeight: 500,
                  }}
                >
                  {skill.includes("/") ? skill.split("/").pop() : skill}
                </span>
              ))
            ) : (
              <span style={{ fontSize: "11px", color: "#94a3b8", fontStyle: "italic" }}>No skills attached</span>
            )}

            {agent.skills.length > 3 && (
              <span style={{ fontSize: "11px", padding: "2px 6px", color: "#64748b", fontWeight: 500 }}>
                +{agent.skills.length - 3} more
              </span>
            )}
          </div>
        </div>

        {/* Connected MCPs preview */}
        <div style={{ marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "#059669", display: "flex", alignItems: "center", gap: "4px" }}>
              <Terminal size={12} />
              Connected MCPs ({agent.mcps.length})
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
            {agent.mcps.length > 0 ? (
              agent.mcps.slice(0, 3).map((mcp) => (
                <span
                  key={mcp}
                  style={{
                    fontSize: "11px",
                    padding: "2px 8px",
                    borderRadius: "12px",
                    backgroundColor: "#d1fae5",
                    color: "#047857",
                    fontWeight: 500,
                  }}
                >
                  {mcp}
                </span>
              ))
            ) : (
              <span style={{ fontSize: "11px", color: "#94a3b8", fontStyle: "italic" }}>No MCPs attached</span>
            )}

            {agent.mcps.length > 3 && (
              <span style={{ fontSize: "11px", padding: "2px 6px", color: "#64748b", fontWeight: 500 }}>
                +{agent.mcps.length - 3} more
              </span>
            )}
          </div>
        </div>
      </div>

      <div
        className="skill-card__footer"
        style={{
          paddingTop: "12px",
          borderTop: "1px solid #f1f5f9",
          marginTop: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: "4px" }}>
          {agent.compileTargets.map((target) => (
            <span
              key={target}
              title={`Supports ${target}`}
              style={{
                fontSize: "10px",
                padding: "2px 6px",
                borderRadius: "4px",
                backgroundColor: "#f1f5f9",
                color: "#475569",
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: "3px",
              }}
            >
              <Code2 size={10} />
              {target}
            </span>
          ))}
        </div>

        <button
          type="button"
          className="action-pill action-pill--md action-pill--accent"
          onClick={() => onHire(agent.ref)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 14px",
            fontSize: "12px",
            fontWeight: 600,
            borderRadius: "8px",
            boxShadow: "0 2px 4px rgba(37, 99, 235, 0.15)",
          }}
        >
          <UserCheck size={14} />
          Hire Agent
        </button>
      </div>
    </article>
  );
}
