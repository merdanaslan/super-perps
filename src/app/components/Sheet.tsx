import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import { useSheetViewport } from './useSheetViewport';

/** Shared focus-trapped mobile sheet; focus returns to the control that opened it. */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  tall = false,
  fullHeight = false,
  contentKey,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Actions stay visible above the safe area while the details scroll. */
  footer?: ReactNode;
  tall?: boolean;
  fullHeight?: boolean;
  contentKey?: string;
}) {
  const returnFocus = useRef<HTMLElement | null>(null);
  const [viewportContainer, setViewportContainer] = useState<HTMLDivElement | null>(null);
  const previousOpen = useRef(false);
  const [previewContainer, setPreviewContainer] = useState<HTMLElement | null>(null);
  useSheetViewport(open && !previewContainer, viewportContainer, fullHeight);
  useLayoutEffect(() => {
    const body = viewportContainer?.querySelector('.sheet-body');
    if (body) {
      body.querySelector<HTMLElement>('.sheet-content')?.style.removeProperty('min-height');
      body.scrollTop = 0;
    }
  }, [contentKey, viewportContainer]);
  const drag = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const resetDrag = () => {
    drag.current = null;
    setDragOffset(0);
    setDragging(false);
  };
  const finishDrag = (event: PointerEvent<HTMLDivElement>, cancelled = false) => {
    const start = drag.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const distance = event.clientY - start.y;
    const sideways = Math.abs(event.clientX - start.x);
    resetDrag();
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    // Use the same controlled dismissal as the close button. Busy reviews may refuse it.
    if (!cancelled && distance >= 72 && distance > sideways) onClose();
  };
  useLayoutEffect(() => {
    if (!open) resetDrag();
  }, [open]);
  useLayoutEffect(() => {
    // Keep development previews inside the phone frame, including provider-level reviews.
    // On a real phone the portal still uses the document viewport.
    if (import.meta.env.DEV)
      setPreviewContainer(document.querySelector<HTMLElement>('.developer-preview .phone-shell'));
  }, []);
  if (open && !previousOpen.current)
    returnFocus.current = document.activeElement as HTMLElement | null;
  previousOpen.current = open;
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal container={previewContainer ?? undefined}>
        <Dialog.Backdrop className="sheet-backdrop" />
        <Dialog.Viewport
          ref={setViewportContainer}
          className={`sheet-viewport ${fullHeight ? 'sheet-viewport-form' : ''}`}
        >
          <Dialog.Popup
            className={`app-sheet ${tall ? 'app-sheet-tall' : ''}`}
            finalFocus={returnFocus}
            data-dragging={dragging || undefined}
            style={
              {
                '--sheet-drag-y': `${dragOffset}px`,
              } as CSSProperties
            }
          >
            <div
              className="sheet-drag-handle"
              aria-hidden="true"
              onPointerDown={(event) => {
                if (!event.isPrimary || event.button !== 0) return;
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
                setDragging(true);
              }}
              onPointerMove={(event) => {
                if (drag.current?.pointerId === event.pointerId)
                  setDragOffset(Math.max(0, event.clientY - drag.current.y));
              }}
              onPointerUp={(event) => finishDrag(event)}
              onPointerCancel={(event) => finishDrag(event, true)}
              onLostPointerCapture={resetDrag}
            >
              <div className="sheet-grip" />
            </div>
            <div className="sheet-heading">
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Close className="icon-button" aria-label="Close sheet">
                <X size={21} />
              </Dialog.Close>
            </div>
            {description && (
              <Dialog.Description className="sheet-description">{description}</Dialog.Description>
            )}
            <div className="sheet-body">
              {fullHeight ? <div className="sheet-content">{children}</div> : children}
            </div>
            {footer && <div className="sheet-footer">{footer}</div>}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
