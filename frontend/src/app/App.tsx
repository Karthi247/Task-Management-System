import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { AuthProvider } from './contexts/AuthContext';
import { Login } from './pages/auth/Login';
import { Signup } from './pages/auth/Signup';
import { ForgotPassword } from './pages/auth/ForgotPassword';
import { DashboardLayout } from './components/DashboardLayout';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { UserManagement } from './pages/admin/UserManagement';
import { ProjectManagement } from './pages/admin/ProjectManagement';
import { AdminProfile } from './pages/admin/AdminProfile';
import { ManagerDashboard } from './pages/manager/ManagerDashboard';
import { TaskManagement } from './pages/manager/TaskManagement';
import { ProjectView } from './pages/manager/ProjectView';
import { ManagerProfile } from './pages/manager/ManagerProfile';
import { MemberDashboard } from './pages/member/MemberDashboard';
import { MyTasks } from './pages/member/MyTasks';
import { MemberProfile } from './pages/member/MemberProfile';
import { Toaster } from 'sonner';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          <Route path="/admin" element={<DashboardLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="projects" element={<ProjectManagement />} />
            <Route path="profile" element={<AdminProfile />} />
          </Route>

          <Route path="/manager" element={<DashboardLayout />}>
            <Route index element={<Navigate to="/manager/dashboard" replace />} />
            <Route path="dashboard" element={<ManagerDashboard />} />
            <Route path="tasks" element={<TaskManagement />} />
            <Route path="projects" element={<ProjectView />} />
            <Route path="profile" element={<ManagerProfile />} />
          </Route>

          <Route path="/member" element={<DashboardLayout />}>
            <Route index element={<Navigate to="/member/dashboard" replace />} />
            <Route path="dashboard" element={<MemberDashboard />} />
            <Route path="tasks" element={<MyTasks />} />
            <Route path="profile" element={<MemberProfile />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </BrowserRouter>
  );
}
