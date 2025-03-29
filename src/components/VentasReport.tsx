// --- START OF FILE VentasReport.tsx ---

import { useState, useEffect, useMemo, useRef, useCallback } from 'preact/hooks'; // Added useCallback
import { supabase } from '../utils/supabaseClient';
import './VentasReport.css'; // Ensure CSS file is present
import VentasCardsReport from './VentasCardsReport';
import Gastos from './Gastos'; // Import the Gastos component

// --- Interfaces and Constants ---
interface TableRow {
  id?: number;
  articulo: string;
  fecha: string;
  tipo: string;
  movto: string;
  desc_movto: string;
  cantidad: number;
  costo: number;
  referencia: string;
  hora: string;
  nombre: string;
  turno: string;
  ppub: number;
  autonumber: number;
  fol: string;
  dscto: number;
  costoTotal: number;
  precioFinal: number;
  utilidad: number;
  sucursal: string;
}
const branches: string[] = [ 'KardexEcono1', 'KardexMexico', 'KardexMadero', 'KardexLopezM', 'KardexBaja', 'KardexEcono2', 'KardexLolita' ];
const safeParseFloatAndRound = (value: any, decimals: number = 2): number => { if (value === null || value === undefined) return 0; const stringValue = String(value).replace(/,/g, '.'); const num = parseFloat(stringValue); if (isNaN(num)) return 0; const multiplier = Math.pow(10, decimals); const roundedNum = Math.round((num * multiplier) + Number.EPSILON) / multiplier; return Number(roundedNum.toFixed(decimals)); };
const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
const months = [ { value: '01', name: 'Ene' }, { value: '02', name: 'Feb' }, { value: '03', name: 'Mar' }, { value: '04', name: 'Abr' }, { value: '05', name: 'May' }, { value: '06', name: 'Jun' }, { value: '07', name: 'Jul' }, { value: '08', name: 'Ago' }, { value: '09', name: 'Sep' }, { value: '10', name: 'Oct' }, { value: '11', name: 'Nov' }, { value: '12', name: 'Dic' } ];
const currentYear = new Date().getFullYear();
const years = Array.from({ length: currentYear - 2015 + 1 }, (_, i) => String(2015 + i)).reverse();


const DataTableVentas = () => {
  // --- State ---
  const [allData, setAllData] = useState<TableRow[]>([]);
  const [filteredData, setFilteredData] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true); // Combined loading state
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('General');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage] = useState(25);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [displayStartDate, setDisplayStartDate] = useState<string>(''); // For display in titles
  const [displayEndDate, setDisplayEndDate] = useState<string>('');     // For display in titles
  const [appliedStartDate, setAppliedStartDate] = useState<string>(''); // Used for fetching/calculations
  const [appliedEndDate, setAppliedEndDate] = useState<string>('');     // Used for fetching/calculations
  const initialDate = new Date();
  const initialDay = String(initialDate.getDate()).padStart(2, '0');
  const initialMonth = String(initialDate.getMonth() + 1).padStart(2, '0');
  const initialYear = String(initialDate.getFullYear());
  const [startDay, setStartDay] = useState<string>('');
  const [startMonth, setStartMonth] = useState<string>('');
  const [startYear, setStartYear] = useState<string>('');
  const [endDay, setEndDay] = useState<string>('');
  const [endMonth, setEndMonth] = useState<string>('');
  const [endYear, setEndYear] = useState<string>('');
  const isInitialMount = useRef(true);
  const [sortColumn, setSortColumn] = useState<keyof TableRow | null>('fecha'); // Default sort
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');  // Default direction

  // --- State for Operating Expenses ---
  const [operatingExpenses, setOperatingExpenses] = useState<number>(0);

  // --- Effects ---

  // Effect 1: Fetch initial date range
    useEffect(() => {
        let isMounted = true;
        const fetchDateRange = async () => {
        setLoading(true); setError(null);
        let initialStart = ''; let initialEnd = '';
        const defaultDateStr = `${initialYear}-${initialMonth}-${initialDay}`;
        try {
            const { data, error: dbError } = await supabase.from('date_range').select('start_date, end_date').single();
            if (dbError) { initialStart = defaultDateStr; initialEnd = defaultDateStr; }
            else if (data && data.start_date && data.end_date) { initialStart = data.start_date; initialEnd = data.end_date; }
            else { initialStart = defaultDateStr; initialEnd = defaultDateStr; }

            if (isMounted) {
                 if (initialStart.includes('-')) { const [sY, sM, sD] = initialStart.split('-'); setStartYear(sY); setStartMonth(sM); setStartDay(sD); } else { setStartYear(initialYear); setStartMonth(initialMonth); setStartDay(initialDay); }
                 if (initialEnd.includes('-')) { const [eY, eM, eD] = initialEnd.split('-'); setEndYear(eY); setEndMonth(eM); setEndDay(eD); } else { setEndYear(initialYear); setEndMonth(initialMonth); setEndDay(initialDay); }
                 setDisplayStartDate(initialStart);
                 setDisplayEndDate(initialEnd);
            }
        } catch (err: any) {
            console.error('Error setting initial date range:', err.message);
            if (isMounted) {
                setError(`Error setting initial dates: ${err.message}`);
                setDisplayStartDate(defaultDateStr); setDisplayEndDate(defaultDateStr);
                setStartDay(initialDay); setStartMonth(initialMonth); setStartYear(initialYear);
                setEndDay(initialDay); setEndMonth(initialMonth); setEndYear(initialYear);
            }
        }
        };
        fetchDateRange();
        return () => { isMounted = false; }
    }, []); // Removed initial date parts from dependencies

  // Effect 2: Apply initial dates ONCE dropdowns are populated
     useEffect(() => {
       if (isInitialMount.current && startYear && startMonth && startDay && endYear && endMonth && endDay) {
           const initialStartDate = `${startYear}-${startMonth}-${startDay}`;
           const initialEndDate = `${endYear}-${endMonth}-${endDay}`;
           console.log("Effect 2: Applying initial dates:", initialStartDate, initialEndDate);
           setAppliedStartDate(initialStartDate);
           setAppliedEndDate(initialEndDate);
           setSortColumn('fecha');
           setSortDirection('desc');
           isInitialMount.current = false;
       }
     }, [startYear, startMonth, startDay, endYear, endMonth, endDay]);


  // --- fetchDataFromBranch Helper ---
  const fetchDataFromBranch = async (branch: string, formattedStart: string, formattedEnd: string): Promise<TableRow[]> => {
      if (!formattedStart || !formattedEnd) return [];
      try {
          const { data, error: dbError } = await supabase
              .from(branch)
              .select('*')
              .gte('fecha', `${formattedStart} 00:00:00`)
              .lte('fecha', `${formattedEnd} 23:59:59`)
              .eq('movto', '1')
              // Remove specific server-side order if client-side handles it comprehensively
              // .order('fecha', { ascending: false })
              // .order('hora', { ascending: false });
                .returns<any[]>(); // Use any[] first for processing flexibility

          if (dbError) throw dbError;
          if (!data) return [];

          return data.map((item: any): TableRow => {
              const cantidad = safeParseFloatAndRound(item.cantidad);
              const costo = safeParseFloatAndRound(item.costo);
              const ppub = safeParseFloatAndRound(item.ppub);
              const dscto = safeParseFloatAndRound(item.dscto);
              const costoTotal = safeParseFloatAndRound(cantidad * costo);
              const precioFinal = safeParseFloatAndRound(cantidad * ppub); // Should this be (qty*ppub) - dscto? Verify logic. Assuming dscto is separate line item discount.
              const utilidad = safeParseFloatAndRound(precioFinal - costoTotal - dscto); // Recalculate here for consistency

              // Format Time safely
              let formattedHora = 'N/A';
              if (item.hora) {
                  try {
                      // Assuming item.hora is like "HH:MM:SS" or includes date info
                      // Use a fixed date part to avoid DST issues if only time is present
                      const dateWithTime = item.hora.includes('T') ? new Date(item.hora) : new Date(`1970-01-01T${item.hora}`);
                      if (!isNaN(dateWithTime.getTime())) {
                           formattedHora = dateWithTime.toLocaleTimeString('es-MX', {
                              hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
                          });
                      }
                  } catch (timeError) {
                      console.warn(`Could not parse time: ${item.hora}`, timeError);
                      // Keep formattedHora as 'N/A'
                  }
              }


              return {
                  id: Number(item.id || 0),
                  articulo: String(item.articulo || ''),
                  fecha: item.fecha ? String(item.fecha).split('T')[0] : 'N/A', // Keep only date part
                  tipo: String(item.tipo || ''),
                  movto: String(item.movto || ''),
                  desc_movto: String(item.desc_movto || ''),
                  cantidad: cantidad,
                  costo: costo,
                  referencia: String(item.referencia || ''),
                  hora: formattedHora, // Use safely formatted time
                  nombre: String(item.nombre || ''),
                  turno: String(item.turno || ''),
                  ppub: ppub,
                  autonumber: Number(item.autonumber || 0),
                  fol: String(item.fol || ''),
                  dscto: dscto,
                  costoTotal: costoTotal,
                  precioFinal: precioFinal,
                  utilidad: utilidad,
                  sucursal: branch // Keep original branch name from fetch
              };
          });
      } catch(err: any) {
          console.error(`Error fetching TABLE data from ${branch}:`, err.message);
          // Propagate error to main handler by re-throwing or returning specific error indicator
          // For simplicity, setting global error here, but better to throw/handle in calling effect
          setError(`Error getting TABLE data from ${branch}.`);
          return []; // Return empty on error for this branch
      }
  };


  // Effect 3: Fetch TABLE data
  useEffect(() => {
    if (isInitialMount.current || !appliedStartDate || !appliedEndDate) {
        console.log("Effect 3: Skipping fetch (initial mount or missing applied dates)");
        if (!isInitialMount.current && (!appliedStartDate || !appliedEndDate)) {
            setLoading(false); setAllData([]); setFilteredData([]);
        }
        return;
    }

    const fetchAllData = async () => {
      console.log("Effect 3: Fetching TABLE data for", appliedStartDate, "to", appliedEndDate, "Branch:", selectedBranch);
      setLoading(true); setError(null); setAllData([]); setFilteredData([]); setCurrentPage(1);

      const formattedStartDate = appliedStartDate;
      const formattedEndDate = appliedEndDate;
      let combinedData: TableRow[] = [];
      const branchesToFetch = selectedBranch === 'General' ? branches : [selectedBranch];

      try {
        // Using Promise.allSettled to handle potential errors in individual branch fetches
        const promises = branchesToFetch.map(branch => fetchDataFromBranch(branch, formattedStartDate, formattedEndDate));
        const results = await Promise.allSettled(promises);

        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                 combinedData = combinedData.concat(result.value);
            } else {
                // Log error for the specific branch that failed but continue processing others
                 console.error(`VentasReport: Failed to fetch data for branch ${branchesToFetch[index]}:`, result.reason);
                 // Optionally set a non-blocking error message
                 // setError(prev => prev ? `${prev}\nError fetching from ${branchesToFetch[index]}.` : `Error fetching from ${branchesToFetch[index]}.`);
            }
        });

        // Set all successfully fetched data, Effect 4 will sort/filter
        setAllData(combinedData);
        if (combinedData.length === 0 && !error) {
            // If no data was returned from any branch, potentially set info message
            console.log("Effect 3: Fetch complete, no data found for selection.");
            // setError("No se encontraron datos de ventas para la selección."); // Or an info message
        } else {
             console.log("Effect 3: Fetch complete, raw data count:", combinedData.length);
        }

      } catch (err: any) { // Catch errors not handled by allSettled (e.g., network issues before requests)
        console.error("VentasReport: General error during TABLE data fetch:", err);
        setError("Ocurrió un error general al obtener los datos de la tabla.");
        setAllData([]); // Clear data on general error
      } finally {
        // Loading will be set to false within Effect 4 after processing
        // Do not set loading false here
      }
    };

    fetchAllData();
  }, [appliedStartDate, appliedEndDate, selectedBranch]);


   // Effect 4: Filter, SORT, and Paginate TABLE data
   useEffect(() => {
     if (isInitialMount.current) {
        console.log("Effect 4: Skipping processing (initial mount)");
        return;
     };

     console.log("Effect 4: Processing data (Filter/Sort/Paginate). Current allData length:", allData.length, "Loading state:", loading);

     let dataToProcess = [...allData];

     // 1. Apply Search Filter
     if (searchQuery) {
        const lowerCaseQuery = searchQuery.toLowerCase();
        dataToProcess = dataToProcess.filter((row) =>
             Object.values(row).some((value) =>
                value?.toString().toLowerCase().includes(lowerCaseQuery) ?? false
             )
        );
     }

     // 2. Apply Sorting
     if (sortColumn) {
        dataToProcess.sort((a, b) => {
            let comparison = 0;
            const valA = a[sortColumn];
            const valB = b[sortColumn];

            if (sortColumn === 'fecha') {
                 const dateA = a.fecha; const dateB = b.fecha;
                 comparison = dateA.localeCompare(dateB);
                 if (comparison === 0 && a.hora !== 'N/A' && b.hora !== 'N/A') { // Compare time only if dates are equal and times are valid
                     try {
                         const dtA = new Date(`1970-01-01T${a.hora}`).getTime();
                         const dtB = new Date(`1970-01-01T${b.hora}`).getTime();
                         if (!isNaN(dtA) && !isNaN(dtB)) comparison = dtA - dtB;
                     } catch { comparison = 0; }
                 }
            } else if (sortColumn === 'hora') {
                if (a.hora !== 'N/A' && b.hora !== 'N/A') {
                     try {
                         const dtA = new Date(`1970-01-01T${a.hora}`).getTime();
                         const dtB = new Date(`1970-01-01T${b.hora}`).getTime();
                         if (!isNaN(dtA) && !isNaN(dtB)) comparison = dtA - dtB;
                     } catch { comparison = 0; }
                 } else if (a.hora !== 'N/A') comparison = -1; // Valid time first
                 else if (b.hora !== 'N/A') comparison = 1;
            } else if (typeof valA === 'number' && typeof valB === 'number') {
                 comparison = valA - valB;
            } else {
                 const strA = String(valA ?? '').toLowerCase(); const strB = String(valB ?? '').toLowerCase();
                 comparison = strA.localeCompare(strB);
            }
            return sortDirection === 'asc' ? comparison : comparison * -1;
        });
     }

     // 3. Calculate Pagination
     const newTotalPages = Math.ceil(dataToProcess.length / itemsPerPage);
     setTotalPages(newTotalPages > 0 ? newTotalPages : 1);
     let adjustedCurrentPage = currentPage;
     if (currentPage > newTotalPages && newTotalPages > 0) adjustedCurrentPage = newTotalPages;
     else if (adjustedCurrentPage < 1 && newTotalPages > 0) adjustedCurrentPage = 1;
     else if (newTotalPages === 0) adjustedCurrentPage = 1; // Reset to 1 if no data
     if (adjustedCurrentPage !== currentPage) setCurrentPage(adjustedCurrentPage); // Update state only if needed

     // 4. Slice for Pagination
     const startIndex = (adjustedCurrentPage - 1) * itemsPerPage;
     const endIndex = startIndex + itemsPerPage;
     setFilteredData(dataToProcess.slice(startIndex, endIndex));

     // 5. Set loading to false NOW
     if (loading) {
         console.log("Effect 4: Processing complete, setting loading to false.");
         setLoading(false);
     }

   }, [searchQuery, allData, currentPage, itemsPerPage, sortColumn, sortDirection, loading]); // Keep dependencies


  // --- Event Handlers ---
  const handleBranchChange = (event: Event) => { const target = event.target as HTMLSelectElement; setSelectedBranch(target.value); setCurrentPage(1); };
  const handleSearchChange = (event: Event) => { const target = event.target as HTMLInputElement; setSearchQuery(target.value); setCurrentPage(1); };
  const handlePageChange = (newPage: number) => { if (newPage >= 1 && newPage <= totalPages && !loading) { setCurrentPage(newPage); } };
  const handleStartDayChange = (e: Event) => setStartDay((e.target as HTMLSelectElement).value);
  const handleStartMonthChange = (e: Event) => setStartMonth((e.target as HTMLSelectElement).value);
  const handleStartYearChange = (e: Event) => setStartYear((e.target as HTMLSelectElement).value);
  const handleEndDayChange = (e: Event) => setEndDay((e.target as HTMLSelectElement).value);
  const handleEndMonthChange = (e: Event) => setEndMonth((e.target as HTMLSelectElement).value);
  const handleEndYearChange = (e: Event) => setEndYear((e.target as HTMLSelectElement).value);

  // Apply Button Handler
  const handleApplyDatesClick = () => {
     if (!startYear || !startMonth || !startDay || !endYear || !endMonth || !endDay) {
         setError("Por favor seleccione fechas de inicio y fin completas."); return;
     }
     const newStartDateStr = `${startYear}-${startMonth}-${startDay}`;
     const newEndDateStr = `${endYear}-${endMonth}-${endDay}`;
      const startDateObj = new Date(newStartDateStr + 'T00:00:00');
      const endDateObj = new Date(newEndDateStr + 'T00:00:00');
       if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
            setError("Las fechas seleccionadas no son válidas."); return;
       }
       if (startDateObj > endDateObj) {
           setError("La fecha de inicio no puede ser posterior a la fecha de fin."); return;
       }

     console.log("Apply clicked: Setting applied dates to:", newStartDateStr, newEndDateStr);
     setError(null);
     setDisplayStartDate(newStartDateStr);
     setDisplayEndDate(newEndDateStr);
     setAppliedStartDate(newStartDateStr);
     setAppliedEndDate(newEndDateStr);
     setCurrentPage(1);
  }

  // --- Sorting Handler ---
   const handleSort = (column: keyof TableRow) => {
     if (loading) return;
     const isAsc = sortColumn === column && sortDirection === 'asc';
     setSortColumn(column);
     setSortDirection(isAsc ? 'desc' : 'asc');
     console.log(`Sorting by ${column} ${isAsc ? 'desc' : 'asc'}`);
   };

   // --- Callback Handler for Expenses (MEMOIZED) ---
   const handleExpensesCalculated = useCallback((calculatedExpenses: number) => {
       // console.log("Received calculated expenses from Gastos component:", calculatedExpenses); // Reduce console noise if working
       setOperatingExpenses(prevExpenses => {
           // Only update state if the value truly changes
           if (prevExpenses !== calculatedExpenses) {
               // console.log(`Updating operating expenses from ${prevExpenses} to ${calculatedExpenses}`); // Log only on actual change
               return calculatedExpenses;
           }
           return prevExpenses;
       });
   }, []); // Empty dependency array because setOperatingExpenses is stable


  // Memoized dropdown options
   const yearOptions = useMemo(() => years.map(year => <option key={year} value={year}>{year}</option>), []);
   const monthOptions = useMemo(() => months.map(month => <option key={month.value} value={month.value}>{month.name}</option>), []);
   const dayOptions = useMemo(() => days.map(day => <option key={day} value={day}>{day}</option>), []);


  // --- Render ---
  return (
    <>
      {/* --- Cards Section --- */}
      {/* Pass applied dates, which trigger calculations */}
      <VentasCardsReport
        startDate={appliedStartDate}
        endDate={appliedEndDate}
        selectedBranch={selectedBranch}
        operatingExpenses={operatingExpenses}
      />

      {/* --- Gastos Section --- */}
      {/* Pass applied dates and the memoized callback */}
      <Gastos
          startDate={appliedStartDate}
          endDate={appliedEndDate}
          selectedBranch={selectedBranch}
          onExpensesCalculated={handleExpensesCalculated}
      />


      {/* --- Table Section --- */}
      <div class="ventas-report-container">
        <h2>Detalle de Ventas</h2>

        {/* Filter Controls Row */}
        <div class="row g-2 mb-3 align-items-end filter-controls-row">
            <div class="col-12 col-md-6 col-lg-3">
                <label class="form-label form-label-sm">Fecha Inicio:</label>
                <div class="input-group input-group-sm">
                <select class="form-select" value={startDay} onChange={handleStartDayChange} disabled={loading} aria-label="Día inicio">{dayOptions}</select>
                <select class="form-select" value={startMonth} onChange={handleStartMonthChange} disabled={loading} aria-label="Mes inicio">{monthOptions}</select>
                <select class="form-select" value={startYear} onChange={handleStartYearChange} disabled={loading} aria-label="Año inicio">{yearOptions}</select>
                </div>
            </div>
            <div class="col-12 col-md-6 col-lg-3">
                <label class="form-label form-label-sm">Fecha Fin:</label>
                <div class="input-group input-group-sm">
                <select class="form-select" value={endDay} onChange={handleEndDayChange} disabled={loading} aria-label="Día fin">{dayOptions}</select>
                <select class="form-select" value={endMonth} onChange={handleEndMonthChange} disabled={loading} aria-label="Mes fin">{monthOptions}</select>
                <select class="form-select" value={endYear} onChange={handleEndYearChange} disabled={loading} aria-label="Año fin">{yearOptions}</select>
                </div>
            </div>
            <div class="col-12 col-md-3 col-lg-1">
                <button type="button" class="btn btn-primary btn-sm w-100 mt-3 mt-md-0" onClick={handleApplyDatesClick} disabled={loading}>Aplicar</button>
            </div>
            <div class="col-6 col-md-4 col-lg-2">
                <label htmlFor="branch-select" class="form-label form-label-sm">Sucursal:</label>
                <select id="branch-select" class="form-select form-select-sm" value={selectedBranch} onChange={handleBranchChange} disabled={loading}>
                <option value="General">General</option>
                {branches.map((branch) => ( <option key={branch} value={branch}>{branch.replace('Kardex', '')}</option> ))}
                </select>
            </div>
            <div class="col-6 col-md-5 col-lg-3">
                <label htmlFor="search-input" class="form-label form-label-sm">Buscar:</label>
                <input type="search" id="search-input" class="form-control form-control-sm" placeholder="Buscar en tabla..." value={searchQuery} onInput={handleSearchChange} disabled={loading || allData.length === 0}/>
            </div>
        </div>

        {/* Error Display */}
        {error && !loading && <div class="alert alert-danger mt-2">{error}</div>}


        {/* Loading Indicator for Table */}
        {loading && (
            <div class="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
               <div class="spinner-border text-primary" role="status">
                   <span class="visually-hidden">Cargando tabla...</span>
               </div>
            </div>
        )}

        {/* --- Data Table --- */}
        {!loading && (
          <>
            {allData.length > 0 ? (
              <div class="table-container">
                <table class="data-table">
                   <thead>
                     <tr>
                       <th onClick={() => handleSort('fecha')} className={`sortable ${sortColumn === 'fecha' ? sortDirection : ''}`} aria-sort={sortColumn === 'fecha' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>Fecha {sortColumn === 'fecha' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</th>
                       <th onClick={() => handleSort('hora')} className={`sortable ${sortColumn === 'hora' ? sortDirection : ''}`} aria-sort={sortColumn === 'hora' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>Hora {sortColumn === 'hora' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</th>
                       <th>Sucursal</th>
                       <th>Artículo</th>
                       <th onClick={() => handleSort('cantidad')} className={`sortable text-end ${sortColumn === 'cantidad' ? sortDirection : ''}`} aria-sort={sortColumn === 'cantidad' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>Cantidad {sortColumn === 'cantidad' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</th>
                       <th onClick={() => handleSort('ppub')} className={`sortable text-end ${sortColumn === 'ppub' ? sortDirection : ''}`} aria-sort={sortColumn === 'ppub' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>P. Público {sortColumn === 'ppub' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</th>
                       <th onClick={() => handleSort('dscto')} className={`sortable text-end ${sortColumn === 'dscto' ? sortDirection : ''}`} aria-sort={sortColumn === 'dscto' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>Desc. {sortColumn === 'dscto' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</th>
                       <th onClick={() => handleSort('precioFinal')} className={`sortable text-end ${sortColumn === 'precioFinal' ? sortDirection : ''}`} aria-sort={sortColumn === 'precioFinal' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>P. Final {sortColumn === 'precioFinal' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</th>
                       <th onClick={() => handleSort('costo')} className={`sortable text-end ${sortColumn === 'costo' ? sortDirection : ''}`} aria-sort={sortColumn === 'costo' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>Costo U. {sortColumn === 'costo' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</th>
                       <th onClick={() => handleSort('costoTotal')} className={`sortable text-end ${sortColumn === 'costoTotal' ? sortDirection : ''}`} aria-sort={sortColumn === 'costoTotal' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>Costo Total {sortColumn === 'costoTotal' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</th>
                       <th onClick={() => handleSort('utilidad')} className={`sortable text-end ${sortColumn === 'utilidad' ? sortDirection : ''}`} aria-sort={sortColumn === 'utilidad' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>Utilidad {sortColumn === 'utilidad' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</th>
                       <th>Referencia</th><th>Folio</th><th>Turno</th>
                     </tr>
                   </thead>
                  <tbody>
                    {filteredData.length > 0 ? filteredData.map((row) => (
                      <tr key={`${row.sucursal}-${row.autonumber}-${row.id || Math.random()}`}> {/* Added fallback key component */}
                        <td>{row.fecha}</td><td>{row.hora}</td><td>{row.sucursal.replace('Kardex', '')}</td>
                        <td class="articulo-cell">{row.articulo} - {row.nombre}</td>
                        <td class="number-cell">{row.cantidad.toLocaleString('es-MX')}</td>
                        <td class="currency-cell">{row.ppub.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</td>
                        <td class="currency-cell">{row.dscto.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</td>
                        <td class="currency-cell">{row.precioFinal.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</td>
                        <td class="currency-cell">{row.costo.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</td>
                        <td class="currency-cell">{row.costoTotal.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</td>
                        <td class={`currency-cell ${row.utilidad < 0 ? 'negative-utilidad' : ''}`}>{row.utilidad.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</td>
                        <td>{row.referencia}</td><td>{row.fol}</td><td>{row.turno}</td>
                      </tr>
                    )) : (
                        <tr><td colSpan={14} style={{ textAlign: 'center', padding: '20px' }}>{searchQuery ? 'No hay resultados para su búsqueda.' : 'No hay datos de ventas en esta página.'}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
               <div class="alert alert-info mt-3 text-center">{!error ? 'No se encontraron ventas para los filtros seleccionados.' : ''}</div>
             )
            }

            {/* Pagination */}
            {allData.length > 0 && totalPages > 1 && (
                <div class="pagination-controls d-flex justify-content-center align-items-center mt-3">
                    <button class="btn btn-sm btn-outline-secondary me-2" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1 || loading}>Anterior</button>
                    <span class="text-muted small mx-2">Página {currentPage} de {totalPages} ({allData.length.toLocaleString('es-MX')} registros)</span>
                    <button class="btn btn-sm btn-outline-secondary ms-2" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages || loading}>Siguiente</button>
                </div>
            )}
             {allData.length > 0 && totalPages <= 1 && !loading && (
                 <div class="pagination-controls d-flex justify-content-center text-muted small mt-3"><span>Total: {allData.length.toLocaleString('es-MX')} registros</span></div>
             )}
          </>
        )}
      </div> {/* End ventas-report-container */}
    </>
  );
};

export default DataTableVentas;

// --- END OF FILE VentasReport.tsx ---