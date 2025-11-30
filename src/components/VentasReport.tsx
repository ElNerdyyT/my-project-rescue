import { useState, useEffect, useMemo, useRef, useCallback } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';
import './VentasReport.css';
import VentasCardsReport from './VentasCardsReport';
import Gastos from './Gastos';

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

const branches: string[] = [
  'KardexEcono1',
  'KardexMexico',
  'KardexMadero',
  'KardexLopezM',
  'KardexBaja',
  'KardexEcono2',
  'KardexLolita'
];

const safeParseFloatAndRound = (value: any, decimals: number = 2): number => {
  if (value === null || value === undefined) return 0;
  const stringValue = String(value).replace(/,/g, '.');
  const num = parseFloat(stringValue);
  if (isNaN(num)) return 0;
  const multiplier = Math.pow(10, decimals);
  const roundedNum =
    Math.round(num * multiplier + Number.EPSILON) / multiplier;
  return Number(roundedNum.toFixed(decimals));
};

const days = Array.from({ length: 31 }, (_, i) =>
  String(i + 1).padStart(2, '0')
);
const months = [
  { value: '01', name: 'Ene' },
  { value: '02', name: 'Feb' },
  { value: '03', name: 'Mar' },
  { value: '04', name: 'Abr' },
  { value: '05', name: 'May' },
  { value: '06', name: 'Jun' },
  { value: '07', name: 'Jul' },
  { value: '08', name: 'Ago' },
  { value: '09', name: 'Sep' },
  { value: '10', name: 'Oct' },
  { value: '11', name: 'Nov' },
  { value: '12', name: 'Dic' }
];
const currentYear = new Date().getFullYear();
const years = Array.from(
  { length: currentYear - 2015 + 1 },
  (_, i) => String(2015 + i)
).reverse();

const DataTableVentas = () => {
  // --- State ---
  const [data, setData] = useState<TableRow[]>([]); // Data for current page
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('General');
  const [selectedTurno, setSelectedTurno] = useState<string>('Todos');

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage] = useState(25);
  const [totalCount, setTotalCount] = useState<number>(0); // Total records found

  const [, setDisplayStartDate] = useState<string>('');
  const [, setDisplayEndDate] = useState<string>('');
  const [appliedStartDate, setAppliedStartDate] = useState<string>('');
  const [appliedEndDate, setAppliedEndDate] = useState<string>('');

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

  const [sortColumn, setSortColumn] = useState<keyof TableRow>('fecha');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const [operatingExpenses, setOperatingExpenses] = useState<number>(0);

  // --- Modal State ---
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [selectedArticle, setSelectedArticle] = useState<TableRow | null>(null);
  const [articleName, setArticleName] = useState<string>('');
  const [loadingArticleName, setLoadingArticleName] = useState<boolean>(false);

  // --- Effects ---

  // Effect: Lock body scroll when modal is open
  useEffect(() => {
    if (modalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [modalOpen]);

  // Effect 1: Fetch initial date range
  useEffect(() => {
    let isMounted = true;
    const fetchDateRange = async () => {
      setLoading(true);
      setError(null);
      let initialStart = '';
      let initialEnd = '';
      const defaultDateStr = `${initialYear}-${initialMonth}-${initialDay}`;
      try {
        const { data, error: dbError } = await supabase
          .from('date_range')
          .select('start_date, end_date')
          .single();
        if (dbError) {
          initialStart = defaultDateStr;
          initialEnd = defaultDateStr;
        } else if (data && data.start_date && data.end_date) {
          initialStart = data.start_date;
          initialEnd = data.end_date;
        } else {
          initialStart = defaultDateStr;
          initialEnd = defaultDateStr;
        }

        if (isMounted) {
          if (initialStart.includes('-')) {
            const [sY, sM, sD] = initialStart.split('-');
            setStartYear(sY);
            setStartMonth(sM);
            setStartDay(sD);
          } else {
            setStartYear(initialYear);
            setStartMonth(initialMonth);
            setStartDay(initialDay);
          }
          if (initialEnd.includes('-')) {
            const [eY, eM, eD] = initialEnd.split('-');
            setEndYear(eY);
            setEndMonth(eM);
            setEndDay(eD);
          } else {
            setEndYear(initialYear);
            setEndMonth(initialMonth);
            setEndDay(initialDay);
          }
          setDisplayStartDate(initialStart);
          setDisplayEndDate(initialEnd);
        }
      } catch (err: any) {
        console.error('Error setting initial date range:', err.message);
        if (isMounted) {
          setError(`Error setting initial dates: ${err.message}`);
          setDisplayStartDate(defaultDateStr);
          setDisplayEndDate(defaultDateStr);
          setStartDay(initialDay);
          setStartMonth(initialMonth);
          setStartYear(initialYear);
          setEndDay(initialDay);
          setEndMonth(initialMonth);
          setEndYear(initialYear);
        }
      }
    };
    fetchDateRange();
    return () => {
      isMounted = false;
    };
  }, []);

  // Effect 2: Apply initial dates
  useEffect(() => {
    if (
      isInitialMount.current &&
      startYear &&
      startMonth &&
      startDay &&
      endYear &&
      endMonth &&
      endDay
    ) {
      const initialStartDate = `${startYear}-${startMonth}-${startDay}`;
      const initialEndDate = `${endYear}-${endMonth}-${endDay}`;
      setAppliedStartDate(initialStartDate);
      setAppliedEndDate(initialEndDate);
      setSortColumn('fecha');
      setSortDirection('desc');
      isInitialMount.current = false;
    }
  }, [startYear, startMonth, startDay, endYear, endMonth, endDay]);

  // Effect 3: Fetch Data (Server-Side Pagination)
  useEffect(() => {
    if (isInitialMount.current || !appliedStartDate || !appliedEndDate) {
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const tableName =
          selectedBranch === 'General' ? 'vista_ventas_general' : selectedBranch;

        // Base query
        let query = supabase
          .from(tableName)
          .select('*', { count: 'exact' })
          .gte('fecha', `${appliedStartDate} 00:00:00`)
          .lte('fecha', `${appliedEndDate} 23:59:59`)
          .eq('movto', '1');

        // Filters
        if (selectedTurno !== 'Todos') {
          query = query.eq('turno', selectedTurno);
        }

        if (searchQuery) {
          // Note: 'ilike' works on text columns. For numbers, we might need casting or exact match.
          // Searching across multiple columns with 'or'
          const term = `%${searchQuery}%`;
          query = query.or(
            `articulo.ilike.${term},nombre.ilike.${term},referencia.ilike.${term},fol.ilike.${term}`
          );
        }

        // Sorting
        query = query.order(sortColumn, { ascending: sortDirection === 'asc' });

        // Pagination
        const from = (currentPage - 1) * itemsPerPage;
        const to = from + itemsPerPage - 1;
        query = query.range(from, to);

        const { data: resultData, error: resultError, count } = await query;

        if (resultError) throw resultError;

        if (count !== null) setTotalCount(count);

        // Process Data
        const processedData: TableRow[] = (resultData || []).map((item: any) => {
          const cantidad = safeParseFloatAndRound(item.cantidad);
          const costo = safeParseFloatAndRound(item.costo);
          const ppub = safeParseFloatAndRound(item.ppub);
          const dscto = safeParseFloatAndRound(item.dscto);
          const costoTotal = safeParseFloatAndRound(cantidad * costo);
          const precioFinal = safeParseFloatAndRound(cantidad * ppub);
          const utilidad = safeParseFloatAndRound(
            precioFinal - costoTotal - dscto
          );

          let formattedHora = 'N/A';
          if (item.hora) {
            try {
              // Handle Supabase timestamp format: "1899-12-30 18:53:25" or "2024-01-01T18:53:25"
              const horaStr = String(item.hora);

              // Try to parse as Date
              const dateWithTime = new Date(horaStr);

              if (!isNaN(dateWithTime.getTime())) {
                // Successfully parsed - extract time portion
                formattedHora = dateWithTime.toLocaleTimeString('es-MX', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false
                });
              } else {
                // If Date parsing fails, try to extract time manually
                // Format: "YYYY-MM-DD HH:MM:SS" or "HH:MM:SS"
                const timeMatch = horaStr.match(/(\d{2}):(\d{2}):(\d{2})/);
                if (timeMatch) {
                  formattedHora = `${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}`;
                }
              }
            } catch (e) {
              console.warn('Error parsing time:', item.hora, e);
            }
          }

          return {
            id: Number(item.id || 0),
            articulo: String(item.articulo || ''),
            fecha: item.fecha ? String(item.fecha).split('T')[0] : 'N/A',
            tipo: String(item.tipo || ''),
            movto: String(item.movto || ''),
            desc_movto: String(item.desc_movto || ''),
            cantidad: cantidad,
            costo: costo,
            referencia: String(item.referencia || ''),
            hora: formattedHora,
            nombre: String(item.nombre || ''),
            turno: String(item.turno || ''),
            ppub: ppub,
            autonumber: Number(item.autonumber || 0),
            fol: String(item.fol || ''),
            dscto: dscto,
            costoTotal: costoTotal,
            precioFinal: precioFinal,
            utilidad: utilidad,
            sucursal: item.sucursal || selectedBranch // Use returned branch or selected
          };
        });

        setData(processedData);
      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError(
          `Error al obtener datos: ${err.message}. ${selectedBranch === 'General'
            ? 'Asegúrese de que la vista "vista_ventas_general" exista.'
            : ''
          }`
        );
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    // Debounce search
    const timeoutId = setTimeout(() => {
      fetchData();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [
    appliedStartDate,
    appliedEndDate,
    selectedBranch,
    selectedTurno,
    searchQuery,
    currentPage,
    sortColumn,
    sortDirection,
    itemsPerPage
  ]);

  // --- Event Handlers ---
  const handleBranchChange = (event: Event) => {
    const target = event.target as HTMLSelectElement;
    setSelectedBranch(target.value);
    setCurrentPage(1);
  };

  const handleTurnoChange = (event: Event) => {
    const target = event.target as HTMLSelectElement;
    setSelectedTurno(target.value);
    setCurrentPage(1);
  };

  const handleSearchChange = (event: Event) => {
    const target = event.target as HTMLInputElement;
    setSearchQuery(target.value);
    setCurrentPage(1);
  };

  const handlePageChange = (newPage: number) => {
    const totalPages = Math.ceil(totalCount / itemsPerPage);
    if (newPage >= 1 && newPage <= totalPages && !loading) {
      setCurrentPage(newPage);
    }
  };

  const handleStartDayChange = (e: Event) =>
    setStartDay((e.target as HTMLSelectElement).value);
  const handleStartMonthChange = (e: Event) =>
    setStartMonth((e.target as HTMLSelectElement).value);
  const handleStartYearChange = (e: Event) =>
    setStartYear((e.target as HTMLSelectElement).value);

  const handleEndDayChange = (e: Event) =>
    setEndDay((e.target as HTMLSelectElement).value);
  const handleEndMonthChange = (e: Event) =>
    setEndMonth((e.target as HTMLSelectElement).value);
  const handleEndYearChange = (e: Event) =>
    setEndYear((e.target as HTMLSelectElement).value);

  const handleApplyDatesClick = () => {
    if (
      !startYear ||
      !startMonth ||
      !startDay ||
      !endYear ||
      !endMonth ||
      !endDay
    ) {
      setError('Por favor seleccione fechas de inicio y fin completas.');
      return;
    }
    const newStartDateStr = `${startYear}-${startMonth}-${startDay}`;
    const newEndDateStr = `${endYear}-${endMonth}-${endDay}`;

    const startDateObj = new Date(newStartDateStr + 'T00:00:00');
    const endDateObj = new Date(newEndDateStr + 'T00:00:00');

    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      setError('Las fechas seleccionadas no son válidas.');
      return;
    }
    if (startDateObj > endDateObj) {
      setError('La fecha de inicio no puede ser posterior a la fecha de fin.');
      return;
    }

    setError(null);
    setDisplayStartDate(newStartDateStr);
    setDisplayEndDate(newEndDateStr);
    setAppliedStartDate(newStartDateStr);
    setAppliedEndDate(newEndDateStr);
    setCurrentPage(1);
  };

  const handleSort = (column: keyof TableRow) => {
    if (loading) return;
    const isAsc = sortColumn === column && sortDirection === 'asc';
    setSortColumn(column);
    setSortDirection(isAsc ? 'desc' : 'asc');
  };

  const getBranchArticulosTable = (kardexBranch: string): string => {
    // Map Kardex branch names to Articulos table names
    const branchMap: Record<string, string> = {
      'KardexMexico': 'ArticulosMexico',
      'KardexMadero': 'ArticulosMadero',
      'KardexEcono1': 'ArticulosEcono1',
      'KardexLopezM': 'ArticulosLopezM',
      'KardexBaja': 'ArticulosBaja',
      'KardexEcono2': 'ArticulosEcono2',
      'KardexLolita': 'ArticulosLolita'
    };
    return branchMap[kardexBranch] || 'ArticulosMexico'; // Default to Mexico
  };

  const handleArticleClick = async (row: TableRow) => {
    setSelectedArticle(row);
    setModalOpen(true);
    setArticleName('');
    setLoadingArticleName(true);

    // Fetch article name from Articulos table
    try {
      const articulosTable = getBranchArticulosTable(row.sucursal);
      const { data, error } = await supabase
        .from(articulosTable)
        .select('nombre_comer_a')
        .eq('cve_articulo_a', row.articulo)
        .single();

      if (error) {
        console.error('Error fetching article name:', error);
        setArticleName('No disponible');
      } else if (data) {
        setArticleName(data.nombre_comer_a || 'Sin nombre');
      } else {
        setArticleName('No encontrado');
      }
    } catch (err) {
      console.error('Error:', err);
      setArticleName('Error al cargar');
    } finally {
      setLoadingArticleName(false);
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedArticle(null);
  };

  const handleExpensesCalculated = useCallback((calculatedExpenses: number) => {
    setOperatingExpenses((prevExpenses) => {
      if (prevExpenses !== calculatedExpenses) {
        return calculatedExpenses;
      }
      return prevExpenses;
    });
  }, []);

  const yearOptions = useMemo(
    () =>
      years.map((year) => (
        <option key={year} value={year}>
          {year}
        </option>
      )),
    []
  );
  const monthOptions = useMemo(
    () =>
      months.map((month) => (
        <option key={month.value} value={month.value}>
          {month.name}
        </option>
      )),
    []
  );
  const dayOptions = useMemo(
    () =>
      days.map((day) => (
        <option key={day} value={day}>
          {day}
        </option>
      )),
    []
  );

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  return (
    <>
      <VentasCardsReport
        startDate={appliedStartDate}
        endDate={appliedEndDate}
        selectedBranch={selectedBranch}
        operatingExpenses={operatingExpenses}
        selectedTurno={selectedTurno}
      />

      <Gastos
        startDate={appliedStartDate}
        endDate={appliedEndDate}
        selectedBranch={selectedBranch}
        onExpensesCalculated={handleExpensesCalculated}
      />

      <div class="ventas-report-container">
        <h2>Detalle de Ventas</h2>

        <div class="row g-2 mb-3 align-items-end filter-controls-row">
          <div class="col-12 col-md-6 col-lg-3">
            <label class="form-label form-label-sm">Fecha Inicio:</label>
            <div class="input-group input-group-sm">
              <select
                class="form-select"
                value={startDay}
                onChange={handleStartDayChange}
                disabled={loading}
              >
                {dayOptions}
              </select>
              <select
                class="form-select"
                value={startMonth}
                onChange={handleStartMonthChange}
                disabled={loading}
              >
                {monthOptions}
              </select>
              <select
                class="form-select"
                value={startYear}
                onChange={handleStartYearChange}
                disabled={loading}
              >
                {yearOptions}
              </select>
            </div>
          </div>

          <div class="col-12 col-md-6 col-lg-3">
            <label class="form-label form-label-sm">Fecha Fin:</label>
            <div class="input-group input-group-sm">
              <select
                class="form-select"
                value={endDay}
                onChange={handleEndDayChange}
                disabled={loading}
              >
                {dayOptions}
              </select>
              <select
                class="form-select"
                value={endMonth}
                onChange={handleEndMonthChange}
                disabled={loading}
              >
                {monthOptions}
              </select>
              <select
                class="form-select"
                value={endYear}
                onChange={handleEndYearChange}
                disabled={loading}
              >
                {yearOptions}
              </select>
            </div>
          </div>

          <div class="col-12 col-md-3 col-lg-1">
            <button
              type="button"
              class="btn btn-primary btn-sm w-100 mt-3 mt-md-0"
              onClick={handleApplyDatesClick}
              disabled={loading}
            >
              Aplicar
            </button>
          </div>

          <div class="col-6 col-md-4 col-lg-2">
            <label htmlFor="branch-select" class="form-label form-label-sm">
              Sucursal:
            </label>
            <select
              id="branch-select"
              class="form-select form-select-sm"
              value={selectedBranch}
              onChange={handleBranchChange}
              disabled={loading}
            >
              <option value="General">General</option>
              {branches.map((branch) => (
                <option key={branch} value={branch}>
                  {branch.replace('Kardex', '')}
                </option>
              ))}
            </select>
          </div>

          <div class="col-6 col-md-4 col-lg-2">
            <label htmlFor="turno-select" class="form-label form-label-sm">
              Turno:
            </label>
            <select
              id="turno-select"
              class="form-select form-select-sm"
              value={selectedTurno}
              onChange={handleTurnoChange}
              disabled={loading}
            >
              <option value="Todos">Todos</option>
              <option value="TURNO PRIMERO">TURNO PRIMERO</option>
              <option value="TURNO SEGUNDO">TURNO SEGUNDO</option>
            </select>
          </div>
        </div>

        <div class="row mb-3">
          <div class="col-12">
            <input
              type="text"
              class="form-control form-control-sm"
              placeholder="Buscar por artículo, nombre, referencia o folio..."
              value={searchQuery}
              onInput={handleSearchChange}
              disabled={loading}
            />
          </div>
        </div>

        {error && <div class="alert alert-danger">{error}</div>}

        {loading ? (
          <div class="text-center py-5">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Cargando datos...</span>
            </div>
            <p class="mt-2 text-muted">Obteniendo registros...</p>
          </div>
        ) : (
          <div class="table-responsive">
            <table class="table table-sm table-striped table-hover table-bordered align-middle">
              <thead class="table-light">
                <tr>
                  <th
                    onClick={() => handleSort('fecha')}
                    style={{ cursor: 'pointer' }}
                  >
                    Fecha{' '}
                    {sortColumn === 'fecha' &&
                      (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    onClick={() => handleSort('hora')}
                    style={{ cursor: 'pointer' }}
                  >
                    Hora{' '}
                    {sortColumn === 'hora' &&
                      (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    onClick={() => handleSort('sucursal')}
                    style={{ cursor: 'pointer' }}
                  >
                    Sucursal{' '}
                    {sortColumn === 'sucursal' &&
                      (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    onClick={() => handleSort('articulo')}
                    style={{ cursor: 'pointer' }}
                  >
                    Artículo{' '}
                    {sortColumn === 'articulo' &&
                      (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    onClick={() => handleSort('nombre')}
                    style={{ cursor: 'pointer' }}
                  >
                    Nombre{' '}
                    {sortColumn === 'nombre' &&
                      (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    onClick={() => handleSort('cantidad')}
                    style={{ cursor: 'pointer' }}
                    class="text-end"
                  >
                    Cant.{' '}
                    {sortColumn === 'cantidad' &&
                      (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    onClick={() => handleSort('ppub')}
                    style={{ cursor: 'pointer' }}
                    class="text-end"
                  >
                    P.Unit{' '}
                    {sortColumn === 'ppub' &&
                      (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    onClick={() => handleSort('dscto')}
                    style={{ cursor: 'pointer' }}
                    class="text-end"
                  >
                    Dscto{' '}
                    {sortColumn === 'dscto' &&
                      (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    onClick={() => handleSort('precioFinal')}
                    style={{ cursor: 'pointer' }}
                    class="text-end"
                  >
                    Total{' '}
                    {sortColumn === 'precioFinal' &&
                      (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    onClick={() => handleSort('utilidad')}
                    style={{ cursor: 'pointer' }}
                    class="text-end"
                  >
                    Utilidad{' '}
                    {sortColumn === 'utilidad' &&
                      (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    onClick={() => handleSort('turno')}
                    style={{ cursor: 'pointer' }}
                  >
                    Turno{' '}
                    {sortColumn === 'turno' &&
                      (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    onClick={() => handleSort('fol')}
                    style={{ cursor: 'pointer' }}
                  >
                    Folio{' '}
                    {sortColumn === 'fol' &&
                      (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.length > 0 ? (
                  data.map((row, index) => (
                    <tr key={`${row.id}-${index}`}>
                      <td>{row.fecha}</td>
                      <td>{row.hora}</td>
                      <td>{row.sucursal.replace('Kardex', '')}</td>
                      <td
                        class="text-truncate"
                        style={{ maxWidth: '150px', cursor: 'pointer', color: '#0d6efd' }}
                        onClick={() => handleArticleClick(row)}
                        title="Click para ver detalles"
                      >
                        {row.articulo}
                      </td>
                      <td class="text-truncate" style={{ maxWidth: '200px' }}>
                        {row.nombre}
                      </td>
                      <td class="text-end">{row.cantidad}</td>
                      <td class="text-end">
                        {row.ppub.toLocaleString('es-MX', {
                          style: 'currency',
                          currency: 'MXN'
                        })}
                      </td>
                      <td class="text-end text-warning">
                        {row.dscto > 0
                          ? row.dscto.toLocaleString('es-MX', {
                            style: 'currency',
                            currency: 'MXN'
                          })
                          : '-'}
                      </td>
                      <td class="text-end fw-bold">
                        {row.precioFinal.toLocaleString('es-MX', {
                          style: 'currency',
                          currency: 'MXN'
                        })}
                      </td>
                      <td
                        class={`text-end ${row.utilidad >= 0 ? 'text-success' : 'text-danger'
                          }`}
                      >
                        {row.utilidad.toLocaleString('es-MX', {
                          style: 'currency',
                          currency: 'MXN'
                        })}
                      </td>
                      <td>{row.turno}</td>
                      <td>{row.fol}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={12} class="text-center py-3">
                      No se encontraron registros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        <div class="d-flex justify-content-between align-items-center mt-3">
          <div>
            <span class="text-muted small">
              Mostrando {data.length} de {totalCount} registros
            </span>
          </div>
          <nav aria-label="Page navigation">
            <ul class="pagination pagination-sm mb-0">
              <li class={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                <button
                  class="page-link"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || loading}
                >
                  Anterior
                </button>
              </li>
              <li class="page-item disabled">
                <span class="page-link">
                  Página {currentPage} de {totalPages || 1}
                </span>
              </li>
              <li
                class={`page-item ${currentPage === totalPages || totalPages === 0 ? 'disabled' : ''
                  }`}
              >
                <button
                  class="page-link"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={
                    currentPage === totalPages || totalPages === 0 || loading
                  }
                >
                  Siguiente
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Article Details Modal */}
      {modalOpen && selectedArticle && (
        <div
          class="modal fade show d-block"
          tabIndex={-1}
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={handleCloseModal}
        >
          <div
            class="modal-dialog modal-md modal-dialog-centered modal-dialog-scrollable"
            onClick={(e) => e.stopPropagation()}
          >
            <div class="modal-content">
              <div class="modal-header bg-primary text-white">
                <h5 class="modal-title">Detalles del Artículo</h5>
                <button
                  type="button"
                  class="btn-close btn-close-white"
                  aria-label="Close"
                  onClick={handleCloseModal}
                ></button>
              </div>
              <div class="modal-body p-3">
                <div class="card">
                  <div class="card-body p-3">
                    {/* Article Code and Name */}
                    <div class="mb-3">
                      <label class="form-label fw-bold small text-muted mb-1">Código</label>
                      <p class="mb-2">{selectedArticle.articulo}</p>

                      <label class="form-label fw-bold small text-muted mb-1">Nombre del Producto</label>
                      {loadingArticleName ? (
                        <div class="d-flex align-items-center">
                          <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                          <span class="text-muted small">Cargando...</span>
                        </div>
                      ) : (
                        <p class="mb-0 fs-6 fw-bold text-primary">{articleName}</p>
                      )}
                    </div>

                    <hr class="my-2" />

                    {/* Transaction Info */}
                    <div class="row g-2 mb-2">
                      <div class="col-6">
                        <label class="form-label fw-bold small text-muted mb-0">Fecha</label>
                        <p class="mb-0 small">{selectedArticle.fecha}</p>
                      </div>
                      <div class="col-6">
                        <label class="form-label fw-bold small text-muted mb-0">Hora</label>
                        <p class="mb-0 small">{selectedArticle.hora}</p>
                      </div>
                      <div class="col-6">
                        <label class="form-label fw-bold small text-muted mb-0">Sucursal</label>
                        <p class="mb-0 small">{selectedArticle.sucursal.replace('Kardex', '')}</p>
                      </div>
                      <div class="col-6">
                        <label class="form-label fw-bold small text-muted mb-0">Turno</label>
                        <p class="mb-0 small">{selectedArticle.turno}</p>
                      </div>
                      <div class="col-6">
                        <label class="form-label fw-bold small text-muted mb-0">Folio</label>
                        <p class="mb-0 small">{selectedArticle.fol}</p>
                      </div>
                      <div class="col-6">
                        <label class="form-label fw-bold small text-muted mb-0">Referencia</label>
                        <p class="mb-0 small">{selectedArticle.referencia || 'N/A'}</p>
                      </div>
                    </div>

                    <hr class="my-2" />

                    {/* Pricing Info */}
                    <div class="row g-2">
                      <div class="col-6">
                        <label class="form-label fw-bold small text-muted mb-0">Cantidad</label>
                        <p class="mb-0 fw-bold">{selectedArticle.cantidad}</p>
                      </div>
                      <div class="col-6">
                        <label class="form-label fw-bold small text-muted mb-0">Precio Unit.</label>
                        <p class="mb-0">
                          {selectedArticle.ppub.toLocaleString('es-MX', {
                            style: 'currency',
                            currency: 'MXN'
                          })}
                        </p>
                      </div>
                      <div class="col-6">
                        <label class="form-label fw-bold small text-muted mb-0">Costo Unit.</label>
                        <p class="mb-0">
                          {selectedArticle.costo.toLocaleString('es-MX', {
                            style: 'currency',
                            currency: 'MXN'
                          })}
                        </p>
                      </div>
                      <div class="col-6">
                        <label class="form-label fw-bold small text-muted mb-0">Descuento</label>
                        <p class="mb-0 text-warning">
                          {selectedArticle.dscto > 0
                            ? selectedArticle.dscto.toLocaleString('es-MX', {
                              style: 'currency',
                              currency: 'MXN'
                            })
                            : '-'}
                        </p>
                      </div>
                      <div class="col-6">
                        <label class="form-label fw-bold small text-muted mb-0">Total Venta</label>
                        <p class="mb-0 fw-bold text-primary">
                          {selectedArticle.precioFinal.toLocaleString('es-MX', {
                            style: 'currency',
                            currency: 'MXN'
                          })}
                        </p>
                      </div>
                      <div class="col-6">
                        <label class="form-label fw-bold small text-muted mb-0">Utilidad</label>
                        <p
                          class={`mb-0 fw-bold ${selectedArticle.utilidad >= 0 ? 'text-success' : 'text-danger'
                            }`}
                        >
                          {selectedArticle.utilidad.toLocaleString('es-MX', {
                            style: 'currency',
                            currency: 'MXN'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="modal-footer p-2">
                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  onClick={handleCloseModal}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DataTableVentas;
