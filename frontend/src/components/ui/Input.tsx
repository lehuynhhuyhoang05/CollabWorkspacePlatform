import { useId, type InputHTMLAttributes } from "react";
import clsx from "clsx";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function Input({ label, hint, error, className, ...props }: InputProps) {
  const generatedId = useId();
  const inputId = props.id ?? `field-${generatedId}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const customDescribedBy = props["aria-describedby"];
  const describedBy = [customDescribedBy, errorId, !error ? hintId : undefined]
    .filter(Boolean)
    .join(" ");

  return (
    <label className="field-root" htmlFor={inputId}>
      {label ? <span className="field-label">{label}</span> : null}
      <input
        id={inputId}
        className={clsx("field-input", error && "field-error", className)}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy || undefined}
        {...props}
      />
      {error ? <span id={errorId} className="field-feedback">{error}</span> : null}
      {!error && hint ? <span id={hintId} className="field-hint">{hint}</span> : null}
    </label>
  );
}
