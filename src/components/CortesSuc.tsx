// --- START OF FILE src/components/CortesSuc.tsx ---

import { useState, useEffect, useMemo, useCallback } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';

// --- Interfaces ---
interface TableRow {
    // Original fields from your DB (no 'id')
    corte: string;
    turno: string;
    fecha: string; // Expecting 'YYYY-MM-DD' or 'YYYY-MM-DD HH:MM:SS'
    hora: string;
    folini: string;
    folfin: string;
    totentreg: string | number;
    tottarj: string | number;
    faltan: string | number;
    sobran: string | number;
    encar: string;
    cajer: string;
    gas: string | number;
    com: string | number;
    val: string | number;
    totret: string | number;
    // Added for 'General' view context
    sucursal_nombre?: string;
}

interface TotalsRow {
    totentreg: number;
    tottarj: number;
    faltan: number;
    sobran: number;
    gas: number;
    com: number;
    val: number;
    totret: number;
    recordCount: number; // Add count for clarity in totals row
}

// Structure to hold processed data for each DATE
interface DateGroupData {
    rows: TableRow[];
    totals: TotalsRow;
}

// Type for the final processed data structure, grouped by DATE KEY
type ProcessedDataByDate = {
    [dateKey: string]: DateGroupData;
};


interface Props {
    selectedSucursal: string; // e.g., 'General', 'CortesMexico'
    onSucursalChange: (sucursal: string) => void;
    sucursales: string[]; // List including 'General' and actual table names
}

// --- Helper Functions ---

// Debounce function
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    return function executedFunction(...args: Parameters<T>) {
        const later = () => {
            timeout = null;
            func(...args);
        };
        if (timeout !== null) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(later, wait);
    };
}

// Helper function to safely parse and sum numbers
const safeParseAndAdd = (currentSum: number, newValue: any): number => {
    const strVal = String(newValue ?? '0');
    const num = parseFloat(strVal.replace(/,/g, '.')) || 0;
    // Use toFixed(2) before adding to manage floating point issues, then parse back
    return parseFloat((currentSum + num).toFixed(2));
};

// Format currency
const formatCurrency = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) return '$0.00';
    const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '.')) || 0 : Number(value) || 0;
    const fixedNum = parseFloat(num.toFixed(2)); // Ensure 2 decimal places
    return `$${fixedNum.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Format date string for display (e.g., "1 de marzo de 2024")
const formatDisplayDate = (dateKey: string): string => {
    if (!dateKey) return 'Fecha desconocida';
    try {
        // Assuming dateKey is 'YYYY-MM-DD'
        const date = new Date(dateKey + 'T00:00:00Z'); // Interpret as UTC
        if (isNaN(date.getTime())) return dateKey;

        return date.toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'long', // 'long' for full month name
            day: 'numeric',
            timeZone: 'UTC', // Display based on UTC date
        });
    } catch (e) {
        console.error("Error formatting display date:", dateKey, e);
        return dateKey;
    }
};

// Format time string
const formatTime = (timeString: string | null | undefined): string => {
     if (!timeString) return '';
     return timeString.substring(0, 5); // Get HH:MM
};

// Define columns to select (no 'id')
const COLUMNS_TO_SELECT = 'corte, turno, fecha, hora, folini, folfin, totentreg, tottarj, faltan, sobran, encar, cajer, gas, com, val, totret';

// Function to get clean sucursal name
const getCleanSucursalName = (dbName: string): string => {
     if (dbName === 'General') return 'General (Todas)';
     return dbName.replace('Cortes', ''); // Remove "Cortes" prefix
};

// --- Component ---
const CortesSuc = ({ selectedSucursal, onSucursalChange, sucursales }: Props) => {
    const [rawData, setRawData] = useState<TableRow[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [startDate, setStartDate] = useState<string | null>(null);
    const [endDate, setEndDate] = useState<string | null>(null);

    const debouncedSetSearch = useCallback(debounce(setDebouncedSearchQuery, 300), []);

    useEffect(() => {
        debouncedSetSearch(searchQuery);
    }, [searchQuery, debouncedSetSearch]);

    // 1. Fetch Date Range (remains the same)
    useEffect(() => {
        setLoading(true); setError(null);
        const fetchDateRange = async () => {
            try {
                const { data, error: dateError } = await supabase.from('date_range').select('start_date, end_date').single();
                if (dateError) throw dateError;
                if (!data || !data.start_date || !data.end_date) throw new Error("Rango de fechas inválido recibido.");
                setStartDate(data.start_date); setEndDate(data.end_date);
            } catch (err: any) {
                console.error('Error al obtener el rango de fechas:', err);
                setError(`Error al obtener rango de fechas: ${err.message}`);
                setStartDate(null); setEndDate(null); setLoading(false);
            }
        };
        fetchDateRange();
    }, []);

    // 2. Fetch Sucursal Data (fetch logic remains similar, sorting is key)
    useEffect(() => {
        if (!startDate || !endDate) {
             if (!loading && !error) setLoading(true);
            return;
        }
        setLoading(true); setError(null); setRawData([]);

        const fetchData = async () => {
            try {
                 const dayAfterEnd = (() => { const d=new Date(endDate+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+1); return d.toISOString().split('T')[0]; })();
                let combinedData: TableRow[] = [];

                if (selectedSucursal === 'General') {
                    const sucursalesToFetch = sucursales.filter(s => s !== 'General' && !s.startsWith('date_') && s !== 'tasks');
                    const promises = sucursalesToFetch.map(async (sucursalName) => {
                        const { data, error: fetchError } = await supabase
                            .from(sucursalName).select(COLUMNS_TO_SELECT)
                            .gte('fecha', startDate).lt('fecha', dayAfterEnd);
                        if (fetchError) { console.warn(`Error fetching ${sucursalName}: ${fetchError.message}`); return []; }
                        // Add the *database table name* as sucursal_nombre for potential filtering/display
                        return data ? data.map(row => ({ ...row, sucursal_nombre: sucursalName })) : [];
                    });
                    const results = await Promise.all(promises);
                    combinedData = results.flat();
                } else {
                    const { data, error: fetchError } = await supabase
                        .from(selectedSucursal).select(COLUMNS_TO_SELECT)
                        .gte('fecha', startDate).lt('fecha', dayAfterEnd);
                    if (fetchError) throw fetchError;
                    combinedData = data || [];
                    // Add sucursal_nombre even for single view for consistency if needed later
                    // combinedData = combinedData.map(row => ({ ...row, sucursal_nombre: selectedSucursal }));
                }

                // Sort primarily by DATE (desc), then by SUCURSAL (asc), then TIME (asc) for grouping
                combinedData.sort((a, b) => {
                     const dateAStr = a.fecha?.split('T')[0].split(' ')[0] || '';
                     const dateBStr = b.fecha?.split('T')[0].split(' ')[0] || '';
                     const dateComparison = dateBStr.localeCompare(dateAStr); // Descending date
                     if (dateComparison !== 0) return dateComparison;

                     // If dates are same, sort by sucursal name (applies mainly to General view)
                     const sucA = a.sucursal_nombre || (selectedSucursal !== 'General' ? selectedSucursal : '');
                     const sucB = b.sucursal_nombre || (selectedSucursal !== 'General' ? selectedSucursal : '');
                     const sucComparison = sucA.localeCompare(sucB); // Ascending sucursal
                     if (sucComparison !== 0) return sucComparison;

                     // If date and sucursal are same, sort by time
                     const timeA = a.hora || '00:00:00';
                     const timeB = b.hora || '00:00:00';
                     return timeA.localeCompare(timeB); // Ascending time
                });

                setRawData(combinedData);
            } catch (err: any) {
                console.error('Error fetching sucursal data:', err);
                const message = err.message || 'Error desconocido.';
                setError(`Error al cargar datos: ${message}`);
                setRawData([]);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [selectedSucursal, startDate, endDate, sucursales]);

    // 3. Process Data: Filter, Group by DATE, Calculate Totals (Memoized)
    const processedDataByDate: ProcessedDataByDate | null = useMemo(() => {
        if (!rawData.length) return null;

        // Apply search filter first
        const filteredRows = !debouncedSearchQuery
            ? rawData
            : rawData.filter((row) =>
                Object.values(row).some((value) =>
                    value?.toString().toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ?? false
                )
              );

        if (!filteredRows.length && debouncedSearchQuery) return {}; // Return empty if search yields no results

        const groupedByDate: ProcessedDataByDate = {};
        const initialTotals: Omit<TotalsRow, 'recordCount'> = { totentreg: 0, tottarj: 0, faltan: 0, sobran: 0, gas: 0, com: 0, val: 0, totret: 0 };

        // Group filtered rows by date (YYYY-MM-DD)
        for (const row of filteredRows) {
            let dateKey = 'Fecha desconocida';
            if (row.fecha) {
                try {
                    // Extract YYYY-MM-DD consistently
                    dateKey = row.fecha.split('T')[0].split(' ')[0];
                    // Validate format roughly (optional but good practice)
                    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
                       dateKey = 'Fecha inválida';
                    }
                } catch { dateKey = 'Fecha inválida'; }
            }

            if (!groupedByDate[dateKey]) {
                groupedByDate[dateKey] = { rows: [], totals: { ...initialTotals, recordCount: 0 } };
            }
            groupedByDate[dateKey].rows.push(row);
        }

        // Calculate totals for each date group
        Object.keys(groupedByDate).forEach(dateKey => {
            const group = groupedByDate[dateKey];
            group.totals = group.rows.reduce((acc, row) => ({
                totentreg: safeParseAndAdd(acc.totentreg, row.totentreg),
                tottarj:   safeParseAndAdd(acc.tottarj, row.tottarj),
                faltan:    safeParseAndAdd(acc.faltan, row.faltan),
                sobran:    safeParseAndAdd(acc.sobran, row.sobran),
                gas:       safeParseAndAdd(acc.gas, row.gas),
                com:       safeParseAndAdd(acc.com, row.com),
                val:       safeParseAndAdd(acc.val, row.val),
                totret:    safeParseAndAdd(acc.totret, row.totret),
                recordCount: acc.recordCount + 1,
            }), { ...initialTotals, recordCount: 0 }); // Start fresh for each date
        });

        return groupedByDate;

    }, [rawData, debouncedSearchQuery]);

    // Get sorted date keys for rendering (most recent first)
    const dateKeys = useMemo(() => {
        if (!processedDataByDate) return [];
        return Object.keys(processedDataByDate).sort((a, b) => b.localeCompare(a)); // Sort YYYY-MM-DD descending
    }, [processedDataByDate]);

    // --- Render Logic ---
    return (
        <div className="bg-white shadow-lg rounded-lg overflow-hidden border border-gray-200">
            {/* Card Header (Keep similar style) */}
             <div className="p-4 sm:p-6 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                 <div>
                      <h3 className="text-lg font-semibold text-gray-800">
                          Reporte de Cortes por Día
                      </h3>
                      {startDate && endDate && (
                          <p className="text-sm text-gray-500 mt-1">
                             Periodo: {formatDisplayDate(startDate)} - {formatDisplayDate(endDate)}
                          </p>
                      )}
                      <p className="text-sm text-gray-500 mt-1">
                         Sucursal: {getCleanSucursalName(selectedSucursal)}
                      </p>
                 </div>
                 <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
                     {/* Sucursal Selector */}
                     <div className="w-full sm:w-auto">
                         <label htmlFor="sucursal-select" className="sr-only">Seleccionar Sucursal</label>
                         <select id="sucursal-select"
                                 className="block w-full px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out"
                                 value={selectedSucursal}
                                 onChange={(e) => onSucursalChange(e.currentTarget.value)}>
                             {sucursales.map((sucursal) => (
                                 <option key={sucursal} value={sucursal}>
                                     {getCleanSucursalName(sucursal)}
                                 </option>
                             ))}
                         </select>
                     </div>
                     {/* Search Input */}
                     <div className="w-full sm:w-auto">
                         <label htmlFor="table-search" className="sr-only">Buscar</label>
                          <div className="relative">
                              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                   <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"></path></svg>
                               </div>
                               <input type="text" id="table-search"
                                      className="block w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out"
                                      placeholder="Buscar en tabla..."
                                      value={searchQuery}
                                      onInput={(e) => setSearchQuery(e.currentTarget.value)} />
                          </div>
                     </div>
                 </div>
             </div>

            {/* Loading State */}
            {loading && ( <div className="flex justify-center items-center py-20 text-gray-600" /* ... spinner ... */ >Cargando datos...</div> )}

            {/* Error State */}
            {!loading && error && ( <div className="p-6 text-center text-red-600 bg-red-50 border-t border-red-200" /* ... error details ... */ >Error al cargar datos: {error}</div> )}

            {/* Table Area */}
            {!loading && !error && (
                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse">
                        <thead className="bg-gray-100 sticky top-0 z-10">
                            <tr>
                                {/* Define headers - Add Sucursal if General */}
                                {selectedSucursal === 'General' && <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap border border-gray-300">Sucursal</th>}
                                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap border border-gray-300">Corte</th>
                                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap border border-gray-300">Turno</th>
                                {/* No Date column needed here, it's a group header */}
                                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap border border-gray-300">Hora</th>
                                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap border border-gray-300">Folio I</th>
                                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap border border-gray-300">Folio F</th>
                                <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap border border-gray-300">Total Ef</th>
                                <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap border border-gray-300">Total Tar</th>
                                <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap border border-gray-300">Faltante</th>
                                <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap border border-gray-300">Sobrante</th>
                                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap border border-gray-300">Encar</th>
                                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap border border-gray-300">Cajero</th>
                                <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap border border-gray-300">Gastos</th>
                                <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap border border-gray-300">Compras</th>
                                <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap border border-gray-300">Vales</th>
                                <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap border border-gray-300">TotRet</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200"> {/* Added divide-y for subtle row lines */}
                        {!processedDataByDate || dateKeys.length === 0 ? (
                            <tr>
                                {/* Colspan based on whether 'Sucursal' column is visible */}
                                <td colSpan={selectedSucursal === 'General' ? 16 : 15} className="px-6 py-10 text-center text-gray-500 border border-gray-300">
                                    {debouncedSearchQuery ? 'No se encontraron registros que coincidan con la búsqueda.' : 'No hay datos disponibles para el periodo y sucursal seleccionados.'}
                                </td>
                            </tr>
                        ) : (
                            dateKeys.map((dateKey) => {
                                const dateGroup = processedDataByDate[dateKey];
                                // Defensive check in case data structure is unexpectedly empty
                                if (!dateGroup || !dateGroup.rows) return null;

                                const colSpanCount = selectedSucursal === 'General' ? 16 : 15;

                                return (
                                    // Using Fragment shorthand <> to group rows for a single date
                                    <>
                                        {/* === Date Header Row === */}
                                        <tr key={`header-${dateKey}`} className="bg-gray-200 sticky top-[45px] z-[9]"> {/* Adjust top offset if header height changes */}
                                            <td colSpan={colSpanCount} className="px-3 py-2 text-center text-sm font-semibold text-gray-700 border border-gray-300">
                                                {/* Date is BOLD */}
                                                {formatDisplayDate(dateKey)}
                                            </td>
                                        </tr>

                                        {/* === Data Rows for this Date === */}
                                        {dateGroup.rows.map((row, index) => (
                                            <tr key={`${dateKey}-${row.sucursal_nombre || selectedSucursal}-${row.corte}-${row.turno}-${index}`} className="hover:bg-gray-50">
                                                 {/* --- Conditional Sucursal Column --- */}
                                                {selectedSucursal === 'General' && <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap border border-gray-300">{getCleanSucursalName(row.sucursal_nombre || '')}</td>}
                                                {/* --- Data Cells --- */}
                                                <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap border border-gray-300">{row.corte}</td>
                                                <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap border border-gray-300">{row.turno}</td>
                                                <td className="px-3 py-2 text-sm text-gray-500 whitespace-nowrap border border-gray-300">{formatTime(row.hora)}</td>
                                                <td className="px-3 py-2 text-sm text-gray-500 whitespace-nowrap border border-gray-300">{row.folini}</td>
                                                <td className="px-3 py-2 text-sm text-gray-500 whitespace-nowrap border border-gray-300">{row.folfin}</td>
                                                <td className="px-3 py-2 text-sm text-gray-900 text-right whitespace-nowrap border border-gray-300">{formatCurrency(row.totentreg)}</td>
                                                <td className="px-3 py-2 text-sm text-gray-900 text-right whitespace-nowrap border border-gray-300">{formatCurrency(row.tottarj)}</td>
                                                {/* Conditional styling for faltan/sobran */}
                                                <td className={`px-3 py-2 text-sm text-right whitespace-nowrap border border-gray-300 ${parseFloat(String(row.faltan || '0').replace(',','.')) > 0 ? 'text-red-600' : 'text-gray-900'}`}>{formatCurrency(row.faltan)}</td>
                                                <td className={`px-3 py-2 text-sm text-right whitespace-nowrap border border-gray-300 ${parseFloat(String(row.sobran || '0').replace(',','.')) > 0 ? 'text-green-600' : 'text-gray-900'}`}>{formatCurrency(row.sobran)}</td>
                                                <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap border border-gray-300">{row.encar}</td>
                                                <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap border border-gray-300">{row.cajer}</td>
                                                <td className="px-3 py-2 text-sm text-gray-900 text-right whitespace-nowrap border border-gray-300">{formatCurrency(row.gas)}</td>
                                                <td className="px-3 py-2 text-sm text-gray-900 text-right whitespace-nowrap border border-gray-300">{formatCurrency(row.com)}</td>
                                                <td className="px-3 py-2 text-sm text-gray-900 text-right whitespace-nowrap border border-gray-300">{formatCurrency(row.val)}</td>
                                                <td className="px-3 py-2 text-sm text-gray-900 text-right whitespace-nowrap border border-gray-300">{formatCurrency(row.totret)}</td>
                                            </tr>
                                        ))}

                                        {/* === Total Row for this Date === */}
                                        <tr key={`total-${dateKey}`} className="bg-gray-100"> {/* Light background for total row */}
                                             {/* --- Label Cell (spans initial columns) --- */}
                                             {/* Text is BOLD */}
                                             <td colSpan={selectedSucursal === 'General' ? 6 : 5} className="px-3 py-2 text-left text-sm font-semibold text-gray-800 border border-gray-300">
                                                 Total del Día ({dateGroup.totals.recordCount} cortes)
                                             </td>

                                            {/* --- Total Values - All BOLD --- */}
                                            <td className="px-3 py-2 text-sm font-semibold text-gray-800 text-right whitespace-nowrap border border-gray-300">{formatCurrency(dateGroup.totals.totentreg)}</td>
                                            <td className="px-3 py-2 text-sm font-semibold text-gray-800 text-right whitespace-nowrap border border-gray-300">{formatCurrency(dateGroup.totals.tottarj)}</td>
                                            <td className="px-3 py-2 text-sm font-semibold text-gray-800 text-right whitespace-nowrap border border-gray-300">{formatCurrency(dateGroup.totals.faltan)}</td>
                                            <td className="px-3 py-2 text-sm font-semibold text-gray-800 text-right whitespace-nowrap border border-gray-300">{formatCurrency(dateGroup.totals.sobran)}</td>
                                            {/* --- Empty placeholder cells for Encar, Cajero --- */}
                                            {/* Added matching classes for consistency, text will be invisible anyway */}
                                            <td className="px-3 py-2 text-sm font-semibold text-gray-800 text-right whitespace-nowrap border border-gray-300"></td>
                                            <td className="px-3 py-2 text-sm font-semibold text-gray-800 text-right whitespace-nowrap border border-gray-300"></td>
                                             {/* --- Remaining totals - All BOLD --- */}
                                            <td className="px-3 py-2 text-sm font-semibold text-gray-800 text-right whitespace-nowrap border border-gray-300">{formatCurrency(dateGroup.totals.gas)}</td>
                                            <td className="px-3 py-2 text-sm font-semibold text-gray-800 text-right whitespace-nowrap border border-gray-300">{formatCurrency(dateGroup.totals.com)}</td>
                                            <td className="px-3 py-2 text-sm font-semibold text-gray-800 text-right whitespace-nowrap border border-gray-300">{formatCurrency(dateGroup.totals.val)}</td>
                                            <td className="px-3 py-2 text-sm font-semibold text-gray-800 text-right whitespace-nowrap border border-gray-300">{formatCurrency(dateGroup.totals.totret)}</td>
                                        </tr>
                                    </>
                                );
                            })
                        )}
                    </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default CortesSuc;

// --- END OF FILE src/components/CortesSuc.tsx ---