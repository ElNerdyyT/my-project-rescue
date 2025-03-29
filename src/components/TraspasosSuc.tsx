import { useState, useEffect } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';
import { formatCurrency, formatNumber, formatDate } from '../utils/helpers'; // Adjust path

// Constants
const SUCURSALES_VALIDAS_TRASPASOS = ['Mexico', 'Econo1', 'Econo2', 'Baja']; // Ensure these match table names suffix
const MOVIMIENTO_ENTRADA = 7;
const MOVIMIENTO_SALIDA = 8;
const COLUMNAS_KARDEX = 'fecha, fol, referencia, articulo, cantidad, costo, sucursal, movto'; // Base columns needed

// Types
interface KardexRow {
    fecha: string;
    fol: number | string | null;
    referencia: string | null;
    articulo: string | null;
    cantidad: number | string | null;
    costo: number | string | null;
    sucursal: string | null; // The sucursal where the record exists (e.g., 'Mexico', 'Econo1')
    movto: number | null;
    // Add 'destino' if it exists directly in the table, otherwise it's derived
}

interface Transferencia {
  id: string; // Composite key
  origen: string;
  destino: string;
  fecha: string;
  codigo: string; // Folio key
  articulo: string;
  costo_origen: number;
  costo_destino: number;
  cantidad_origen: number;
  cantidad_destino: number;
  discrepancia: boolean;
  credito_origen: number; // total value sent
  credito_destino: number; // total value received (based on origin cost ideally?)
  diferencia_valor: number; // Difference in total value
}

interface TotalesGlobales {
  enviado: number;
  recibido: number;
  balance: number;
  discrepancias: number;
}

// Mapping for destinos based on 'referencia' text
const DESTINO_MAPPING: Record<string, string> = {
    ECONOFARMA: 'Econo1',
    MEXICO: 'Mexico',
    ECONO1: 'Econo1',
    ECONOFAMRA2: 'Econo2', // Typo? Should be ECONOFARMA2?
    ECONOFARMA2: 'Econo2', // Corrected?
    BAJA: 'Baja',
    SUC2: 'Mexico', // Example, adjust as needed
    // Add all variations found in 'referencia'
};

const extractDestinoFromReferencia = (referencia: string | null): string => {
  if (!referencia) return 'Desconocido';
  // More robust regex: case-insensitive, handles variations in spacing/punctuation
  const match = referencia.match(/A\s+SUC(?:URSAL)?\.?\s+#?\s*\d*\s*([A-Z0-9\s]+)/i);
  if (match && match[1]) {
    const rawDestino = match[1].trim().toUpperCase().replace(/\s+/g,''); // Normalize
    return DESTINO_MAPPING[rawDestino] || 'Desconocido'; // Use mapping
  }
  return 'Desconocido';
};

const TraspasosSuc = () => {
  const [transferencias, setTransferencias] = useState<Transferencia[]>([]);
  const [totalesGlobales, setTotalesGlobales] = useState<TotalesGlobales>({
    enviado: 0, recibido: 0, balance: 0, discrepancias: 0,
  });
  const [selectedSucursal, setSelectedSucursal] = useState(SUCURSALES_VALIDAS_TRASPASOS[0]);
  const [loading, setLoading] = useState(false);
  const [loadingTotals, setLoadingTotals] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

   // Fetch initial date range
   useEffect(() => {
    let isCancelled = false;
    const fetchDateRange = async () => {
      // ... (same as in FacturasSuc, handle cancellation) ...
      try {
        const { data, error: dbError } = await supabase
          .from('date_range')
          .select('start_date, end_date')
          .single();

        if (dbError) throw dbError;

        if (!isCancelled && data) {
          setStartDate(data.start_date || '');
          setEndDate(data.end_date || '');
        } else if (!isCancelled) {
            setError('No se pudo obtener el rango de fechas.');
        }
      } catch (err) {
        console.error('Error obteniendo fechas:', err);
        if (!isCancelled) {
            setError(err instanceof Error ? err.message : 'Error desconocido al obtener fechas.');
        }
      }
    };
    fetchDateRange();
    return () => { isCancelled = true; };
  }, []);

  // Fetch GLOBAL totals
  // WARNING: This fetches potentially large amounts of data from ALL tables.
  // Consider creating a Database View or Function for aggregation for better performance.
  useEffect(() => {
    if (!startDate || !endDate) return;

    let isCancelled = false;
    const fetchGlobalData = async () => {
      setLoadingTotals(true);
      setError(null); // Reset specific errors if needed

      const formattedStartDate = new Date(startDate + 'T00:00:00Z').toISOString();
      const formattedEndDate = new Date(endDate + 'T23:59:59Z').toISOString();

      try {
        // Fetch all relevant movements concurrently
        const fetchPromises = SUCURSALES_VALIDAS_TRASPASOS.map(suc =>
          supabase
            .from(`Kardex${suc}`)
            .select(COLUMNAS_KARDEX)
            .gte('fecha', formattedStartDate)
            .lte('fecha', formattedEndDate)
            .in('movto', [MOVIMIENTO_ENTRADA, MOVIMIENTO_SALIDA])
        );

        const results = await Promise.all(fetchPromises);
        if (isCancelled) return;

        let allMovimientos: KardexRow[] = [];
        results.forEach((result, index) => {
          if (result.error) {
            console.error(`Error fetching global data from Kardex${SUCURSALES_VALIDAS_TRASPASOS[index]}:`, result.error);
            // Optionally collect errors to display
          } else if (result.data) {
            // Add the sucursal name if not present in the row data directly
            allMovimientos = allMovimientos.concat(result.data.map(row => ({...row, sucursal: row.sucursal || SUCURSALES_VALIDAS_TRASPASOS[index]})));
          }
        });

        // Process all movements for global totals
        const outgoing = allMovimientos.filter(m => m.movto === MOVIMIENTO_SALIDA);
        const incoming = allMovimientos.filter(m => m.movto === MOVIMIENTO_ENTRADA);

        // Create map of incoming movements for quick lookup
        // Key: fol_articulo_destinoSucursal (assuming fol + articulo + destino identifies the corresponding entry)
        const incomingMap = new Map<string, { cantidad: number; costo: number }>();
        incoming.forEach(entrada => {
          const folKey = entrada.fol?.toString().split('.')[0] || 'nofol';
          const articuloKey = entrada.articulo?.trim().toUpperCase() || 'noart';
          const sucursalEntrada = entrada.sucursal || 'Desconocido'; // Where the entry was recorded
          // This key assumes the 'entrada.sucursal' is the destination of the transfer
          const mapKey = `${folKey}_${articuloKey}_${sucursalEntrada}`;
          incomingMap.set(mapKey, {
            cantidad: Number(entrada.cantidad || 0),
            costo: Number(entrada.costo || 0),
          });
        });

        // Calculate totals by iterating through outgoing movements
        let totalEnviado = 0;
        let totalRecibido = 0;
        let countDiscrepancias = 0;

        outgoing.forEach(salida => {
          const folKey = salida.fol?.toString().split('.')[0] || 'nofol';
          const articuloKey = salida.articulo?.trim().toUpperCase() || 'noart';
          const destino = extractDestinoFromReferencia(salida.referencia); // Get intended destination

          const cantidadSalida = Number(salida.cantidad || 0);
          const costoSalida = Number(salida.costo || 0);
          const valorSalida = cantidadSalida * costoSalida;
          totalEnviado += valorSalida;

          // Find the corresponding entry in the *destination* sucursal's records
          const mapKey = `${folKey}_${articuloKey}_${destino}`; // Look for entry in the derived destination
          const entradaData = incomingMap.get(mapKey);
          const cantidadEntrada = entradaData?.cantidad || 0;
          const costoEntrada = entradaData?.costo || 0; // Cost recorded at destination
          const valorRecibido = cantidadEntrada * costoSalida; // Calculate received value using ORIGIN cost for fair comparison

          totalRecibido += valorRecibido;

          // Check for quantity discrepancy
          if (Math.abs(cantidadEntrada - cantidadSalida) > 0.01) { // Tolerance for float comparison
            countDiscrepancias++;
          }
        });

        if (!isCancelled) {
          setTotalesGlobales({
            enviado: totalEnviado,
            recibido: totalRecibido,
            balance: totalEnviado - totalRecibido, // Based on origin cost
            discrepancias: countDiscrepancias,
          });
        }
      } catch (err) {
        console.error('Error calculando totales globales:', err);
        if (!isCancelled) {
            setError(err instanceof Error ? err.message : 'Error al calcular totales globales.');
        }
      } finally {
        if (!isCancelled) {
            setLoadingTotals(false);
        }
      }
    };

    fetchGlobalData();
    return () => { isCancelled = true; };
  }, [startDate, endDate]); // Re-calculate totals only when dates change


  // Fetch transfer details for the SELECTED sucursal
  useEffect(() => {
    if (!startDate || !endDate || !selectedSucursal) return;

    let isCancelled = false;
    const fetchTransferencias = async () => {
      setLoading(true);
      setError(null);
      setTransferencias([]);

      const formattedStartDate = new Date(startDate + 'T00:00:00Z').toISOString();
      const formattedEndDate = new Date(endDate + 'T23:59:59Z').toISOString();
      const originTable = `Kardex${selectedSucursal}`;

      try {
        // Fetch outgoing movements from the selected origin sucursal
        const { data: originMovimientos, error: originError } = await supabase
          .from(originTable)
          .select(COLUMNAS_KARDEX)
          .gte('fecha', formattedStartDate)
          .lte('fecha', formattedEndDate)
          .eq('movto', MOVIMIENTO_SALIDA);

        if (originError) throw originError;
        if (isCancelled) return;

        if (!originMovimientos || originMovimientos.length === 0) {
             // No outgoing transfers from this sucursal in the period
             setTransferencias([]);
             setLoading(false);
             return;
        }

        // Fetch potential incoming movements from ALL other valid sucursales to match
        const destFetchPromises = SUCURSALES_VALIDAS_TRASPASOS
            .filter(s => s !== selectedSucursal) // Don't query origin table again
            .map(destSuc =>
                supabase
                    .from(`Kardex${destSuc}`)
                    .select(COLUMNAS_KARDEX)
                    .gte('fecha', formattedStartDate) // Wider date range might be needed if receipt is delayed
                    .lte('fecha', formattedEndDate)   // Adjust date range for destination if necessary
                    .eq('movto', MOVIMIENTO_ENTRADA)
                    // Add filter by 'fol' if possible and efficient
                    // .in('fol', originMovimientos.map(o => o.fol).filter(Boolean))
             );

        const destResults = await Promise.all(destFetchPromises);
        if (isCancelled) return;

        // Create map of ALL potential destination entries
        // Key: fol_articulo_sucursalEntrada (where sucursalEntrada is the table it came from)
        const destMap = new Map<string, { cantidad: number; costo: number }>();
        destResults.forEach((result, index) => {
            const destSucursalName = SUCURSALES_VALIDAS_TRASPASOS.filter(s => s !== selectedSucursal)[index];
            if (result.error) {
                console.error(`Error fetching entries from ${destSucursalName}:`, result.error);
            } else if (result.data) {
                result.data.forEach((entrada: KardexRow) => {
                    const folKey = entrada.fol?.toString().split('.')[0] || 'nofol';
                    const articuloKey = entrada.articulo?.trim().toUpperCase() || 'noart';
                    const mapKey = `${folKey}_${articuloKey}_${destSucursalName}`; // Key includes where entry was recorded
                    destMap.set(mapKey, {
                        cantidad: Number(entrada.cantidad || 0),
                        costo: Number(entrada.costo || 0), // Cost recorded at destination
                    });
                });
            }
        });


        // Process outgoing transfers and match with destination entries
        const transferenciasData: Transferencia[] = (originMovimientos || [])
          .map((salida: KardexRow, index: number) => {
            const folKey = salida.fol?.toString().split('.')[0] || 'nofol';
            const articuloKey = salida.articulo?.trim().toUpperCase() || 'noart';
            const id = `${folKey}-${articuloKey}-${selectedSucursal}-${index}`; // Unique key for the row

            const destinoCalculado = extractDestinoFromReferencia(salida.referencia);

            // Look for the entry in the specific calculated destination sucursal
            const destMapKey = `${folKey}_${articuloKey}_${destinoCalculado}`;
            const entradaData = destMap.get(destMapKey);

            const cantidad_origen = Number(salida.cantidad || 0);
            const costo_origen = Number(salida.costo || 0);
            const cantidad_destino = entradaData?.cantidad || 0;
            const costo_destino = entradaData?.costo || 0; // Cost at destination

            const credito_origen = costo_origen * cantidad_origen;
            // Use origin cost for comparing value received vs sent
            const credito_destino_comparativo = costo_origen * cantidad_destino;

            return {
              id: id,
              origen: selectedSucursal,
              destino: destinoCalculado,
              fecha: formatDate(salida.fecha),
              codigo: folKey,
              articulo: salida.articulo || 'N/A',
              costo_origen,
              costo_destino,
              cantidad_origen,
              cantidad_destino,
              discrepancia: Math.abs(cantidad_destino - cantidad_origen) > 0.01,
              credito_origen: credito_origen,
              credito_destino: costo_destino * cantidad_destino, // Actual value recorded at dest
              diferencia_valor: credito_origen - credito_destino_comparativo, // Diff based on origin cost
            };
          })
          // Optional: Filter out transfers where destination is unknown or invalid?
          .filter(t => t.destino !== 'Desconocido' && SUCURSALES_VALIDAS_TRASPASOS.includes(t.destino));


        if (!isCancelled) {
            // Sort transfers, e.g., by date descending
            transferenciasData.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
            setTransferencias(transferenciasData);
        }

      } catch (err) {
        console.error('Error fetching transfer details:', err);
        if (!isCancelled) {
            setError(err instanceof Error ? err.message : 'Error desconocido al cargar transferencias.');
        }
      } finally {
        if (!isCancelled) {
            setLoading(false);
        }
      }
    };

    fetchTransferencias();
    return () => { isCancelled = true; };
  }, [startDate, endDate, selectedSucursal]);


  return (
    <div className="container mx-auto p-4 md:p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        Control de Traspasos ({selectedSucursal})
      </h2>

      {/* Selector and Loading Indicator */}
      <div className="mb-6 flex flex-wrap gap-4 items-center">
         <div>
           <label htmlFor="sucursal-select-traspasos" className="sr-only">Sucursal Origen</label>
           <select
             id="sucursal-select-traspasos"
             value={selectedSucursal}
             onChange={(e) => setSelectedSucursal(e.currentTarget.value)}
             disabled={loading || loadingTotals}
             className="px-4 py-2 border rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
           >
             {SUCURSALES_VALIDAS_TRASPASOS.map((sucursal) => (
               <option value={sucursal} key={sucursal}>
                 {sucursal} {/* Display as Origin */}
               </option>
             ))}
           </select>
        </div>

        {(loading || loadingTotals) && (
          <div className="flex items-center text-gray-600">
             <svg className="animate-spin h-5 w-5 mr-2 text-blue-500" /* Spinner SVG */ ></svg>
            {loading ? 'Cargando detalles...' : 'Calculando totales...'}
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg border border-red-300">
           <span className="font-medium">Error:</span> {error}
        </div>
      )}

      {/* Tarjetas de totales globales */}
      <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
         {/* Total Enviado Card */}
         <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex justify-between items-center mb-1">
            <h3 className="text-sm font-medium text-gray-500">Total Enviado (Global)</h3>
            {loadingTotals && <svg className="animate-spin h-4 w-4 text-gray-400" /* Small spinner */ ></svg>}
          </div>
          <div className="text-2xl font-bold text-blue-600">
            {formatCurrency(totalesGlobales.enviado)}
          </div>
        </div>
         {/* Total Recibido Card */}
         <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
           <div className="flex justify-between items-center mb-1">
              <h3 className="text-sm font-medium text-gray-500">Total Recibido (Valor Origen)</h3>
               {loadingTotals && <svg className="animate-spin h-4 w-4 text-gray-400" /* Small spinner */ ></svg>}
           </div>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(totalesGlobales.recibido)}
          </div>
        </div>
        {/* Balance Card */}
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
           <div className="flex justify-between items-center mb-1">
              <h3 className="text-sm font-medium text-gray-500">Balance (Global)</h3>
               {loadingTotals && <svg className="animate-spin h-4 w-4 text-gray-400" /* Small spinner */ ></svg>}
            </div>
          <div className={`text-2xl font-bold ${
            totalesGlobales.balance < -0.01 ? 'text-red-600' : 'text-green-600' // Tolerance
          }`}>
            {formatCurrency(totalesGlobales.balance)}
          </div>
        </div>
         {/* Discrepancias Card */}
         <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
           <div className="flex justify-between items-center mb-1">
            <h3 className="text-sm font-medium text-gray-500">Discrepancias (Global)</h3>
             {loadingTotals && <svg className="animate-spin h-4 w-4 text-gray-400" /* Small spinner */ ></svg>}
            </div>
          <div className={`text-2xl font-bold ${
              totalesGlobales.discrepancias > 0 ? 'text-red-600' : 'text-gray-800'
          }`}>
            {totalesGlobales.discrepancias}
          </div>
        </div>
      </div>

      {/* Tabla de transferencias */}
       <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {/* Adjust columns as needed */}
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Artículo</th>
                {/*<th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Origen</th>*/}
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Destino</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cant. Enviada</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cant. Recibida</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Enviado</th>
                <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transferencias.map((tr) => (
                <tr key={tr.id} className="hover:bg-gray-50 transition-colors duration-150 ease-in-out">
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{tr.fecha}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 font-mono">#{tr.codigo}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{tr.articulo}</td>
                  {/*<td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{tr.origen}</td>*/}
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{tr.destino}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">{formatNumber(tr.cantidad_origen)}</td>
                  <td className={`px-4 py-3 whitespace-nowrap text-sm text-right ${tr.discrepancia ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                      {formatNumber(tr.cantidad_destino)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-800 font-medium">{formatCurrency(tr.credito_origen)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        tr.discrepancia ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {tr.discrepancia ? 'DISCREPANCIA' : 'OK'}
                    </span>
                  </td>
                </tr>
              ))}
               {/* Empty state within table */}
              {!loading && transferencias.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-gray-500">
                    No se encontraron traspasos salientes para {selectedSucursal} en este período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TraspasosSuc;