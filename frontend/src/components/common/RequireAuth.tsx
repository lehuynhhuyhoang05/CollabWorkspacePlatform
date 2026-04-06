import { Navigate, useLocation } from "react-router-dom";
import type { PropsWithChildren } from "react";
import { useLocale } from "../../lib/locale";
import { useAuthStore } from "../../store/auth.store";
import { Loader } from "./Loader";

export function RequireAuth({ children }: PropsWithChildren) {
  const location = useLocation();
  const { t } = useLocale();
  const { accessToken, hydrated } = useAuthStore();

  if (!hydrated) {
    return <Loader text={t("Đang khôi phục phiên đăng nhập...", "Restoring session...")} />;
  }

  if (!accessToken) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
