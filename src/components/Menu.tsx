import { FunctionalComponent } from 'preact';
import { useState } from 'preact/hooks';
import { Router, Route } from 'preact-router';
import LogoutButton from './LogoutButton';
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

const Menu: FunctionalComponent = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="menu-container">
      {/* Barra superior */}
      <div className="top-bar">
        <button 
          className="menu-toggle"
          onClick={toggleSidebar}
          aria-label="Toggle menu"
        >
          <span className="menu-icon">☰</span>
        </button>
        <div className="search-bar">
          <input
            type="text"
            placeholder="Buscar..."
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>
      
        <div className="notification-badge">
          <span className="notification-icon">🔔</span>
          <span className="notification-count">1</span>
        </div>
      </div>

      {/* Barra lateral */}
      {/* Overlay para móviles */}
      <div className={`overlay ${isSidebarOpen ? 'active' : ''}`} onClick={toggleSidebar}></div>
      
      {/* Barra lateral */}
      <nav className={`sidebar ${isSidebarOpen ? 'active' : ''}`}>
        {/* Logo */}
        <div className="logo">
          <span className="logo-blue">Dash</span>
          <span className="logo-black">Farmacia</span>
        </div>

        {/* Menú principal */}
        <ul className="menu">
          <li className="menu-item active">
            <a href="/" className="menu-link" aria-current="page">
              <span className="menu-icon">🏠</span>
              <span>Análisis</span>
            </a>
          </li>
          <li className="menu-item">
            <a href="/cortes" className="menu-link">
              <span className="menu-icon">📊</span>
              <span>Cortes</span>
            </a>
          </li>
          <li className="menu-item">
            <a href="/kardex" className="menu-link">
              <span className="menu-icon">📋</span>
              <span>Kardex</span>
            </a>
          </li>
          <li className="menu-item">
            <a href="/salidas" className="menu-link">
              <span className="menu-icon">📄</span>
              <span>Salidas</span>
            </a>
          </li>
          <li className="menu-item">
            <a href="/comisiones" className="menu-link">
              <span className="menu-icon">📈</span>
              <span>Comisiones</span>
            </a>
          </li>
          <li className="menu-item">
            <a href="/ventas" className="menu-link">
              <span className="menu-icon">💵</span>
              <span>Ventas</span>
            </a>
          </li>
        </ul>

        {/* Sección de reportes */}
        <div className="menu-section">
          <h4 className="section-title">Reportes</h4>
          <ul className="menu">
            <li className="menu-item">
              <a href="/reportes" className="menu-link">
                <span className="menu-icon">📊</span>
                <span>Utilidad</span>
              </a>
            </li>
            <li className="menu-item">
              <a href="/reportes/hoja-corte" className="menu-link">
                <span className="menu-icon">📄</span>
                <span>Hoja de corte</span>
              </a>
            </li>
            <li className="menu-item">
              <a href="/reportes/inventario" className="menu-link">
                <span className="menu-icon">📋</span>
                <span>Inventario</span>
              </a>
            </li>
            <li className="menu-item">
              <a href="/reportes/facturas" className="menu-link">
                <span className="menu-icon">📄</span>
                <span>Facturas</span>
              </a>
            </li>
            <li className="menu-item">
              <a href="/reportes/ajustes" className="menu-link">
                <span className="menu-icon">⚙️</span>
                <span>Ajustes</span>
              </a>
            </li>
            <li className="menu-item">
              <a href="/reportes/traspasos" className="menu-link">
                <span className="menu-icon">🔄</span>
                <span>Traspasos</span>
              </a>
            </li>
            <li className="menu-item">
              <a href="/reportes/negativos" className="menu-link">
                <span className="menu-icon">➖</span>
                <span>Negativos</span>
              </a>
            </li>
            <li className="menu-item">
              <a href="/reportes/pedidos-inteligentes" className="menu-link">
                <span className="menu-icon">🛍️</span>
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
                <a href="/ajustes" className="menu-link">
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
              <span className="user-icon">👤</span>
            </div>
            <div className="user-info">
              <span className="user-name">Admin</span>
              <span className="user-role">Administrador</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Área principal donde se renderizan las rutas */}
      <div className="main-content">
        <Router>
          <Route path="/" component={Dashboard} />
          <Route path="/cortes" component={Cortes} />
          <Route path="/salidas" component={Salidas} />
          <Route path="/comisiones" component={Comisiones} />
          <Route path="/kardex" component={Kardex} />
          <Route path="/articulos" component={Articulos} />
          <Route path="/reportes" component={Reportes} />
          <Route path="/ajustes" component={Ajustes} />
          <Route path="/reportes/pedidos-inteligentes" component={PedidosInteligentes} />
        </Router>
      </div>
    </div>
  );
}

export default Menu;
