import { useState, useEffect, useMemo } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';

// --- TIPOS DE DATOS ---
interface SustanciaAgrupada {
  nombre: string;
  stockTotal: number;
}

interface DetalleProducto {
  cve_articulo_a: string;
  nombre_comer_a: string;
  depto_a: string;
  subdepto_a: string;
  sucursales: DetalleSucursal[];
}

interface DetalleSucursal {
  nombre: string;
  cantidad: number;
  costo: number;
  fecha_mod: string;
}

// --- CONSTANTES ---
const SUCURSALES_TABLAS = [
  'ArticulosMexico', 'ArticulosMadero', 'ArticulosEcono1', 
  'ArticulosLopezM', 'ArticulosBaja', 'ArticulosEcono2', 'ArticulosLolita'
];

// --- COMPONENTE PRINCIPAL ---
const ExploradorSustancias = () => {
  const [sustancias, setSustancias] = useState<SustanciaAgrupada[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // -- Estados para filtros y búsqueda --
  const [busqueda, setBusqueda] = useState('');
  const [filtroStock, setFiltroStock] = useState('todos'); // 'todos', 'conStock', 'sinStock'
  const [orden, setOrden] = useState({ columna: 'stockTotal', dir: 'desc' });

  // -- Estados para el modal --
  const [modalAbierto, setModalAbierto] = useState(false);
  const [sustanciaSeleccionada, setSustanciaSeleccionada] = useState<SustanciaAgrupada | null>(null);
  const [detallesSustancia, setDetallesSustancia] = useState<DetalleProducto[]>([]);
  const [loadingModal, setLoadingModal] = useState(false);
  
  // -- Estado para sustancias relacionadas --
  const [sustanciasRelacionadas, setSustanciasRelacionadas] = useState<SustanciaAgrupada[]>([]);
  const [loadingRelacionadas, setLoadingRelacionadas] = useState(false);

  // Carga inicial de datos
  useEffect(() => {
    const fetchSustancias = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('maestrosustancias')
          .select('sustancia_activa, cantidadGeneral')
          .not('sustancia_activa', 'eq', 'POR DEFINIR');

        if (error) throw error;
        
        const agrupado = (data || []).reduce((acc, item) => {
          const { sustancia_activa, cantidadGeneral } = item;
          if (!acc[sustancia_activa]) acc[sustancia_activa] = 0;
          acc[sustancia_activa] += cantidadGeneral || 0;
          return acc;
        }, {} as Record<string, number>);

        const listaSustancias: SustanciaAgrupada[] = Object.entries(agrupado)
          .map(([nombre, stockTotal]) => ({ nombre, stockTotal }));

        setSustancias(listaSustancias);
      } catch (err) {
        setError('Error al cargar la lista de sustancias.');
      } finally {
        setLoading(false);
      }
    };
    fetchSustancias();
  }, []);

  // Lógica de filtrado, búsqueda y ordenamiento (se ejecuta cada vez que cambia un filtro)
  const sustanciasFiltradas = useMemo(() => {
    return sustancias
      .filter(s => {
        if (filtroStock === 'conStock') return s.stockTotal > 0;
        if (filtroStock === 'sinStock') return s.stockTotal <= 0;
        return true;
      })
      .filter(s => s.nombre.toLowerCase().includes(busqueda.toLowerCase()))
      .sort((a, b) => {
        const valA = orden.columna === 'nombre' ? a.nombre : a.stockTotal;
        const valB = orden.columna === 'nombre' ? b.nombre : b.stockTotal;
        
        if (valA < valB) return orden.dir === 'asc' ? -1 : 1;
        if (valA > valB) return orden.dir === 'asc' ? 1 : -1;
        return 0;
      });
  }, [sustancias, busqueda, filtroStock, orden]);

  const handleOrdenar = (columna: string) => {
    setOrden(prev => ({
      columna,
      dir: prev.columna === columna && prev.dir === 'desc' ? 'asc' : 'desc'
    }));
  };

  // Función para buscar sustancias relacionadas en el modal
  const handleVerRelacionadas = async (nombreSustancia: string) => {
      setLoadingRelacionadas(true);
      setSustanciasRelacionadas([]);
      try {
          // Extraemos el nombre base (ej. "PARACETAMOL" de "PARACETAMOL 500MG")
          const baseSustancia = nombreSustancia.split(' ')[0];
          const { data, error } = await supabase
              .from('maestrosustancias')
              .select('sustancia_activa, cantidadGeneral')
              .like('sustancia_activa', `${baseSustancia}%`)
              .not('sustancia_activa', 'eq', nombreSustancia); // Excluimos la actual

          if (error) throw error;
          
          const relacionadas = (data || []).map(item => ({
              nombre: item.sustancia_activa,
              stockTotal: item.cantidadGeneral || 0,
          }));
          setSustanciasRelacionadas(relacionadas);

      } catch (err) {
          console.error("Error buscando relacionadas", err);
      } finally {
          setLoadingRelacionadas(false);
      }
  };
  
  // (La función handleAbrirModal y el resto de la lógica del modal se mantienen igual que en la versión anterior)
  // ... (incluir aquí la función handleAbrirModal del componente anterior)

  return (
    <div class="container mx-auto p-4 md:p-6">
      <div class="bg-white rounded-lg shadow-md border border-gray-200 p-6">
        <h2 class="text-2xl font-bold mb-4 text-gray-800">Explorador de Sustancias</h2>
        
        {/* Barra de Filtros y Búsqueda */}
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <input
            type="text"
            placeholder="Buscar por nombre de sustancia..."
            value={busqueda}
            onInput={e => setBusqueda(e.currentTarget.value)}
            class="md:col-span-2 form-input px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={filtroStock}
            onChange={e => setFiltroStock(e.currentTarget.value)}
            class="form-select px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="todos">Todo el Stock</option>
            <option value="conStock">Con Stock</option>
            <option value="sinStock">Sin Stock</option>
          </select>
        </div>

        {/* Tabla de Sustancias */}
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-100">
              <tr>
                <th onClick={() => handleOrdenar('nombre')} class="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer">
                  Sustancia Activa {orden.columna === 'nombre' && (orden.dir === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleOrdenar('stockTotal')} class="px-6 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer">
                  Stock Total {orden.columna === 'stockTotal' && (orden.dir === 'asc' ? '▲' : '▼')}
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={2} class="text-center p-8 text-gray-500">Cargando...</td></tr>
              ) : (
                sustanciasFiltradas.map(sustancia => (
                  <tr key={sustancia.nombre} onClick={() => { /* Lógica de handleAbrirModal */ }} class="hover:bg-blue-50 cursor-pointer transition-colors">
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="text-sm font-medium text-gray-900">{sustancia.nombre}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right">
                      <span class={`text-sm font-bold ${sustancia.stockTotal > 0 ? 'text-green-700' : 'text-red-600'}`}>
                        {sustancia.stockTotal}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* El Modal (con la nueva sección de "Relacionadas") */}
      {modalAbierto && sustanciaSeleccionada && (
         <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
          <div class="bg-gray-100 rounded-lg shadow-2xl max-w-4xl w-full max-h-full overflow-y-auto">
             {/* ... (Contenido del modal, igual que en la versión anterior) ... */}

             {/* Nueva sección para sustancias relacionadas */}
             <div class="px-6 pt-4 pb-6">
                <button 
                  onClick={() => handleVerRelacionadas(sustanciaSeleccionada.nombre)}
                  class="btn btn-sm btn-outline-primary" // Ajusta clases según tu CSS
                  disabled={loadingRelacionadas}
                >
                  {loadingRelacionadas ? 'Buscando...' : 'Ver Presentaciones Relacionadas'}
                </button>

                {sustanciasRelacionadas.length > 0 && (
                  <div class="mt-4 space-y-2">
                    <h4 class="font-bold">Otras presentaciones encontradas:</h4>
                    <ul class="list-disc pl-5">
                      {sustanciasRelacionadas.map(rel => (
                        <li key={rel.nombre} class="text-sm">
                          {rel.nombre} (Stock: <span class="font-bold">{rel.stockTotal}</span>)
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExploradorSustancias;
