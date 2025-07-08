import { h } from 'preact';
import { useState, useEffect, useMemo, useCallback } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { supabase } from '../utils/supabaseClient';

// --- TIPOS DE DATOS ---
interface MaestroSustancia {
  cve_articulo_a: string;
  nombre_comer_a: string;
  sustancia_activa: string;
  cantidadGeneral: number;
}

interface ArticuloSucursal {
  cve_articulo_a: string;
  nombre_comer_a: string;
  depto_a: string;
  subdepto_a: string;
  cant_piso_a: number;
  costo_a: number;
  fecha_modificacion: string;
}

interface SustanciaAgrupada {
  nombre: string;
  stockTotal: number;
}

interface ProductoDetallado {
  nombre_comer_a: string;
  depto_a: string;
  subdepto_a: string;
  inventarioPorSucursal: Record<string, SucursalDetalle | null>;
}

interface SucursalDetalle {
  cantidad: number;
  costo: number;
  fecha_modificacion: string;
}

type SortKey = 'nombre' | 'stockTotal';
type SortOrder = 'asc' | 'desc';
type StockFilter = 'todos' | 'conStock' | 'sinStock';

// --- CONSTANTES ---
const NOMBRES_SUCURSALES = [
  'ArticulosMexico',
  'ArticulosMadero',
  'ArticulosEcono1',
  'ArticulosLopezM',
  'ArticulosBaja',
  'ArticulosEcono2',
  'ArticulosLolita',
];

const NOMBRE_INVALIDO = 'POR DEFINIR';

// --- COMPONENTES AUXILIARES ---

// Portal para el Modal
const Portal = ({ children }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);
  return mounted ? createPortal(children, document.body) : null;
};

// Skeleton para la tabla principal
const TableSkeleton = () => (
  <tbody>
    {[...Array(10)].map((_, i) => (
      <tr key={i}>
        <td colSpan={2} class="p-2">
            <div class="h-12 bg-slate-200 rounded animate-pulse"></div>
        </td>
      </tr>
    ))}
  </tbody>
);

// Skeleton para el contenido del modal
const ModalSkeleton = () => (
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="md:col-span-2 space-y-4">
            <div class="h-8 w-3/4 bg-slate-200 rounded animate-pulse"></div>
            {[...Array(2)].map((_, i) => (
                <div key={i} class="bg-slate-100 p-4 rounded-lg space-y-3">
                    <div class="h-5 w-1/2 bg-slate-200 rounded animate-pulse"></div>
                    <div class="h-4 w-1/4 bg-slate-200 rounded animate-pulse"></div>
                    <div class="h-12 w-full bg-slate-200 rounded animate-pulse mt-2"></div>
                </div>
            ))}
        </div>
        <div class="space-y-4">
            <div class="h-8 w-3/4 bg-slate-200 rounded animate-pulse"></div>
            <div class="h-10 w-full bg-slate-200 rounded animate-pulse"></div>
            <div class="space-y-2">
                {[...Array(3)].map((_, i) => (
                    <div key={i} class="h-8 w-full bg-slate-200 rounded animate-pulse"></div>
                ))}
            </div>
        </div>
    </div>
);


// --- COMPONENTE PRINCIPAL ---
const ExploradorSustancias = () => {
  // --- ESTADOS ---
  const [sustancias, setSustancias] = useState<SustanciaAgrupada[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('todos');
  const [sortKey, setSortKey] = useState<SortKey>('nombre');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const [modalOpen, setModalOpen] = useState(false);
  const [loadingModal, setLoadingModal] = useState(false);
  const [selectedSustancia, setSelectedSustancia] = useState<string | null>(null);
  const [productosDetallados, setProductosDetallados] = useState<ProductoDetallado[]>([]);
  const [sustanciasRelacionadas, setSustanciasRelacionadas] = useState<string[]>([]);
  const [modalError, setModalError] = useState<string | null>(null);

  // --- EFECTOS ---

  // Carga inicial de datos
  useEffect(() => {
    const fetchSustancias = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from('maestrosustancias')
          .select('sustancia_activa, cantidadGeneral');

        if (error) throw error;
        
        const agrupado = data
          .filter(item => item.sustancia_activa && item.sustancia_activa.toUpperCase() !== NOMBRE_INVALIDO)
          .reduce((acc: Record<string, number>, item) => {
            if (!acc[item.sustancia_activa]) {
              acc[item.sustancia_activa] = 0;
            }
            acc[item.sustancia_activa] += item.cantidadGeneral || 0;
            return acc;
          }, {});

        const resultado = Object.entries(agrupado).map(([nombre, stockTotal]) => ({
          nombre,
          stockTotal,
        }));
        
        setSustancias(resultado);
      } catch (err: any) {
        setError(`Error al cargar datos: ${err.message}`);
        console.error('Error fetching from Supabase:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSustancias();
  }, []);
  
  // Efecto para manejar el scroll del body y el foco del teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };

    if (modalOpen) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = 'auto';
    }
    
    return () => {
      document.body.style.overflow = 'auto';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [modalOpen]);


  // --- LÓGICA DE FILTRADO Y ORDENAMIENTO ---
  const filteredAndSortedSustancias = useMemo(() => {
    return sustancias
      .filter(s => {
        const matchesStock = 
          stockFilter === 'todos' ||
          (stockFilter === 'conStock' && s.stockTotal > 0) ||
          (stockFilter === 'sinStock' && s.stockTotal === 0);
        const matchesSearch = s.nombre.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesStock && matchesSearch;
      })
      .sort((a, b) => {
        const valA = a[sortKey];
        const valB = b[sortKey];
        const order = sortOrder === 'asc' ? 1 : -1;
        if (valA < valB) return -1 * order;
        if (valA > valB) return 1 * order;
        return 0;
      });
  }, [sustancias, searchTerm, stockFilter, sortKey, sortOrder]);

  
  // --- MANEJADORES DE EVENTOS ---
  
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };
  
  const openModalWithSustancia = useCallback(async (nombreSustancia: string) => {
    if (!nombreSustancia) return;
    
    setModalOpen(true);
    setLoadingModal(true);
    setSelectedSustancia(nombreSustancia);
    setModalError(null);
    setProductosDetallados([]);
    setSustanciasRelacionadas([]);

    try {
      const { data: productosMaestro, error: maestroError } = await supabase
        .from('maestrosustancias')
        .select('cve_articulo_a, nombre_comer_a')
        .eq('sustancia_activa', nombreSustancia);

      if (maestroError) throw maestroError;
      if (!productosMaestro || productosMaestro.length === 0) {
          setProductosDetallados([]);
          return;
      };

      const codigosArticulos = productosMaestro.map(p => p.cve_articulo_a);

      const consultasSucursales = NOMBRES_SUCURSALES.map(tabla =>
        supabase
          .from(tabla)
          .select('cve_articulo_a, nombre_comer_a, depto_a, subdepto_a, cant_piso_a, costo_a, fecha_modificacion')
          .in('cve_articulo_a', codigosArticulos)
      );

      const resultados = await Promise.all(consultasSucursales);
      
      const productosMap: Record<string, ProductoDetallado> = {};
      resultados.forEach((res, index) => {
        if (res.error) {
          console.warn(`Advertencia al consultar ${NOMBRES_SUCURSALES[index]}: ${res.error.message}`);
          return;
        }
        res.data?.forEach((articulo: ArticuloSucursal) => {
          if (!productosMap[articulo.cve_articulo_a]) {
            productosMap[articulo.cve_articulo_a] = {
              nombre_comer_a: articulo.nombre_comer_a,
              depto_a: articulo.depto_a || 'N/A',
              subdepto_a: articulo.subdepto_a || 'N/A',
              inventarioPorSucursal: {},
            };
          }
          productosMap[articulo.cve_articulo_a].inventarioPorSucursal[NOMBRES_SUCURSALES[index]] = {
            cantidad: articulo.cant_piso_a,
            costo: articulo.costo_a,
            fecha_modificacion: articulo.fecha_modificacion,
          };
        });
      });
      
      setProductosDetallados(Object.values(productosMap));
      findRelatedSustancias(nombreSustancia);

    } catch (err: any) {
      console.error("Error al cargar detalles del modal:", err);
      setModalError(`No se pudieron cargar los detalles. ${err.message}`);
    } finally {
      setLoadingModal(false);
    }
  }, []);

  const closeModal = () => {
    setModalOpen(false);
  };
  
  const findRelatedSustancias = useCallback((baseSustancia: string) => {
    const ingredienteBase = baseSustancia.split(' ')[0].toUpperCase();
    if (!ingredienteBase || ingredienteBase.length < 4) {
      setSustanciasRelacionadas([]);
      return;
    }
    const relacionadas = sustancias
      .map(s => s.nombre)
      .filter(nombre => 
        nombre.toUpperCase().startsWith(ingredienteBase) && 
        nombre.toUpperCase() !== baseSustancia.toUpperCase()
      );
    setSustanciasRelacionadas(relacionadas);
  }, [sustancias]);

  // --- RENDERIZADO ---
  
  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <span class="text-slate-400 opacity-50">↕</span>;
    return sortOrder === 'asc' ? <span class="text-indigo-500">↑</span> : <span class="text-indigo-500">↓</span>;
  };

  return (
    <div class="bg-slate-50 min-h-screen p-4 sm:p-6 md:p-8 font-sans">
      <div class="max-w-7xl mx-auto">
        <header class="mb-6">
          <h1 class="text-3xl font-bold text-slate-800">Explorador de Sustancias</h1>
          <p class="text-slate-600 mt-1">Busca, filtra y explora el inventario de sustancias activas.</p>
        </header>

        <div class="flex flex-col sm:flex-row gap-4 mb-4">
          <input
            type="text"
            placeholder="🔍 Buscar por nombre de sustancia..."
            value={searchTerm}
            onInput={(e) => setSearchTerm((e.target as HTMLInputElement).value)}
            class="w-full sm:w-1/2 md:w-1/3 px-4 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
          />
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter((e.target as HTMLSelectElement).value as StockFilter)}
            class="w-full sm:w-auto px-4 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition bg-white"
          >
            <option value="todos">📦 Todos</option>
            <option value="conStock">✅ Con Stock</option>
            <option value="sinStock">❌ Sin Stock</option>
          </select>
        </div>

        <div class="overflow-x-auto bg-white rounded-lg shadow-md">
          <table class="w-full text-left">
            <thead class="bg-slate-100 border-b-2 border-slate-200">
              <tr>
                <th
                  class="p-4 text-sm font-semibold text-slate-600 cursor-pointer select-none transition-colors hover:bg-slate-200"
                  onClick={() => handleSort('nombre')}
                >
                  <span class="flex items-center gap-2">Sustancia Activa <SortIcon column="nombre" /></span>
                </th>
                <th
                  class="p-4 text-sm font-semibold text-slate-600 cursor-pointer select-none text-right transition-colors hover:bg-slate-200"
                  onClick={() => handleSort('stockTotal')}
                >
                   <span class="flex items-center justify-end gap-2">Stock Total <SortIcon column="stockTotal" /></span>
                </th>
              </tr>
            </thead>
            
            {loading ? <TableSkeleton /> : (
              <tbody>
                {error && (
                  <tr>
                    <td colSpan={2} class="text-center p-8">
                      <div class="text-red-600 bg-red-100 p-4 rounded-lg">{error}</div>
                    </td>
                  </tr>
                )}
                {!error && filteredAndSortedSustancias.map((sustancia) => (
                  <tr
                    key={sustancia.nombre}
                    class="border-b border-slate-200 hover:bg-indigo-50 transition-colors duration-150 cursor-pointer"
                    onClick={() => openModalWithSustancia(sustancia.nombre)}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && openModalWithSustancia(sustancia.nombre)}
                  >
                    <td class="p-4 text-slate-800 font-medium">{sustancia.nombre}</td>
                    <td class="p-4 text-slate-600 text-right font-mono text-lg">{sustancia.stockTotal}</td>
                  </tr>
                ))}
                {!error && filteredAndSortedSustancias.length === 0 && (
                   <tr>
                      <td colSpan={2} class="text-center p-8 text-slate-500">No se encontraron sustancias que coincidan.</td>
                   </tr>
                )}
              </tbody>
            )}
          </table>
        </div>
      </div>
      
      <Portal>
        {modalOpen && (
          <div 
            class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-fade-in"
            onClick={closeModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div 
              class="bg-slate-50 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col m-4 transform animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            >
              <header class="p-4 border-b border-slate-200 flex justify-between items-center flex-shrink-0">
                <div>
                  <h2 id="modal-title" class="text-xl font-bold text-indigo-700">Detalles de la Sustancia</h2>
                  <p class="text-slate-800 font-semibold">{selectedSustancia}</p>
                </div>
                <button onClick={closeModal} class="p-2 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-all text-2xl" aria-label="Cerrar modal">&times;</button>
              </header>
              
              <main class="p-6 overflow-y-auto flex-grow">
                {loadingModal && <ModalSkeleton />}
                {modalError && <div class="text-center p-8 text-red-500 bg-red-100 rounded-lg">{modalError}</div>}
                
                {!loadingModal && !modalError && (
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-8">
                    <div class="md:col-span-2 space-y-4">
                      <h3 class="text-lg font-semibold text-slate-700 border-b pb-2">Productos Comerciales</h3>
                      {productosDetallados.length > 0 ? (
                        productosDetallados.map((prod) => (
                          <div key={prod.nombre_comer_a} class="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                             <p class="font-bold text-slate-800">{prod.nombre_comer_a}</p>
                             <p class="text-sm text-slate-500">{prod.depto_a} / {prod.subdepto_a}</p>
                             <div class="mt-4 text-xs space-y-1">
                               <h4 class="font-semibold mb-2 text-slate-600">Inventario por Sucursal:</h4>
                               <div class="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
                                 {NOMBRES_SUCURSALES.map(sucursal => (
                                     <div key={sucursal} class="flex justify-between items-center border-b border-dotted">
                                         <span class="text-slate-600">{sucursal.replace('Articulos', '')}:</span>
                                         <span class={`font-mono font-bold ${prod.inventarioPorSucursal[sucursal] ? 'text-indigo-600' : 'text-slate-400'}`}>
                                            {prod.inventarioPorSucursal[sucursal]?.cantidad ?? 0}
                                         </span>
                                     </div>
                                 ))}
                               </div>
                             </div>
                          </div>
                        ))
                      ) : (
                        <div class="text-center p-6 bg-slate-100 rounded-lg text-slate-500">
                          No se encontraron productos comerciales para esta sustancia.
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <div class="sticky top-0">
                          <h3 class="text-lg font-semibold text-slate-700 border-b pb-2 mb-4">Relacionados</h3>
                          <button
                              onClick={() => findRelatedSustancias(selectedSustancia!)}
                              class="w-full mb-4 text-sm bg-indigo-500 text-white px-4 py-2 rounded-md hover:bg-indigo-600 transition shadow-sm active:scale-95"
                          >
                            Buscar Presentaciones Relacionadas
                          </button>
                          {sustanciasRelacionadas.length > 0 ? (
                            <ul class="space-y-1">
                              {sustanciasRelacionadas.map(rel => (
                                <li key={rel}>
                                  <button 
                                      onClick={() => openModalWithSustancia(rel)}
                                      class="w-full text-left text-sm text-indigo-700 hover:text-indigo-900 hover:bg-indigo-100 p-2 rounded-md transition-colors"
                                  >
                                    {rel}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div class="text-xs text-slate-500 text-center p-4 bg-slate-100 rounded-md">
                              No se encontraron otras presentaciones.
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                )}
              </main>
            </div>
          </div>
        )}
      </Portal>
    </div>
  );
};

export default ExploradorSustancias;

/*
  tailwind.config.js
  Asegúrate de tener estas animaciones para que el modal aparezca suavemente.

  theme: {
    extend: {
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        }
      },
    },
  },
*/
