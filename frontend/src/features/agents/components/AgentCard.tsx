import { Bot, Terminal, Code2 } from "lucide-react";
import { OverflowTooltipText } from "../../../components/ui/OverflowTooltipText";
import type { AgentSummaryResponse } from "../api/types";

interface AgentCardProps {
  agent: AgentSummaryResponse;
  onHire: (agentRef: string) => void;
}

export function AgentCard({ agent, onHire }: AgentCardProps) {
  return (
    <article 
      className="skill-card" 
      role="button" 
      tabIndex={0} 
      onClick={() => onHire(agent.ref)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onHire(agent.ref);
        }
      }}
    >
      <div className="skill-card__head">
        <OverflowTooltipText as="h3" className="skill-card__name">
          {agent.name || agent.slug}
        </OverflowTooltipText>
        <span className="skill-card__version">{agent.packageSlug}</span>
      </div>
      {agent.description ? (
        <OverflowTooltipText as="p" className="skill-card__description">
          {agent.description}
        </OverflowTooltipText>
      ) : null}
      <div className="skill-card__footer" style={{ flexDirection: "column", alignItems: "flex-start", gap: "8px" }}>
        <div className="skill-card__tags">
          <span className="skill-card__tag">
            <Bot size={12} style={{ marginRight: 4 }} />
            {agent.skills.length} skills
          </span>
          <span className="skill-card__tag">
            <Terminal size={12} style={{ marginRight: 4 }} />
            {agent.mcps.length} MCPs
          </span>
        </div>
        <div className="skill-card__tags">
          {agent.compileTargets.map((target) => (
            <span key={target} className="skill-card__tag">
              <Code2 size={12} style={{ marginRight: 4 }} />
              {target}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}
