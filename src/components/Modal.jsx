import { useCallback, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./ui";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

const sizes = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export default function Modal({
  open,
  onClose,
  title,
  description,
  icon,
  size = "md",
  children,
  footer,
  dismissible = true,
}) {
  const panelRef = useRef(null);
  const titleId = useId();
  const descId = useId();

  const handleKey = useCallback(
    (event) => {
      if (event.key === "Escape" && dismissible) {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const node = panelRef.current;
      if (!node) return;
      const items = [...node.querySelectorAll(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [dismissible, onClose],
  );

  useEffect(() => {
    if (!open) return undefined;

    const previous = document.activeElement;
    const node = panelRef.current;
    if (node) {
      const target =
        node.querySelector("[data-autofocus]") || node.querySelector(FOCUSABLE) || node;
      target.focus();
    }

    document.addEventListener("keydown", handleKey, true);
    return () => {
      document.removeEventListener("keydown", handleKey, true);
      if (previous && typeof previous.focus === "function") previous.focus();
    };
  }, [open, handleKey]);

  useEffect(() => {
    if (!open) return undefined;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevPad = body.style.paddingRight;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPad;
    };
  }, [open]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-margin-mobile sm:p-lg">
      <button
        type="button"
        aria-label="Close dialog"
        tabIndex={-1}
        onClick={dismissible ? onClose : undefined}
        className="absolute inset-0 bg-primary/40 backdrop-blur-sm"
        style={{ animation: "eqFade 160ms ease-out" }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`relative w-full ${sizes[size]} max-h-[90vh] flex flex-col bg-surface-container-lowest border border-outline-variant rounded-xl lift-shadow outline-none`}
        style={{ animation: "eqPop 180ms cubic-bezier(0.16, 1, 0.3, 1)" }}
      >
        {title ? (
          <header className="flex items-start justify-between gap-md px-lg py-md border-b border-outline-variant flex-shrink-0">
            <div className="flex items-start gap-md min-w-0">
              {icon ? (
                <span className="w-9 h-9 rounded-lg bg-primary-container text-on-primary flex items-center justify-center flex-shrink-0">
                  <Icon name={icon} className="text-[20px]" />
                </span>
              ) : null}
              <div className="min-w-0">
                <h2
                  id={titleId}
                  className="font-headline-sm text-headline-sm text-primary leading-tight"
                >
                  {title}
                </h2>
                {description ? (
                  <p id={descId} className="font-body-sm text-body-sm text-secondary mt-1">
                    {description}
                  </p>
                ) : null}
              </div>
            </div>
            {dismissible ? (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="w-8 h-8 flex items-center justify-center rounded-md text-secondary hover:text-on-surface hover:bg-surface-container transition-colors flex-shrink-0"
              >
                <Icon name="close" className="text-[20px]" />
              </button>
            ) : null}
          </header>
        ) : null}

        <div className="px-lg py-lg overflow-y-auto custom-scrollbar flex-1 min-h-0">
          {children}
        </div>

        {footer ? (
          <footer className="px-lg py-md border-t border-outline-variant flex items-center justify-end gap-md flex-shrink-0 bg-surface-container-low/40 rounded-b-xl">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

export function ModalActions({ children }) {
  return <div className="flex items-center gap-md">{children}</div>;
}

export function Button({ variant = "secondary", className = "", children, ...rest }) {
  const variants = {
    primary: "bg-primary-container text-on-primary hover:bg-primary soft-shadow",
    secondary:
      "bg-surface-container-lowest border border-outline-variant text-on-surface hover:bg-surface-container",
    danger: "bg-error text-on-primary hover:bg-error/90",
    ghost: "text-secondary hover:text-on-surface hover:bg-surface-container",
  };
  return (
    <button
      type="button"
      className={`px-md py-2.5 rounded-md font-label-md text-label-md transition-colors ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Field({ label, hint, children, id }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-label-md text-label-md text-on-surface">
        {label}
      </label>
      {children}
      {hint ? <span className="font-body-sm text-body-sm text-secondary">{hint}</span> : null}
    </div>
  );
}

export const inputClass =
  "w-full px-md py-2.5 bg-surface-container-lowest font-body-md text-body-md text-on-surface border border-outline-variant rounded-md focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all placeholder:text-secondary/60";
