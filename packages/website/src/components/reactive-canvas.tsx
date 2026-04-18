import { type ReactNode, useEffect, useRef, useState } from 'react';

const MIN_SCALE = 0.1;
const MAX_SCALE = 5;

interface ZoomCanvasProps {
  children: ReactNode;
  contentWidth?: number;
  contentHeight?: number;
  className?: string;
}

export function ZoomCanvas({ children, contentWidth = 600, contentHeight = 400, className = '' }: ZoomCanvasProps) {
  const [scale, setScale] = useState(1);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();

      const factor = Math.exp(-e.deltaY * 0.001 * 2.5);

      setScale((prev) => {
        const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev * factor));
        const ratio = next / prev;

        const vw = el.clientWidth;
        const vh = el.clientHeight;

        requestAnimationFrame(() => {
          el.scrollLeft = (el.scrollLeft + vw / 2) * ratio - vw / 2;
          el.scrollTop = (el.scrollTop + vh / 2) * ratio - vh / 2;
        });

        return next;
      });
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  const scaledW = contentWidth * scale;
  const scaledH = contentHeight * scale;

  return (
    <div className={`relative w-full h-full ${className}`}>
      <div className="absolute bottom-6 right-6 z-10 pointer-events-none select-none bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500">
        {Math.round(scale * 100)}%
      </div>

      <div ref={viewportRef} className="absolute inset-0 overflow-auto">
        <div
          style={{
            width: `${scaledW}px`,
            height: `${scaledH}px`,
            minWidth: '100%',
            minHeight: '100%',
          }}
          className="flex items-center justify-center"
        >
          <div style={{ transform: `scale(${scale})` }} className="origin-center flex-shrink-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
