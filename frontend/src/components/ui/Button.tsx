import type { ButtonHTMLAttributes } from "react";
import clsx from "clsx";
import { useLocale } from "../../lib/locale";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingText?: string;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading = false,
  loadingText,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const { t } = useLocale();

  return (
    <button
      className={clsx(
        "btn",
        `btn-${variant}`,
        `btn-${size}`,
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? loadingText ?? t("Đang xử lý...", "Processing...") : children}
    </button>
  );
}
