import { useState, useEffect } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';
import { useDebounce, formatCurrency, formatDate } from '../utils/helpers'; // Adjust path

// Constants
const SUCURSALES_VALIDAS_NEGATIVOS = ['Mexico', 'Econo1', 'Econo2', 'Baja'];
const COLUMNAS_ARTICULOS = 'cve_articulo_a, depto_a, subdepto_a, nombre_comer_a, cant_piso_a, preciomn_a, costo_a, comision, fecha_modificacion';
const DEBOUNCE_DELAY = 300; // milliseconds

// Type for Supabase row
interface ArticuloRow {
    cve_articulo_a: string;
    depto_a: string | null;
    subdepto_a: string | null;
    nombre_comer_a: string | null;
    cant_piso_a: number | string | null; // Stock
    preciomn_a: number | string | null; // Price
    costo_a: number | string | null; // Cost
    comision: number | string | null; // Commission
    fecha_modificacion: string;
}

// Type for processed data
interface TableRow {
  id: string; // Use cve_articulo_a
  cve_articulo_a: string;
  depto_a: string;
  subdepto_a: string;
  nombre_comer_a: string;
  cant_piso_a: number;
  preciomn_a: number;
  costo_a: number;
  comision: number;
  fecha_modificacion: string; // Formatted date
}

const Negativos = () => {
  const [data, setData] = useState<TableRow[]>([]);
  // No need for filteredData state, filtering happens via query or simple map
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSucursal, setSelectedSucursal] = useState(SUCURSALES_VALIDAS_NEGATIVOS[0]);

  // Debounce search query
  const debouncedSearchQuery = useDebounce(searchQuery, DEBOUNCE_DELAY);

  useEffect(() => {
    let isCancelled = false;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setData([]); // Clear previous results

      const targetTable = `Articulos${selectedSucursal}`;

      try {
        let query = supabase
          .from(targetTable)
          .select(COLUMNAS_ARTICULOS)
          .lt('cant_piso_a', 0) // *** Filter for negatives directly in the query ***
          .order('nombre_comer_a', { ascending: true }); // Order by name

        // Apply search filter if debounced query exists
        if (debouncedSearchQuery.trim()) {
          // Search across code and name
          query = query.or(`cve_articulo_a.ilike.%${debouncedSearchQuery}%,nombre_comer_a.ilike.%${debouncedSearchQuery}%`);
        }

        const { data: supabaseData, error: dbError } = await query;

        if (dbError) throw dbError;

        if (!isCancelled) {
           const processedData: TableRow[] = (supabaseData || []).map((row: ArticuloRow) => ({
                id: row.cve_articulo_a,
                cve_articulo_a: row.cve_articulo_a,
                depto_a: row.depto_a || 'N/A',
                subdepto_a: row.subdepto_a || 'N/A',
                nombre_comer_a: row.nombre_comer_a || 'N/A',
                cant_piso_a: Number(row.cant_piso_a || 0),
                preciomn_a: Number(row.preciomn_a || 0),
                costo_a: Number(row.costo_a || 0),
                comision: Number(row.comision || 0),
                fecha_modificacion: formatDate(row.fecha_modificacion),
           }));
           setData(processedData);
        }
      } catch (err) {
        console.error(`Error fetching negative stock from ${targetTable}:`, err);
        if (!isCancelled) {
            setError(err instanceof Error ? err.message : 'Error desconocido al obtener negativos.');
        }
      } finally {
        if (!isCancelled) {
            setLoading(false);
        }
      }
    };

    fetchData();

    return () => { isCancelled = true; }; // Cleanup

  }, [debouncedSearchQuery, selectedSucursal]); // Re-fetch when debounced search or sucursal changes

  return (
    // Using Tailwind classes directly for styling
    <div className="container mx-auto p-4 md:p-6">
        <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
            {/* Card Header */}
            <div className="px-4 py-3 sm:px-6 border-b border-gray-200 flex flex-wrap gap-4 items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-800 whitespace-nowrap">
                    Artículos con Existencia Negativa ({selectedSucursal})
                </h2>
                <div className="flex flex-wrap gap-4 items-center">
                     {/* Sucursal Selector */}
                    <div>
                         <label htmlFor="sucursal-select-negativos" className="sr-only">Sucursal</label>
                         <select
                            id="sucursal-select-negativos"
                            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                            value={selectedSucursal}
                            onChange={(e) => setSelectedSucursal(e.currentTarget.value)}
                            disabled={loading}
                         >
                            {SUCURSALES_VALIDAS_NEGATIVOS.map((sucursal) => (
                            <option value={sucursal} key={sucursal}>
                                {sucursal}
                            </option>
                            ))}
                        </select>
                    </div>
                    {/* Search Input */}
                    <div className="relative">
                        <label htmlFor="search-negativos" className="sr-only">Buscar</label>
                         <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input
                            id="search-negativos"
                            type="search"
                            className="block w-full pl-10 pr-3 py-1.5 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
                            placeholder="Buscar artículo..."
                            value={searchQuery}
                            onInput={(e) => setSearchQuery(e.currentTarget.value)}
                            disabled={loading}
                        />
                    </div>
                </div>
            </div>

            {/* Loading Indicator */}
             {loading && (
                 <div className="p-6 text-center text-gray-500 flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 mr-2 text-blue-500" /* Spinner SVG */ ></svg>
                    Cargando datos...
                 </div>
            )}

            {/* Error Message */}
            {error && !loading && (
                <div role="alert" className="m-4 p-4 bg-red-100 text-red-700 rounded-lg border border-red-300">
                     <span className="font-medium">Error:</span> {error}
                </div>
            )}

            {/* Table */}
            {!loading && !error && (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                        <tr>
                            {/* Define headers explicitly */}
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cve Artículo</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre Comercial</th>
                            <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Existencia</th>
                            <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Precio</th>
                            <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Costo</th>
                            {/* <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Depto</th> */}
                            {/* <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subdepto</th> */}
                            {/* <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Comisión</th> */}
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Últ. Modif.</th>
                        </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                        {data.map((row) => (
                            <tr key={row.id} className="hover:bg-red-50 transition-colors duration-150 ease-in-out"> {/* Highlight negative rows */}
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-mono">{row.cve_articulo_a}</td>
                                <td className="px-4 py-3 text-sm text-gray-900 font-medium">{row.nombre_comer_a}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-bold text-red-600">{row.cant_piso_a}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">{formatCurrency(row.preciomn_a)}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">{formatCurrency(row.costo_a)}</td>
                                {/* <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{row.depto_a}</td> */}
                                {/* <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{row.subdepto_a}</td> */}
                                {/* <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">{row.comision}</td> */}
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{row.fecha_modificacion}</td>
                            </tr>
                        ))}
                        {/* Empty state */}
                        {data.length === 0 && (
                            <tr>
                            <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                                No se encontraron artículos con existencia negativa {searchQuery ? `que coincidan con "${searchQuery}"` : ''} en {selectedSucursal}.
                            </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    </div>
  );
};

export default Negativos;