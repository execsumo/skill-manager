import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X } from "lucide-react";

const SUPPORTED_EVENTS = [
  "SessionStart",
  "Setup",
  "InstructionsLoaded",
  "UserPromptSubmit",
  "UserPromptExpansion",
  "MessageDisplay",
  "PreToolUse",
  "PermissionRequest",
  "PostToolUse",
  "PostToolUseFailure",
  "PostToolBatch",
  "PermissionDenied",
  "Notification",
  "SubagentStart",
  "SubagentStop",
  "TaskCreated",
  "TaskCompleted",
  "Stop",
  "StopFailure",
  "TeammateIdle",
  "ConfigChange",
  "CwdChanged",
  "FileChanged",
  "WorktreeCreate",
  "WorktreeRemove",
  "PreCompact",
  "PostCompact",
  "SessionEnd",
  "Elicitation",
  "ElicitationResult",
];

interface HookFormValue {
  id: string;
  event: string;
  command: string;
  matcher: string | null;
  timeout: number | null;
  description: string;
}

interface HookFormDialogProps {
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: HookFormValue) => Promise<void> | void;
}

export function HookFormDialog({
  open,
  pending,
  onOpenChange,
  onSubmit,
}: HookFormDialogProps) {
  const [id, setId] = useState("");
  const [event, setEvent] = useState("PreToolUse");
  const [command, setCommand] = useState("");
  const [matcher, setMatcher] = useState("");
  const [timeoutStr, setTimeoutStr] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    setId("");
    setEvent("PreToolUse");
    setCommand("");
    setMatcher("");
    setTimeoutStr("");
    setDescription("");
  }, [open]);

  const canSubmit = id.trim() && event.trim() && command.trim();

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!canSubmit) return;
    const timeoutVal = timeoutStr.trim() ? parseInt(timeoutStr, 10) : null;
    await onSubmit({
      id: id.trim(),
      event,
      command: command.trim(),
      matcher: matcher.trim() || null,
      timeout: isNaN(Number(timeoutVal)) ? null : timeoutVal,
      description: description.trim(),
    });
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!pending) onOpenChange(nextOpen);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content" aria-describedby="hook-form-dialog-desc">
          <div className="dialog-header">
            <Dialog.Title className="dialog-title">
              Add Hook
            </Dialog.Title>
            <Dialog.Close className="dialog-close-btn" disabled={pending}>
              <X size={18} />
            </Dialog.Close>
          </div>

          <div id="hook-form-dialog-desc" style={{ display: "none" }}>
            Add a new hook configurations that will run command on specified life cycle event.
          </div>

          <form onSubmit={handleSubmit} className="dialog-form">
            <div className="dialog-form-fields">
              <label className="form-field">
                <span className="form-field__label">Hook ID *</span>
                <input
                  type="text"
                  className="form-field__input"
                  placeholder="e.g. format-json-hook"
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  disabled={pending}
                  required
                />
              </label>

              <label className="form-field">
                <span className="form-field__label">Event *</span>
                <select
                  className="form-field__select"
                  value={event}
                  onChange={(e) => setEvent(e.target.value)}
                  disabled={pending}
                  required
                >
                  {SUPPORTED_EVENTS.map((evt) => (
                    <option key={evt} value={evt}>
                      {evt}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <span className="form-field__label">Matcher (optional, e.g. command tool name regex)</span>
                <input
                  type="text"
                  className="form-field__input"
                  placeholder="e.g. Bash"
                  value={matcher}
                  onChange={(e) => setMatcher(e.target.value)}
                  disabled={pending}
                />
              </label>

              <label className="form-field">
                <span className="form-field__label">Command *</span>
                <input
                  type="text"
                  className="form-field__input"
                  placeholder="e.g. /path/to/formatter.sh"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  disabled={pending}
                  required
                />
              </label>

              <label className="form-field">
                <span className="form-field__label">Timeout (seconds, optional)</span>
                <input
                  type="number"
                  className="form-field__input"
                  placeholder="e.g. 60"
                  value={timeoutStr}
                  onChange={(e) => setTimeoutStr(e.target.value)}
                  disabled={pending}
                />
              </label>

              <label className="form-field">
                <span className="form-field__label">Description</span>
                <textarea
                  className="form-field__textarea"
                  placeholder="Describe what this hook does..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={pending}
                  rows={3}
                />
              </label>
            </div>

            <div className="dialog-footer">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="action-pill action-pill--md"
                  disabled={pending}
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                className="action-pill action-pill--md action-pill--accent"
                disabled={!canSubmit || pending}
              >
                {pending ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Adding...
                  </>
                ) : (
                  "Add Hook"
                )}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
