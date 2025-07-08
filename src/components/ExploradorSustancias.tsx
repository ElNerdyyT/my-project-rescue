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
  'ArticulosMexico', 'ArticulosMadero', 'ArticulosEcono1',
  'ArticulosLopezM', 'ArticulosBaja', 'ArticulosEcono2', 'ArticulosLolita',
];

const NOMBRE_INVALIDO = 'POR DEFINIR';


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
        const { data, error: dbError } = await supabase
          .from('maestrosustancias')
          .select('sustancia_activa, cantidadGeneral');

        if (dbError) throw dbError;
        
        const agrupado = data
          .filter(item => item.sustancia_activa && item.sustancia_activa.toUpperCase() !== NOMBRE_INVALIDO)
          .reduce((acc: Record<string, number>, item) => {
            acc[item.sustancia_activa] = (acc[item.sustancia_activa] || 0) + (item.cantidadGeneral || 0);
            return acc;
          }, {});

        const resultado = Object.entries(agrupado).map(([nombre, stockTotal]) => ({ nombre, stockTotal }));
        setSustancias(resultado);
      } catch (err: any) {
        setError(`Error al cargar datos: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchSustancias();
  }, []);
  
  // Bloquear scroll del body cuando el modal está abierto
  useEffect(() => {
    if (modalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => { document.body.style.overflow = 'auto'; };
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

  const closeModal = () => {
    setModalOpen(false);
    setSelectedSustancia(null);
    setModalError(null);
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

      const codigosArticulos = productosMaestro.map(p => p.cve_articulo_a);
      if (codigosArticulos.length === 0) {
        setProductosDetallados([]);
        findRelatedSustancias(nombreSustancia);
        return;
      }

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
  }, [findRelatedSustancias]);

  // --- RENDERIZADO ---
  if (loading) {
    return <div class="text-center p-5"><div class="spinner-border text-primary" role="status"></div><span class="ms-2">Cargando...</span></div>;
  }
  if (error) {
    return <div class="alert alert-danger">{error}</div>;
  }

  return (
    <div class="card shadow-sm">
        <div class="card-header d-flex flex-wrap justify-content-between align-items-center">
            <h3 class="card-title mb-2 mb-md-0">Explorador de Sustancias</h3>
            <div class="d-flex flex-wrap gap-2">
                <input
                    type="text"
                    placeholder="Buscar sustancia..."
                    value={searchTerm}
                    onInput={(e) => setSearchTerm((e.target as HTMLInputElement).value)}
                    class="form-control form-control-sm"
                    style={{width: '220px'}}
                />
                <select
                    value={stockFilter}
                    onChange={(e) => setStockFilter((e.target as HTMLSelectElement).value as StockFilter)}
                    class="form-select form-select-sm"
                    style={{width: '150px'}}
                >
                    <option value="todos">Todos</option>
                    <option value="conStock">Con Stock</option>
                    <option value="sinStock">Sin Stock</option>
                </select>
            </div>
        </div>

        <div class="table-responsive">
            <table class="table table-vcenter text-nowrap table-hover table-striped mb-0">
                <thead>
                    <tr>
                        <th class="cursor-pointer" onClick={() => handleSort('nombre')}>Sustancia Activa {sortKey === 'nombre' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                        <th class="text-end cursor-pointer" onClick={() => handleSort('stockTotal')}>Stock Total {sortKey === 'stockTotal' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredAndSortedSustancias.map((sustancia) => (
                        <tr key={sustancia.nombre} onClick={() => openModalWithSustancia(sustancia.nombre)} style={{cursor: 'pointer'}}>
                            <td>{sustancia.nombre}</td>
                            <td class="text-end">{sustancia.stockTotal}</td>
                        </tr>
                    ))}
                    {filteredAndSortedSustancias.length === 0 && (
                        <tr><td colSpan={2} class="text-center text-muted fst-italic py-4">No se encontraron resultados.</td></tr>
                    )}
                </tbody>
            </table>
        </div>

        {/* --- MODAL REESCRITO CON CLASES DE BOOTSTRAP --- */}
        {modalOpen && (
          <div class="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }} onClick={closeModal}>
            <div class="modal-dialog modal-xl modal-dialog-scrollable modal-dialog-centered" onClick={e => e.stopPropagation()}>
              <div class="modal-content">
                <div class="modal-header">
                  <h5 class="modal-title">Detalles de: {selectedSustancia}</h5>
                  <button type="button" class="btn-close" aria-label="Close" onClick={closeModal} disabled={loadingModal}></button>
                </div>
                <div class="modal-body">
                  {loadingModal ? (
                    <div class="text-center p-5"><div class="spinner-border text-primary" role="status" style={{width: '3rem', height: '3rem'}}></div><p class="mt-3 text-muted">Cargando detalles...</p></div>
                  ) : modalError ? (
                    <div class="alert alert-danger">{modalError}</div>
                  ) : (
                    <div class="row g-4">
                      {/* Columna Izquierda: Productos */}
                      <div class="col-md-8">
                        <h6>Productos Comerciales</h6>
                        <hr class="mt-1" />
                        {productosDetallados.length > 0 ? (
                          productosDetallados.map(prod => (
                            <div key={prod.nombre_comer_a} class="card mb-3">
                              <div class="card-body">
                                <h6 class="card-title mb-1">{prod.nombre_comer_a}</h6>
                                <p class="card-subtitle text-muted small">{prod.depto_a} / {prod.subdepto_a}</p>
                                <hr/>
                                <p class="mb-2 fw-bold small">Inventario por Sucursal:</p>
                                <div class="row g-2">
                                  {NOMBRES_SUCURSALES.map(sucursal => (
                                    <div class="col-6 col-sm-4" key={sucursal}>
                                      <div class="d-flex justify-content-between border-bottom pb-1">
                                        <span class="small">{sucursal.replace('Articulos', '')}:</span>
                                        <span class="fw-bold small">{prod.inventarioPorSucursal[sucursal]?.cantidad ?? 0}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p class="text-center text-muted fst-italic p-4">No se encontraron productos comerciales.</p>
                        )}
                      </div>

                      {/* Columna Derecha: Relacionados */}
                      <div class="col-md-4">
                         <h6>Presentaciones Relacionadas</h6>
                         <hr class="mt-1" />
                         <div class="d-grid">
                            <button class="btn btn-sm btn-outline-secondary mb-3" onClick={() => findRelatedSustancias(selectedSustancia!)}>
                                Volver a buscar relacionados
                            </button>
                         </div>
                         {sustanciasRelacionadas.length > 0 ? (
                           <ul class="list-group list-group-flush">
                             {sustanciasRelacionadas.map(rel => (
                               <li key={rel} class="list-group-item list-group-item-action p-2" style={{cursor: 'pointer'}} onClick={() => openModalWithSustancia(rel)}>
                                 {rel}
                               </li>
                             ))}
                           </ul>
                         ) : (
                           <p class="text-center text-muted fst-italic p-3 small">No hay otras presentaciones.</p>
                         )}
                      </div>
                    </div>
                  )}
                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-secondary" onClick={closeModal} disabled={loadingModal}>Cerrar</button>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

export default ExploradorSustancias;
