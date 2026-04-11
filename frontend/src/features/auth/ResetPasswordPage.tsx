import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { authApi } from "../../api/auth.api";
import { useLocale } from "../../lib/locale";
import { getErrorMessage } from "../../lib/errors";
import { useToastStore } from "../../store/toast.store";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { ErrorBanner } from "../../components/common/ErrorBanner";

type TranslateFn = (vi: string, en: string) => string;

function createSchema(t: TranslateFn) {
  return z
    .object({
      newPassword: z
        .string()
        .min(8, t("Mật khẩu cần ít nhất 8 ký tự", "Password must be at least 8 characters"))
        .regex(
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
          t("Cần 1 chữ hoa, 1 chữ thường, 1 chữ số", "Need 1 uppercase, 1 lowercase, 1 number"),
        ),
      confirmPassword: z.string().min(1, t("Vui lòng nhập lại mật khẩu", "Please confirm your password")),
    })
    .refine((values) => values.newPassword === values.confirmPassword, {
      path: ["confirmPassword"],
      message: t("Mật khẩu xác nhận không khớp", "Confirmation password does not match"),
    });
}

type ResetPasswordForm = {
  newPassword: string;
  confirmPassword: string;
};

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useLocale();
  const pushToast = useToastStore((state) => state.pushToast);

  const token = (searchParams.get("token") || "").trim();

  const form = useForm<ResetPasswordForm>({
    resolver: zodResolver(createSchema(t)),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const resetMutation = useMutation({
    mutationFn: (input: { token: string; newPassword: string }) => authApi.resetPassword(input),
    onSuccess: async (result) => {
      pushToast({
        kind: "success",
        title: t("Đổi mật khẩu thành công", "Password reset complete"),
        message: result.message,
      });
      navigate("/login", { replace: true });
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    if (!token) return;
    await resetMutation.mutateAsync({
      token,
      newPassword: values.newPassword,
    });
  });

  if (!token) {
    return (
      <div>
        <h2 className="section-title">{t("Link không hợp lệ", "Invalid Link")}</h2>
        <ErrorBanner
          message={t(
            "Thiếu token đặt lại mật khẩu. Vui lòng mở lại link từ email.",
            "Reset token is missing. Please reopen the reset link from your email.",
          )}
        />
        <p className="switch-text">
          <Link to="/forgot-password">{t("Yêu cầu link mới", "Request a new link")}</Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="section-title">{t("Đặt lại mật khẩu", "Reset Password")}</h2>
      <p className="section-subtitle">
        {t(
          "Tạo mật khẩu mới để đăng nhập lại an toàn.",
          "Create a new password to securely sign in again.",
        )}
      </p>

      {resetMutation.error ? <ErrorBanner message={getErrorMessage(resetMutation.error)} /> : null}

      <form className="form-stack" onSubmit={onSubmit}>
        <Input
          label={t("Mật khẩu mới", "New Password")}
          type="password"
          hint={t("Tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và số", "At least 8 chars with upper/lowercase and number")}
          error={form.formState.errors.newPassword?.message}
          {...form.register("newPassword")}
        />

        <Input
          label={t("Xác nhận mật khẩu", "Confirm Password")}
          type="password"
          error={form.formState.errors.confirmPassword?.message}
          {...form.register("confirmPassword")}
        />

        <Button type="submit" loading={resetMutation.isPending}>
          {t("Lưu mật khẩu mới", "Save new password")}
        </Button>
      </form>

      <p className="switch-text">
        <Link to="/login">{t("Quay lại đăng nhập", "Back to sign in")}</Link>
      </p>
    </div>
  );
}

export default ResetPasswordPage;
