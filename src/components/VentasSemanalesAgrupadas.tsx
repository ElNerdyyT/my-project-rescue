// --- START OF FILE VentasReport.tsx ---

import { useState, useEffect, useMemo, useCallback } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';
import './VentasReport.css';
import VentasCardsReport from './VentasCardsReport';
import Gastos from './Gastos';

// --- Interfaces y Constantes ---
interface TableRow {
  id?: number; articulo: string; fecha: string; tipo: string; movto: string; desc_movto: string; cantidad: number; costo: number; referencia: string; hora: string; nombre: string; turno: string; ppub: number; autonumber: number; fol: string; dscto: number; costoTotal: number; precioFinal: number; utilidad: number; sucursal: string;
}

const branches: string[] = ['KardexEcono1', 'KardexMexico', 'KardexMadero', 'KardexLopezM', 'KardexBaja', 'KardexEcono2', 'KardexLolita'];

// --- LÓGICA DE SEMANAS CORREGIDA Y ROBUSTA ---

// Función para obtener el número de semana ISO 8601 de una fecha.
const getISOWeek = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.valueOf() - yearStart.valueOf()) / 86400000) + 1) / 7);
    return weekNo;
};

/**
 * Calcula las fechas de inicio (Lunes) y fin (Viernes) para una semana y año específicos.
 * Esta es una versión corregida y más precisa que evita errores en los límites del año.
 * @param year El año de la semana.
 * @param week El número de la semana (1-53).
 * @returns Un objeto con las fechas 'start' y 'end' en formato YYYY-MM-DD.
 */
const getWeekDatesForYear = (year: number, week: number): { start: string, end: string } => {
    // La 4ta de Enero siempre está en la semana 1 del año.
    const fourthOfJanuary = new Date(year, 0, 4);
    const dayOfWeekOfFourth = fourthOfJanuary.getDay() || 7; // 1=Lunes, 7=Domingo

    // Calculamos el Jueves de la semana 1
    const thursdayOfWeek1 = new Date(year, 0, 4 - dayOfWeekOfFourth + 4);

    // Calculamos el Jueves de la semana que nos interesa
    const thursdayOfWeekN = new Date(thursdayOfWeek1);
    thursdayOfWeekN.setDate(thursdayOfWeek1.getDate() + (week - 1) * 7);

    // El Lunes es 3 días antes del Jueves
    const monday = new Date(thursdayOfWeekN);
    monday.setDate(thursdayOfWeekN.getDate() - 3);

    // El Viernes es 1 día después del Jueves
    const friday = new Date(thursdayOfWeekN);
    friday.setDate(thursdayOfWeekN.getDate() + 1);

    const formatDate = (dt: Date) => dt.toISOString().split('T')[0];
    
    return { start: formatDate(monday), end: formatDate(friday) };
};


// Genera la lista de semanas para el selector.
const generateWeeksForYear = (year: number) => {
    const weeks = [];
    const today = new Date();
    const currentYear = today.getFullYear();
    // Una forma fiable de saber la última semana es viendo la semana del 28 de diciembre
    const lastWeekOfYear = getISOWeek(new Date(year, 11, 28));
    const lastWeek = (year === currentYear) ? getISOWeek(today) : lastWeekOfYear;

    for (let i = 1; i <= lastWeek; i++) {
        const { start, end } = getWeekDatesForYear(year, i);
        const formatDisplayDate = (dateStr: string) => {
            const [, m, d] = dateStr.split('-');
            return `${d}/${m}`;
        }
        weeks.push({
            value: i,
            label: `Semana ${i} (${formatDisplayDate(start)} - ${formatDisplayDate(end)})`
        });
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
  
  const years = Array.from({ length: today.getFullYear() - 2020 + 1 }, (_, i) => 2020 + i).reverse();
  const weeksInYear = useMemo(() => generateWeeksForYear(selectedYear), [selectedYear]);

  // --- Effects ---

  // Efecto para establecer las fechas (Lunes a Viernes) cuando cambia la semana o el año
  useEffect(() => {
    const { start, end } = getWeekDatesForYear(selectedYear, selectedWeek);
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
    };

    fetchAllData();
  }, [appliedStartDate, appliedEndDate, selectedBranch]);

  // Efecto para filtrar, ordenar y paginar
  useEffect(() => {
    let dataToProcess = [...allData];

    if (searchQuery) {
        const lowerCaseQuery = searchQuery.toLowerCase();
        dataToProcess = dataToProcess.filter(row =>
            Object.values(row).some(value => value?.toString().toLowerCase().includes(lowerCaseQuery))
        );
    }
    
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

    const newTotalPages = Math.ceil(dataToProcess.length / itemsPerPage);
    setTotalPages(newTotalPages > 0 ? newTotalPages : 1);
    const adjustedCurrentPage = (currentPage > newTotalPages && newTotalPages > 0) ? newTotalPages : currentPage;
    const startIndex = (adjustedCurrentPage - 1) * itemsPerPage;
    setFilteredData(dataToProcess.slice(startIndex, startIndex + itemsPerPage));
    if (currentPage !== adjustedCurrentPage) setCurrentPage(adjustedCurrentPage);
    
    setLoading(false);
  }, [allData, searchQuery, sortColumn, sortDirection, currentPage, itemsPerPage]);

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
        <h2>Detalle de Ventas de Lunes a Viernes</h2>

        <div class="row g-2 mb-3 align-items-end filter-controls-row">
            <div class="col-6 col-md-3">
                <label class="form-label form-label-sm">Año:</label>
                <select class="form-select form-select-sm" value={selectedYear} onChange={handleYearChange} disabled={loading}>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>
            <div class="col-6 col-md-4">
                <label class="form-label form-label-sm">Semana (Lunes a Viernes):</label>
                <select class="form-select form-select-sm" value={selectedWeek} onChange={handleWeekChange} disabled={loading}>
                    {weeksInYear.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                </select>
            </div>
             <div class="col-6 col-md-2">
                <label htmlFor="branch-select" class="form-label form-label-sm">Sucursal:</label>
                <select id="branch-select" class="form-select form-select-sm" value={selectedBranch} onChange={(e) => setSelectedBranch((e.target as HTMLSelectElement).value)} disabled={loading}>
                    <option value="General">General</option>
                    {branches.map((branch) => (<option key={branch} value={branch}>{branch.replace('Kardex', '')}</option>))}
                </select>
            </div>
            <div class="col-6 col-md-3">
                <label htmlFor="search-input" class="form-label form-label-sm">Buscar:</label>
                <input type="search" id="search-input" class="form-control form-control-sm" placeholder="Buscar en la semana..." value={searchQuery} onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)} disabled={loading}/>
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
