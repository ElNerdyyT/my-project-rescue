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

  useEffect(() => {
    fetchSustancias();
  }, []);

  useEffect(() => {
    if (modalState.isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => { document.body.style.overflow = 'auto'; };
  }, [modalState.isOpen]);

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

  const handleAbrirModal = async (sustancia: SustanciaAgrupada) => {
    setModalState({ isOpen: true, sustancia, detalles: [], relacionadas: [], isLoading: true, isLoadingRelacionadas: false });
    try {
      const { data: productosConSustancia } = await supabase.from('maestrosustancias').select('cve_articulo_a, nombre_comer_a').eq('sustancia_activa', sustancia.nombre);
      if (!productosConSustancia || productosConSustancia.length === 0) { setModalState(prev => ({ ...prev, isLoading: false })); return; }
      const codigosArticulos = productosConSustancia.map(p => p.cve_articulo_a);
      const promesas = SUCURSALES_TABLAS.map(tabla => supabase.from(tabla).select('cve_articulo_a, nombre_comer_a, depto_a, subdepto_a, cant_piso_a, costo_a, fecha_modificacion').in('cve_articulo_a', codigosArticulos));
      const resultadosPorSucursal = await Promise.all(promesas);
      const detallesProcesados = productosConSustancia.map(productoBase => {
        const sucursales: DetalleSucursal[] = [];
        resultadosPorSucursal.forEach((resSucursal, index) => {
          const articuloEnSucursal = resSucursal.data?.find(d => d.cve_articulo_a === productoBase.cve_articulo_a);
          if (articuloEnSucursal) sucursales.push({ nombre: getSucursalName(SUCURSALES_TABLAS[index]), cantidad: Number(articuloEnSucursal.cant_piso_a || 0), costo: Number(articuloEnSucursal.costo_a || 0), fecha_mod: articuloEnSucursal.fecha_modificacion ? new Date(articuloEnSucursal.fecha_modificacion).toLocaleDateString('es-MX') : 'N/A' });
        });
        const primerArticuloConDatos = resultadosPorSucursal.flatMap(r => r.data || []).find(d => d.cve_articulo_a === productoBase.cve_articulo_a);
        return { cve_articulo_a: productoBase.cve_articulo_a, nombre_comer_a: productoBase.nombre_comer_a, depto_a: primerArticuloConDatos?.depto_a || 'N/A', subdepto_a: primerArticuloConDatos?.subdepto_a || 'N/A', sucursales: sucursales.sort((a,b) => b.cantidad - a.cantidad) };
      });
      setModalState(prev => ({ ...prev, detalles: detallesProcesados, isLoading: false }));
    } catch(err) {
      console.error("Error al cargar detalles para el modal:", err);
      setModalState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleVerRelacionadas = async (nombreSustancia: string) => {
      setModalState(prev => ({ ...prev, isLoadingRelacionadas: true, relacionadas: [] }));
      try {
          const baseSustancia = nombreSustancia.split(' ')[0];
          const { data, error } = await supabase.from('maestrosustancias').select('sustancia_activa, cantidadGeneral').like('sustancia_activa', `${baseSustancia}%`).not('sustancia_activa', 'eq', nombreSustancia);
          if (error) throw error;
          const relacionadas: SustanciaAgrupada[] = (data || []).map(item => ({ nombre: item.sustancia_activa, stockTotal: item.cantidadGeneral || 0 })).sort((a,b) => a.nombre.localeCompare(b.nombre));
          setModalState(prev => ({ ...prev, relacionadas, isLoadingRelacionadas: false }));
      } catch (err) {
          console.error("Error buscando relacionadas", err);
          setModalState(prev => ({ ...prev, isLoadingRelacionadas: false }));
      }
  };

  return (
    <div class="bg-slate-50 min-h-screen">
      <div class="container mx-auto p-4 md:p-8">
        <div class="bg-white rounded-xl shadow-lg border border-slate-200">
          <div class="p-6 border-b border-slate-200">
            <h2 class="text-3xl font-bold text-slate-800">Explorador de Sustancias Activas</h2>
            <p class="mt-1 text-slate-500">Busca, filtra y explora el stock de las sustancias en todas las sucursales.</p>
          </div>
          
          <div class="p-6">
            <div class="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
              <div class="relative lg:col-span-3">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg class="h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd" /></svg>
                </div>
                <input type="text" placeholder="Buscar por nombre de sustancia..." value={busqueda} onInput={e => setBusqueda(e.currentTarget.value)} class="form-input block w-full pl-10 pr-3 sm:text-sm border-slate-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-base py-2.5" />
              </div>
              <select value={filtroStock} onChange={e => setFiltroStock(e.currentTarget.value)} class="lg:col-span-2 form-select block w-full px-3 sm:text-sm border-slate-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-base py-2.5">
                <option value="todos">Mostrar Todo el Stock</option>
                <option value="conStock">Solo Con Stock</option>
                <option value="sinStock">Solo Sin Stock</option>
              </select>
            </div>

            <div class="overflow-x-auto rounded-lg border border-slate-200">
              <table class="min-w-full divide-y divide-slate-200">
                <thead class="bg-slate-100">
                  <tr>
                    <th onClick={() => setOrden(o => ({ columna: 'nombre', dir: o.columna === 'nombre' && o.dir === 'asc' ? 'desc' : 'asc' }))} class="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider cursor-pointer select-none">Sustancia Activa {orden.columna === 'nombre' && (orden.dir === 'asc' ? '▲' : '▼')}</th>
                    <th onClick={() => setOrden(o => ({ columna: 'stockTotal', dir: o.columna === 'stockTotal' && o.dir === 'asc' ? 'desc' : 'asc' }))} class="px-6 py-3 text-right text-xs font-bold text-slate-600 uppercase tracking-wider cursor-pointer select-none">Stock Total {orden.columna === 'stockTotal' && (orden.dir === 'asc' ? '▲' : '▼')}</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-slate-200">
                  {loading ? ( <tr><td colSpan={2} class="text-center p-8 text-slate-500">Cargando...</td></tr> ) : 
                  !loading && sustanciasFiltradas.length === 0 ? ( <tr><td colSpan={2} class="text-center p-8 text-slate-500">No se encontraron resultados.</td></tr> ) :
                  (sustanciasFiltradas.map(sustancia => (
                    <tr key={sustancia.nombre} onClick={() => handleAbrirModal(sustancia)} class="hover:bg-indigo-50 cursor-pointer transition-colors duration-150">
                      <td class="px-6 py-4 whitespace-nowrap"><div class="text-sm font-semibold text-slate-900">{sustancia.nombre}</div></td>
                      <td class="px-6 py-4 whitespace-nowrap text-right"><span class={`text-base font-bold rounded-md px-2 py-1 ${sustancia.stockTotal > 0 ? 'text-emerald-800 bg-emerald-100' : 'text-rose-800 bg-rose-100'}`}>{sustancia.stockTotal}</span></td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {modalState.isOpen && modalState.sustancia && (
          <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.8)', zIndex: 50, display: 'flex', justifyContent: 'center', alignItems: 'center'}} onClick={() => setModalState({ ...modalState, isOpen: false })}>
            <div class="bg-slate-100 rounded-xl shadow-2xl w-11/12 max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div class="px-6 py-4 border-b border-slate-200 flex justify-between items-center flex-shrink-0">
                <div>
                    <h3 class="text-xl font-bold text-slate-900">{modalState.sustancia.nombre}</h3>
                    <p class="text-sm text-slate-500">Stock Total General: <span class="font-bold text-lg text-emerald-600">{modalState.sustancia.stockTotal}</span></p>
                </div>
                <button onClick={() => setModalState({ ...modalState, isOpen: false })} class="text-slate-400 hover:text-slate-800 text-3xl font-bold">&times;</button>
              </div>
              
              <div class="flex-grow p-4 sm:p-6 overflow-y-auto">
                {modalState.isLoading ? ( <div class="text-center p-8 text-slate-600">Cargando detalles...</div> ) : 
                modalState.detalles.length === 0 ? ( <div class="text-center text-slate-500 py-4">No se encontraron productos para esta sustancia.</div> ) : 
                (<div class="space-y-6">
                  {modalState.detalles.map(producto => (
                    <div key={producto.cve_articulo_a} class="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                      <div class="px-4 py-3 bg-slate-50 border-b border-slate-200"><p class="font-bold text-slate-800">{producto.nombre_comer_a}</p><p class="text-xs text-slate-500">Depto: {producto.depto_a} / Subdepto: {producto.subdepto_a}</p></div>
                      <div class="overflow-x-auto"><table class="min-w-full"><thead class="bg-slate-100 text-xs text-slate-500"><tr><th class="text-left p-2 font-medium">Sucursal</th><th class="text-right p-2 font-medium">Cantidad</th><th class="text-right p-2 font-medium">Costo</th><th class="text-left p-2 font-medium">Últ. Modificación</th></tr></thead>
                        <tbody class="text-sm">
                          {producto.sucursales.map(s => (<tr key={s.nombre} class="border-t border-slate-200"><td class="p-2 font-semibold text-slate-700">{s.nombre}</td><td class={`p-2 text-right font-bold ${s.cantidad <= 0 ? 'text-rose-600' : 'text-slate-800'}`}>{s.cantidad}</td><td class="p-2 text-right text-slate-600">{formatCurrency(s.costo)}</td><td class="p-2 text-slate-600">{s.fecha_mod}</td></tr>))}
                        </tbody>
                      </table></div>
                    </div>
                  ))}
                </div>)}
              </div>
              
              <div class="px-6 pt-4 pb-6 border-t border-slate-200 bg-white/70 backdrop-blur-sm flex-shrink-0">
                  <button onClick={() => handleVerRelacionadas(modalState.sustancia!.nombre)} class="bg-indigo-100 text-indigo-800 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-indigo-200 transition-colors disabled:opacity-50" disabled={modalState.isLoadingRelacionadas}>
                    {modalState.isLoadingRelacionadas ? 'Buscando...' : 'Ver Presentaciones Relacionadas'}
                  </button>
                  {modalState.relacionadas.length > 0 && (
                    <div class="mt-4"><h4 class="font-bold text-sm mb-2 text-slate-700">Otras presentaciones:</h4><div class="flex flex-wrap gap-2">
                      {modalState.relacionadas.map(rel => (
                        <button key={rel.nombre} onClick={() => handleAbrirModal(rel)} class="bg-slate-200 text-slate-800 text-xs font-medium px-3 py-1.5 rounded-full hover:bg-slate-300 transition-colors">
                          {rel.nombre} <span class="font-bold text-slate-900">({rel.stockTotal})</span>
                        </button>
                      ))}
                    </div></div>
                  )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExploradorSustancias;
