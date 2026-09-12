type NativeMenuAction =
  | "undo"
  | "redo"
  | "cut"
  | "copy"
  | "paste"
  | "selectAll";

declare global {
  interface Window {
    __pathforgeNativeMenuAction?: (action: NativeMenuAction) => void;
  }
}

function getActiveTextTarget() {
  const activeElement = document.activeElement;

  if (
    activeElement instanceof HTMLInputElement ||
    activeElement instanceof HTMLTextAreaElement ||
    (activeElement instanceof HTMLElement && activeElement.isContentEditable)
  ) {
    return activeElement;
  }

  return null;
}

function insertClipboardText(target: HTMLInputElement | HTMLTextAreaElement, text: string) {
  const start = target.selectionStart ?? target.value.length;
  const end = target.selectionEnd ?? target.value.length;
  target.setRangeText(text, start, end, "end");
  target.dispatchEvent(new Event("input", { bubbles: true }));
}

function handleNativeMenuAction(action: NativeMenuAction) {
  const target = getActiveTextTarget();

  if (action === "selectAll") {
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      target.select();
    } else {
      document.execCommand("selectAll");
    }
    return;
  }

  if (action === "paste") {
    if (!target) return;

    void navigator.clipboard
      ?.readText()
      .then((text) => {
        if (document.activeElement !== target) return;

        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
          insertClipboardText(target, text);
        } else {
          document.execCommand("insertText", false, text);
        }
      })
      .catch(() => {
        document.execCommand("paste");
      });
    return;
  }

  document.execCommand(action);
}

window.__pathforgeNativeMenuAction = handleNativeMenuAction;

export {};
