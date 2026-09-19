"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface FlickeringGridProps extends React.HTMLAttributes<HTMLDivElement> {
  squareSize?: number;
  gridGap?: number;
  /** Chance per second, per square, of picking a new opacity. */
  flickerChance?: number;
  /** Any CSS colour: hex, rgb(), hsl() or a named colour. */
  color?: string;
  /** Fixed size in px. Omit both to fill the parent, which is the usual use. */
  width?: number;
  height?: number;
  maxOpacity?: number;
}

/** Resolves any CSS colour to the "rgba(r, g, b," prefix the drawing code appends an alpha to. */
function toRgbaPrefix(color: string) {
  if (typeof window === "undefined") return "rgba(0, 0, 0,";
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "rgba(0, 0, 0,";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = Array.from(ctx.getImageData(0, 0, 1, 1).data);
  return `rgba(${r}, ${g}, ${b},`;
}

const FRAME_INTERVAL_MS = 1000 / 30; // 30fps is smooth enough for a flicker and half the work

/**
 * A canvas of small squares whose opacity flickers at random (MagicUI's
 * FlickeringGrid). A single canvas element, so it is far lighter than
 * animating many DOM/SVG nodes. It additionally:
 *  - stops drawing while scrolled out of view (IntersectionObserver);
 *  - runs at 30fps;
 *  - draws one still frame instead of animating for people who asked their
 *    system for reduced motion.
 */
export const FlickeringGrid: React.FC<FlickeringGridProps> = ({
  squareSize = 4,
  gridGap = 6,
  flickerChance = 0.3,
  color = "rgb(0, 0, 0)",
  width,
  height,
  className,
  maxOpacity = 0.3,
  ...props
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const rgbaPrefix = useMemo(() => toRgbaPrefix(color), [color]);

  const setupCanvas = useCallback(
    (canvas: HTMLCanvasElement, w: number, h: number) => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const cols = Math.ceil(w / (squareSize + gridGap));
      const rows = Math.ceil(h / (squareSize + gridGap));
      const squares = new Float32Array(cols * rows);
      for (let i = 0; i < squares.length; i += 1) squares[i] = Math.random() * maxOpacity;
      return { cols, rows, squares, dpr };
    },
    [squareSize, gridGap, maxOpacity],
  );

  const updateSquares = useCallback(
    (squares: Float32Array, deltaSeconds: number) => {
      for (let i = 0; i < squares.length; i += 1) {
        if (Math.random() < flickerChance * deltaSeconds) squares[i] = Math.random() * maxOpacity;
      }
    },
    [flickerChance, maxOpacity],
  );

  const drawGrid = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, cols: number, rows: number, squares: Float32Array, dpr: number) => {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          ctx.fillStyle = `${rgbaPrefix}${squares[i * rows + j]})`;
          ctx.fillRect(i * (squareSize + gridGap) * dpr, j * (squareSize + gridGap) * dpr, squareSize * dpr, squareSize * dpr);
        }
      }
    },
    [rgbaPrefix, squareSize, gridGap],
  );

  // Track the size of the container (or use the fixed size).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => setCanvasSize({ width: width || container.clientWidth, height: height || container.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [width, height]);

  // Only animate while visible.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new IntersectionObserver(([entry]) => setIsInView(entry.isIntersecting), { threshold: 0 });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !canvasSize.width || !canvasSize.height) return;

    const grid = setupCanvas(canvas, canvasSize.width, canvasSize.height);
    const draw = () => drawGrid(ctx, canvas.width, canvas.height, grid.cols, grid.rows, grid.squares, grid.dpr);
    draw();

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || !isInView) return;

    let frame = 0;
    let last = performance.now();
    const tick = (time: number) => {
      frame = requestAnimationFrame(tick);
      const delta = time - last;
      if (delta < FRAME_INTERVAL_MS) return;
      last = time;
      updateSquares(grid.squares, delta / 1000);
      draw();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [canvasSize, isInView, setupCanvas, updateSquares, drawGrid]);

  return (
    <div ref={containerRef} aria-hidden className={cn("size-full", className)} {...props}>
      <canvas ref={canvasRef} className="pointer-events-none" style={{ width: canvasSize.width, height: canvasSize.height }} />
    </div>
  );
};
