import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
export const StudentRoute = () => useAuth().user?.role === 'superadmin' ? <Navigate replace to="/admin" /> : <Outlet />
