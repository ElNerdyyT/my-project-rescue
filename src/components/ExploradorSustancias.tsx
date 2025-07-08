import { h } from 'preact';
import { useState, useEffect, useMemo, useCallback } from 'preact/hooks';
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

// --- COMPONENTE PRINCIPAL ---
const ExploradorSustancias = () => {
  // --- ESTADOS ---
  const [sustancias, setSustancias] = useState<SustanciaAgrupada[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados para la UI de la tabla principal
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('todos');
  const [sortKey, setSortKey] = useState<SortKey>('nombre');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Estados para el Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingModal, setLoadingModal] = useState(false);
  const [selectedSustancia, setSelectedSustancia] = useState<string | null>(null);
  const [productosDetallados, setProductosDetallados] = useState<ProductoDetallado[]>([]);
  const [sustanciasRelacionadas, setSustanciasRelacionadas] = useState<string[]>([]);
  const [modalError, setModalError] = useState<string | null>(null);

  // --- EFECTOS ---

  // Carga inicial de datos desde `maestrosustancias`
  useEffect(() => {
    const fetchSustancias = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('maestrosustancias')
        .select('sustancia_activa, cantidadGeneral');

      if (error) {
        setError(`Error al cargar datos: ${error.message}`);
        console.error('Error fetching from Supabase:', error);
      } else if (data) {
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
      }
      setLoading(false);
    };

    fetchSustancias();
  }, []);
  
  // Bloquear/desbloquear scroll del body cuando el modal se abre/cierra
  useEffect(() => {
    if (modalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [modalOpen]);


  // --- LÓGICA DE FILTRADO Y ORDENAMIENTO (CLIENT-SIDE) ---
  const filteredAndSortedSustancias = useMemo(() => {
    let resultado = [...sustancias];

    // 1. Filtrado por stock
    if (stockFilter === 'conStock') {
      resultado = resultado.filter(s => s.stockTotal > 0);
    } else if (stockFilter === 'sinStock') {
      resultado = resultado.filter(s => s.stockTotal === 0);
    }

    // 2. Filtrado por término de búsqueda
    if (searchTerm) {
      resultado = resultado.filter(s =>
        s.nombre.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // 3. Ordenamiento
    resultado.sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return resultado;
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
  
  const openModalWithSustancia = async (nombreSustancia: string) => {
    if (!nombreSustancia) return;
    
    setModalOpen(true);
    setLoadingModal(true);
    setSelectedSustancia(nombreSustancia);
    setModalError(null);

    try {
      // 1. Obtener los productos comerciales para la sustancia seleccionada
      const { data: productosMaestro, error: maestroError } = await supabase
        .from('maestrosustancias')
        .select('cve_articulo_a, nombre_comer_a')
        .eq('sustancia_activa', nombreSustancia);

      if (maestroError) throw maestroError;

      const codigosArticulos = productosMaestro.map(p => p.cve_articulo_a);

      // 2. Consultar el inventario en las 7 sucursales de forma concurrente
      const consultasSucursales = NOMBRES_SUCURSALES.map(tabla =>
        supabase
          .from(tabla)
          .select('cve_articulo_a, nombre_comer_a, depto_a, subdepto_a, cant_piso_a, costo_a, fecha_modificacion')
          .in('cve_articulo_a', codigosArticulos)
      );

      const resultados = await Promise.all(consultasSucursales);

      // 3. Procesar y combinar los datos
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

      // 4. Encontrar sustancias relacionadas (opcionalmente al abrir el modal)
      await findRelatedSustancias(nombreSustancia);

    } catch (err: any) {
      console.error("Error al cargar detalles del modal:", err);
      setModalError(`No se pudieron cargar los detalles. ${err.message}`);
    } finally {
      setLoadingModal(false);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedSustancia(null);
    setProductosDetallados([]);
    setSustanciasRelacionadas([]);
    setModalError(null);
  };
  
  const findRelatedSustancias = async (baseSustancia: string) => {
    const ingredienteBase = baseSustancia.split(' ')[0].toUpperCase();
    if (!ingredienteBase || ingredienteBase.length < 4) {
      setSustanciasRelacionadas([]);
      return;
    }

    // Filtrar de la lista ya cargada para eficiencia
    const relacionadas = sustancias
      .map(s => s.nombre)
      .filter(nombre => 
        nombre.toUpperCase().startsWith(ingredienteBase) && 
        nombre.toUpperCase() !== baseSustancia.toUpperCase()
      );
      
    setSustanciasRelacionadas(relacionadas);
  };

  const handleRelatedClick = (nombreRelacionada: string) => {
      openModalWithSustancia(nombreRelacionada);
  };


  // --- RENDERIZADO ---

  if (loading) {
    return <div class="text-center p-8 text-slate-500">Cargando sustancias...</div>;
  }

  if (error) {
    return <div class="text-center p-8 text-red-500 bg-red-100 rounded-lg">{error}</div>;
  }
  
  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <span class="text-slate-400">↕</span>;
    return sortOrder === 'asc' ? <span class="text-indigo-500">↑</span> : <span class="text-indigo-500">↓</span>;
  };

  return (
    <div class="bg-slate-50 min-h-screen p-4 sm:p-6 md:p-8 font-sans">
      <div class="max-w-7xl mx-auto">
        <header class="mb-6">
          <h1 class="text-3xl font-bold text-slate-800">Explorador de Sustancias</h1>
          <p class="text-slate-600 mt-1">Busca, filtra y explora el inventario de sustancias activas.</p>
        </header>

        {/* Controles de Búsqueda y Filtro */}
        <div class="flex flex-col sm:flex-row gap-4 mb-4">
          <input
            type="text"
            placeholder="Buscar por nombre de sustancia..."
            value={searchTerm}
            onInput={(e) => setSearchTerm((e.target as HTMLInputElement).value)}
            class="w-full sm:w-1/2 md:w-1/3 px-4 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
          />
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter((e.target as HTMLSelectElement).value as StockFilter)}
            class="w-full sm:w-auto px-4 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition bg-white"
          >
            <option value="todos">Todos</option>
            <option value="conStock">Solo con Stock</option>
            <option value="sinStock">Solo sin Stock</option>
          </select>
        </div>

        {/* Tabla Principal */}
        <div class="overflow-x-auto bg-white rounded-lg shadow">
          <table class="w-full text-left">
            <thead class="bg-slate-100 border-b border-slate-200">
              <tr>
                <th
                  class="p-4 text-sm font-semibold text-slate-600 cursor-pointer select-none"
                  onClick={() => handleSort('nombre')}
                >
                  Sustancia Activa <SortIcon column="nombre" />
                </th>
                <th
                  class="p-4 text-sm font-semibold text-slate-600 cursor-pointer select-none text-right"
                  onClick={() => handleSort('stockTotal')}
                >
                  Stock Total <SortIcon column="stockTotal" />
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedSustancias.map((sustancia) => (
                <tr
                  key={sustancia.nombre}
                  class="border-b border-slate-200 hover:bg-indigo-50 transition cursor-pointer"
                  onClick={() => openModalWithSustancia(sustancia.nombre)}
                >
                  <td class="p-4 text-slate-800 font-medium">{sustancia.nombre}</td>
                  <td class="p-4 text-slate-600 text-right font-mono">{sustancia.stockTotal}</td>
                </tr>
              ))}
              {filteredAndSortedSustancias.length === 0 && (
                 <tr>
                    <td colSpan={2} class="text-center p-8 text-slate-500">No se encontraron sustancias que coincidan con los filtros.</td>
                 </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* --- MODAL --- */}
      {modalOpen && (
        <div class="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div 
            class="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del Modal */}
            <header class="p-4 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h2 class="text-xl font-bold text-indigo-700">Detalles de la Sustancia</h2>
                <p class="text-slate-800 font-semibold">{selectedSustancia}</p>
              </div>
              <button onClick={closeModal} class="text-slate-500 hover:text-slate-800 text-2xl">&times;</button>
            </header>
            
            {/* Cuerpo del Modal */}
            <div class="p-6 overflow-y-auto flex-grow">
              {loadingModal && <div class="text-center p-8">Cargando detalles...</div>}
              {modalError && <div class="text-center p-8 text-red-500 bg-red-100 rounded-lg">{modalError}</div>}
              
              {!loadingModal && !modalError && (
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Columna de Productos */}
                  <div class="md:col-span-2 space-y-4">
                    <h3 class="text-lg font-semibold text-slate-700 border-b pb-2">Productos Comerciales</h3>
                    {productosDetallados.length > 0 ? (
                      productosDetallados.map((prod) => (
                        <div key={prod.nombre_comer_a} class="bg-slate-50 p-4 rounded-lg border border-slate-200">
                           <p class="font-bold text-slate-800">{prod.nombre_comer_a}</p>
                           <p class="text-sm text-slate-500">{prod.depto_a} / {prod.subdepto_a}</p>
                           <div class="mt-3 text-xs space-y-1">
                             <h4 class="font-semibold mb-1">Inventario por Sucursal:</h4>
                             <div class="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
                               {NOMBRES_SUCURSALES.map(sucursal => (
                                   <div key={sucursal} class="flex justify-between items-center">
                                       <span class="text-slate-600">{sucursal.replace('Articulos', '')}:</span>
                                       {prod.inventarioPorSucursal[sucursal] ? (
                                           <span class="font-mono font-semibold text-indigo-600">{prod.inventarioPorSucursal[sucursal]!.cantidad}</span>
                                       ) : (
                                           <span class="font-mono text-slate-400">0</span>
                                       )}
                                   </div>
                               ))}
                             </div>
                           </div>
                        </div>
                      ))
                    ) : (
                      <p class="text-slate-500">No se encontraron productos comerciales para esta sustancia.</p>
                    )}
                  </div>
                  
                  {/* Columna de Sustancias Relacionadas */}
                  <div>
                    <h3 class="text-lg font-semibold text-slate-700 border-b pb-2 mb-3">Relacionados</h3>
                    <button
                        onClick={() => findRelatedSustancias(selectedSustancia!)}
                        class="w-full mb-4 text-sm bg-indigo-500 text-white px-4 py-2 rounded-md hover:bg-indigo-600 transition shadow"
                    >
                      Ver Presentaciones Relacionadas
                    </button>
                    {sustanciasRelacionadas.length > 0 ? (
                      <ul class="space-y-1">
                        {sustanciasRelacionadas.map(rel => (
                          <li key={rel}>
                            <button 
                                onClick={() => handleRelatedClick(rel)}
                                class="w-full text-left text-sm text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 p-2 rounded-md transition"
                            >
                              {rel}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p class="text-xs text-slate-500 text-center p-4 bg-slate-100 rounded-md">No se encontraron otras presentaciones.</p>
                    )}
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

// Nota: Agrega las animaciones a tu archivo tailwind.config.js si no las tienes.
/*
  theme: {
    extend: {
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
*/
