import { useState, useEffect } from 'preact/hooks';
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
  
  // Estados para el modal
  const [modalAbierto, setModalAbierto] = useState(false);
  const [sustanciaSeleccionada, setSustanciaSeleccionada] = useState<SustanciaAgrupada | null>(null);
  const [detallesSustancia, setDetallesSustancia] = useState<DetalleProducto[]>([]);
  const [loadingModal, setLoadingModal] = useState(false);

  // Carga inicial de la lista de sustancias
  useEffect(() => {
    const fetchSustancias = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('maestrosustancias')
          .select('sustancia_activa, cantidadGeneral')
          .not('sustancia_activa', 'eq', 'POR DEFINIR'); // Excluimos los no definidos

        if (error) throw error;
        
        // Agrupar por sustancia y sumar el stock total
        const agrupado = (data || []).reduce((acc, item) => {
          const { sustancia_activa, cantidadGeneral } = item;
          if (!acc[sustancia_activa]) {
            acc[sustancia_activa] = 0;
          }
          acc[sustancia_activa] += cantidadGeneral || 0;
          return acc;
        }, {} as Record<string, number>);

        const listaSustancias: SustanciaAgrupada[] = Object.entries(agrupado)
          .map(([nombre, stockTotal]) => ({ nombre, stockTotal }))
          .sort((a, b) => b.stockTotal - a.stockTotal); // Ordenar por stock

        setSustancias(listaSustancias);
      } catch (err) {
        setError('Error al cargar la lista de sustancias.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchSustancias();
  }, []);

  // Función para abrir el modal y buscar los detalles
  const handleAbrirModal = async (sustancia: SustanciaAgrupada) => {
    setSustanciaSeleccionada(sustancia);
    setModalAbierto(true);
    setLoadingModal(true);
    setDetallesSustancia([]);

    try {
      // 1. Encontrar todos los productos que tienen esta sustancia activa
      const { data: productosConSustancia, error: errorMaestro } = await supabase
        .from('maestrosustancias')
        .select('cve_articulo_a, nombre_comer_a')
        .eq('sustancia_activa', sustancia.nombre);
        
      if (errorMaestro) throw errorMaestro;

      const codigosArticulos = productosConSustancia.map(p => p.cve_articulo_a);
      if (codigosArticulos.length === 0) {
          setLoadingModal(false);
          return;
      }
      
      // 2. Buscar esos productos en todas las sucursales (usando el patrón de ChecadorExistencias)
      const promesas = SUCURSALES_TABLAS.map(async (tabla) => {
        const { data, error } = await supabase
          .from(tabla)
          .select('cve_articulo_a, nombre_comer_a, depto_a, subdepto_a, cant_piso_a, costo_a, fecha_modificacion')
          .in('cve_articulo_a', codigosArticulos);
        
        return {
          sucursal: tabla.replace('Articulos', ''),
          data: data || [],
          error
        };
      });

      const resultadosPorSucursal = await Promise.all(promesas);

      // 3. Procesar y agrupar los resultados para el modal
      const detallesProcesados = productosConSustancia.map(productoBase => {
          const sucursales: DetalleSucursal[] = [];
          resultadosPorSucursal.forEach(resSucursal => {
              const articuloEnSucursal = resSucursal.data.find(d => d.cve_articulo_a === productoBase.cve_articulo_a);
              if (articuloEnSucursal) {
                  sucursales.push({
                      nombre: resSucursal.sucursal,
                      cantidad: Number(articuloEnSucursal.cant_piso_a || 0),
                      costo: Number(articuloEnSucursal.costo_a || 0),
                      fecha_mod: articuloEnSucursal.fecha_modificacion ? new Date(articuloEnSucursal.fecha_modificacion).toLocaleDateString('es-MX') : 'N/A'
                  });
              }
          });
          
          // Tomamos depto y subdepto del primer resultado donde lo encontremos
          const primerArticuloConDatos = resultadosPorSucursal.flatMap(r => r.data).find(d => d.cve_articulo_a === productoBase.cve_articulo_a);

          return {
              cve_articulo_a: productoBase.cve_articulo_a,
              nombre_comer_a: productoBase.nombre_comer_a,
              depto_a: primerArticuloConDatos?.depto_a || 'N/A',
              subdepto_a: primerArticuloConDatos?.subdepto_a || 'N/A',
              sucursales: sucursales,
          };
      });
      
      setDetallesSustancia(detallesProcesados);

    } catch(err) {
      setError('Error al cargar los detalles del producto.');
      console.error(err);
    } finally {
      setLoadingModal(false);
    }
  };


  return (
    <div class="container mx-auto p-4 md:p-6">
      <h2 class="text-2xl font-semibold mb-6 text-center text-gray-800">
        Explorador de Sustancias Activas
      </h2>
      
      {loading && <p class="text-center text-gray-500 py-4">Cargando...</p>}
      {error && <p class="text-center text-red-500 py-4">{error}</p>}
      
      {/* Lista de Sustancias */}
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {sustancias.map(sustancia => (
          <div 
            key={sustancia.nombre}
            onClick={() => handleAbrirModal(sustancia)}
            class="bg-white rounded-lg shadow border border-gray-200 p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 hover:shadow-md transition-all"
          >
            <span class="font-medium text-gray-800 text-sm">{sustancia.nombre}</span>
            <span class="font-bold text-lg text-blue-600">{sustancia.stockTotal}</span>
          </div>
        ))}
      </div>

      {/* --- MODAL --- */}
      {modalAbierto && sustanciaSeleccionada && (
        <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
          <div class="bg-gray-100 rounded-lg shadow-2xl max-w-4xl w-full max-h-full overflow-y-auto">
            {/* Modal Header */}
            <div class="sticky top-0 bg-white px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                  <h3 class="text-xl font-bold text-gray-900">{sustanciaSeleccionada.nombre}</h3>
                  <p class="text-sm text-gray-600">
                      Cantidad Total General: <span class="font-bold text-lg text-green-700">{sustanciaSeleccionada.stockTotal}</span>
                  </p>
              </div>
              <button onClick={() => setModalAbierto(false)} class="text-gray-500 hover:text-gray-800 text-3xl font-bold">&times;</button>
            </div>
            
            {/* Modal Body */}
            <div class="p-6">
              {loadingModal ? (
                <p class="text-center p-8">Cargando detalles...</p>
              ) : (
                <div class="space-y-6">
                  {detallesSustancia.map(producto => (
                    <div key={producto.cve_articulo_a} class="bg-white rounded-md border border-gray-200 overflow-hidden">
                      <div class="px-4 py-2 bg-gray-50 border-b">
                        <p class="font-bold text-gray-800">{producto.nombre_comer_a}</p>
                        <p class="text-xs text-gray-500">Depto: {producto.depto_a} / Subdepto: {producto.subdepto_a}</p>
                      </div>
                      <table class="min-w-full">
                        <thead class="bg-gray-100 text-xs text-gray-500">
                          <tr>
                            <th class="text-left p-2 font-medium">Sucursal</th>
                            <th class="text-right p-2 font-medium">Cantidad</th>
                            <th class="text-right p-2 font-medium">Costo</th>
                            <th class="text-left p-2 font-medium">Últ. Modificación</th>
                          </tr>
                        </thead>
                        <tbody class="text-sm">
                          {producto.sucursales.map(s => (
                            <tr key={s.nombre} class="border-t border-gray-100">
                              <td class="p-2 font-medium">{s.nombre}</td>
                              <td class={`p-2 text-right font-semibold ${s.cantidad < 0 ? 'text-red-600' : 'text-gray-800'}`}>{s.cantidad}</td>
                              <td class="p-2 text-right text-gray-600">${s.costo.toFixed(2)}</td>
                              <td class="p-2 text-gray-600">{s.fecha_mod}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
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
