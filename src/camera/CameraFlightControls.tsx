import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { Box3 } from 'three';
import { fieldCameraActionForCode, type FieldCameraAction } from '../keybindings';
import { SmoothedCameraFlight } from './SmoothedCameraFlight';

const isEditableTarget = (target: EventTarget | null): boolean => (
  target instanceof HTMLElement
  && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
);

interface CameraFlightControlsProps {
  readonly active: boolean;
  readonly bounds: Box3;
  readonly onInteraction?: () => void;
}

export function CameraFlightControls({ active, bounds, onInteraction }: CameraFlightControlsProps) {
  const camera = useThree((state) => state.camera);
  const canvas = useThree((state) => state.gl.domElement);
  const invalidate = useThree((state) => state.invalidate);
  const regress = useThree((state) => state.performance.regress);
  const flight = useMemo(() => new SmoothedCameraFlight(camera, bounds), [camera, bounds]);
  const pressedActions = useRef(new Set<FieldCameraAction>());
  const previousFrameAtMs = useRef<number | null>(null);

  useEffect(() => {
    pressedActions.current.clear();
    flight.stop();
    previousFrameAtMs.current = null;
    if (!active) return;

    let drag: { id: number; x: number; y: number; pan: boolean } | null = null;
    const previousCursor = canvas.style.cursor;
    const previousTouchAction = canvas.style.touchAction;
    canvas.style.cursor = 'grab';
    canvas.style.touchAction = 'none';

    const wake = (): void => {
      // Exclude time spent idle before the input from the first easing frame.
      previousFrameAtMs.current ??= performance.now();
      invalidate();
    };
    const changed = (): void => { onInteraction?.(); regress(); wake(); };
    const stopDrag = (): void => {
      const pointerId = drag?.id;
      drag = null;
      if (pointerId !== undefined && canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
      canvas.style.cursor = 'grab';
    };
    const stopMovement = (): void => {
      pressedActions.current.clear();
      flight.stop();
      previousFrameAtMs.current = null;
      stopDrag();
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.metaKey || event.ctrlKey || event.altKey || isEditableTarget(event.target)) {
        stopMovement();
        return;
      }
      const action = fieldCameraActionForCode(event.code);
      if (!action) return;
      event.preventDefault();
      changed();
      pressedActions.current.add(action);
    };
    const handleKeyUp = (event: KeyboardEvent): void => {
      const action = fieldCameraActionForCode(event.code);
      if (action && pressedActions.current.delete(action)) wake();
    };
    const handleFocus = (event: FocusEvent): void => {
      if (isEditableTarget(event.target)) stopMovement();
    };
    const handleVisibility = (): void => { if (document.hidden) stopMovement(); };
    const handlePointerDown = (event: PointerEvent): void => {
      if (drag || event.button > 2 || event.metaKey || event.ctrlKey || event.altKey) return;
      event.preventDefault();
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, pan: event.button === 1 || event.shiftKey };
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = 'grabbing';
    };
    const handlePointerMove = (event: PointerEvent): void => {
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (dx === 0 && dy === 0) return;
      changed();
      if (drag.pan) flight.pan(dx, dy);
      else flight.look(dx, dy);
      drag.x = event.clientX;
      drag.y = event.clientY;
    };
    const handlePointerEnd = (event: PointerEvent): void => {
      if (drag?.id === event.pointerId) stopDrag();
    };
    const handleWheel = (event: WheelEvent): void => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      event.preventDefault();
      if (event.deltaY === 0) return;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1;
      changed();
      flight.dolly(-event.deltaY * unit * 0.01);
    };
    const handleContextMenu = (event: MouseEvent): void => event.preventDefault();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', stopMovement);
    window.addEventListener('focusin', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerEnd);
    canvas.addEventListener('pointercancel', handlePointerEnd);
    canvas.addEventListener('lostpointercapture', handlePointerEnd);
    canvas.addEventListener('contextmenu', handleContextMenu);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      stopMovement();
      canvas.style.cursor = previousCursor;
      canvas.style.touchAction = previousTouchAction;
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', stopMovement);
      window.removeEventListener('focusin', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerEnd);
      canvas.removeEventListener('pointercancel', handlePointerEnd);
      canvas.removeEventListener('lostpointercapture', handlePointerEnd);
      canvas.removeEventListener('contextmenu', handleContextMenu);
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [active, canvas, flight, invalidate, regress, onInteraction]);

  useFrame(() => {
    if (!active || previousFrameAtMs.current === null) return;
    const now = performance.now();
    const delta = (now - previousFrameAtMs.current) / 1000;
    previousFrameAtMs.current = now;
    if (flight.update(pressedActions.current, delta)) {
      regress();
      invalidate();
    } else {
      previousFrameAtMs.current = null;
    }
  });
  return null;
}
