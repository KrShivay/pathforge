import { ArrowRight, Lock, LogIn, Unlock } from "lucide-react";
import type { RefObject } from "react";
import { useBranding } from "../../store/BrandingContext";
import { getUsableLogoDataUrl } from "../../store/branding";

export type WorkspaceGateKind = "entry" | "locked";

interface WorkspaceGateProps {
  kind: WorkspaceGateKind;
  actionRef: RefObject<HTMLButtonElement | null>;
  onAction: () => void;
}

const GATE_CONTENT = {
  entry: {
    mark: LogIn,
    actionIcon: ArrowRight,
    title: "Welcome",
    copy: "Enter the workspace to start your pathology report workflow.",
    action: "Enter workspace",
  },
  locked: {
    mark: Lock,
    actionIcon: Unlock,
    title: "Workspace locked",
    copy: "Report work is paused while the workspace is locked. Unlock to return to your report workflow.",
    action: "Unlock workspace",
  },
} as const;

export default function WorkspaceGate({
  kind,
  actionRef,
  onAction,
}: WorkspaceGateProps) {
  // The entry screen greets the laboratory by its own name and mark.
  const { profile } = useBranding();
  const gateLogoUrl = getUsableLogoDataUrl(profile.logoDataUrl);
  const laboratoryName = profile.laboratoryName || "the workspace";
  const content = GATE_CONTENT[kind];
  const MarkIcon = content.mark;
  const ActionIcon = content.actionIcon;
  const titleId = `workspace-${kind}-title`;

  return (
    <section
      className={`quiet-mode quiet-mode-${kind}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key === "Tab") event.preventDefault();
      }}
    >
      <div className="quiet-mode-stars" aria-hidden="true" />
      <div className="quiet-mode-orbit quiet-mode-orbit-one" aria-hidden="true" />
      <div className="quiet-mode-orbit quiet-mode-orbit-two" aria-hidden="true" />
      <div className="quiet-mode-content">
        <span className={`quiet-mode-mark${gateLogoUrl ? " has-logo" : ""}`} aria-hidden="true">
          {gateLogoUrl ? <img src={gateLogoUrl} alt="" /> : <MarkIcon size={21} />}
        </span>
        <p className="quiet-mode-kicker">{profile.reportSubtitle || "Pathology workspace"}</p>
        <h1 id={titleId}>
          {kind === "entry" ? `${content.title} to ${laboratoryName}` : content.title}
        </h1>
        <p className="quiet-mode-copy">{content.copy}</p>
        <button
          ref={actionRef}
          type="button"
          className="quiet-mode-open"
          onClick={onAction}
        >
          <span className="quiet-mode-open-icon" aria-hidden="true">
            <ActionIcon size={17} />
          </span>
          {content.action}
        </button>
      </div>
    </section>
  );
}
