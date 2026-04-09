import { useEffect, useMemo, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { googleIntegrationsApi } from "../../api/google-integrations.api";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { ErrorBanner } from "../../components/common/ErrorBanner";
import { useLocale } from "../../lib/locale";
import { getErrorMessage } from "../../lib/errors";
import { useToastStore } from "../../store/toast.store";

export function GoogleOAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useLocale();
  const pushToast = useToastStore((state) => state.pushToast);
  const autoExchangeCodeRef = useRef<string | null>(null);

  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");
  const oauthErrorDescription = searchParams.get("error_description");

  const redirectUri = useMemo(
    () => `${window.location.origin}/integrations/google/callback`,
    [],
  );

  const exchangeMutation = useMutation({
    mutationFn: (payload: { code: string; redirectUri: string }) =>
      googleIntegrationsApi.exchangeCode(payload),
    onSuccess: async (status) => {
      await queryClient.invalidateQueries({ queryKey: ["integrations", "google"] });
      pushToast({
        kind: "success",
        title: t("Kết nối Google thành công", "Google connected"),
        message: status.googleEmail
          ? t(`Đã liên kết tài khoản ${status.googleEmail}.`, `Connected ${status.googleEmail}.`)
          : t("Tài khoản Google đã được liên kết.", "Google account has been linked."),
      });
      navigate("/profile", { replace: true });
    },
  });

  useEffect(() => {
    if (oauthError) {
      return;
    }

    if (!code) {
      return;
    }

    // Google auth code is single-use. Auto-exchange only once per code to avoid spam loops on failure.
    if (autoExchangeCodeRef.current === code) {
      return;
    }

    autoExchangeCodeRef.current = code;
    exchangeMutation.mutate({ code, redirectUri });
  }, [code, oauthError, redirectUri, exchangeMutation]);

  const showMissingCode = !oauthError && !code;

  return (
    <div className="page-stack">
      <div className="page-header-row">
        <div>
          <p className="chip">{t("Google Integration", "Google Integration")}</p>
          <h1>{t("Hoàn tất kết nối Google", "Finishing Google connection")}</h1>
        </div>
      </div>

      {oauthError ? (
        <ErrorBanner
          message={
            oauthErrorDescription ||
            t("Google đã trả về lỗi khi xác thực OAuth.", "Google returned an OAuth error.")
          }
        />
      ) : null}

      {exchangeMutation.error ? <ErrorBanner message={getErrorMessage(exchangeMutation.error)} /> : null}

      {showMissingCode ? (
        <ErrorBanner
          message={t(
            "Không tìm thấy mã xác thực (code) trong callback URL.",
            "No authorization code was found in callback URL.",
          )}
        />
      ) : null}

      <Card>
        {exchangeMutation.isPending ? (
          <p className="muted-text">
            {t("Đang trao đổi mã xác thực với backend...", "Exchanging auth code with backend...")}
          </p>
        ) : oauthError || exchangeMutation.error || showMissingCode ? (
          <div className="inline-actions">
            <Link to="/profile" className="link-button">
              {t("Quay lại hồ sơ", "Back to profile")}
            </Link>
          </div>
        ) : exchangeMutation.isSuccess ? (
          <p className="muted-text">
            {t("Kết nối thành công. Đang chuyển hướng...", "Connection succeeded. Redirecting...")}
          </p>
        ) : (
          <div className="inline-actions">
            <Button
              onClick={() => {
                if (!code) {
                  return;
                }
                exchangeMutation.mutate({ code, redirectUri });
              }}
            >
              {t("Thử lại kết nối", "Retry connection")}
            </Button>
            <Link to="/profile" className="link-button">
              {t("Quay lại hồ sơ", "Back to profile")}
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}

export default GoogleOAuthCallbackPage;
