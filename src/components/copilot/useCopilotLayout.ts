/**
 * useCopilotLayout — drag, resize, and localStorage persistence for the
 * floating Copilot panel.
 *
 * Stored under: localStorage key "spliceguard-copilot-layout"
 * Shape: { x, y, width, height }
 *
 * Drag handle: attach `dragHandleProps` to the header element.
 * Resize handles: attach `resizeProps(edge)` to each resize affordance.
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STORAGE_KEY = 'nunar-copilot-layout';

const MIN_W = 320;
const MAX_W = 800;
const MIN_H = 400;
// MAX_H is dynamic: 90vh — computed at runtime

// Default position: bottom-right, offset from viewport edge
function defaultLayout() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(420, vw - 32);
  const h = Math.min(620, Math.floor(vh * 0.85));
  return {
    x: vw - w - 24,
    y: vh - h - 24,
    width: w,
    height: h,
  };
}

interface Layout {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ResizeEdge =
  | 'bottom-right'
  | 'bottom'
  | 'right'
  | 'bottom-left'
  | 'left'
  | 'top';

// ---------------------------------------------------------------------------
// Clamp helpers
// ---------------------------------------------------------------------------
function clampLayout(l: Layout): Layout {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxH = Math.floor(vh * 0.9);

  const width = Math.max(MIN_W, Math.min(MAX_W, l.width));
  const height = Math.max(MIN_H, Math.min(maxH, l.height));

  // Keep panel fully inside viewport (at least the header must be reachable)
  const x = Math.max(0, Math.min(l.x, vw - width));
  const y = Math.max(0, Math.min(l.y, vh - 48)); // 48px = header height minimum

  return { x, y, width, height };
}

function loadLayout(): Layout | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Layout;
    if (
      typeof parsed.x === 'number' &&
      typeof parsed.y === 'number' &&
      typeof parsed.width === 'number' &&
      typeof parsed.height === 'number'
    ) {
      return clampLayout(parsed);
    }
  } catch {
    // ignore
  }
  return null;
}

function saveLayout(l: Layout) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(l));
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useCopilotLayout() {
  const [layout, setLayoutState] = useState<Layout>(() => {
    return loadLayout() ?? defaultLayout();
  });

  const layoutRef = useRef<Layout>(layout);
  // Sync ref whenever state changes
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  const setLayout = useCallback((next: Layout | ((prev: Layout) => Layout)) => {
    setLayoutState((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      const clamped = clampLayout(resolved);
      layoutRef.current = clamped;
      saveLayout(clamped);
      return clamped;
    });
  }, []);

  // Re-clamp on viewport resize
  useEffect(() => {
    const handleResize = () => {
      setLayout((prev) => clampLayout(prev));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setLayout]);

  // ------------------------------------------------------------------
  // DRAG — pointer events on the drag handle
  // ------------------------------------------------------------------
  const dragStartRef = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);

  const onDragPointerDown = useCallback((e: React.PointerEvent) => {
    // Only primary button (left click)
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    dragStartRef.current = {
      mx: e.clientX,
      my: e.clientY,
      px: layoutRef.current.x,
      py: layoutRef.current.y,
    };
  }, []);

  const onDragPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    e.preventDefault();

    const dx = e.clientX - dragStartRef.current.mx;
    const dy = e.clientY - dragStartRef.current.my;

    setLayout((prev) => ({
      ...prev,
      x: dragStartRef.current!.px + dx,
      y: dragStartRef.current!.py + dy,
    }));
  }, [setLayout]);

  const onDragPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    dragStartRef.current = null;
    const target = e.currentTarget as HTMLElement;
    if (target.hasPointerCapture(e.pointerId)) {
      target.releasePointerCapture(e.pointerId);
    }
  }, []);

  const dragHandleProps = {
    onPointerDown: onDragPointerDown,
    onPointerMove: onDragPointerMove,
    onPointerUp: onDragPointerUp,
    onPointerCancel: onDragPointerUp,
    style: { cursor: 'grab', userSelect: 'none' as const, touchAction: 'none' as const },
  };

  // ------------------------------------------------------------------
  // RESIZE — pointer events per edge
  // ------------------------------------------------------------------
  const resizeStartRef = useRef<{
    mx: number;
    my: number;
    px: number;
    py: number;
    pw: number;
    ph: number;
    edge: ResizeEdge;
  } | null>(null);

  const getResizePointerDown = useCallback(
    (edge: ResizeEdge) =>
      (e: React.PointerEvent) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();

        const target = e.currentTarget as HTMLElement;
        target.setPointerCapture(e.pointerId);

        resizeStartRef.current = {
          mx: e.clientX,
          my: e.clientY,
          px: layoutRef.current.x,
          py: layoutRef.current.y,
          pw: layoutRef.current.width,
          ph: layoutRef.current.height,
          edge,
        };
      },
    []
  );

  const onResizePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!resizeStartRef.current) return;
      e.preventDefault();

      const { mx, my, px, py, pw, ph, edge } = resizeStartRef.current;
      const dx = e.clientX - mx;
      const dy = e.clientY - my;

      let newX = px;
      let newY = py;
      let newW = pw;
      let newH = ph;

      if (edge === 'bottom-right' || edge === 'right') {
        newW = pw + dx;
      }
      if (edge === 'bottom-left' || edge === 'left') {
        newW = pw - dx;
        newX = px + dx;
      }
      if (
        edge === 'bottom-right' ||
        edge === 'bottom' ||
        edge === 'bottom-left'
      ) {
        newH = ph + dy;
      }
      if (edge === 'top') {
        newH = ph - dy;
        newY = py + dy;
      }

      setLayout({ x: newX, y: newY, width: newW, height: newH });
    },
    [setLayout]
  );

  const onResizePointerUp = useCallback((e: React.PointerEvent) => {
    if (!resizeStartRef.current) return;
    resizeStartRef.current = null;
    const target = e.currentTarget as HTMLElement;
    if (target.hasPointerCapture(e.pointerId)) {
      target.releasePointerCapture(e.pointerId);
    }
  }, []);

  /**
   * Returns props to spread onto a resize-handle div for a given edge.
   */
  const resizeHandleProps = useCallback(
    (edge: ResizeEdge) => ({
      onPointerDown: getResizePointerDown(edge),
      onPointerMove: onResizePointerMove,
      onPointerUp: onResizePointerUp,
      onPointerCancel: onResizePointerUp,
      style: { touchAction: 'none' as const, userSelect: 'none' as const },
    }),
    [getResizePointerDown, onResizePointerMove, onResizePointerUp]
  );

  // ------------------------------------------------------------------
  // RESET LAYOUT
  // ------------------------------------------------------------------
  const resetLayout = useCallback(() => {
    const fresh = defaultLayout();
    setLayout(fresh);
  }, [setLayout]);

  return {
    layout,
    dragHandleProps,
    resizeHandleProps,
    resetLayout,
  };
}
