import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { fieldCameraActionForCode, type FieldCameraAction } from '../keybindings';
import { CameraFlight } from './CameraFlight';

const isEditableTarget = (target: EventTarget | null): boolean => (
  target instanceof HTMLElement
  && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
);

interface CameraFlightControlsProps {
  readonly active: boolean;
  readonly onInteraction?: () => void;
}

export function CameraFlightControls({ active, onInteraction }: CameraFlightControlsProps) {
  const camera = useThree((state) => state.camera);
  const canvas = useThree((state) => state.gl.domElement);
  const invalidate = useThree((state) => state.invalidate);
  const regress = useThree((state) => state.performance.regress);
  const flight = useMemo(() => new CameraFlight(camera), [camera]);
  const pressedActions = useRef(new Set<FieldCameraAction>());

  useEffect(() => {
    pressedActions.current.clear();
    if (!active) return;

    let drag: { id: number; x: number; y: number; pan: boolean } | null = null;
    const previousCursor = canvas.style.cursor;
    const previousTouchAction = canvas.style.touchAction;
    canvas.style.cursor = 'grab';
    canvas.style.touchAction = 'none';

    const changed = (): void => { onInteraction?.(); regress(); invalidate(); };
    const stopDrag = (): void => {
      const pointerId = drag?.id;
      drag = null;
      if (pointerId !== undefined && canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
      canvas.style.cursor = 'grab';
    };
    const stopMovement = (): void => { pressedActions.current.clear(); stopDrag(); };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.metaKey || event.ctrlKey || event.altKey || isEditableTarget(event.target)) {
        pressedActions.current.clear();
        return;
      }
      const action = fieldCameraActionForCode(event.code);
      if (!action) return;
      event.preventDefault();
      onInteraction?.();
      pressedActions.current.add(action);
      invalidate();
    };
    const handleKeyUp = (event: KeyboardEvent): void => {
      const action = fieldCameraActionForCode(event.code);
      if (action) pressedActions.current.delete(action);
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
      if (drag.pan) flight.pan(dx, dy);
      else flight.look(dx, dy);
      drag.x = event.clientX;
      drag.y = event.clientY;
      changed();
    };
    const handlePointerEnd = (event: PointerEvent): void => {
      if (drag?.id === event.pointerId) stopDrag();
    };
    const handleWheel = (event: WheelEvent): void => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1;
      flight.dolly(-event.deltaY * unit * 0.01);
      changed();
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

  useFrame((_state, delta) => {
    if (active && flight.move(pressedActions.current, delta)) {
      onInteraction?.();
      regress();
      invalidate();
    }
  });
  return null;
}
