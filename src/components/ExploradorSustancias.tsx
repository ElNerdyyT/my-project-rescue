import { useState, useEffect, useMemo } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';

// --- Interfaces para una estructura de datos clara ---
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

// --- Constantes y Helpers ---
const SUCURSALES_TABLAS = [
  'ArticulosMexico', 'ArticulosMadero', 'ArticulosEcono1', 
  'ArticulosLopezM', 'ArticulosBaja', 'ArticulosEcono2', 'ArticulosLolita'
];

const getSucursalName = (tableName: string) => tableName.replace('Articulos', '');
const formatCurrency = (value: number) => `$${(value || 0).toFixed(2)}`;

// --- Componente Principal ---
const ExploradorSustancias = () => {
  // --- Estados de la Vista Principal ---
  const [sustancias, setSustancias] = useState<SustanciaAgrupada[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtroStock, setFiltroStock] = useState('todos');
  const [orden, setOrden] = useState({ columna: 'stockTotal', dir: 'desc' });

  // --- Estado Unificado para el Modal ---
  const [modalState, setModalState] = useState({
    isOpen: false,
    sustancia: null as SustanciaAgrupada | null,
    detalles: [] as DetalleProducto[],
    relacionadas: [] as SustanciaAgrupada[],
    isLoading: false,
    isLoadingRelacionadas: false,
  });

  // --- Lógica de Datos ---

  // Carga inicial de la lista de sustancias
  useEffect(() => {
    fetchSustancias();
  }, []);

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

  // Filtrado y ordenamiento en el cliente para máxima velocidad
  const sustanciasFiltradas = useMemo(() => {
    return sustancias
      .filter(s => {
        if (filtroStock === 'conStock') return s.stockTotal > 0;
        if (filtroStock === 'sinStock') return s.stockTotal <= 0;
        return true;
      })
      .filter(s => s.nombre.toLowerCase().includes(busqueda.toLowerCase()))
      .sort((a, b) => {
        const valA = orden.columna === 'nombre' ? a.nombre.toLowerCase() : a.stockTotal;
        const valB = orden.columna === 'nombre' ? b.nombre.toLowerCase() : b.stockTotal;
        
        if (valA < valB) return orden.dir === 'asc' ? -1 : 1;
        if (valA > valB) return orden.dir === 'asc' ? 1 : -1;
        return 0;
      });
  }, [sustancias, busqueda, filtroStock, orden]);

  // Manejo del click para abrir el modal y buscar detalles
  const handleAbrirModal = async (sustancia: SustanciaAgrupada) => {
    setModalState({
      isOpen: true,
      sustancia,
      detalles: [],
      relacionadas: [],
      isLoading: true,
      isLoadingRelacionadas: false,
    });

    try {
      const { data: productosConSustancia } = await supabase
        .from('maestrosustancias')
        .select('cve_articulo_a, nombre_comer_a')
        .eq('sustancia_activa', sustancia.nombre);

      if (!productosConSustancia || productosConSustancia.length === 0) {
        setModalState(prev => ({ ...prev, isLoading: false }));
        return;
      }
      
      const codigosArticulos = productosConSustancia.map(p => p.cve_articulo_a);

      const promesas = SUCURSALES_TABLAS.map(tabla =>
        supabase
          .from(tabla)
          .select('cve_articulo_a, nombre_comer_a, depto_a, subdepto_a, cant_piso_a, costo_a, fecha_modificacion')
          .in('cve_articulo_a', codigosArticulos)
      );

      const resultadosPorSucursal = await Promise.all(promesas);

      const detallesProcesados = productosConSustancia.map(productoBase => {
        const sucursales: DetalleSucursal[] = [];
        resultadosPorSucursal.forEach((resSucursal, index) => {
          const articuloEnSucursal = resSucursal.data?.find(d => d.cve_articulo_a === productoBase.cve_articulo_a);
          if (articuloEnSucursal) {
            sucursales.push({
              nombre: getSucursalName(SUCURSALES_TABLAS[index]),
              cantidad: Number(articuloEnSucursal.cant_piso_a || 0),
              costo: Number(articuloEnSucursal.costo_a || 0),
              fecha_mod: articuloEnSucursal.fecha_modificacion ? new Date(articuloEnSucursal.fecha_modificacion).toLocaleDateString('es-MX') : 'N/A'
            });
          }
        });

        const primerArticuloConDatos = resultadosPorSucursal.flatMap(r => r.data || []).find(d => d.cve_articulo_a === productoBase.cve_articulo_a);

        return {
          cve_articulo_a: productoBase.cve_articulo_a,
          nombre_comer_a: productoBase.nombre_comer_a,
          depto_a: primerArticuloConDatos?.depto_a || 'N/A',
          subdepto_a: primerArticuloConDatos?.subdepto_a || 'N/A',
          sucursales: sucursales.sort((a,b) => b.cantidad - a.cantidad),
        };
      });
      
      setModalState(prev => ({ ...prev, detalles: detallesProcesados, isLoading: false }));

    } catch(err) {
      console.error("Error al cargar detalles para el modal:", err);
      setModalState(prev => ({ ...prev, isLoading: false, error: 'No se pudieron cargar los detalles.' }));
    }
  };

  // Función para buscar y mostrar sustancias relacionadas DENTRO del modal
  const handleVerRelacionadas = async (nombreSustancia: string) => {
      setModalState(prev => ({ ...prev, isLoadingRelacionadas: true, relacionadas: [] }));
      try {
          const baseSustancia = nombreSustancia.split(' ')[0];
          const { data, error } = await supabase
              .from('maestrosustancias')
              .select('sustancia_activa, cantidadGeneral')
              .like('sustancia_activa', `${baseSustancia}%`)
              .not('sustancia_activa', 'eq', nombreSustancia);

          if (error) throw error;
          
          const relacionadas: SustanciaAgrupada[] = (data || []).map(item => ({
              nombre: item.sustancia_activa,
              stockTotal: item.cantidadGeneral || 0,
          })).sort((a,b) => a.nombre.localeCompare(b.nombre));

          setModalState(prev => ({ ...prev, relacionadas, isLoadingRelacionadas: false }));
      } catch (err) {
          console.error("Error buscando relacionadas", err);
          setModalState(prev => ({ ...prev, isLoadingRelacionadas: false }));
      }
  };

  // --- Renderizado del Componente ---

  return (
    <div class="container mx-auto p-4 md:p-6">
      <div class="bg-white rounded-lg shadow-md border border-gray-200 p-6">
        <h2 class="text-2xl font-bold mb-4 text-gray-800">Explorador de Sustancias</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <input
            type="text"
            placeholder="Buscar por nombre de sustancia..."
            value={busqueda}
            onInput={e => setBusqueda(e.currentTarget.value)}
            class="md:col-span-2 form-input px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          />
          <select value={filtroStock} onChange={e => setFiltroStock(e.currentTarget.value)} class="form-select px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500">
            <option value="todos">Todo el Stock</option>
            <option value="conStock">Con Stock</option>
            <option value="sinStock">Sin Stock</option>
          </select>
        </div>

        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-100">
              <tr>
                <th onClick={() => setOrden(o => ({ columna: 'nombre', dir: o.dir === 'asc' ? 'desc' : 'asc' }))} class="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer">Sustancia Activa {orden.columna === 'nombre' && (orden.dir === 'asc' ? '▲' : '▼')}</th>
                <th onClick={() => setOrden(o => ({ columna: 'stockTotal', dir: o.dir === 'asc' ? 'desc' : 'asc' }))} class="px-6 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer">Stock Total {orden.columna === 'stockTotal' && (orden.dir === 'asc' ? '▲' : '▼')}</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={2} class="text-center p-8 text-gray-500">Cargando...</td></tr>
              ) : (
                sustanciasFiltradas.map(sustancia => (
                  <tr key={sustancia.nombre} onClick={() => handleAbrirModal(sustancia)} class="hover:bg-blue-50 cursor-pointer transition-colors">
                    <td class="px-6 py-4 whitespace-nowrap"><div class="text-sm font-medium text-gray-900">{sustancia.nombre}</div></td>
                    <td class="px-6 py-4 whitespace-nowrap text-right"><span class={`text-sm font-bold ${sustancia.stockTotal > 0 ? 'text-green-700' : 'text-gray-500'}`}>{sustancia.stockTotal}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODAL (CON ESTILOS EN LÍNEA PARA ARREGLAR POSICIONAMIENTO) --- */}
      {modalState.isOpen && modalState.sustancia && (
        <div 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)', zIndex: 50,
            display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem'
          }}
          onClick={() => setModalState({ ...modalState, isOpen: false })}
        >
          <div 
            class="bg-gray-100 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col" 
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-white rounded-t-lg">
              <div>
                  <h3 class="text-xl font-bold text-gray-900">{modalState.sustancia.nombre}</h3>
                  <p class="text-sm text-gray-600">Cantidad Total General: <span class="font-bold text-lg text-green-700">{modalState.sustancia.stockTotal}</span></p>
              </div>
              <button onClick={() => setModalState({ ...modalState, isOpen: false })} class="text-gray-400 hover:text-gray-800 text-3xl font-bold">&times;</button>
            </div>
            
            {/* Modal Body */}
            <div class="p-6 overflow-y-auto">
              {modalState.isLoading ? (
                <div class="text-center p-8">Cargando detalles...</div>
              ) : (
                <div class="space-y-6">
                  {modalState.detalles.map(producto => (
                    <div key={producto.cve_articulo_a} class="bg-white rounded-md border border-gray-200 overflow-hidden">
                      <div class="px-4 py-2 bg-gray-50 border-b"><p class="font-bold text-gray-800">{producto.nombre_comer_a}</p><p class="text-xs text-gray-500">Depto: {producto.depto_a} / Subdepto: {producto.subdepto_a}</p></div>
                      <table class="min-w-full"><thead class="bg-gray-100 text-xs text-gray-500"><tr><th class="text-left p-2 font-medium">Sucursal</th><th class="text-right p-2 font-medium">Cantidad</th><th class="text-right p-2 font-medium">Costo</th><th class="text-left p-2 font-medium">Últ. Modificación</th></tr></thead>
                        <tbody class="text-sm">
                          {producto.sucursales.map(s => (<tr key={s.nombre} class="border-t border-gray-100"><td class="p-2 font-medium">{s.nombre}</td><td class={`p-2 text-right font-semibold ${s.cantidad < 0 ? 'text-red-600' : 'text-gray-800'}`}>{s.cantidad}</td><td class="p-2 text-right text-gray-600">{formatCurrency(s.costo)}</td><td class="p-2 text-gray-600">{s.fecha_mod}</td></tr>))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                  {modalState.detalles.length === 0 && <p class="text-center text-gray-500">No se encontraron productos para esta sustancia.</p>}
                </div>
              )}
            </div>
            
            {/* Modal Footer con Sustancias Relacionadas */}
            <div class="px-6 pt-4 pb-6 border-t bg-white rounded-b-lg">
                <button onClick={() => handleVerRelacionadas(modalState.sustancia!.nombre)} class="bg-blue-100 text-blue-800 text-sm font-semibold px-4 py-2 rounded-md hover:bg-blue-200 disabled:opacity-50" disabled={modalState.isLoadingRelacionadas}>
                  {modalState.isLoadingRelacionadas ? 'Buscando...' : 'Ver Presentaciones Relacionadas'}
                </button>
                {modalState.relacionadas.length > 0 && (
                  <div class="mt-4">
                    <h4 class="font-bold text-sm mb-2">Otras presentaciones:</h4>
                    <div class="flex flex-wrap gap-2">
                      {modalState.relacionadas.map(rel => (
                        <button key={rel.nombre} onClick={() => handleAbrirModal(rel)} class="bg-gray-200 text-gray-800 text-xs px-3 py-1 rounded-full hover:bg-gray-300">
                          {rel.nombre} <span class="font-bold">({rel.stockTotal})</span>
                        </button>
                      ))}
                    </div>
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
