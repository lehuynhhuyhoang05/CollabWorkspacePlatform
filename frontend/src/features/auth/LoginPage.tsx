import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { authApi } from "../../api/auth.api";
import { useAuthStore } from "../../store/auth.store";
import { useToastStore } from "../../store/toast.store";
import { getErrorMessage } from "../../lib/errors";
import { useLocale } from "../../lib/locale";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { ErrorBanner } from "../../components/common/ErrorBanner";

type TranslateFn = (vi: string, en: string) => string;

function createLoginSchema(t: TranslateFn) {
  return z.object({
    email: z.string().email(t("Email không đúng định dạng", "Invalid email format")),
    password: z.string().min(1, t("Mật khẩu là bắt buộc", "Password is required")),
  });
}

type LoginFormValues = {
  email: string;
  password: string;
};

interface RouteState {
  from?: {
    pathname?: string;
  };
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLocale();
  const pushToast = useToastStore((state) => state.pushToast);
  const { setTokens, setUser } = useAuthStore();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(createLoginSchema(t)),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: async (tokens) => {
      setTokens(tokens.accessToken, tokens.refreshToken);
      const me = await authApi.me();
      setUser(me);
      pushToast({
        kind: "success",
        title: t("Đăng nhập thành công", "Login successful"),
        message: t("Chào mừng bạn quay lại.", "Welcome back."),
      });

      const routeState = location.state as RouteState | null;
      const nextPath = routeState?.from?.pathname || "/workspaces";
      navigate(nextPath, { replace: true });
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    await loginMutation.mutateAsync(values);
  });

  return (
    <div>
      <h2 className="section-title">{t("Chào mừng quay lại", "Welcome Back")}</h2>
      <p className="section-subtitle">
        {t("Đăng nhập để tiếp tục làm việc cùng nhóm của bạn.", "Sign in to continue working with your team.")}
      </p>

      {loginMutation.error ? <ErrorBanner message={getErrorMessage(loginMutation.error)} /> : null}

      <form className="form-stack" onSubmit={onSubmit}>
        <Input
          label={t("Email", "Email")}
          type="email"
          placeholder="you@example.com"
          error={form.formState.errors.email?.message}
          {...form.register("email")}
        />

        <Input
          label={t("Mật khẩu", "Password")}
          type="password"
          placeholder={t("Nhập mật khẩu", "Your password")}
          error={form.formState.errors.password?.message}
          {...form.register("password")}
        />

        <Button type="submit" loading={loginMutation.isPending}>
          {t("Đăng nhập", "Sign In")}
        </Button>
      </form>

      <p className="switch-text">
        {t("Chưa có tài khoản?", "No account yet?")} <Link to="/register">{t("Tạo mới", "Create one")}</Link>
      </p>
    </div>
  );
}
