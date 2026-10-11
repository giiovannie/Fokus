import { Navigate, Route, Routes } from 'react-router-dom'
import { MainLayout } from '../layouts/MainLayout.jsx'
import { AuthLayout } from '../layouts/AuthLayout.jsx'
import { DashboardPage } from '../pages/DashboardPage.jsx'
import { ExamsPage } from '../pages/ExamsPage.jsx'
import { LoginPage } from '../pages/LoginPage.jsx'
import { NotFoundPage } from '../pages/NotFoundPage.jsx'
import { NotificationPreferencesPage } from '../pages/NotificationPreferencesPage.jsx'
import { NotificationsPage } from '../pages/NotificationsPage.jsx'
import { ProfilePage } from '../pages/ProfilePage.jsx'
import { RegisterPage } from '../pages/RegisterPage.jsx'
import { StudyPage } from '../pages/StudyPage.jsx'
import { SubjectsPage } from '../pages/SubjectsPage.jsx'
import { TasksPage } from '../pages/TasksPage.jsx'
import { ProtectedRoute } from './ProtectedRoute.jsx'

const AppRoutes = () => (
  <Routes>
    <Route element={<AuthLayout />}>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
    </Route>
    <Route element={<ProtectedRoute />}>
      <Route element={<MainLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="subjects" element={<SubjectsPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="exams" element={<ExamsPage />} />
        <Route path="study" element={<StudyPage />} />
        <Route path="notifications/preferences" element={<NotificationPreferencesPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
    </Route>
    <Route path="/home" element={<Navigate replace to="/" />} />
    <Route path="*" element={<NotFoundPage />} />
  </Routes>
)

export { AppRoutes }
