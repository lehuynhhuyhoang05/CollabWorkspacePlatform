import { useEffect } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "../../api/auth.api";
import { notificationsApi } from "../../api/notifications.api";
import { useLocale } from "../../lib/locale";
import { useTheme } from "../../lib/theme";
import { useAuthStore } from "../../store/auth.store";
import { useToastStore } from "../../store/toast.store";
import { Button } from "../ui/Button";
import { Loader } from "../common/Loader";

export function AppLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { locale, setLocale, t } = useLocale();
  const { isDark, toggleTheme } = useTheme();
  const pushToast = useToastStore((state) => state.pushToast);
  const { user, accessToken, setUser, clearAuth } = useAuthStore();

  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: authApi.me,
    enabled: Boolean(accessToken),
    staleTime: 60_000,
  });

  const unreadNotificationsQuery = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => notificationsApi.listInbox(true),
    enabled: Boolean(accessToken),
    staleTime: 15_000,
  });

  const unreadCount = unreadNotificationsQuery.data?.length ?? 0;

  useEffect(() => {
    if (meQuery.data) {
      setUser(meQuery.data);
    }
  }, [meQuery.data, setUser]);

  const onLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Force local logout even if backend already invalidated token.
    }

    clearAuth();
    queryClient.clear();
    navigate("/login", { replace: true });
    pushToast({
      kind: "info",
      title: t("Đã đăng xuất", "Logged out"),
      message: t("Phiên làm việc đã kết thúc.", "Your session has ended."),
    });
  };

  if (!user && meQuery.isPending) {
    return <Loader text={t("Đang tải không gian làm việc...", "Loading workspace...")} />;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <Link to="/workspaces" className="brand-link">CloudCollab</Link>
          <nav className="topbar-nav">
            <NavLink to="/workspaces" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              {t("Không gian", "Workspaces")}
            </NavLink>
            <NavLink to="/tasks/my" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              {t("Việc của tôi", "My Tasks")}
            </NavLink>
            <NavLink to="/inbox" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              {t("Inbox", "Inbox")}
              {unreadCount > 0 ? <span className="nav-badge">{unreadCount}</span> : null}
            </NavLink>
            <NavLink to="/profile" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              {t("Hồ sơ", "Profile")}
            </NavLink>
          </nav>
        </div>

        <div className="topbar-right">
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={t("Đổi giao diện sáng/tối", "Toggle light or dark theme")}
            title={t("Đổi giao diện sáng/tối", "Toggle light or dark theme")}
          >
            {isDark ? t("Sáng", "Light") : t("Tối", "Dark")}
          </button>
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
          <div className="user-pill">
            <strong>{user?.name ?? t("Người dùng", "User")}</strong>
            <span>{user?.email ?? ""}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onLogout}>{t("Đăng xuất", "Logout")}</Button>
        </div>
      </header>

      <section className="app-content">
        <Outlet />
      </section>
    </div>
  );
}
