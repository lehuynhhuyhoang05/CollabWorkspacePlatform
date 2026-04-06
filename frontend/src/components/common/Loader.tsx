import { useLocale } from "../../lib/locale";

export function Loader({ text }: { text?: string }) {
  const { t } = useLocale();

  return (
    <div className="loader-wrap" role="status" aria-live="polite">
      <span className="loader-dot" />
      <span>{text ?? t("Đang tải...", "Loading...")}</span>
    </div>
  );
}
