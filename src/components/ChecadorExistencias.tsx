import { useState, useEffect } from 'preact/hooks';
import { JSX } from 'preact';
import { supabase } from '../utils/supabaseClient';
import { useDebounce, formatCurrency, formatDate, formatNumber } from '../utils/helpers'; // Adjust path

// Constants
const SUCURSALES_ARTICULOS = [
  'ArticulosEcono1',
  'ArticulosMexico',
  'ArticulosMadero',
  'ArticulosLopezM',
  'ArticulosBaja',
  'ArticulosEcono2',
  'ArticulosLolita'
];
const COLUMNAS_EXISTENCIA = 'cve_articulo_a, nombre_comer_a, cant_piso_a, preciomn_a, costo_a, fecha_modificacion';
const AUTOCOMPLETE_DEBOUNCE = 300; // ms delay for autocomplete suggestions
const AUTOCOMPLETE_MIN_CHARS = 3; // Minimum characters to trigger autocomplete

// Types
interface SupabaseArticuloRow {
    cve_articulo_a: string;
    nombre_comer_a: string | null;
    cant_piso_a: number | string | null;
    preciomn_a: number | string | null;
    costo_a: number | string | null;
    fecha_modificacion: string | null;
}

interface TableRow {
  sucursal: string;
  cve_articulo_a: string;
  nombre_comer_a: string;
  existencia: number;
  preciomn_a: number;
  costo_a: number;
  fecha_modificacion: string; // Formatted date
}

interface AutocompleteItem {
  cve_articulo_a: string;
  nombre_comer_a: string;
}

// Helper to extract sucursal name from table name
const getSucursalName = (tableName: string): string => {
    return tableName.replace('Articulos', '') || 'Desconocida';
}

const ChecadorExistencia = () => {
  const [searchTerm, setSearchTerm] = useState(''); // Raw input value
  const [searchValue, setSearchValue] = useState(''); // Value used for actual search (after select/enter)
  const [resultados, setResultados] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [autocompleteResults, setAutocompleteResults] = useState<AutocompleteItem[]>([]);
  const [loadingAutocomplete, setLoadingAutocomplete] = useState<boolean>(false);

  // Debounce the raw search term for autocomplete
  const debouncedSearchTerm = useDebounce(searchTerm, AUTOCOMPLETE_DEBOUNCE);

  // Fetch autocomplete suggestions
  useEffect(() => {
    if (debouncedSearchTerm.length < AUTOCOMPLETE_MIN_CHARS) {
      setAutocompleteResults([]);
      return;
    }

    let isCancelled = false;
    const fetchAutocomplete = async () => {
      setLoadingAutocomplete(true);
      setError(null); // Clear previous errors maybe
      try {
        // Query a central/main table for autocomplete for efficiency
        const { data, error: dbError } = await supabase
          .from('ArticulosMexico') // Or a dedicated view/master table
          .select('cve_articulo_a, nombre_comer_a')
          .or(`cve_articulo_a.ilike.%${debouncedSearchTerm}%,nombre_comer_a.ilike.%${debouncedSearchTerm}%`)
          .limit(10); // Limit suggestions

        if (dbError) throw dbError;

        if (!isCancelled) {
            setAutocompleteResults(data || []);
        }
      } catch (err) {
        console.error('Error en autocompletado:', err);
        if (!isCancelled) {
             // Optionally set an error state for autocomplete failure
             // setError("Error al buscar sugerencias.");
            setAutocompleteResults([]); // Clear results on error
        }
      } finally {
        if (!isCancelled) {
            setLoadingAutocomplete(false);
        }
      }
    };

    fetchAutocomplete();
    return () => { isCancelled = true; }

  }, [debouncedSearchTerm]);


  // Function to fetch existence from a single sucursal
  const buscarEnSucursal = async (sucursalTable: string, valueToSearch: string): Promise<TableRow[]> => {
    try {
        const { data, error: dbError } = await supabase
            .from(sucursalTable)
            .select(COLUMNAS_EXISTENCIA)
            // Use eq for exact match if searching by selected code, ilike for broader search
            .or(`cve_articulo_a.eq.${valueToSearch},nombre_comer_a.ilike.%${valueToSearch}%`) // Adjust logic based on search type
            // Consider searching only by cve_articulo_a if an item was selected from autocomplete
            // .eq('cve_articulo_a', valueToSearch) // If item selected
            ;

        if (dbError) {
            console.error(`Error en ${sucursalTable}:`, dbError);
            // Decide how to handle partial errors, maybe return empty or throw
            return []; // Return empty for this sucursal on error
        }

        return (data || []).map((dato: SupabaseArticuloRow) => ({
            sucursal: getSucursalName(sucursalTable),
            cve_articulo_a: dato.cve_articulo_a,
            nombre_comer_a: dato.nombre_comer_a || 'N/A',
            existencia: Number(dato.cant_piso_a || 0),
            preciomn_a: Number(dato.preciomn_a || 0),
            costo_a: Number(dato.costo_a || 0),
            fecha_modificacion: formatDate(dato.fecha_modificacion),
        }));
    } catch (err) {
         console.error(`Exception fetching from ${sucursalTable}:`, err);
         return [];
    }
  };

  // Function to trigger the main search across all sucursales
  const buscarExistencia = async (valueToSearch: string) => {
    if (!valueToSearch.trim()) return; // Don't search if empty

    setLoading(true);
    setError(null);
    setResultados([]); // Clear previous results
    setAutocompleteResults([]); // Hide autocomplete dropdown
    setSearchValue(valueToSearch); // Store the value that was actually searched

    try {
        // Use Promise.all for concurrent searches
        const promises = SUCURSALES_ARTICULOS.map(sucursalTable =>
            buscarEnSucursal(sucursalTable, valueToSearch)
        );

        const resultsArrays = await Promise.all(promises);

        // Flatten the array of arrays and filter out empty results potentially
        const combinedResultados = resultsArrays.flat();

        // Optionally filter out items where existence is 0 if needed, but usually better to show 0
        // const filteredResultados = combinedResultados.filter(r => r.existencia !== 0);

        setResultados(combinedResultados);

        if(combinedResultados.length === 0) {
            // Set a specific message if nothing found?
            // setError(`No se encontraron existencias para "${valueToSearch}".`);
        }

    } catch (err) {
         console.error("Error during parallel fetch:", err);
         setError(err instanceof Error ? err.message : "Error desconocido al buscar existencias.");
    } finally {
        setLoading(false);
    }
  };

  // --- Event Handlers ---
  const handleSearchInput = (e: JSX.TargetedEvent<HTMLInputElement, Event>) => {
    const value = e.currentTarget.value;
    setSearchTerm(value); // Update the raw input term for debouncing/autocomplete
    // Don't trigger main search here, wait for Enter or selection
  };

  const handleSelectItem = (item: AutocompleteItem) => {
    setSearchTerm(item.cve_articulo_a); // Update input field text
    setAutocompleteResults([]); // Hide autocomplete
    buscarExistencia(item.cve_articulo_a); // Trigger search with selected code
  };

  const handleKeyDown = (e: JSX.TargetedKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
       e.preventDefault(); // Prevent potential form submission
       setAutocompleteResults([]); // Hide autocomplete
       buscarExistencia(searchTerm); // Trigger search with current input value
    }
     // Add Up/Down arrow key navigation for autocomplete if desired
  };

  const handleSearchButtonClick = () => {
      setAutocompleteResults([]); // Hide autocomplete
      buscarExistencia(searchTerm); // Trigger search with current input value
  };

  // --- Data Processing for Display ---
  const agruparPorArticulo = (res: TableRow[]) => {
    return res.reduce((acc, item) => {
      const key = item.cve_articulo_a;
      if (!acc[key]) {
        // Store common info once
        acc[key] = { nombre: item.nombre_comer_a, data: [] };
      }
      acc[key].data.push(item);
      return acc;
    }, {} as { [key: string]: { nombre: string; data: TableRow[] } });
  };

  const calcularExistenciasTotales = (articuloData: TableRow[]) => {
    return articuloData.reduce((total, item) => total + (item.existencia || 0), 0);
  };

  const ordenarGruposPorExistencias = (grupos: [string, { nombre: string; data: TableRow[] }][]) => {
     // Sorts groups: negatives first (most negative first), then positives (highest first)
    return grupos.sort(([, dataA], [, dataB]) => {
      const totalA = calcularExistenciasTotales(dataA.data);
      const totalB = calcularExistenciasTotales(dataB.data);

      if (totalA < 0 && totalB >= 0) return -1; // A negative, B non-negative: A comes first
      if (totalA >= 0 && totalB < 0) return 1;  // A non-negative, B negative: B comes first
      if (totalA < 0 && totalB < 0) return totalA - totalB; // Both negative: sort by value (most negative first)
      return totalB - totalA; // Both non-negative: sort descending by value
    });
  };

  const resultadosAgrupados = agruparPorArticulo(resultados);
  const resultadosOrdenados = ordenarGruposPorExistencias(Object.entries(resultadosAgrupados));

  return (
    <div className="container mx-auto p-4 md:p-6">
        <h2 className="text-2xl font-semibold mb-6 text-center text-gray-800">
            Checador de Existencias Global
        </h2>
        <div className="relative max-w-xl mx-auto mb-4">
            <label htmlFor="search-existencias" className="sr-only">Buscar Artículo</label>
            <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                <input
                    id="search-existencias"
                    type="search"
                    placeholder="Clave o Nombre del artículo..."
                    value={searchTerm}
                    onInput={handleSearchInput}
                    onKeyDown={handleKeyDown}
                    disabled={loading}
                    className="p-3 border-none focus:outline-none w-full text-lg flex-grow disabled:bg-gray-100"
                    aria-autocomplete="list"
                    aria-controls="autocomplete-list"
                />
                 {loadingAutocomplete && (
                     <div className="px-3">
                         <svg className="animate-spin h-5 w-5 text-gray-400" /* Spinner */></svg>
                     </div>
                )}
            </div>

             {/* Autocomplete Dropdown */}
             {autocompleteResults.length > 0 && (
                <ul
                    id="autocomplete-list"
                    className="absolute mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg z-10 max-h-60 overflow-y-auto"
                    role="listbox"
                >
                {autocompleteResults.map((item) => (
                    <li
                        key={item.cve_articulo_a}
                        onClick={() => handleSelectItem(item)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSelectItem(item)} // Allow selection with Enter
                        className="px-4 py-2 text-sm cursor-pointer hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                        role="option"
                        tabIndex={0} // Make it focusable
                        aria-selected="false"
                    >
                        <span className="font-mono font-medium">{item.cve_articulo_a}</span> - {item.nombre_comer_a}
                    </li>
                ))}
                </ul>
            )}
        </div>

        <button
            onClick={handleSearchButtonClick}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 w-full max-w-xl mx-auto block text-lg font-medium disabled:opacity-50"
            disabled={loading || !searchTerm.trim()}
        >
            {loading ? (
                <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" /* spinner */></svg>
                    Buscando...
                </span>
            ) : (
                'Consultar Existencia'
            )}
        </button>

        {/* Error Display */}
        {error && !loading && (
            <div role="alert" className="mt-6 max-w-xl mx-auto p-4 bg-red-100 text-red-700 rounded-lg border border-red-300">
                 <span className="font-medium">Error:</span> {error}
            </div>
        )}

        {/* Results Area */}
        <div className="mt-8 space-y-8">
            {/* Display search term if results are shown */}
             {resultados.length > 0 && !loading && (
                <p className="text-center text-gray-600">
                    Resultados para: <span className="font-medium">{searchValue}</span>
                </p>
             )}

            {resultadosOrdenados.map(([cve_articulo_a, { nombre, data: articuloData }]) => {
                const totalExistencias = calcularExistenciasTotales(articuloData);
                const totalClass = totalExistencias < 0 ? "text-red-600 font-bold" : "text-green-700 font-bold";

                return (
                <div key={cve_articulo_a} className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
                    {/* Articulo Header */}
                    <div className="px-4 py-3 sm:px-6 bg-gray-50 border-b border-gray-200 flex flex-wrap justify-between items-center gap-2">
                        <h3 className="text-lg font-semibold text-gray-800">
                            <span className="font-mono">{cve_articulo_a}</span> - {nombre}
                        </h3>
                        <span className={`text-lg font-semibold ${totalClass}`}>
                            Total: {formatNumber(totalExistencias)}
                        </span>
                    </div>
                    {/* Sucursal Table */}
                    <div className="overflow-x-auto">
                         <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sucursal</th>
                                    <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Existencia</th>
                                    <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Precio</th>
                                    <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Costo</th>
                                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Últ. Modif.</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {articuloData.map((resultado, index) => (
                                <tr key={`${resultado.sucursal}-${index}`} className="hover:bg-gray-50 transition-colors duration-150 ease-in-out">
                                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{resultado.sucursal}</td>
                                    <td className={`px-4 py-2 whitespace-nowrap text-sm text-right ${
                                        resultado.existencia < 0 ? 'text-red-600 font-bold' : 'text-gray-700'
                                    }`}>
                                        {formatNumber(resultado.existencia)}
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-right text-gray-700">{formatCurrency(resultado.preciomn_a)}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-right text-gray-700">{formatCurrency(resultado.costo_a)}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">{resultado.fecha_modificacion}</td>
                                </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                );
            })}

            {/* No Results Message */}
            {!loading && resultados.length === 0 && searchValue && (
                 <div className="text-center py-10 text-gray-500">
                     No se encontraron existencias para "{searchValue}".
                 </div>
            )}
        </div>
    </div>
  );
};

export default ChecadorExistencia;