import { h } from 'preact';
import { useState, useEffect, useMemo, useCallback, useRef } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';

// --- Interfaces ---
interface SustanciaAgrupada { nombre: string; stockTotal: number; }
interface DetalleProducto { cve_articulo_a: string; nombre_comer_a: string; depto_a: string; subdepto_a: string; sucursales: DetalleSucursal[]; }
interface DetalleSucursal { nombre: string; cantidad: number; costo: number; fecha_mod: string; }

// --- Constantes ---
const SUCURSALES_TABLAS = [
  'ArticulosMexico','ArticulosMadero','ArticulosEcono1',
  'ArticulosLopezM','ArticulosBaja','ArticulosEcono2','ArticulosLolita'
];
const formatCurrency = (v: number) => `$${v.toFixed(2)}`;
// --- Hook de debounce ---
function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// --- Componente optimizado ---
export default function ExploradorSustancias() {
  // Estados principales
  const [sustancias, setSustancias] = useState<SustanciaAgrupada[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'todos'|'conStock'|'sinStock'>('todos');
  const [sort, setSort] = useState<{col: 'nombre'|'stockTotal'; dir: 'asc'|'desc'}>({ col: 'stockTotal', dir: 'desc' });
  const debouncedSearch = useDebounce(search);

  // Modal
  const [modal, setModal] = useState<{ open: boolean; sust?: SustanciaAgrupada }>({ open: false });
  const [detalles, setDetalles] = useState<DetalleProducto[]>([]);
  const [loadingDetalles, setLoadingDetalles] = useState(false);

  // Caching detalles para no recargar
  const cacheDetalles = useRef(new Map<string, DetalleProducto[]>());

  // Fetch sustancias
  const fetchSustancias = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('maestrosustancias')
        .select('sustancia_activa, cantidadGeneral')
        .not('sustancia_activa', 'eq', 'POR DEFINIR');
      if (error) throw error;
      const agrup = (data || []).reduce((acc: Record<string, number>, { sustancia_activa, cantidadGeneral }) => {
        acc[sustancia_activa] = (acc[sustancia_activa] || 0) + (cantidadGeneral || 0);
        return acc;
      }, {});
      setSustancias(Object.entries(agrup).map(([nombre, stockTotal]) => ({ nombre, stockTotal })));
    } catch (e) {
      setError('Error cargando sustancias');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSustancias(); }, [fetchSustancias]);

  // Filtrado y orden
  const filtered = useMemo(() => {
    let arr = sustancias;
    if (stockFilter === 'conStock') arr = arr.filter(s => s.stockTotal > 0);
    if (stockFilter === 'sinStock') arr = arr.filter(s => s.stockTotal <= 0);
    if (debouncedSearch) arr = arr.filter(s => s.nombre.toLowerCase().includes(debouncedSearch.toLowerCase()));
    return arr.sort((a,b) => {
      const vA = sort.col === 'nombre' ? a.nombre.toLowerCase() : a.stockTotal;
      const vB = sort.col === 'nombre' ? b.nombre.toLowerCase() : b.stockTotal;
      if (vA < vB) return sort.dir === 'asc' ? -1 : 1;
      if (vA > vB) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [sustancias, stockFilter, sort, debouncedSearch]);

  // Abrir modal y fetch detalles solo si no está cacheado
  const openModal = async (sust: SustanciaAgrupada) => {
    setModal({ open: true, sust });
    if (cacheDetalles.current.has(sust.nombre)) {
      setDetalles(cacheDetalles.current.get(sust.nombre)!);
      return;
    }
    setLoadingDetalles(true);
    try {
      const { data: prod } = await supabase
        .from('maestrosustancias')
        .select('cve_articulo_a, nombre_comer_a')
        .eq('sustancia_activa', sust.nombre);
      const cods = prod?.map(p => p.cve_articulo_a) || [];
      const prom = SUCURSALES_TABLAS.map(tab =>
        supabase.from(tab).select('cve_articulo_a,nombre_comer_a,depto_a,subdepto_a,cant_piso_a,costo_a,fecha_modificacion')
          .in('cve_articulo_a', cods)
      );
      const res = await Promise.all(prom);
      const detallesArr = prod?.map(p => {
        const sucArr = SUCURSALES_TABLAS.flatMap((tab, i) => (
          res[i].data || []
        )).filter(r => r.cve_articulo_a === p.cve_articulo_a)
         .map(r => ({
           nombre: tabName(r.table),
           cantidad: +r.cant_piso_a,
           costo: +r.costo_a,
           fecha_mod: r.fecha_modificacion ? new Date(r.fecha_modificacion).toLocaleDateString('es-MX') : 'N/A'
         })).sort((a,b) => b.cantidad - a.cantidad);
        const any = (res.flatMap(r => r.data || []).find(r => r.cve_articulo_a === p.cve_articulo_a) as any) || {};
        return { cve_articulo_a: p.cve_articulo_a, nombre_comer_a: p.nombre_comer_a, depto_a: any.depto_a||'N/A', subdepto_a: any.subdepto_a||'N/A', sucursales: sucArr };
      }) || [];
      cacheDetalles.current.set(sust.nombre, detallesArr);
      setDetalles(detallesArr);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetalles(false);
    }
  };

  const closeModal = () => setModal({ open: false });

  return (
    <div class="p-4 bg-slate-50 min-h-screen">
      <header class="mb-4 flex flex-col sm:flex-row justify-between items-center">
        <h1 class="text-2xl font-bold">Explorador de Sustancias</h1>
        <div class="flex gap-2 mt-2 sm:mt-0">
          <input
            value={search}
            onInput={e=>setSearch(e.currentTarget.value)}
            placeholder="Buscar..."
            class="px-3 py-2 border rounded-lg focus:outline-none"
          />
          <select value={stockFilter} onChange={e=>setStockFilter(e.currentTarget.value as any)} class="px-3 py-2 border rounded-lg">
            <option value="todos">Todos</option>
            <option value="conStock">Con Stock</option>
            <option value="sinStock">Sin Stock</option>
          </select>
        </div>
      </header>
      {error && <div class="text-red-600">{error}</div>}
      <section class="overflow-auto">
        <table class="w-full bg-white rounded-lg shadow">
          <thead>
            <tr class="border-b">
              {['Sustancia',{label:'Stock Total',col:'stockTotal'}].map(h=> (
                <th
                  onClick={()=>{
                    const col = typeof h==='string'?'nombre':h.col;
                    setSort(s=>({col,s.dir:(s.col===col&&s.dir==='asc')?'desc':'asc'}));
                  }}
                  class="p-3 cursor-pointer text-left"
                >{typeof h==='string'?h:h.label} {(sort.col=== (typeof h==='string'?'nombre':h.col))?(sort.dir==='asc'?'▲':'▼'):''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={2} class="p-4 text-center">Cargando...</td></tr>
            ) : filtered.length===0 ? (
              <tr><td colSpan={2} class="p-4 text-center">No hay resultados</td></tr>
            ) : filtered.map(s=> (
              <tr key={s.nombre} onClick={()=>openModal(s)} class="hover:bg-indigo-50 cursor-pointer">
                <td class="p-3 font-medium">{s.nombre}</td>
                <td class="p-3 text-right">
                  <span class={`px-2 py-1 rounded ${s.stockTotal>0?'bg-emerald-100 text-emerald-800':'bg-rose-100 text-rose-800'}`}> {s.stockTotal} </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {modal.open && modal.sust && (
        <div class="fixed inset-0 bg-black/60 flex justify-center items-center p-4">
          <div class="bg-white rounded-xl shadow-lg w-full max-w-3xl max-h-[90vh] overflow-auto" role="dialog" aria-modal="true">
            <header class="flex justify-between items-center border-b p-4">
              <h2 class="text-xl font-bold">{modal.sust.nombre}</h2>
              <button onClick={closeModal} aria-label="Cerrar" class="text-2xl">&times;</button>
            </header>
            <main class="p-4">
              {loadingDetalles ? <p>Cargando detalles...</p> : (
                detalles.length===0 ? <p>No se encontraron productos</p> : detalles.map(prod=>(
                  <article key={prod.cve_articulo_a} class="mb-6 border rounded-lg shadow-sm">
                    <div class="bg-slate-100 p-3 border-b">
                      <h3 class="font-semibold">{prod.nombre_comer_a}</h3>
                      <small class="text-sm text-slate-500">{prod.depto_a} / {prod.subdepto_a}</small>
                    </div>
                    <div class="p-3 overflow-auto">
                      <table class="w-full text-sm">
                        <thead class="bg-slate-50">
                          <tr>
                            <th class="p-2 text-left">Sucursal</th>
                            <th class="p-2 text-right">Cantidad</th>
                            <th class="p-2 text-right">Costo</th>
                            <th class="p-2 text-left">Últ. Mod.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {prod.sucursales.map(s=>(
                            <tr key={s.nombre} class="border-t">
                              <td class="p-2 font-medium">{s.nombre}</td>
                              <td class="p-2 text-right">{s.cantidad}</td>
                              <td class="p-2 text-right">{formatCurrency(s.costo)}</td>
                              <td class="p-2">{s.fecha_mod}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>
                ))
              )}
            </main>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Helpers fuera de componente ---
function tabName(table: string) {
  return table.replace('Articulos','');
}
