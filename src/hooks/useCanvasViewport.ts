/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction
} from 'react';
import { MAX_ZOOM, MIN_ZOOM } from '../editor/constants';
import type { CanvasSize } from '../editor/types';

type StatusType = 'success' | 'warning' | 'error' | 'info';

type ZoomAnchor = {
  canvasX: number;
  canvasY: number;
  viewportX: number;
  viewportY: number;
};

type UseCanvasViewportOptions = {
  canvasSize: CanvasSize;
  zoom: number;
  setZoom: Dispatch<SetStateAction<number>>;
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  canvasStageRef: MutableRefObject<HTMLDivElement | null>;
  canvasPointerRef: MutableRefObject<{ clientX: number; clientY: number } | null>;
  setStatusText: (text: string, type: StatusType) => void;
};

const SPACE_WHEEL_ZOOM_THRESHOLD = 120;
const SPACE_WHEEL_ZOOM_RESET_MS = 160;

export function useCanvasViewport({
  canvasSize,
  zoom,
  setZoom,
  canvasRef,
  canvasStageRef,
  canvasPointerRef,
  setStatusText
}: UseCanvasViewportOptions) {
  const [viewportRestoreSequence, setViewportRestoreSequence] = useState<number>(0);
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const [isPanning, setIsPanning] = useState<boolean>(false);

  const pendingZoomAnchorRef = useRef<ZoomAnchor | null>(null);
  const pendingViewportRestoreRef = useRef<{ scrollLeft: number; scrollTop: number } | null>(null);
  const spaceWheelZoomAccumRef = useRef<number>(0);
  const spaceWheelZoomResetTimerRef = useRef<number | null>(null);
  const panStateRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startScrollLeft: number;
    startScrollTop: number;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    startScrollLeft: 0,
    startScrollTop: 0
  });

  const endPan = useCallback(() => {
    if (!panStateRef.current.active) {
      return;
    }
    panStateRef.current.active = false;
    setIsPanning(false);
  }, []);

  const beginPan = useCallback(
    (clientX: number, clientY: number) => {
      const stage = canvasStageRef.current;
      if (!stage) {
        return;
      }

      panStateRef.current = {
        active: true,
        startX: clientX,
        startY: clientY,
        startScrollLeft: stage.scrollLeft,
        startScrollTop: stage.scrollTop
      };
      setIsPanning(true);
    },
    [canvasStageRef]
  );

  const updatePan = useCallback(
    (clientX: number, clientY: number) => {
      const stage = canvasStageRef.current;
      if (!stage || !panStateRef.current.active) {
        return;
      }

      const dx = clientX - panStateRef.current.startX;
      const dy = clientY - panStateRef.current.startY;
      stage.scrollLeft = panStateRef.current.startScrollLeft - dx;
      stage.scrollTop = panStateRef.current.startScrollTop - dy;
    },
    [canvasStageRef]
  );

  const resetSpaceWheelZoomAccumulation = useCallback(() => {
    spaceWheelZoomAccumRef.current = 0;
    if (spaceWheelZoomResetTimerRef.current !== null) {
      window.clearTimeout(spaceWheelZoomResetTimerRef.current);
      spaceWheelZoomResetTimerRef.current = null;
    }
  }, []);

  const clampCanvasCoordinateX = useCallback(
    (value: number) => Math.max(0, Math.min(value, canvasSize.width)),
    [canvasSize.width]
  );
  const clampCanvasCoordinateY = useCallback(
    (value: number) => Math.max(0, Math.min(value, canvasSize.height)),
    [canvasSize.height]
  );

  const resolveZoomAnchorFromClientPoint = useCallback(
    (clientX: number, clientY: number): ZoomAnchor | null => {
      const stage = canvasStageRef.current;
      const canvas = canvasRef.current;
      if (!stage || !canvas) {
        return null;
      }

      const canvasRect = canvas.getBoundingClientRect();
      if (
        clientX < canvasRect.left ||
        clientX > canvasRect.right ||
        clientY < canvasRect.top ||
        clientY > canvasRect.bottom
      ) {
        return null;
      }

      const stageRect = stage.getBoundingClientRect();
      return {
        canvasX: clampCanvasCoordinateX((clientX - canvasRect.left) / zoom),
        canvasY: clampCanvasCoordinateY((clientY - canvasRect.top) / zoom),
        viewportX: clientX - stageRect.left,
        viewportY: clientY - stageRect.top
      };
    },
    [canvasRef, canvasStageRef, clampCanvasCoordinateX, clampCanvasCoordinateY, zoom]
  );

  const resolveViewportCenterZoomAnchor = useCallback((): ZoomAnchor | null => {
    const stage = canvasStageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) {
      return null;
    }

    const viewportX = stage.clientWidth / 2;
    const viewportY = stage.clientHeight / 2;
    return {
      canvasX: clampCanvasCoordinateX((stage.scrollLeft + viewportX - canvas.offsetLeft) / zoom),
      canvasY: clampCanvasCoordinateY((stage.scrollTop + viewportY - canvas.offsetTop) / zoom),
      viewportX,
      viewportY
    };
  }, [canvasRef, canvasStageRef, clampCanvasCoordinateX, clampCanvasCoordinateY, zoom]);

  const resolveZoomAnchor = useCallback(
    (clientPoint?: { clientX: number; clientY: number } | null): ZoomAnchor | null => {
      if (clientPoint) {
        const hoveredAnchor = resolveZoomAnchorFromClientPoint(clientPoint.clientX, clientPoint.clientY);
        if (hoveredAnchor) {
          return hoveredAnchor;
        }
      }

      if (canvasPointerRef.current) {
        const pointerAnchor = resolveZoomAnchorFromClientPoint(
          canvasPointerRef.current.clientX,
          canvasPointerRef.current.clientY
        );
        if (pointerAnchor) {
          return pointerAnchor;
        }
      }

      return resolveViewportCenterZoomAnchor();
    },
    [canvasPointerRef, resolveViewportCenterZoomAnchor, resolveZoomAnchorFromClientPoint]
  );

  const restoreZoomAnchor = useCallback(
    (anchor: ZoomAnchor) => {
      const stage = canvasStageRef.current;
      const canvas = canvasRef.current;
      if (!stage || !canvas) {
        return;
      }

      const maxScrollLeft = Math.max(0, stage.scrollWidth - stage.clientWidth);
      const maxScrollTop = Math.max(0, stage.scrollHeight - stage.clientHeight);
      const nextScrollLeft = Math.max(
        0,
        Math.min(canvas.offsetLeft + anchor.canvasX * zoom - anchor.viewportX, maxScrollLeft)
      );
      const nextScrollTop = Math.max(
        0,
        Math.min(canvas.offsetTop + anchor.canvasY * zoom - anchor.viewportY, maxScrollTop)
      );

      stage.scrollLeft = nextScrollLeft;
      stage.scrollTop = nextScrollTop;
    },
    [canvasRef, canvasStageRef, zoom]
  );

  const restoreCanvasViewport = useCallback(
    (viewport: { scrollLeft: number; scrollTop: number }) => {
      const stage = canvasStageRef.current;
      if (!stage) {
        return;
      }

      const maxScrollLeft = Math.max(0, stage.scrollWidth - stage.clientWidth);
      const maxScrollTop = Math.max(0, stage.scrollHeight - stage.clientHeight);
      stage.scrollLeft = Math.max(0, Math.min(viewport.scrollLeft, maxScrollLeft));
      stage.scrollTop = Math.max(0, Math.min(viewport.scrollTop, maxScrollTop));
    },
    [canvasStageRef]
  );

  useLayoutEffect(() => {
    if (!pendingZoomAnchorRef.current) {
      return;
    }

    restoreZoomAnchor(pendingZoomAnchorRef.current);
    pendingZoomAnchorRef.current = null;
  }, [restoreZoomAnchor, zoom]);

  useLayoutEffect(() => {
    if (!pendingViewportRestoreRef.current) {
      return;
    }

    restoreCanvasViewport(pendingViewportRestoreRef.current);
    pendingViewportRestoreRef.current = null;
  }, [canvasSize, restoreCanvasViewport, viewportRestoreSequence, zoom]);

  const setZoomWithAnchor = useCallback(
    (nextZoom: number, clientPoint?: { clientX: number; clientY: number } | null) => {
      const normalizedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.trunc(nextZoom)));
      if (normalizedZoom !== zoom) {
        pendingZoomAnchorRef.current = resolveZoomAnchor(clientPoint);
      } else {
        pendingZoomAnchorRef.current = null;
      }
      setZoom(normalizedZoom);
      setStatusText(`表示倍率: ${normalizedZoom}x`, 'success');
    },
    [resolveZoomAnchor, setStatusText, setZoom, zoom]
  );

  const stepZoom = useCallback(
    (delta: number, clientPoint?: { clientX: number; clientY: number } | null) => {
      setZoomWithAnchor(zoom + delta, clientPoint);
    },
    [setZoomWithAnchor, zoom]
  );

  const applyZoom = useCallback(
    (value: number) => {
      setZoomWithAnchor(value);
    },
    [setZoomWithAnchor]
  );

  const zoomIn = useCallback(() => {
    stepZoom(1);
  }, [stepZoom]);

  const zoomOut = useCallback(() => {
    stepZoom(-1);
  }, [stepZoom]);

  useEffect(() => {
    const isEditableElement = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }
      const tag = target.tagName;
      return target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') {
        return;
      }
      if (isEditableElement(event.target)) {
        return;
      }
      event.preventDefault();
      setIsSpacePressed(true);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') {
        return;
      }
      setIsSpacePressed(false);
      endPan();
      resetSpaceWheelZoomAccumulation();
    };

    const onBlur = () => {
      setIsSpacePressed(false);
      endPan();
      resetSpaceWheelZoomAccumulation();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [endPan, resetSpaceWheelZoomAccumulation]);

  useEffect(() => {
    return () => {
      resetSpaceWheelZoomAccumulation();
    };
  }, [resetSpaceWheelZoomAccumulation]);

  useEffect(() => {
    if (!isPanning) {
      return;
    }

    const onMouseMove = (event: MouseEvent) => {
      updatePan(event.clientX, event.clientY);
    };
    const onMouseUp = () => {
      endPan();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [endPan, isPanning, updatePan]);

  useEffect(() => {
    const stage = canvasStageRef.current;
    if (!stage) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      if (!isSpacePressed) {
        return;
      }
      if (isPanning) {
        event.preventDefault();
        return;
      }

      const delta = event.deltaY;
      if (!Number.isFinite(delta) || delta === 0) {
        return;
      }

      event.preventDefault();
      spaceWheelZoomAccumRef.current += delta;
      if (spaceWheelZoomResetTimerRef.current !== null) {
        window.clearTimeout(spaceWheelZoomResetTimerRef.current);
      }
      spaceWheelZoomResetTimerRef.current = window.setTimeout(() => {
        spaceWheelZoomAccumRef.current = 0;
        spaceWheelZoomResetTimerRef.current = null;
      }, SPACE_WHEEL_ZOOM_RESET_MS);

      const anchorPoint = {
        clientX: event.clientX,
        clientY: event.clientY
      };

      while (spaceWheelZoomAccumRef.current <= -SPACE_WHEEL_ZOOM_THRESHOLD) {
        stepZoom(1, anchorPoint);
        spaceWheelZoomAccumRef.current += SPACE_WHEEL_ZOOM_THRESHOLD;
      }

      while (spaceWheelZoomAccumRef.current >= SPACE_WHEEL_ZOOM_THRESHOLD) {
        stepZoom(-1, anchorPoint);
        spaceWheelZoomAccumRef.current -= SPACE_WHEEL_ZOOM_THRESHOLD;
      }
    };

    stage.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      stage.removeEventListener('wheel', handleWheel);
    };
  }, [canvasStageRef, isPanning, isSpacePressed, stepZoom]);

  return {
    isSpacePressed,
    isPanning,
    panStateRef,
    beginPan,
    updatePan,
    endPan,
    pendingZoomAnchorRef,
    pendingViewportRestoreRef,
    setViewportRestoreSequence,
    applyZoom,
    zoomIn,
    zoomOut
  };
}
