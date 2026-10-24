import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
export function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  useLayoutEffect(() => {
    closeRef.current = close;
  }, [close]);
  useLayoutEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const box = ref.current!;
    const backdrop = box.parentElement!;
    const background = new Map<Element, string | null>();
    const isolate = () => {
      for (const sibling of document.body.children) {
        if (sibling === backdrop || background.has(sibling)) continue;
        background.set(sibling, sibling.getAttribute('inert'));
        sibling.setAttribute('inert', '');
      }
    };
    // The portal stays usable while the app root (including future children)
    // and any other body siblings are natively isolated.
    isolate();
    const observer = new MutationObserver(isolate);
    observer.observe(document.body, { childList: true });
    box.querySelector<HTMLElement>('button,textarea')?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeRef.current) {
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key === 'Tab') {
        const elements = Array.from(
          box.querySelectorAll<HTMLElement>(
            'button:not(:disabled),textarea,a[href]',
          ),
        );
        const first = elements[0],
          last = elements[elements.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    box.addEventListener('keydown', key);
    return () => {
      box.removeEventListener('keydown', key);
      observer.disconnect();
      for (const [element, inert] of background) {
        if (inert === null) element.removeAttribute('inert');
        else element.setAttribute('inert', inert);
      }
      // Restore isolation first so native focus works, including effect replay.
      previous?.focus();
    };
  }, []);
  return createPortal(
    <div className="modal-backdrop">
      <div
        ref={ref}
        className="card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2>{title}</h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}
