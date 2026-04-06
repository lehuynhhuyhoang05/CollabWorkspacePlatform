import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./components/common/RequireAuth";
import { AppLayout } from "./components/layout/AppLayout";
import { AuthLayout } from "./components/layout/AuthLayout";
import { LoginPage } from "./features/auth/LoginPage";
import { RegisterPage } from "./features/auth/RegisterPage";
import { PageDetailPage } from "./features/pages/PageDetailPage";
import { ProfilePage } from "./features/profile/ProfilePage";
import { SharePage } from "./features/share/SharePage";
import { WorkspaceDetailPage } from "./features/workspaces/WorkspaceDetailPage";
import { WorkspacesPage } from "./features/workspaces/WorkspacesPage";
import { ToastViewport } from "./components/common/ToastViewport";

export default function App() {
  return (
    <>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        <Route path="/share/:token" element={<SharePage />} />

        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Navigate to="/workspaces" replace />} />
          <Route path="/workspaces" element={<WorkspacesPage />} />
          <Route path="/workspaces/:workspaceId" element={<WorkspaceDetailPage />} />
          <Route path="/pages/:pageId" element={<PageDetailPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <ToastViewport />
    </>
  );
}
