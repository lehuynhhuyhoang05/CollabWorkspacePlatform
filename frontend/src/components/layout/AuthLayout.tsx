import { Link, Outlet } from "react-router-dom";
import { useLocale } from "../../lib/locale";

export function AuthLayout() {
  const { locale, setLocale, t } = useLocale();

  return (
    <main className="auth-screen">
      <section className="auth-brand-panel">
        <p className="chip">{t("Dự án Cloud", "Cloud Project")}</p>
        <h1>{t("Không gian cộng tác", "Collaborative Workspace")}</h1>
        <p>
          {t(
            "Tạo ghi chú, trang nội dung và quy trình làm việc nhóm trên backend đã triển khai.",
            "Build notes, pages, and teamwork flows on top of your deployed backend.",
          )}
          {" "}
          {t(
            "Frontend này đã kết nối đầy đủ auth, workspace và content API cho môi trường thực tế.",
            "This frontend is wired to production-grade auth, workspace and content APIs.",
          )}
        </p>
        <div className="brand-grid">
          <div>
            <strong>JWT Rotation</strong>
            <span>{t("Quản lý phiên đăng nhập an toàn", "Secure session handling")}</span>
          </div>
          <div>
            <strong>RBAC</strong>
            <span>{t("Vai trò Owner / Editor / Viewer", "Owner / Editor / Viewer roles")}</span>
          </div>
          <div>
            <strong>{t("Lưu trữ", "Storage")}</strong>
            <span>{t("Tải ảnh qua MinIO", "Upload images via MinIO")}</span>
          </div>
          <div>
            <strong>{t("Thời gian thực", "Realtime")}</strong>
            <span>{t("Sẵn sàng cộng tác qua socket", "Socket collaboration-ready")}</span>
          </div>
        </div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-shell">
          <div className="auth-shell-head">
            <Link to="/" className="brand-link">CloudCollab</Link>
            <div className="locale-switch" role="group" aria-label={t("Chọn ngôn ngữ", "Choose language")}>
              <button
                type="button"
                className={locale === "vi" ? "locale-btn active" : "locale-btn"}
                onClick={() => setLocale("vi")}
                aria-pressed={locale === "vi"}
              >
                VI
              </button>
              <button
                type="button"
                className={locale === "en" ? "locale-btn active" : "locale-btn"}
                onClick={() => setLocale("en")}
                aria-pressed={locale === "en"}
              >
                EN
              </button>
            </div>
          </div>
          <Outlet />
        </div>
      </section>
    </main>
  );
}
