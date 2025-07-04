// --- START OF FILE VentasReport.tsx ---

import { useState, useEffect, useMemo, useRef, useCallback } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';
import './VentasReport.css';
import VentasCardsReport from './VentasCardsReport';
import Gastos from './Gastos';

// --- Interfaces, Constantes y Helpers ---
interface TableRow {
  id?: number; articulo: string; fecha: string; tipo: string; movto: string; desc_movto: string; cantidad: number; costo: number; referencia: string; hora: string; nombre: string; turno: string; ppub: number; autonumber: number; fol: string; dscto: number; costoTotal: number; precioFinal: number; utilidad: number; sucursal: string;
}
type DayTypeFilter = 'all' | 'weekdays' | 'weekends';

const branches: string[] = ['KardexEcono1', 'KardexMexico', 'KardexMadero', 'KardexLopezM', 'KardexBaja', 'KardexEcono2', 'KardexLolita'];

// --- Funciones para manejo de semanas ---
const getISOWeek = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.valueOf() - yearStart.valueOf()) / 86400000) + 1) / 7);
    return weekNo;
};

const getStartAndEndOfWeek = (year: number, week: number): { start: string, end: string } => {
    const d = new Date(year, 0, 1 + (week - 1) * 7);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const start = new Date(d.setDate(diff));
    const end = new Date(d.setDate(diff + 6));
    const formatDate = (dt: Date) => dt.toISOString().split('T')[0];
    return { start: formatDate(start), end: formatDate(end) };
};

const generateWeeksForYear = (year: number) => {
    const weeks = [];
    const today = new Date();
    const currentYear = today.getFullYear();
    const lastWeek = (year === currentYear) ? getISOWeek(today) : 53;

    for (let i = 1; i <= lastWeek; i++) {
        const { start, end } = getStartAndEndOfWeek(year, i);
        const formatDisplayDate = (dateStr: string) => {
            const [y, m, d] = dateStr.split('-');
            return `${d}/${m}`;
        }
        weeks.push({
            value: i,
            label: `Semana ${i}: ${formatDisplayDate(start)} - ${formatDisplayDate(end)}`
        });
    }
    // Si el año no es el actual, puede que la semana 53 no exista, la removemos si es el caso.
     if (year !== currentYear) {
        const lastDayOfYear = new Date(year, 11, 31);
        if (getISOWeek(lastDayOfYear) < 53) {
            weeks.pop();
        }
    }
    return weeks.reverse();
};

const DataTableVentas = () => {
  // --- State ---
  const [allData, setAllData] = useState<TableRow[]>([]);
  const [filteredData, setFilteredData] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('General');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage] = useState(25);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [appliedStartDate, setAppliedStartDate] = useState<string>('');
  const [appliedEndDate, setAppliedEndDate] = useState<string>('');
  const [sortColumn, setSortColumn] = useState<keyof TableRow | null>('fecha');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [operatingExpenses, setOperatingExpenses] = useState<number>(0);

  // --- State para selección de semana ---
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [selectedWeek, setSelectedWeek] = useState<number>(getISOWeek(today));
  const [dayTypeFilter, setDayTypeFilter] = useState<DayTypeFilter>('all');
  
  const years = Array.from({ length: today.getFullYear() - 2020 + 1 }, (_, i) => 2020 + i).reverse();
  const weeksInYear = useMemo(() => generateWeeksForYear(selectedYear), [selectedYear]);

  // --- Effects ---

  // Efecto para establecer las fechas cuando cambia la semana o el año
  useEffect(() => {
    const { start, end } = getStartAndEndOfWeek(selectedYear, selectedWeek);
    setAppliedStartDate(start);
    setAppliedEndDate(end);
  }, [selectedYear, selectedWeek]);


  // Efecto para obtener los datos de la BD
  useEffect(() => {
    if (!appliedStartDate || !appliedEndDate) return;

    const fetchDataFromBranch = async (branch: string, start: string, end: string): Promise<TableRow[]> => {
        const { data, error: dbError } = await supabase.from(branch).select('*').gte('fecha', `${start} 00:00:00`).lte('fecha', `${end} 23:59:59`).eq('movto', '1');
        if (dbError) { console.error(`Error en ${branch}:`, dbError); return []; }
        return (data || []).map((item: any): TableRow => {
            const cantidad = parseFloat(String(item.cantidad || 0).replace(',', '.'));
            const costo = parseFloat(String(item.costo || 0).replace(',', '.'));
            const ppub = parseFloat(String(item.ppub || 0).replace(',', '.'));
            const dscto = parseFloat(String(item.dscto || 0).replace(',', '.'));
            const costoTotal = cantidad * costo;
            const precioFinal = cantidad * ppub;
            const utilidad = precioFinal - costoTotal - dscto;
            return {
                ...item, fecha: item.fecha.split('T')[0], cantidad, costo, ppub, dscto, costoTotal, precioFinal, utilidad, sucursal: branch.replace('Kardex', '')
            };
        });
    };

    const fetchAllData = async () => {
      setLoading(true); setError(null);
      const branchesToFetch = selectedBranch === 'General' ? branches : [selectedBranch];
      const promises = branchesToFetch.map(b => fetchDataFromBranch(b, appliedStartDate, appliedEndDate));
      const results = await Promise.allSettled(promises);
      let combinedData: TableRow[] = [];
      results.forEach(res => {
        if (res.status === 'fulfilled') combinedData = combinedData.concat(res.value);
      });
      setAllData(combinedData);
      // El loading se pone en false en el siguiente efecto
    };

    fetchAllData();
  }, [appliedStartDate, appliedEndDate, selectedBranch]);

  // Efecto para filtrar (por tipo de día y búsqueda), ordenar y paginar
  useEffect(() => {
    let dataToProcess = [...allData];

    // 1. Filtrar por tipo de día (L-V o S-D)
    if (dayTypeFilter !== 'all') {
        dataToProcess = dataToProcess.filter(row => {
            const dayOfWeek = new Date(row.fecha + 'T00:00:00').getDay();
            const isWeekend = dayOfWeek === 6 || dayOfWeek === 0; // Sábado=6, Domingo=0
            return dayTypeFilter === 'weekends' ? isWeekend : !isWeekend;
        });
    }

    // 2. Filtrar por texto de búsqueda
    if (searchQuery) {
        const lowerCaseQuery = searchQuery.toLowerCase();
        dataToProcess = dataToProcess.filter(row =>
            Object.values(row).some(value => value?.toString().toLowerCase().includes(lowerCaseQuery))
        );
    }
    
    // 3. Ordenar
    if (sortColumn) {
        dataToProcess.sort((a, b) => {
            const valA = a[sortColumn]; const valB = b[sortColumn];
            let comparison = 0;
            if (typeof valA === 'number' && typeof valB === 'number') {
                comparison = valA - valB;
            } else {
                comparison = String(valA).localeCompare(String(valB));
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }

    // 4. Paginar
    const newTotalPages = Math.ceil(dataToProcess.length / itemsPerPage);
    setTotalPages(newTotalPages > 0 ? newTotalPages : 1);
    const adjustedCurrentPage = (currentPage > newTotalPages && newTotalPages > 0) ? newTotalPages : currentPage;
    const startIndex = (adjustedCurrentPage - 1) * itemsPerPage;
    setFilteredData(dataToProcess.slice(startIndex, startIndex + itemsPerPage));
    if (currentPage !== adjustedCurrentPage) setCurrentPage(adjustedCurrentPage);
    
    setLoading(false); // Se finaliza la carga aquí
  }, [allData, searchQuery, dayTypeFilter, sortColumn, sortDirection, currentPage, itemsPerPage]);

  // --- Handlers ---
  const handleSort = (column: keyof TableRow) => { setSortColumn(column); setSortDirection(prev => (sortColumn === column && prev === 'asc') ? 'desc' : 'asc'); };
  const handleExpensesCalculated = useCallback((exp: number) => setOperatingExpenses(exp), []);
  const handleYearChange = (e: Event) => { const newYear = parseInt((e.target as HTMLSelectElement).value); setSelectedYear(newYear); setSelectedWeek(generateWeeksForYear(newYear)[0].value); };
  const handleWeekChange = (e: Event) => setSelectedWeek(parseInt((e.target as HTMLSelectElement).value));

  return (
    <>
      <VentasCardsReport startDate={appliedStartDate} endDate={appliedEndDate} selectedBranch={selectedBranch} operatingExpenses={operatingExpenses} />
      <Gastos startDate={appliedStartDate} endDate={appliedEndDate} selectedBranch={selectedBranch} onExpensesCalculated={handleExpensesCalculated} />

      <div class="ventas-report-container">
        <h2>Detalle de Ventas</h2>

        {/* --- Nuevos Controles de Filtro --- */}
        <div class="row g-2 mb-3 align-items-end filter-controls-row">
            <div class="col-6 col-md-2">
                <label class="form-label form-label-sm">Año:</label>
                <select class="form-select form-select-sm" value={selectedYear} onChange={handleYearChange} disabled={loading}>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>
            <div class="col-6 col-md-3">
                <label class="form-label form-label-sm">Semana:</label>
                <select class="form-select form-select-sm" value={selectedWeek} onChange={handleWeekChange} disabled={loading}>
                    {weeksInYear.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                </select>
            </div>
            <div class="col-12 col-md-3">
                <label class="form-label form-label-sm">Filtrar Días:</label>
                <div class="btn-group btn-group-sm w-100">
                    <button type="button" class={`btn ${dayTypeFilter === 'all' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setDayTypeFilter('all')}>Todos</button>
                    <button type="button" class={`btn ${dayTypeFilter === 'weekdays' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setDayTypeFilter('weekdays')}>L-V</button>
                    <button type="button" class={`btn ${dayTypeFilter === 'weekends' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setDayTypeFilter('weekends')}>S-D</button>
                </div>
            </div>
             <div class="col-6 col-md-2">
                <label htmlFor="branch-select" class="form-label form-label-sm">Sucursal:</label>
                <select id="branch-select" class="form-select form-select-sm" value={selectedBranch} onChange={(e) => setSelectedBranch((e.target as HTMLSelectElement).value)} disabled={loading}>
                    <option value="General">General</option>
                    {branches.map((branch) => (<option key={branch} value={branch}>{branch.replace('Kardex', '')}</option>))}
                </select>
            </div>
            <div class="col-6 col-md-2">
                <label htmlFor="search-input" class="form-label form-label-sm">Buscar:</label>
                <input type="search" id="search-input" class="form-control form-control-sm" placeholder="Buscar..." value={searchQuery} onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)} disabled={loading}/>
            </div>
        </div>

        {error && <div class="alert alert-danger mt-2">{error}</div>}
        {loading && <div class="text-center p-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Cargando...</span></div></div>}

        {!loading && (
          <>
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('fecha')}>Fecha {sortColumn === 'fecha' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</th>
                    <th>Sucursal</th>
                    <th>Artículo</th>
                    <th class="text-end" onClick={() => handleSort('cantidad')}>Cantidad {sortColumn === 'cantidad' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</th>
                    <th class="text-end" onClick={() => handleSort('precioFinal')}>P. Final {sortColumn === 'precioFinal' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</th>
                    <th class="text-end" onClick={() => handleSort('costoTotal')}>Costo Total {sortColumn === 'costoTotal' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</th>
                    <th class="text-end" onClick={() => handleSort('utilidad')}>Utilidad {sortColumn === 'utilidad' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</th>
                    <th>Folio</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.length > 0 ? filteredData.map((row) => (
                    <tr key={`${row.sucursal}-${row.autonumber}-${row.id || Math.random()}`}>
                      <td>{row.fecha}</td>
                      <td>{row.sucursal}</td>
                      <td class="articulo-cell">{row.articulo} - {row.nombre}</td>
                      <td class="number-cell">{row.cantidad.toLocaleString('es-MX')}</td>
                      <td class="currency-cell">{row.precioFinal.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</td>
                      <td class="currency-cell">{row.costoTotal.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</td>
                      <td class={`currency-cell ${row.utilidad < 0 ? 'negative-utilidad' : ''}`}>{row.utilidad.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</td>
                      <td>{row.fol}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={8} class="text-center p-4">No se encontraron ventas para los filtros seleccionados.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* --- Paginación --- */}
            {totalPages > 1 && (
                <div class="pagination-controls d-flex justify-content-center align-items-center mt-3">
                    <button class="btn btn-sm btn-outline-secondary" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Anterior</button>
                    <span class="text-muted small mx-3">Página {currentPage} de {totalPages}</span>
                    <button class="btn btn-sm btn-outline-secondary" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Siguiente</button>
                </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default DataTableVentas;
// --- END OF FILE VentasReport.tsx ---
