import { useLocale } from "../../lib/locale";
import { useToastStore } from "../../store/toast.store";

export function ToastViewport() {
  const { t } = useLocale();
  const toasts = useToastStore((state) => state.toasts);
  const dismissToast = useToastStore((state) => state.dismissToast);

  return (
    <section className="toast-viewport" aria-live="polite" aria-relevant="additions text">
      {toasts.map((toast) => (
        <article
          key={toast.id}
          className={`toast toast-${toast.kind}`}
          role={toast.kind === "error" ? "alert" : "status"}
        >
          <div className="toast-copy">
            {toast.title ? <strong>{toast.title}</strong> : null}
            <p>{toast.message}</p>
          </div>
          <button
            type="button"
            className="toast-close"
            onClick={() => dismissToast(toast.id)}
            aria-label={t("Đóng thông báo", "Dismiss notification")}
          >
            ×
          </button>
        </article>
      ))}
    </section>
  );
}
