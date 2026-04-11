'use client';

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';

const SAFE_MARGIN = 12;
const BASE_WINDOW_CLASS =
  'pointer-events-auto fixed select-none rounded-[1.75rem] border p-4 shadow-[0_18px_50px_rgba(0,0,0,0.32)] backdrop-blur-md';
const CLOSE_BUTTON_CLASS =
  'flex h-8 w-8 items-center justify-center rounded-xl border border-[#d9efbd]/30 bg-[#244713]/55 text-sm font-semibold text-[#f4ffe8] transition hover:bg-[#2f5a19]/70';

function loadWindowPosition(storageKey: string, fallback: { left: number; top: number }) {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) {
      return fallback;
    }

    const parsed = JSON.parse(rawValue) as Partial<{ left: number; top: number }>;
    if (typeof parsed.left !== 'number' || typeof parsed.top !== 'number') {
      return fallback;
    }

    return {
      left: parsed.left,
      top: parsed.top,
    };
  } catch {
    return fallback;
  }
}

function clampWindowPosition(left: number, top: number, width: number, height: number) {
  if (typeof window === 'undefined') {
    return { left, top };
  }

  return {
    left: Math.min(
      Math.max(SAFE_MARGIN, left),
      Math.max(SAFE_MARGIN, window.innerWidth - width - SAFE_MARGIN),
    ),
    top: Math.min(
      Math.max(SAFE_MARGIN, top),
      Math.max(SAFE_MARGIN, window.innerHeight - height - SAFE_MARGIN),
    ),
  };
}

export function HudWindow({
  title,
  subtitle,
  storageKey,
  defaultPosition,
  onClose,
  headerActions,
  className,
  bodyClassName,
  children,
}: {
  title: string;
  subtitle?: string;
  storageKey: string;
  defaultPosition: { left: number; top: number };
  onClose?: () => void;
  headerActions?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  const windowRef = useRef<HTMLElement | null>(null);
  const [position, setPosition] = useState(() =>
    loadWindowPosition(storageKey, defaultPosition),
  );
  const [dragState, setDragState] = useState<{
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    setPosition((current) => {
      const loaded = loadWindowPosition(storageKey, defaultPosition);
      if (current.left === loaded.left && current.top === loaded.top) {
        return current;
      }

      return loaded;
    });
  }, [storageKey, defaultPosition.left, defaultPosition.top]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(position));
  }, [position, storageKey]);

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      setPosition(
        clampWindowPosition(
          event.clientX - dragState.offsetX,
          event.clientY - dragState.offsetY,
          dragState.width,
          dragState.height,
        ),
      );
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState]);

  useEffect(() => {
    const syncWindowBounds = () => {
      const bounds = windowRef.current?.getBoundingClientRect();
      const nextWidth = bounds?.width ?? 420;
      const nextHeight = bounds?.height ?? 240;

      setPosition((current) =>
        clampWindowPosition(current.left, current.top, nextWidth, nextHeight),
      );
    };

    syncWindowBounds();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' && windowRef.current
        ? new ResizeObserver(() => {
            syncWindowBounds();
          })
        : null;

    if (resizeObserver && windowRef.current) {
      resizeObserver.observe(windowRef.current);
    }

    window.addEventListener('resize', syncWindowBounds);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', syncWindowBounds);
    };
  }, []);

  const handleDragStart = (event: ReactMouseEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return;
    }

    const windowElement = event.currentTarget.closest('[data-hud-window-root]');
    const bounds = windowElement instanceof HTMLElement
      ? windowElement.getBoundingClientRect()
      : event.currentTarget.getBoundingClientRect();

    setDragState({
      offsetX: event.clientX - bounds.left,
      offsetY: event.clientY - bounds.top,
      width: bounds.width,
      height: bounds.height,
    });
    event.preventDefault();
  };

  return (
    <section
      ref={windowRef}
      data-hud-window-root
      className={`${BASE_WINDOW_CLASS} ${className ?? ''}`}
      style={{
        left: position.left,
        top: position.top,
      }}
    >
      <div
        className="flex cursor-grab items-start justify-between gap-4 active:cursor-grabbing"
        onMouseDown={handleDragStart}
      >
        <div>
          <h2 className="font-serif text-2xl font-bold tracking-wide text-[#f4ffe8]">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-sm leading-5 text-[#dceec9]">{subtitle}</p>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {headerActions}
          {onClose ? (
            <button
              type="button"
              aria-label={`Close ${title}`}
              onClick={onClose}
              onMouseDown={(event) => event.stopPropagation()}
              className={CLOSE_BUTTON_CLASS}
            >
              X
            </button>
          ) : null}
        </div>
      </div>

      <div className={bodyClassName ?? 'mt-4'}>{children}</div>
    </section>
  );
}
