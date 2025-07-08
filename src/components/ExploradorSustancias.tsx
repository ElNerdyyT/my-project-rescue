import { useState, useEffect, useMemo, useCallback } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';

// --- Interfaces ---
interface SustanciaAgrupada { nombre: string; stockTotal: number; }
interface DetalleProducto { cve_articulo_a: string; nombre_comer_a: string; depto_a: string; subdepto_a: string; sucursales: DetalleSucursal[]; }
interface DetalleSucursal { nombre: string; cantidad: number; costo: number; fecha_mod: string; }

// --- Constantes y Helpers ---
const SUCURSALES_TABLAS = [
  'ArticulosMexico','ArticulosMadero','ArticulosEcono1',
  'ArticulosLopezM','ArticulosBaja','ArticulosEcono2','ArticulosLolita'
];
const getSucursalName = (tableName: string) => tableName.replace('Articulos','');
const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
function useDebounce(value: string, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debounced;
}

// --- ExploradorSustancias Component ---
const ExploradorSustancias = () => {
  const [sustancias, setSustancias] = useState<SustanciaAgrupada[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtroStock, setFiltroStock] = useState<'todos'|'conStock'|'sinStock'>('todos');
  const [orden, setOrden] = useState<{columna:'nombre'|'stockTotal';dir:'asc'|'desc'}>({columna:'stockTotal',dir:'desc'});
  const [modalState, setModalState] = useState({
    isOpen:false,
    sustancia:null as SustanciaAgrupada|null,
    detalles:[] as DetalleProducto[],
    relacionadas:[] as SustanciaAgrupada[],
    isLoading:false,
    isLoadingRelacionadas:false
  });
  const debouncedBusqueda = useDebounce(busqueda,300);

  const fetchSustancias = useCallback(async ()=>{
    setLoading(true);setError('');
    try{
      const {data, error} = await supabase.from('maestrosustancias')
        .select('sustancia_activa, cantidadGeneral')
        .not('sustancia_activa','eq','POR DEFINIR');
      if(error) throw error;
      const agg = (data||[]).reduce((acc:Record<string,number>,i)=>{
        acc[i.sustancia_activa]=(acc[i.sustancia_activa]||0)+(i.cantidadGeneral||0);
        return acc;
      },{});
      setSustancias(Object.entries(agg).map(([nombre,stockTotal])=>({nombre,stockTotal})));
    }catch{
      setError('Error cargando sustancias');
    }finally{setLoading(false);}
  },[]);

  useEffect(()=>{fetchSustancias();},[fetchSustancias]);
  useEffect(()=>{document.body.style.overflow=modalState.isOpen?'hidden':'auto';},[modalState.isOpen]);

  const sustanciasFiltradas = useMemo(()=>{
    return sustancias
      .filter(s=> filtroStock==='todos' || (filtroStock==='conStock'?s.stockTotal>0:s.stockTotal<=0))
      .filter(s=> s.nombre.toLowerCase().includes(debouncedBusqueda.toLowerCase()))
      .sort((a,b)=>{
        const va = orden.columna==='nombre'?a.nombre.toLowerCase():a.stockTotal;
        const vb = orden.columna==='nombre'?b.nombre.toLowerCase():b.stockTotal;
        if(va<vb) return orden.dir==='asc'?-1:1;
        if(va>vb) return orden.dir==='asc'?1:-1;
        return 0;
      });
  },[sustancias,debouncedBusqueda,filtroStock,orden]);

  const handleAbrirModal = useCallback(async(sust)=>{
    setModalState(ms=>({...ms,isOpen:true,sustancia:sust,isLoading:true,detalles:[],relacionadas:[]}));
    try{
      const {data:prod} = await supabase.from('maestrosustancias')
        .select('cve_articulo_a,nombre_comer_a')
        .eq('sustancia_activa',sust.nombre);
      const cods = prod?.map(p=>p.cve_articulo_a)||[];
      const res = await Promise.all(SUCURSALES_TABLAS.map(tab=>
        supabase.from(tab).select('cve_articulo_a,depto_a,subdepto_a,cant_piso_a,costo_a,fecha_modificacion')
          .in('cve_articulo_a',cods).then(r=>({tabla:tab,data:r.data||[]}))
      ));
      const detalles = prod?.map(item=>{
        const regs = res.flatMap(r=> r.data.filter(d=>d.cve_articulo_a===item.cve_articulo_a)
          .map(d=>({...d,sucursal:getSucursalName(r.tabla)})));
        const suc = regs.map(r=>({nombre:r.sucursal,cantidad:+r.cant_piso_a,costo:+r.costo_a,fecha_mod:r.fecha_modificacion?new Date(r.fecha_modificacion).toLocaleDateString('es-MX'):'N/A'}))
          .sort((a,b)=>b.cantidad-a.cantidad);
        const first = regs[0]||{};
        return {cve_articulo_a:item.cve_articulo_a,nombre_comer_a:item.nombre_comer_a,depto_a:first.depto_a||'N/A',subdepto_a:first.subdepto_a||'N/A',sucursales:suc};
      })||[];
      setModalState(ms=>({...ms,detalles, isLoading:false}));
    }catch{
      setModalState(ms=>({...ms,isLoading:false}));
    }
  },[]);

  const handleVerRelacionadas = useCallback(async(name)=>{
    setModalState(ms=>({...ms,isLoadingRelacionadas:true,relacionadas:[]}));
    try{
      const base=name.split(' ')[0];
      const {data} = await supabase.from('maestrosustancias')
        .select('sustancia_activa,cantidadGeneral')
        .like('sustancia_activa',`${base}%`)
        .not('sustancia_activa','eq',name);
      const rel = (data||[]).map(d=>({nombre:d.sustancia_activa,stockTotal:d.cantidadGeneral||0}));
      setModalState(ms=>({...ms,relacionadas:rel,isLoadingRelacionadas:false}));
    }catch{
      setModalState(ms=>({...ms,isLoadingRelacionadas:false}));
    }
  },[]);

  return (
    <div class="bg-slate-50 min-h-screen">
      <div class="container mx-auto p-4 md:p-8">
        <div class="bg-white rounded-xl shadow-lg border border-slate-200">
          <Header />
          <SearchBar busqueda={busqueda} setBusqueda={setBusqueda} filtroStock={filtroStock} setFiltroStock={setFiltroStock} />
          <TableBody loading={loading} orden={orden} setOrden={setOrden} data={sustanciasFiltradas} onRowClick={handleAbrirModal} />
        </div>
        {modalState.isOpen&&modalState.sustancia&&(
          <Modal state={modalState} onClose={()=>setModalState(ms=>({...ms,isOpen:false}))} onVerRelacionadas={handleVerRelacionadas} />
        )}
      </div>
    </div>
  );
};
export default ExploradorSustancias;

// --- Funciones Auxiliares ---
function Header(){return(
  <div class="p-6 border-b border-slate-200">
    <h2 class="text-3xl font-bold text-slate-800">Explorador de Sustancias Activas</h2>
    <p class="mt-1 text-slate-500">Busca, filtra y explora el stock de las sustancias en todas las sucursales.</p>
  </div>
);} 

function SearchBar({busqueda,setBusqueda,filtroStock,setFiltroStock}:{busqueda:string;setBusqueda:(v:string)=>void;filtroStock:string;setFiltroStock:(v:any)=>void;}){
  return(
    <div class="p-6">
      <div class="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
        <div class="relative lg:col-span-3">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg class="h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" clip-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"/></svg>
          </div>
          <input type="text" placeholder="Buscar por nombre de sustancia..." value={busqueda} onInput={e=>setBusqueda(e.currentTarget.value)} class="form-input block w-full pl-10 pr-3 sm:text-sm border-slate-300 rounded-lg shadow-sm text-base py-2.5"/>
        </div>
        <select value={filtroStock} onChange={e=>setFiltroStock(e.currentTarget.value)} class="lg:col-span-2 form-select block w-full px-3 sm:text-sm border-slate-300 rounded-lg shadow-sm text-base py-2.5">
          <option value="todos">Mostrar Todo el Stock</option>
          <option value="conStock">Solo Con Stock</option>
          <option value="sinStock">Solo Sin Stock</option>
        </select>
      </div>
    </div>
  );
}

function TableBody({loading,orden,setOrden,data,onRowClick}:{loading:boolean;orden:any;setOrden:(o:any)=>void;data:SustanciaAgrupada[];onRowClick:(s:SustanciaAgrupada)=>void;}){
  return(
    <div class="overflow-x-auto rounded-lg border border-slate-200">
      <table class="min-w-full divide-y divide-slate-200">
        <thead class="bg-slate-100"><tr>
          <th onClick={()=>setOrden(o=>({columna:'nombre',dir:o.columna==='nombre'&&o.dir==='asc'?'desc':'asc'}))} class="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase cursor-pointer">Sustancia {orden.columna==='nombre'?orden.dir==='asc'?'▲':'▼':''}</th>
          <th onClick={()=>setOrden(o=>({columna:'stockTotal',dir:o.columna==='stockTotal'&&o.dir==='asc'?'desc':'asc'}))} class="px-6 py-3 text-right text-xs font-bold text-slate-600 uppercase cursor-pointer">Stock {orden.columna==='stockTotal'?orden.dir==='asc'?'▲':'▼':''}</th>
        </tr></thead>
        <tbody class="bg-white divide-y divide-slate-200">
          {loading? <tr><td colSpan={2} class="p-8 text-center text-slate-500">Cargando...</td></tr>:
           data.length===0? <tr><td colSpan={2} class="p-8 text-center text-slate-500">No hay resultados</td></tr>:
           data.map(s=>(
            <tr key={s.nombre} onClick={()=>onRowClick(s)} class="hover:bg-indigo-50 cursor-pointer">
              <td class="px-6 py-4 whitespace-nowrap"><div class="text-sm font-semibold text-slate-900">{s.nombre}</div></td>
              <td class="px-6 py-4 whitespace-nowrap text-right"><span class={`px-2 py-1 rounded ${s.stockTotal>0?'bg-emerald-100 text-emerald-800':'bg-rose-100 text-rose-800'}`}>{s.stockTotal}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Modal({state,onClose,onVerRelacionadas}:{state:any;onClose:()=>void;onVerRelacionadas:(n:string)=>void;}){
  const {sustancia,detalles,relacionadas,isLoading,isLoadingRelacionadas} = state;
  return(
    <div class="fixed inset-0 bg-black/60 flex justify-center items-center p-4" onClick={onClose}>
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-auto" onClick={e=>e.stopPropagation()}>
        <div class="px-6 py-4 border-b flex justify-between items-center">
          <div><h3 class="text-xl font-bold text-slate-900">{sustancia.nombre}</h3><p class="text-sm text-slate-500">Stock Total: <span class="font-bold text-lg text-emerald-600">{sustancia.stockTotal}</span></p></div>
          <button onClick={onClose} class="text-slate-400 hover:text-slate-800 text-3xl font-bold">×</button>
        </div>
        <div class="flex-grow p-4 overflow-y-auto">
          {isLoading? <div class="text-center p-8 text-slate-600">Cargando detalles...</div>:
           detalles.length===0? <div class="text-center text-slate-500 py-4">No hay productos</div>:
           detalles.map(prod=>(
            <div key={prod.cve_articulo_a} class="bg-white rounded-lg border shadow-sm mb-6">
              <div class="px-4 py-3 bg-slate-50 border-b"><p class="font-bold text-slate-800">{prod.nombre_comer_a}</p><p class="text-xs text-slate-500">{prod.depto_a} / {prod.subdepto_a}</p></div>
              <div class="overflow-x-auto"><table class="min-w-full text-sm"><thead class="bg-slate-100"><tr><th class="p-2 text-left">Sucursal</th><th class="p-2 text-right">Cant.</th><th class="p-2 text-right">Costo</th><th class="p-2 text-left">Últ.Mod.</th></tr></thead><tbody>
                {prod.sucursales.map(s=>(<tr key={s.nombre} class="border-t"><td class="p-2 font-semibold text-slate-700">{s.nombre}</td><td class="p-2 text-right">{s.cantidad}</td><td class="p-2 text-right">{formatCurrency(s.costo)}</td><td class="p-2">{s.fecha_mod}</td></tr>))}
              </tbody></table></div>
            </div>
          ))}
        </div>
        <div class="px-6 py-4 border-t bg-white/70 backdrop-blur-sm flex items-center justify-between">
          <button onClick={()=>onVerRelacionadas(sustancia.nombre)} class="bg-indigo-100 text-indigo-800 px-4 py-2 rounded-lg hover:bg-indigo-200 disabled:opacity-50" disabled={isLoadingRelacionadas}>{isLoadingRelacionadas?'Buscando...':'Ver relacionadas'}</button>
          {relacionadas.length>0&&<div class="space-x-2 overflow-x-auto">
            {relacionadas.map(r=><button key={r.nombre} onClick={()=>onAbrirRelacionado(r.nombre)} class="bg-slate-200 px-3 py-1 rounded-full text-xs">{r.nombre}({r.stockTotal})</button>)}
          </div>}
        </div>
      </div>
    </div>
  );
}
