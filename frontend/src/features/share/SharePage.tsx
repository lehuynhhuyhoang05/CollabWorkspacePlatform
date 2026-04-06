import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { shareApi } from "../../api/share.api";
import { Loader } from "../../components/common/Loader";
import { ErrorBanner } from "../../components/common/ErrorBanner";
import { getErrorMessage } from "../../lib/errors";
import { useLocale } from "../../lib/locale";
import { Card } from "../../components/ui/Card";

export function SharePage() {
  const { token = "" } = useParams();
  const { t } = useLocale();

  const query = useQuery({
    queryKey: ["share", token],
    queryFn: () => shareApi.resolve(token),
    enabled: Boolean(token),
  });

  if (query.isPending) {
    return <Loader text={t("Đang tải trang chia sẻ...", "Loading shared page...")} />;
  }

  if (query.error) {
    return (
      <div className="page-stack">
        <ErrorBanner message={getErrorMessage(query.error)} />
        <Link to="/login" className="link-button">
          {t("Vào ứng dụng", "Go to app")}
        </Link>
      </div>
    );
  }

  const shared = query.data;

  return (
    <main className="page-stack shared-screen">
      <div className="page-header-row">
        <div>
          <p className="chip">{t("Trang chia sẻ", "Shared Page")}</p>
          <h1>{shared?.page.title}</h1>
          <p className="muted-text">{t("Quyền", "Permission")}: {shared?.permission}</p>
        </div>
        <Link to="/login" className="link-button">
          {t("Mở ứng dụng đầy đủ", "Open Full App")}
        </Link>
      </div>

      <Card>
        <ul className="block-list">
          {shared?.page.blocks.map((block) => (
            <li key={block.id} className="block-item">
              <strong>{block.type}</strong>
              <p>{block.content || t("(trống)", "(empty)")}</p>
            </li>
          ))}
        </ul>
      </Card>
    </main>
  );
}
