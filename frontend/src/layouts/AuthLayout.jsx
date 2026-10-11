import { Outlet } from 'react-router-dom'
import { ThemeToggle } from '../components/common/ThemeToggle.jsx'
import { Brand } from '../components/common/Brand.jsx'

const AuthLayout = () => (
  <main className="auth-layout min-vh-100 d-flex align-items-center py-5" id="main-content">
    <div className="container">
      <div className="d-flex justify-content-end mb-3"><ThemeToggle /></div>
      <div className="row justify-content-center">
        <div className="col-12 col-sm-10 col-md-7 col-lg-5 col-xl-4">
          <a className="skip-link" href="#auth-form">Saltar al formulario</a>
          <div className="text-center mb-4"><Brand /></div>
          <div id="auth-form">
          <Outlet />
          </div>
          <p className="text-center small text-secondary mt-4 mb-0">Organizá tus días con claridad.</p>
        </div>
      </div>
    </div>
  </main>
)

export { AuthLayout }
