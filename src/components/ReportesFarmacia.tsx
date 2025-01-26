import { FunctionalComponent } from 'preact';
import { useState } from 'preact/hooks';
import VentasReport from './VentasReport';

const ReportesFarmacia: FunctionalComponent = () => {
  const [activeTab, setActiveTab] = useState<string>('Ventas'); // Estado para la pestaña activa

  // Función para cambiar la pestaña activa
  const handleTabClick = (tab: string) => {
    setActiveTab(tab);
  };

  return (
    <div>
      <ul class="nav nav-underline">
        <li class="nav-item">
          <a
            class={`nav-link ${activeTab === 'Ventas' ? 'active' : ''}`}
            href="#"
            onClick={() => handleTabClick('Ventas')}
          >
            Ventas
          </a>
        </li>
        <li class="nav-item">
          <a
            class={`nav-link ${activeTab === 'Utilidad' ? 'active' : ''}`}
            href="#"
            onClick={() => handleTabClick('Utilidad')}
          >
            Utilidad
          </a>
        </li>
        <li class="nav-item">
          <a
            class={`nav-link ${activeTab === 'Gastos' ? 'active' : ''}`}
            href="#"
            onClick={() => handleTabClick('Gastos')}
          >
            Gastos
          </a>
        </li>
        <li class="nav-item">
          <a
            class={`nav-link ${activeTab === 'Pedidos' ? 'active' : ''}`}
            href="#"
            onClick={() => handleTabClick('Pedidos')}
          >
            Pedidos
          </a>
        </li>
        <li class="nav-item">
          <a
            class={`nav-link ${activeTab === 'Facturas' ? 'active' : ''}`}
            href="#"
            onClick={() => handleTabClick('Facturas')}
          >
            Facturas
          </a>
        </li>
        <li class="nav-item">
          <a
            class={`nav-link ${activeTab === 'Salidas' ? 'active' : ''}`}
            href="#"
            onClick={() => handleTabClick('Salidas')}
          >
            Salidas
          </a>
        </li>
        <li class="nav-item">
          <a
            class={`nav-link ${activeTab === 'Comisiones' ? 'active' : ''}`}
            href="#"
            onClick={() => handleTabClick('Comisiones')}
          >
            Comisiones
          </a>
        </li>
        <li class="nav-item">
          <a
            class={`nav-link ${activeTab === 'Ranking' ? 'active' : ''}`}
            href="#"
            onClick={() => handleTabClick('Ranking')}
          >
            Ranking
          </a>
        </li>
      </ul>

      {/* Mostrar el contenido de la pestaña activa */}
      <div class="tab-content mt-3">
        {activeTab === 'Ventas' && <div>Contenido de Ventas <VentasReport /></div>}
        {activeTab === 'Utilidad' && <div>Contenido de Utilidad</div>}
        {activeTab === 'Gastos' && <div>Contenido de Gastos</div>}
        {activeTab === 'Pedidos' && <div>Contenido de Pedidos</div>}
        {activeTab === 'Facturas' && <div>Contenido de Facturas</div>}
        {activeTab === 'Salidas' && <div>Contenido de Salidas</div>}
        {activeTab === 'Comisiones' && <div>Contenido de Comisiones</div>}
        {activeTab === 'Ranking' && <div>Contenido de Ranking</div>}
      </div>
    </div>
  );
};

export default ReportesFarmacia;
