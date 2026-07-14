import { useEffect, useState, useMemo } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X, AlertTriangle } from "lucide-react";

import { useCompileAgentMutation } from "../api/queries";
import type { AgentSummaryResponse, CompileAgentResponse } from "../api/types";
import { useToast } from "../../../components/Toast";
import { ErrorBanner } from "../../../components/ErrorBanner";

interface HireAgentDialogProps {
  agent: AgentSummaryResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HireAgentDialog({
  agent,
  open,
  onOpenChange,
}: HireAgentDialogProps) {
  const [harness, setHarness] = useState("cursor");
  const [projectDir, setProjectDir] = useState("");
  const [previewResult, setPreviewResult] = useState<CompileAgentResponse | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const { toast } = useToast();

  const compileMutation = useCompileAgentMutation();

  useEffect(() => {
    if (!open || !agent) return;
    setHarness(agent.compileTargets[0] ?? "cursor");
    setProjectDir("");
    setPreviewResult(null);
    setPreviewError(null);
  }, [open, agent]);

  const canPreview = harness !== "cursor" || projectDir.trim().length > 0;

  async function handlePreview(e: React.MouseEvent) {
    e.preventDefault();
    if (!agent || !canPreview) return;
    setPreviewError(null);
    try {
      const result = await compileMutation.mutateAsync({
        agentRef: agent.ref,
        request: {
          harness,
          projectDir: harness === "cursor" ? projectDir.trim() : undefined,
          dryRun: true,
        },
      });
      setPreviewResult(result);
    } catch (err: any) {
      setPreviewError(err.detail ?? err.message ?? "An error occurred");
    }
  }

  async function handleHire(e: React.FormEvent) {
    e.preventDefault();
    if (!agent || !canPreview) return;
    setPreviewError(null);
    try {
      const result = await compileMutation.mutateAsync({
        agentRef: agent.ref,
        request: {
          harness,
          projectDir: harness === "cursor" ? projectDir.trim() : undefined,
          dryRun: false,
        },
      });
      toast(`Successfully hired agent. Written to ${result.targetPath}`);
      onOpenChange(false);
    } catch (err: any) {
      setPreviewError(err.detail ?? err.message ?? "An error occurred");
    }
  }

  const isPending = compileMutation.isPending;

  return (
    <Dialog.Root open={open && agent !== null} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content" style={{ maxWidth: "800px", width: "90vw" }}>
          <div className="dialog-header">
            <Dialog.Title className="dialog-title">
              Hire Agent: {agent?.name || agent?.slug}
            </Dialog.Title>
            <Dialog.Close className="dialog-close-btn" disabled={isPending}>
              <X size={18} />
            </Dialog.Close>
          </div>

          <form onSubmit={handleHire} className="dialog-form" style={{ marginTop: "16px" }}>
            <div className="dialog-form-fields">
              {previewError && (
                <ErrorBanner message={previewError} onDismiss={() => setPreviewError(null)} />
              )}
              
              <div style={{ display: "flex", gap: "16px" }}>
                <label className="form-field" style={{ flex: 1 }}>
                  <span className="form-field__label">Target Harness *</span>
                  <select
                    className="form-field__select"
                    value={harness}
                    onChange={(e) => {
                      setHarness(e.target.value);
                      setPreviewResult(null);
                      setPreviewError(null);
                    }}
                    disabled={isPending}
                  >
                    {agent?.compileTargets?.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </label>
                
                {harness === "cursor" && (
                  <label className="form-field" style={{ flex: 2 }}>
                    <span className="form-field__label">Project Directory (Absolute Path) *</span>
                    <input
                      type="text"
                      className="form-field__input"
                      placeholder="/Users/hgill/projects/my-app"
                      value={projectDir}
                      onChange={(e) => {
                        setProjectDir(e.target.value);
                        setPreviewResult(null);
                        setPreviewError(null);
                      }}
                      disabled={isPending}
                      required
                    />
                  </label>
                )}
              </div>
            </div>

            {previewResult && (
              <div style={{ marginTop: "24px" }}>
                <h4 style={{ marginBottom: "8px", fontSize: "14px", fontWeight: 600 }}>Preview</h4>
                {previewResult.degradations && previewResult.degradations.length > 0 && (
                  <div style={{ padding: "12px", backgroundColor: "#fff8f1", border: "1px solid #ffdec2", borderRadius: "6px", marginBottom: "16px", color: "#8a4d1f" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", fontWeight: 600 }}>
                      <AlertTriangle size={16} />
                      Degradations
                    </div>
                    <ul style={{ margin: 0, paddingLeft: "24px" }}>
                      {previewResult.degradations.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {previewResult.resolvedSkills && previewResult.resolvedSkills.length > 0 && (
                  <div style={{ marginBottom: "16px" }}>
                    <h5 style={{ fontSize: "12px", fontWeight: 600, color: "#666", marginBottom: "4px" }}>Resolved Skills:</h5>
                    <div className="skill-card__tags">
                      {previewResult.resolvedSkills.map((s) => (
                        <span key={s.alias} className="skill-card__tag">
                          {s.alias} @ {s.revision.substring(0, 12)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {previewResult.content && (
                  <pre style={{ padding: "16px", backgroundColor: "#f6f8fa", borderRadius: "6px", overflowX: "auto", fontSize: "12px", maxHeight: "400px", border: "1px solid #e1e4e8" }}>
                    {previewResult.content}
                  </pre>
                )}
              </div>
            )}

            <div className="dialog-footer" style={{ marginTop: "24px" }}>
              <Dialog.Close asChild>
                <button type="button" className="action-pill action-pill--md" disabled={isPending}>
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="button"
                className="action-pill action-pill--md"
                disabled={!canPreview || isPending}
                onClick={handlePreview}
              >
                {isPending && !previewResult ? <Loader2 className="animate-spin" size={16} /> : null}
                Preview
              </button>
              <button
                type="submit"
                className="action-pill action-pill--md action-pill--accent"
                disabled={!canPreview || isPending || !previewResult}
              >
                {isPending && previewResult ? <Loader2 className="animate-spin" size={16} /> : null}
                Hire Agent
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
