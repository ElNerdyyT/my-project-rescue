import { useState, useEffect } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';
import { formatCurrency, formatNumber, formatDate } from '../utils/helpers'; // Adjust path

// Define more specific types
interface SupabaseFacturaRow {
    fecha: string;
    referencia: string | null; // Folio
    proveedor: string | null;
    articulo: string | null;
    cantidad: number | string | null;
    costo: number | string | null;
    // Add other columns if needed by other logic, otherwise remove
}

interface Factura {
  id: string; // Use a unique ID if possible, e.g., composite key
  fecha: string;
  folio: string;
  proveedor: string;
  articulo: string;
  cantidad: number;
  costo: number;
  total: number;
  sucursal: string;
}

// Make constants
const SUCURSALES_VALIDAS_FACTURAS = ['Mexico', 'Econo1', 'Econo2', 'Baja'];
const MOVIMIENTO_FACTURA = 9;
const COLUMNAS_FACTURA = 'fecha, referencia, proveedor, articulo, cantidad, costo'; // Select only needed columns

const FacturasSuc = () => {
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [selectedSucursal, setSelectedSucursal] = useState(SUCURSALES_VALIDAS_FACTURAS[0]); // Default to first
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Fetch initial date range
  useEffect(() => {
    let isCancelled = false;
    const fetchDateRange = async () => {
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

  // Fetch facturas when dates or sucursal change
  useEffect(() => {
    if (!startDate || !endDate) return;

    let isCancelled = false;
    const fetchFacturas = async () => {
      setLoading(true);
      setError(null);
      setFacturas([]); // Clear previous results

      // Format dates for Supabase query (assuming DB stores as ISO or compatible)
      const formattedStartDate = new Date(startDate + 'T00:00:00Z').toISOString();
      const formattedEndDate = new Date(endDate + 'T23:59:59Z').toISOString();
      const targetTable = `Kardex${selectedSucursal}`;

      try {
        const { data, error: dbError } = await supabase
          .from(targetTable)
          .select(COLUMNAS_FACTURA)
          .gte('fecha', formattedStartDate)
          .lte('fecha', formattedEndDate)
          .eq('movto', MOVIMIENTO_FACTURA);

        if (dbError) throw dbError;

        if (!isCancelled) {
          const facturasData: Factura[] = (data || []).map((factura: SupabaseFacturaRow, index) => {
            const cantidad = Number(factura.cantidad || 0);
            const costo = Number(factura.costo || 0);
            // Generate a pseudo-unique key if no real ID available
            const id = `${factura.referencia || 'nofolio'}-${factura.articulo || 'noart'}-${index}`;
            return {
                id: id,
                fecha: formatDate(factura.fecha),
                folio: factura.referencia?.toString() || 'N/A',
                proveedor: factura.proveedor || 'N/A',
                articulo: factura.articulo || 'N/A',
                cantidad: cantidad,
                costo: costo,
                total: cantidad * costo,
                sucursal: selectedSucursal
            };
          });
          setFacturas(facturasData);
        }
      } catch (err) {
        console.error(`Error fetching facturas from ${targetTable}:`, err);
        if (!isCancelled) {
            setError(err instanceof Error ? err.message : 'Error desconocido al cargar facturas.');
        }
      } finally {
        if (!isCancelled) {
            setLoading(false);
        }
      }
    };

    fetchFacturas();
    return () => { isCancelled = true; }; // Cleanup function

  }, [startDate, endDate, selectedSucursal]);

  // Calculate total using formatted data
  const totalFacturas = facturas.reduce((acc, factura) => acc + factura.total, 0);

  return (
    <div className="container mx-auto p-4 md:p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        Control de Facturas ({selectedSucursal})
      </h2>

      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <div>
          <label htmlFor="sucursal-select-facturas" className="sr-only">Sucursal</label>
          <select
            id="sucursal-select-facturas"
            value={selectedSucursal}
            onChange={(e) => setSelectedSucursal(e.currentTarget.value)}
            disabled={loading}
            className="px-4 py-2 border rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {SUCURSALES_VALIDAS_FACTURAS.map((sucursal) => (
              <option value={sucursal} key={sucursal}>
                {sucursal}
              </option>
            ))}
          </select>
        </div>

        {loading && (
          <div className="flex items-center text-gray-600">
            <svg className="animate-spin h-5 w-5 mr-2 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Cargando...
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg border border-red-300">
          <span className="font-medium">Error:</span> {error}
        </div>
      )}

      {/* Card con el total */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="text-gray-500 text-sm font-medium">Total Facturado ({selectedSucursal})</div>
          <div className="text-2xl font-bold text-gray-800 mt-1">
            {formatCurrency(totalFacturas)}
          </div>
          <div className="text-xs text-gray-400 mt-1">Periodo: {formatDate(startDate)} - {formatDate(endDate)}</div>
        </div>
        {/* Add more summary cards if needed */}
      </div>

      {/* Tabla de Facturas */}
      <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Folio</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proveedor</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Artículo</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Costo Unitario</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {facturas.map((factura) => (
                <tr key={factura.id} className="hover:bg-gray-50 transition-colors duration-150 ease-in-out">
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{factura.fecha}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 font-mono">#{factura.folio}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{factura.proveedor}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{factura.articulo}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">{formatNumber(factura.cantidad)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">{formatCurrency(factura.costo)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-800 font-medium">{formatCurrency(factura.total)}</td>
                </tr>
              ))}
              {/* Empty state within table */}
              {!loading && facturas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                    No se encontraron facturas para {selectedSucursal} en este período.
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

export default FacturasSuc;