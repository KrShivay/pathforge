import { useEffect, useRef, useState, type ReactNode } from "react";

const A4_WIDTH_PX = (210 * 96) / 25.4;

interface A4PreviewSheetProps {
  children: ReactNode;
  className?: string;
}

/** Scales the fixed-width screen preview to its available viewport. */
export default function A4PreviewSheet({
  children,
  className = "",
}: A4PreviewSheetProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateScale = () => {
      setScale(Math.min(1, viewport.clientWidth / A4_WIDTH_PX));
    };

    updateScale();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateScale);
      return () => window.removeEventListener("resize", updateScale);
    }

    const observer = new ResizeObserver(updateScale);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={viewportRef}
      className={`a4-preview-viewport ${className}`.trim()}
    >
      <div className="a4-preview-sheet" style={{ zoom: scale }}>
        {children}
      </div>
    </div>
  );
}
