import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import mermaid from "mermaid";
import { exportPng, exportSvg } from "../lib/download";

interface MermaidCanvasProps {
  diagram: string;
  /** Used to derive export filenames. */
  title: string;
}

interface ViewState {
  x: number;
  y: number;
  scale: number;
}

const MIN_SCALE = 0.1;
const MAX_SCALE = 8;

function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

let mermaidInitialized = false;

function ensureMermaidInit(): void {
  if (mermaidInitialized) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: "dark",
    themeVariables: {
      darkMode: true,
      background: "#0a0e17",
      primaryColor: "#1e293b",
      primaryTextColor: "#f1f5f9",
      lineColor: "#64748b"
    }
  });
  mermaidInitialized = true;
}

export function MermaidCanvas({ diagram, title }: MermaidCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const [view, setView] = useState<ViewState>({ x: 0, y: 0, scale: 1 });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Render the mermaid diagram whenever the source changes.
  useEffect(() => {
    ensureMermaidInit();
    setError(null);
    let cancelled = false;

    const node = contentRef.current;
    if (!node) return;

    node.innerHTML = "";
    svgRef.current = null;
    const id = `mermaid-${Date.now()}-${Math.round(Math.random() * 1e6)}`;

    mermaid
      .render(id, diagram)
      .then(({ svg }) => {
        if (cancelled || !contentRef.current) return;
        contentRef.current.innerHTML = svg;
        svgRef.current = contentRef.current.querySelector("svg");
      })
      .catch((err: unknown) => {
        if (cancelled || !contentRef.current) return;
        const message = err instanceof Error ? err.message : String(err);
        contentRef.current.innerHTML = `<pre class="mermaid-error">Mermaid Render Error:\n${message}</pre>`;
        setError(message);
      });

    return () => {
      cancelled = true;
    };
  }, [diagram]);

  // Auto-fit to the freshly rendered diagram without viewport jitter.
  useEffect(() => {
    if (error) return;
    const content = contentRef.current;
    const container = containerRef.current;
    if (!content || !container) return;

    // Wait a tick for layout to settle after innerHTML injection.
    const raf = requestAnimationFrame(() => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const sw = content.scrollWidth || cw;
      const sh = content.scrollHeight || ch;
      const scale = clampScale(Math.min(cw / sw, ch / sh, 1) * 0.92);
      setView({
        x: Math.max(0, (cw - sw * scale) / 2),
        y: Math.max(0, (ch - sh * scale) / 2),
        scale
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [diagram, error]);

  const zoomAt = useCallback((clientX: number, clientY: number, factor: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    setView((v) => {
      const scale = clampScale(v.scale * factor);
      const k = scale / v.scale;
      return { x: px - (px - v.x) * k, y: py - (py - v.y) * k, scale };
    });
  }, []);

  const zoomIn = useCallback(() => {
    const container = containerRef.current;
    if (!container) return setView((v) => ({ ...v, scale: clampScale(v.scale * 1.25) }));
    const rect = container.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 1.25);
  }, [zoomAt]);

  const zoomOut = useCallback(() => {
    const container = containerRef.current;
    if (!container) return setView((v) => ({ ...v, scale: clampScale(v.scale / 1.25) }));
    const rect = container.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 1 / 1.25);
  }, [zoomAt]);

  const reset = useCallback(() => setView({ x: 0, y: 0, scale: 1 }), []);

  const fitToScreen = useCallback(() => {
    const content = contentRef.current;
    const container = containerRef.current;
    if (!content || !container) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const sw = content.scrollWidth || cw;
    const sh = content.scrollHeight || ch;
    const scale = clampScale(Math.min(cw / sw, ch / sh, 1) * 0.92);
    setView({ x: Math.max(0, (cw - sw * scale) / 2), y: Math.max(0, (ch - sh * scale) / 2), scale });
  }, []);

  // Keyboard shortcuts (+ / - / 0).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoomIn();
      } else if (e.key === "-") {
        e.preventDefault();
        zoomOut();
      } else if (e.key === "0") {
        e.preventDefault();
        reset();
      } else if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        fitToScreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomIn, zoomOut, reset, fitToScreen]);

  // Native non-passive wheel listener so `preventDefault` actually cancels
  // browser scroll while zooming (React attaches synthetic wheel as passive).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      zoomAt(e.clientX, e.clientY, factor);
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: view.x, origY: view.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    setView((v) => ({ ...v, x: drag.origX + (e.clientX - drag.startX), y: drag.origY + (e.clientY - drag.startY) }));
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const onExportSvg = async () => {
    if (!svgRef.current) return;
    setBusy(true);
    try {
      exportSvg(svgRef.current, `${title}.svg`);
    } finally {
      setBusy(false);
    }
  };

  const onExportPng = async () => {
    if (!svgRef.current) return;
    setBusy(true);
    try {
      await exportPng(svgRef.current, `${title}.png`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mermaid-viewport">
      <div className="viewport-toolbar">
        <button className="tool-btn" onClick={zoomOut} title="Zoom out (-)" disabled={busy}>−</button>
        <button className="tool-btn" onClick={zoomIn} title="Zoom in (+)" disabled={busy}>+</button>
        <button className="tool-btn" onClick={reset} title="Reset view (0)">Reset</button>
        <button className="tool-btn" onClick={fitToScreen} title="Fit to screen (F)">Fit</button>
        <span className="toolbar-sep" />
        <button className="tool-btn" onClick={onExportSvg} disabled={busy || !svgRef.current}>Export SVG</button>
        <button className="tool-btn" onClick={onExportPng} disabled={busy || !svgRef.current}>Export PNG</button>
        <span className="toolbar-hint">drag to pan · scroll to zoom</span>
      </div>

      <div
        ref={containerRef}
        className="viewport-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          ref={contentRef}
          className="viewport-content"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
        />
      </div>
    </div>
  );
}
