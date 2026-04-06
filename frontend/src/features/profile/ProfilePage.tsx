import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "../../api/auth.api";
import { useAuthStore } from "../../store/auth.store";
import { useToastStore } from "../../store/toast.store";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card } from "../../components/ui/Card";
import { ErrorBanner } from "../../components/common/ErrorBanner";
import { getErrorMessage } from "../../lib/errors";
import { useLocale } from "../../lib/locale";
import type { User } from "../../types/api";

function ProfileForm({ user }: { user: User }) {
  const { setUser } = useAuthStore();
  const { t } = useLocale();
  const pushToast = useToastStore((state) => state.pushToast);
  const [name, setName] = useState(user.name || "");
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || "");

  const updateMutation = useMutation({
    mutationFn: () => authApi.updateProfile({ name, avatarUrl }),
    onSuccess: (nextUser) => {
      setUser(nextUser);
      pushToast({
        kind: "success",
        title: t("Đã lưu hồ sơ", "Profile saved"),
        message: t("Thông tin tài khoản đã được cập nhật.", "Account profile has been updated."),
      });
    },
  });

  return (
    <div className="page-stack">
      <div className="page-header-row">
        <div>
          <p className="chip">{t("Hồ sơ", "Profile")}</p>
          <h1>{t("Cài đặt tài khoản", "Account Settings")}</h1>
        </div>
      </div>

      {updateMutation.error ? <ErrorBanner message={getErrorMessage(updateMutation.error)} /> : null}

      <Card>
        <h2 className="card-title">{t("Thông tin cơ bản", "Basic Information")}</h2>
        <div className="grid-form">
          <Input
            label={t("Tên", "Name")}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("Tên hiển thị", "Your display name")}
          />
          <Input
            label={t("URL ảnh đại diện", "Avatar URL")}
            value={avatarUrl}
            onChange={(event) => setAvatarUrl(event.target.value)}
            placeholder="https://..."
          />
        </div>

        <Button loading={updateMutation.isPending} onClick={async () => updateMutation.mutateAsync()}>
          {t("Lưu hồ sơ", "Save Profile")}
        </Button>
      </Card>
    </div>
  );
}

export function ProfilePage() {
  const { user } = useAuthStore();
  const { t } = useLocale();

  if (!user) {
    return (
      <div className="page-stack">
        <Card>
          <h2 className="card-title">{t("Hồ sơ", "Profile")}</h2>
          <p className="muted-text">{t("Đang tải hồ sơ...", "Loading profile...")}</p>
        </Card>
      </div>
    );
  }

  return <ProfileForm key={user.id} user={user} />;
}
