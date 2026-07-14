import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Bot, Loader2, Save, Terminal, X } from "lucide-react";

import { useUpdateAgentMutation } from "../api/queries";
import type { AgentSummaryResponse } from "../api/types";
import { useSkillsListQuery } from "../../skills/public";
import { useMcpInventoryQuery } from "../../mcp/public";
import { CapabilityTagPicker, type OptionItem } from "./CapabilityTagPicker";

import { useToast } from "../../../components/Toast";
import { ErrorBanner } from "../../../components/ErrorBanner";

interface EditAgentDialogProps {
  agent: AgentSummaryResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditAgentDialog({
  agent,
  open,
  onOpenChange,
}: EditAgentDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [mcps, setMcps] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { toast } = useToast();
  const updateMutation = useUpdateAgentMutation();

  const { data: skillsPage } = useSkillsListQuery();
  const { data: mcpInventory } = useMcpInventoryQuery();

  const availableSkillOptions: OptionItem[] = useMemo(() => {
    if (!skillsPage?.rows) return [];
    return skillsPage.rows.map((row) => ({
      id: row.skillRef,
      label: row.name || row.skillRef,
      subtext: row.description || undefined,
    }));
  }, [skillsPage]);

  const availableMcpOptions: OptionItem[] = useMemo(() => {
    if (!mcpInventory?.entries) return [];
    return mcpInventory.entries.map((entry) => ({
      id: entry.name,
      label: entry.displayName || entry.name,
      subtext: entry.mcpStatus?.kind || undefined,
    }));
  }, [mcpInventory]);



  useEffect(() => {
    if (!open || !agent) return;
    setName(agent.name || agent.slug);
    setDescription(agent.description || "");
    setSkills(agent.skills || []);
    setMcps(agent.mcps || []);
    setError(null);
  }, [open, agent]);

  const canSubmit = name.trim().length > 0;
  const isPending = updateMutation.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agent || !canSubmit) return;
    setError(null);
    try {
      await updateMutation.mutateAsync({
        agentRef: agent.ref,
        request: {
          name: name.trim(),
          description: description.trim(),
          skills,
          mcps,
        },
      });
      toast(`Successfully updated ${name.trim()}`);
      onOpenChange(false);
    } catch (err: any) {
      setError(err.detail ?? err.message ?? "An error occurred while updating the agent.");
    }
  }

  return (
    <Dialog.Root open={open && agent !== null} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content" style={{ maxWidth: "620px", width: "92vw" }} aria-describedby="edit-agent-dialog-desc">
          <div className="dialog-header">
            <Dialog.Title className="dialog-title">
              Manage Agent Capabilities: {agent?.name || agent?.slug}
            </Dialog.Title>
            <Dialog.Close className="dialog-close-btn" disabled={isPending}>
              <X size={18} />
            </Dialog.Close>
          </div>

          <div id="edit-agent-dialog-desc" style={{ display: "none" }}>
            Add or remove connected Skills & MCPs, and edit details for this agent.
          </div>

          <form onSubmit={handleSubmit} className="dialog-form" style={{ marginTop: "16px" }}>
            <div className="dialog-form-fields" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {error && (
                <ErrorBanner message={error} onDismiss={() => setError(null)} />
              )}

              <label className="form-field">
                <span className="form-field__label">Agent Name *</span>
                <input
                  type="text"
                  className="form-field__input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isPending}
                  required
                />
              </label>

              <label className="form-field">
                <span className="form-field__label">Description</span>
                <textarea
                  className="form-field__textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isPending}
                  rows={3}
                />
              </label>

              <CapabilityTagPicker
                label="Connected Skills"
                icon={<Bot size={14} color="#0284c7" />}
                items={skills}
                availableOptions={availableSkillOptions}
                onAdd={(id) => setSkills((prev) => [...prev, id])}
                onRemove={(id) => setSkills((prev) => prev.filter((s) => s !== id))}
                placeholder="Search skills in app..."
                emptyAvailableText="No remaining skills in app to attach"
              />

              <CapabilityTagPicker
                label="Connected MCPs"
                icon={<Terminal size={14} color="#059669" />}
                items={mcps}
                availableOptions={availableMcpOptions}
                onAdd={(id) => setMcps((prev) => [...prev, id])}
                onRemove={(id) => setMcps((prev) => prev.filter((m) => m !== id))}
                placeholder="Search active MCP servers..."
                emptyAvailableText="No remaining MCP servers in app to attach"
              />
            </div>

            <div className="dialog-footer" style={{ marginTop: "24px" }}>
              <Dialog.Close asChild>
                <button type="button" className="action-pill action-pill--md" disabled={isPending}>
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                className="action-pill action-pill--md action-pill--accent"
                disabled={!canSubmit || isPending}
              >
                {isPending ? <Loader2 className="animate-spin" size={16} /> : <Save size={14} style={{ marginRight: 4 }} />}
                Save Capabilities
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
