import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, X } from 'lucide-react';

import { Button } from './ui/button';

const isTauri = () => '__TAURI_INTERNALS__' in window;

export function TitleBar() {
  const runWindowCommand = async (command: 'minimize' | 'maximize' | 'close') => {
    if (!isTauri()) return;
    const windowHandle = getCurrentWindow();
    if (command === 'minimize') await windowHandle.minimize();
    if (command === 'maximize') await windowHandle.toggleMaximize();
    if (command === 'close') await windowHandle.close();
  };

  return (
    <header className="titlebar" data-tauri-drag-region>
      <div className="flex min-w-0 items-center gap-2 px-2.5" data-tauri-drag-region>
        <span className="grid size-[18px] place-items-center rounded-[3px] bg-[var(--pf-accent)] text-white">
          <span className="size-2 rotate-45 border-2 border-white" />
        </span>
        <span className="truncate text-xs" data-tauri-drag-region>
          PathForge <span className="text-[var(--pf-text-secondary)]">- Clinical pathology report workstation</span>
        </span>
      </div>
      <div className="grid grid-cols-3">
        <Button aria-label="Minimize" className="caption-button" onClick={() => void runWindowCommand('minimize')} size="icon" variant="ghost"><Minus /></Button>
        <Button aria-label="Maximize" className="caption-button" onClick={() => void runWindowCommand('maximize')} size="icon" variant="ghost"><Square /></Button>
        <Button aria-label="Close" className="caption-button caption-close" onClick={() => void runWindowCommand('close')} size="icon" variant="ghost"><X /></Button>
      </div>
    </header>
  );
}
