import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
export const AdminRoute = () => useAuth().user?.role === 'superadmin' ? <Outlet /> : <Navigate to="/" replace />
