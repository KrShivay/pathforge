import Swal, { type SweetAlertIcon, type SweetAlertResult } from "sweetalert2";

/**
 * The one PathForge dialog theme. Every Swal.fire() in the app goes through a
 * helper here so popups share one clinical, white, restrained look — no
 * per-call styling, no native browser alert/confirm anywhere.
 *
 * `buttonsStyling: false` hands all button appearance to the .pf-swal-* CSS in
 * index.css; `customClass` maps each Swal part onto those classes.
 *
 * Every helper sets `showConfirmButton` / `showDenyButton` / `showCancelButton`
 * explicitly. Only confirmations show a Cancel/No; success and info
 * notifications show a single OK.
 */
const BASE_CLASSES = {
  container: "pf-swal",
  popup: "pf-swal-popup",
  title: "pf-swal-title",
  htmlContainer: "pf-swal-html",
  actions: "pf-swal-actions",
  closeButton: "pf-swal-close",
  icon: "pf-swal-icon",
  confirmButton: "pf-swal-btn pf-swal-btn--primary",
  denyButton: "pf-swal-btn pf-swal-btn--secondary",
  cancelButton: "pf-swal-btn pf-swal-btn--ghost",
} as const;

export const dialog = Swal.mixin({
  buttonsStyling: false,
  reverseButtons: true,
  focusConfirm: false,
  showCloseButton: true,
  closeButtonHtml: "&times;",
  backdrop: "rgba(15, 23, 42, 0.45)",
  showClass: { popup: "pf-swal-in", backdrop: "pf-swal-backdrop-in" },
  hideClass: { popup: "pf-swal-out", backdrop: "pf-swal-backdrop-out" },
  customClass: BASE_CLASSES,
});

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

// --- shared inline icons (lucide geometry, sized for buttons) -----------------
const ICONS = {
  download:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  printer:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
} as const;

// --- simple notifications ---------------------------------------------------
// One action button ("OK") and the X. Never a Cancel or "No". No auto-close.
interface NotifyOptions {
  title: string;
  text?: string;
}

function notify(icon: SweetAlertIcon, options: NotifyOptions) {
  return dialog.fire({
    icon,
    title: options.title,
    text: options.text,
    showConfirmButton: true,
    showDenyButton: false,
    showCancelButton: false,
    confirmButtonText: "OK",
  });
}

export const notifySuccess = (o: NotifyOptions) => notify("success", o);
export const notifyError = (o: NotifyOptions) => notify("error", o);
export const notifyWarning = (o: NotifyOptions) => notify("warning", o);
export const notifyInfo = (o: NotifyOptions) => notify("info", o);

/** Error dialog with a bulleted list of problems (e.g. validation failures). */
export function notifyErrorList(title: string, messages: string[]) {
  return dialog.fire({
    icon: "error",
    title,
    html: `<ul class="pf-swal-list">${messages
      .map((message) => `<li>${escapeHtml(message)}</li>`)
      .join("")}</ul>`,
    showConfirmButton: true,
    showDenyButton: false,
    showCancelButton: false,
    confirmButtonText: "OK",
  });
}

// --- confirmations --------------------------------------------------------
// Two buttons: a Cancel and the action. The X / Esc / backdrop also cancel.
interface ConfirmOptions {
  title: string;
  text?: string;
  html?: string;
  confirmText?: string;
  cancelText?: string;
  icon?: SweetAlertIcon;
}

/** Neutral confirm. Returns true only when the action button is pressed. */
export async function confirmAction(options: ConfirmOptions): Promise<boolean> {
  const result = await dialog.fire({
    icon: options.icon ?? "question",
    title: options.title,
    text: options.text,
    html: options.html,
    showConfirmButton: true,
    showDenyButton: false,
    showCancelButton: true,
    confirmButtonText: options.confirmText ?? "Continue",
    cancelButtonText: options.cancelText ?? "Cancel",
  });
  return result.isConfirmed;
}

/** Destructive confirm — red action button, plus a Cancel. */
export async function confirmDestructive(
  options: ConfirmOptions,
): Promise<boolean> {
  const result = await dialog.fire({
    icon: options.icon ?? "warning",
    title: options.title,
    text: options.text,
    html: options.html,
    showConfirmButton: true,
    showDenyButton: false,
    showCancelButton: true,
    confirmButtonText: options.confirmText ?? "Delete",
    cancelButtonText: options.cancelText ?? "Cancel",
    customClass: {
      ...BASE_CLASSES,
      confirmButton: "pf-swal-btn pf-swal-btn--danger",
    },
  });
  return result.isConfirmed;
}

/** Single-line / multi-line text prompt. Returns the trimmed value or null. */
export async function promptText(options: {
  title: string;
  label: string;
  placeholder?: string;
  confirmText?: string;
  multiline?: boolean;
  requiredMessage?: string;
}): Promise<string | null> {
  const result = await dialog.fire<string>({
    icon: "question",
    title: options.title,
    input: options.multiline ? "textarea" : "text",
    inputLabel: options.label,
    inputPlaceholder: options.placeholder,
    inputAttributes: { "aria-label": options.label },
    showConfirmButton: true,
    showDenyButton: false,
    showCancelButton: true,
    confirmButtonText: options.confirmText ?? "Confirm",
    cancelButtonText: "Cancel",
    inputValidator: (value: string) =>
      value && value.trim()
        ? undefined
        : (options.requiredMessage ?? "This field is required."),
  });
  const value = result.value?.trim();
  return result.isConfirmed && value ? value : null;
}

// --- the finalized-report dialog -----------------------------------------
export type FinalizedChoice = "download" | "print" | "close";

interface FinalizedDialogInput {
  reportNo: string;
  version: number | string;
  finalizedOn: string;
}

/**
 * "Report finalized" dialog — matches the PathForge reference layout: green
 * success mark, locked-report note, a metadata card, a divider, then
 * Download PDF (primary) + Print Report (secondary) on one row and Close as a
 * light action below. The X closes without running either action.
 */
export async function showFinalizedDialog(
  input: FinalizedDialogInput,
): Promise<FinalizedChoice> {
  const card = `
    <p class="pf-swal-lead">This report is locked. Use an amendment to make changes.</p>
    <dl class="pf-swal-card">
      <div><dt>Version</dt><dd>${escapeHtml(input.version)}</dd></div>
      <div><dt>Finalized on</dt><dd>${escapeHtml(input.finalizedOn)}</dd></div>
    </dl>`;

  const result: SweetAlertResult = await dialog.fire({
    icon: "success",
    title: "Report finalized",
    html: card,
    showConfirmButton: true,
    showDenyButton: true,
    showCancelButton: true,
    reverseButtons: false,
    confirmButtonText: `${ICONS.download}<span>Download PDF</span>`,
    denyButtonText: `${ICONS.printer}<span>Print Report</span>`,
    cancelButtonText: "Close",
    customClass: {
      ...BASE_CLASSES,
      actions: "pf-swal-actions pf-swal-actions--finalized",
      confirmButton: "pf-swal-btn pf-swal-btn--primary pf-swal-btn--icon",
      denyButton: "pf-swal-btn pf-swal-btn--secondary pf-swal-btn--icon",
      cancelButton: "pf-swal-btn pf-swal-btn--ghost pf-swal-btn--close",
    },
  });

  if (result.isConfirmed) return "download";
  if (result.isDenied) return "print";
  return "close";
}
