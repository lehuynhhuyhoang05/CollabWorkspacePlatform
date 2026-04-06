import { Link, useNavigate } from "react-router-dom";
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

function createRegisterSchema(t: TranslateFn) {
  return z.object({
    name: z
      .string()
      .min(2, t("Tên quá ngắn", "Name is too short"))
      .max(255, t("Tên quá dài", "Name is too long")),
    email: z.string().email(t("Email không đúng định dạng", "Invalid email format")),
    password: z
      .string()
      .min(8, t("Mật khẩu cần ít nhất 8 ký tự", "Password must be at least 8 characters"))
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        t("Cần 1 chữ hoa, 1 chữ thường, 1 chữ số", "Need 1 uppercase, 1 lowercase, 1 number"),
      ),
  });
}

type RegisterFormValues = {
  name: string;
  email: string;
  password: string;
};

export function RegisterPage() {
  const navigate = useNavigate();
  const { t } = useLocale();
  const pushToast = useToastStore((state) => state.pushToast);
  const { setTokens, setUser } = useAuthStore();

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(createRegisterSchema(t)),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: async (tokens) => {
      setTokens(tokens.accessToken, tokens.refreshToken);
      const me = await authApi.me();
      setUser(me);
      pushToast({
        kind: "success",
        title: t("Tạo tài khoản thành công", "Account created"),
        message: t("Bạn đã sẵn sàng bắt đầu workspace.", "You are ready to start your workspace."),
      });
      navigate("/workspaces", { replace: true });
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    await registerMutation.mutateAsync(values);
  });

  return (
    <div>
      <h2 className="section-title">{t("Tạo tài khoản", "Create Account")}</h2>
      <p className="section-subtitle">{t("Bắt đầu workspace của bạn chưa đến một phút.", "Start your workspace in less than a minute.")}</p>

      {registerMutation.error ? <ErrorBanner message={getErrorMessage(registerMutation.error)} /> : null}

      <form className="form-stack" onSubmit={onSubmit}>
        <Input
          label={t("Tên", "Name")}
          type="text"
          placeholder={t("Họ và tên", "Your full name")}
          error={form.formState.errors.name?.message}
          {...form.register("name")}
        />

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
          placeholder={t("Mật khẩu mạnh", "Strong password")}
          hint={t("Tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và số", "At least 8 chars, with upper/lowercase and number")}
          error={form.formState.errors.password?.message}
          {...form.register("password")}
        />

        <Button type="submit" loading={registerMutation.isPending}>
          {t("Tạo tài khoản", "Create Account")}
        </Button>
      </form>

      <p className="switch-text">
        {t("Đã có tài khoản?", "Already have an account?")} <Link to="/login">{t("Đăng nhập", "Sign in")}</Link>
      </p>
    </div>
  );
}
