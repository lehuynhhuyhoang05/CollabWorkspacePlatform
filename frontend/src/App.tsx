import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./components/common/RequireAuth";
import { AppLayout } from "./components/layout/AppLayout";
import { AuthLayout } from "./components/layout/AuthLayout";
import { LoginPage } from "./features/auth/LoginPage";
import { RegisterPage } from "./features/auth/RegisterPage";
import { ForgotPasswordPage } from "./features/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./features/auth/ResetPasswordPage";
import { PrivacyPolicyPage } from "./features/legal/PrivacyPolicyPage";
import { TermsPage } from "./features/legal/TermsPage";
import { InboxPage } from "./features/notifications/InboxPage";
import { PageDetailPage } from "./features/pages/PageDetailPage";
import { GoogleOAuthCallbackPage } from "./features/profile/GoogleOAuthCallbackPage";
import { ProfilePage } from "./features/profile/ProfilePage";
import { PublicHomePage } from "./features/public/PublicHomePage";
import { SharePage } from "./features/share/SharePage";
import { TasksPage } from "./features/tasks/TasksPage";
import { WorkspaceDetailPage } from "./features/workspaces/WorkspaceDetailPage";
import { WorkspacesPage } from "./features/workspaces/WorkspacesPage";
import { ToastViewport } from "./components/common/ToastViewport";
import { useTheme } from "./lib/theme";

export default function App() {
  useTheme();

  return (
    <>
      <Routes>
        <Route path="/" element={<PublicHomePage />} />

        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Route>

        <Route path="/share/:token" element={<SharePage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsPage />} />

        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route path="/workspaces" element={<WorkspacesPage />} />
          <Route path="/workspaces/:workspaceId" element={<WorkspaceDetailPage />} />
          <Route path="/workspaces/:workspaceId/tasks" element={<TasksPage />} />
          <Route path="/tasks/my" element={<TasksPage />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/pages/:pageId" element={<PageDetailPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/integrations/google/callback" element={<GoogleOAuthCallbackPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <ToastViewport />
    </>
  );
}
