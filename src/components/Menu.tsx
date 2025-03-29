// --- START OF FILE Menu.tsx ---

import { FunctionalComponent } from 'preact';
import { useState } from 'preact/hooks';
import { Router, Route, route } from 'preact-router'; // Import route for programmatic navigation
import LogoutButton from './LogoutButton';
import DateRangeSelector from './DateRangeSelector'; // Import the DateRangeSelector
import '../css/Menu.css';

/** Componentes */
import Dashboard from '../pages/Dashboard';
import Cortes from './../pages/Cortes';
import Salidas from '../pages/Salidas';
import Comisiones from '../pages/Comisiones';
import Kardex from '../pages/Kardex';
import Articulos from '../pages/Articulos';
import Reportes from '../pages/Reportes';
import Ajustes from '../pages/Ajustes';
import PedidosInteligentes from '../pages/PedidosInteligentes';
import HojaCorte from '../pages/HojaCorte';
import Traspasos from '../pages/Traspasos';
import Facturas from '../pages/Facturas';
import Negativos from '../pages/Negativos';
import Existencias from '../pages/Existencias';
import Nomina from '../pages/Nomina';


const Menu: FunctionalComponent = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Function to handle navigation and close sidebar on mobile
  const handleNav = (path: string) => {
    route(path); // Programmatically navigate
    if (window.innerWidth < 768) { // Or your mobile breakpoint
        setIsSidebarOpen(false);
    }
  };


  return (
    <div className="menu-container">
      {/* Barra superior */}
      <div className="top-bar">
        <button
          className="menu-toggle"
          onClick={toggleSidebar}
          aria-label="Toggle menu"
          aria-expanded={isSidebarOpen} // Add aria-expanded
        >
          <span className="menu-icon">☰</span>
        </button>

        {/* Date Range Selector Container */}
        <div className="top-bar-date-selector">
           <DateRangeSelector />
        </div>

        {/* Notification Icon */}
        <div className="notification-badge">
          <span className="notification-icon">🔔</span>
          <span className="notification-count">1</span> {/* Example count */}
        </div>
      </div>

      {/* Overlay for mobile */}
      <div className={`overlay ${isSidebarOpen ? 'active' : ''}`} onClick={toggleSidebar}></div>

      {/* Sidebar */}
      <nav className={`sidebar ${isSidebarOpen ? 'active' : ''}`}>
        {/* Logo */}
        <div className="logo" onClick={() => handleNav('/')} style={{ cursor: 'pointer' }}>
          <span className="logo-blue">Dash</span>
          <span className="logo-black">Farmacia</span>
        </div>

        {/* Menu Principal */}
        {/* Use buttons or divs with onClick for navigation to ensure sidebar closes */}
        <ul className="menu">
          <li className="menu-item"> {/* Removed 'active' class, Router will handle this */}
            <a href="/" onClick={(e) => { e.preventDefault(); handleNav('/'); }} className="menu-link">
              <span className="menu-icon">🏠</span>
              <span>Análisis</span>
            </a>
          </li>
          <li className="menu-item">
            <a href="/cortes" onClick={(e) => { e.preventDefault(); handleNav('/cortes'); }} className="menu-link">
              <span className="menu-icon">📊</span>
              <span>Cortes</span>
            </a>
          </li>
           {/* ... Add onClick={(e) => { e.preventDefault(); handleNav('/path'); }} to other links ... */}
           <li className="menu-item">
            <a href="/kardex" onClick={(e) => { e.preventDefault(); handleNav('/kardex'); }} className="menu-link">
              <span className="menu-icon">📋</span>
              <span>Kardex</span>
            </a>
          </li>
          <li className="menu-item">
            <a href="/salidas" onClick={(e) => { e.preventDefault(); handleNav('/salidas'); }} className="menu-link">
              <span className="menu-icon">📄</span>
              <span>Salidas</span>
            </a>
          </li>
          <li className="menu-item">
            <a href="/comisiones" onClick={(e) => { e.preventDefault(); handleNav('/comisiones'); }} className="menu-link">
              <span className="menu-icon">📈</span>
              <span>Comisiones</span>
            </a>
          </li>
          <li className="menu-item">
            <a href="/articulos" onClick={(e) => { e.preventDefault(); handleNav('/articulos'); }} className="menu-link">
              <span className="menu-icon">💊</span> {/* Changed icon */}
              <span>Articulos</span>
            </a>
          </li>
          <li className="menu-item">
            <a href="/existencias" onClick={(e) => { e.preventDefault(); handleNav('/existencias'); }} className="menu-link">
              <span className="menu-icon">📦</span> {/* Changed icon */}
              <span>Existencias</span>
            </a>
          </li>
          <li className="menu-item">
            <a href="/nomina" onClick={(e) => { e.preventDefault(); handleNav('/nomina'); }} className="menu-link">
              <span className="menu-icon">👥</span> {/* Changed icon */}
              <span>Nomina</span>
            </a>
          </li>
        </ul>

        {/* Sección de reportes */}
        <div className="menu-section">
          <h4 className="section-title">Reportes</h4>
          <ul className="menu">
             {/* ... Add onClick={(e) => { e.preventDefault(); handleNav('/path'); }} to report links ... */}
            <li className="menu-item">
              <a href="/reportes" onClick={(e) => { e.preventDefault(); handleNav('/reportes'); }} className="menu-link">
                <span className="menu-icon">💰</span> {/* Changed icon */}
                <span>Utilidad</span>
              </a>
            </li>
            <li className="menu-item">
              <a href="/reportes/hoja-corte" onClick={(e) => { e.preventDefault(); handleNav('/reportes/hoja-corte'); }} className="menu-link">
                <span className="menu-icon">📄</span>
                <span>Hoja de corte</span>
              </a>
            </li>
            <li className="menu-item">
                {/* Note: Inventario link was missing, added /reportes/inventario route below if needed */}
              <a href="/reportes/inventario" onClick={(e) => { e.preventDefault(); handleNav('/reportes/inventario'); }} className="menu-link">
                <span className="menu-icon">📋</span>
                <span>Inventario</span>
              </a>
            </li>
            <li className="menu-item">
              <a href="/reportes/facturas" onClick={(e) => { e.preventDefault(); handleNav('/reportes/facturas'); }} className="menu-link">
                <span className="menu-icon">🧾</span> {/* Changed icon */}
                <span>Facturas</span>
              </a>
            </li>
            <li className="menu-item">
               {/* Note: Ajustes link was missing, added /reportes/ajustes route below if needed */}
              <a href="/reportes/ajustes" onClick={(e) => { e.preventDefault(); handleNav('/reportes/ajustes'); }} className="menu-link">
                <span className="menu-icon">⚙️</span>
                <span>Ajustes</span>
              </a>
            </li>
            <li className="menu-item">
              <a href="/reportes/traspasos" onClick={(e) => { e.preventDefault(); handleNav('/reportes/traspasos'); }} className="menu-link">
                <span className="menu-icon">🔄</span>
                <span>Traspasos</span>
              </a>
            </li>
            <li className="menu-item">
              <a href="/reportes/negativos" onClick={(e) => { e.preventDefault(); handleNav('/reportes/negativos'); }} className="menu-link">
                <span className="menu-icon">➖</span>
                <span>Negativos</span>
              </a>
            </li>
            <li className="menu-item">
              <a href="/reportes/pedidos-inteligentes" onClick={(e) => { e.preventDefault(); handleNav('/reportes/pedidos-inteligentes'); }} className="menu-link">
                <span className="menu-icon">💡</span> {/* Changed icon */}
                <span>Pedidos Inteligente</span>
              </a>
            </li>
          </ul>
        </div>

        {/* Sección inferior */}
        <div className="menu-bottom">
          <div className="menu-section">
            <ul className="menu">
              <li className="menu-item">
                <a href="/ajustes" onClick={(e) => { e.preventDefault(); handleNav('/ajustes'); }} className="menu-link">
                  <span className="menu-icon">⚙️</span>
                  <span>Ajustes</span>
                </a>
              </li>
              <li className="menu-item logout-item">
                <LogoutButton />
              </li>
            </ul>
          </div>

          {/* Perfil de usuario */}
          <div className="user-profile">
            <div className="user-avatar">
              {/* Consider using an actual image or initials */}
              <span className="user-icon" aria-label="User avatar">👤</span>
            </div>
            <div className="user-info">
              {/* Replace with dynamic data if available */}
              <span className="user-name">Admin</span>
              <span className="user-role">Administrador</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Área principal donde se renderizan las rutas */}
      <main className="main-content"> {/* Use main tag for semantics */}
        <Router>
          <Route path="/" component={Dashboard} />
          <Route path="/cortes" component={Cortes} />
          <Route path="/salidas" component={Salidas} />
          <Route path="/comisiones" component={Comisiones} />
          <Route path="/kardex" component={Kardex} />
          <Route path="/articulos" component={Articulos} />
          <Route path="/existencias" component={Existencias} />
          <Route path="/nomina" component={Nomina} />
          <Route path="/reportes" component={Reportes} />
          {/* Added missing report routes based on menu links */}
          <Route path="/reportes/hoja-corte" component={HojaCorte} />
          <Route path="/reportes/inventario" component={/* Add Inventario component here if exists, e.g., Kardex or a new one */ Kardex} />
          <Route path="/reportes/facturas" component={Facturas} />
          <Route path="/reportes/ajustes" component={/* Add Ajustes component here if exists, e.g., Ajustes or a new one */ Ajustes} />
          <Route path="/reportes/traspasos" component={Traspasos} />
          <Route path="/reportes/negativos" component={Negativos} />
          <Route path="/reportes/pedidos-inteligentes" component={PedidosInteligentes} />
          {/* Main Ajustes page */}
          <Route path="/ajustes" component={Ajustes} />

           {/* Add a default route or 404 handler if needed */}
           {/* <NotFound default /> */}
        </Router>
      </main>
    </div>
  );
}

export default Menu;