import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Bot, Loader2, Terminal, X } from "lucide-react";

import { useScaffoldAgentMutation } from "../api/queries";
import { useSkillsListQuery } from "../../skills/public";
import { useMcpInventoryQuery } from "../../mcp/public";
import { CapabilityTagPicker, type OptionItem } from "./CapabilityTagPicker";

import { useToast } from "../../../components/Toast";
import { ErrorBanner } from "../../../components/ErrorBanner";

interface CreateAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateAgentDialog({
  open,
  onOpenChange,
}: CreateAgentDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedMcps, setSelectedMcps] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const scaffoldMutation = useScaffoldAgentMutation();
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
    if (!open) return;
    setName("");
    setDescription("");
    setSelectedSkills([]);
    setSelectedMcps([]);
    setError(null);
  }, [open]);

  const canSubmit = name.trim().length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    try {
      const result = await scaffoldMutation.mutateAsync({
        asset_type: "agent",
        name: name.trim(),
        description: description.trim(),
        skills: selectedSkills,
        mcps: selectedMcps,
      });
      toast(`Successfully created agent ${name.trim()} at ${result.file_path}`);
      onOpenChange(false);
    } catch (err: any) {
      setError(err.detail ?? err.message ?? "An error occurred while creating the agent.");
    }
  }

  const isPending = scaffoldMutation.isPending;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content" style={{ maxWidth: "620px", width: "92vw" }} aria-describedby="create-agent-dialog-desc">
          <div className="dialog-header">
            <Dialog.Title className="dialog-title">
              Create New Agent Persona
            </Dialog.Title>
            <Dialog.Close className="dialog-close-btn" disabled={isPending}>
              <X size={18} />
            </Dialog.Close>
          </div>

          <div id="create-agent-dialog-desc" style={{ display: "none" }}>
            Scaffold a new agent persona in agents/.
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
                  placeholder="e.g. Code Reviewer"
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
                  placeholder="Describe the agent's purpose and capabilities..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isPending}
                  rows={3}
                />
              </label>

              <CapabilityTagPicker
                label="Connected Skills"
                icon={<Bot size={14} color="#0284c7" />}
                items={selectedSkills}
                availableOptions={availableSkillOptions}
                onAdd={(id) => setSelectedSkills((prev) => [...prev, id])}
                onRemove={(id) => setSelectedSkills((prev) => prev.filter((s) => s !== id))}
                placeholder="Search adopted skills..."
                emptyAvailableText="No remaining skills in app to attach"
              />

              <CapabilityTagPicker
                label="Connected MCPs"
                icon={<Terminal size={14} color="#059669" />}
                items={selectedMcps}
                availableOptions={availableMcpOptions}
                onAdd={(id) => setSelectedMcps((prev) => [...prev, id])}
                onRemove={(id) => setSelectedMcps((prev) => prev.filter((m) => m !== id))}
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
                {isPending ? <Loader2 className="animate-spin" size={16} /> : null}
                Create Agent
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
