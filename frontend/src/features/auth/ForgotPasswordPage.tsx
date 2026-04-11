import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { authApi } from "../../api/auth.api";
import { useLocale } from "../../lib/locale";
import { getErrorMessage } from "../../lib/errors";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { ErrorBanner } from "../../components/common/ErrorBanner";

type TranslateFn = (vi: string, en: string) => string;

function createSchema(t: TranslateFn) {
  return z.object({
    email: z.string().email(t("Email không đúng định dạng", "Invalid email format")),
  });
}

type ForgotPasswordForm = {
  email: string;
};

export function ForgotPasswordPage() {
  const { t } = useLocale();

  const form = useForm<ForgotPasswordForm>({
    resolver: zodResolver(createSchema(t)),
    defaultValues: {
      email: "",
    },
  });

  const forgotMutation = useMutation({
    mutationFn: authApi.forgotPassword,
  });

  const onSubmit = form.handleSubmit(async (values) => {
    await forgotMutation.mutateAsync(values);
  });

  const success = forgotMutation.data;

  return (
    <div>
      <h2 className="section-title">{t("Quên mật khẩu", "Forgot Password")}</h2>
      <p className="section-subtitle">
        {t(
          "Nhập email đã đăng ký. Hệ thống sẽ gửi link đặt lại mật khẩu.",
          "Enter your account email and we will send a reset link.",
        )}
      </p>

      {forgotMutation.error ? <ErrorBanner message={getErrorMessage(forgotMutation.error)} /> : null}

      {success ? (
        <div className="status-banner success">
          <strong>{t("Yêu cầu đã được ghi nhận", "Request received")}</strong>
          <p>{success.message}</p>
          {success.resetUrlPreview ? (
            <p>
              {t("Link test (dev):", "Dev preview link:")} <a href={success.resetUrlPreview}>{success.resetUrlPreview}</a>
            </p>
          ) : null}
        </div>
      ) : null}

      <form className="form-stack" onSubmit={onSubmit}>
        <Input
          label={t("Email", "Email")}
          type="email"
          placeholder="you@example.com"
          error={form.formState.errors.email?.message}
          {...form.register("email")}
        />

        <Button type="submit" loading={forgotMutation.isPending}>
          {t("Gửi link đặt lại", "Send reset link")}
        </Button>
      </form>

      <p className="switch-text">
        <Link to="/login">{t("Quay lại đăng nhập", "Back to sign in")}</Link>
      </p>
    </div>
  );
}

export default ForgotPasswordPage;
