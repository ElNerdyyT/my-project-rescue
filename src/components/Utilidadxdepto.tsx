// Utilidadxdepto.tsx
import { useState, useEffect, useMemo } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';
import './VentasReport.css';

// --- Interfaces ---
interface DeptoRow {
  depto: string;
  subdepto: string;
  ventas: number;
  costo: number;
  descuentos: number;
  utilidad: number;
  nombre?: string; // Nuevo campo para nombre
}

interface TableRow {
  articulo: string;
  fecha: string;
  cantidad: number;
  costo: number;
  ppub: number;
  dscto: number;
  costoTotal: number;
  precioFinal: number;
  utilidad: number;
  sucursal: string;
  depto?: string;
  subdepto?: string;
  nombre_comer?: string; // Nuevo campo para nombre comercial
}

// --- Constantes ---
const branches: string[] = [
  'KardexEcono1', 'KardexMexico', 'KardexMadero', 'KardexLopezM',
  'KardexBaja', 'KardexEcono2', 'KardexLolita'
];

const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
const months = [
  { value: '01', name: 'Ene' }, { value: '02', name: 'Feb' }, 
  { value: '03', name: 'Mar' }, { value: '04', name: 'Abr' },
  { value: '05', name: 'May' }, { value: '06', name: 'Jun' },
  { value: '07', name: 'Jul' }, { value: '08', name: 'Ago' },
  { value: '09', name: 'Sep' }, { value: '10', name: 'Oct' },
  { value: '11', name: 'Nov' }, { value: '12', name: 'Dic' }
];
const currentYear = new Date().getFullYear();
const years = Array.from(
  { length: currentYear - 2015 + 1 }, 
  (_, i) => String(2015 + i)
).reverse();

// --- Helper Functions ---
const safeParseFloatAndRound = (value: any, decimals: number = 2): number => {
  if (value === null || value === undefined) return 0;
  const stringValue = String(value).replace(/,/g, '.');
  const num = parseFloat(stringValue);
  if (isNaN(num)) return 0;
  const multiplier = Math.pow(10, decimals);
  const roundedNum = Math.round((num * multiplier) + Number.EPSILON) / multiplier;
  return Number(roundedNum.toFixed(decimals));
};

const fetchArticulosData = async (branch: string, codigos: string[]) => {
  const articulosTable = branch.replace('Kardex', 'Articulos');
  const chunkSize = 200;
  const chunks = [];
  
  for (let i = 0; i < codigos.length; i += chunkSize) {
    chunks.push(codigos.slice(i, i + chunkSize));
  }

  const articulosMap = new Map();
  
  try {
    for (const chunk of chunks) {
      const { data, error } = await supabase
        .from(articulosTable)
        .select('cve_articulo_a, depto_a, subdepto_a, nombre_comer_a') // Añadido nombre_comer_a
        .in('cve_articulo_a', chunk);
      
      if (error) {
        console.error(`Error fetching articulos from ${articulosTable}:`, error);
        continue;
      }
      
      if (data) {
        data.forEach(art => {
          articulosMap.set(art.cve_articulo_a, {
            depto: art.depto_a || 'Sin depto',
            subdepto: art.subdepto_a || 'Sin subdepto',
            nombre_comer: art.nombre_comer_a || 'Sin nombre' // Guardar nombre comercial
          });
        });
      }
    }
  } catch (err) {
    console.error(`Error in batch fetch for ${articulosTable}:`, err);
  }
  
  return articulosMap;
};

// --- Main Component ---
const Utilidadxdepto = () => {
  // --- State ---
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>('General');
  const [startDay, setStartDay] = useState<string>('');
  const [startMonth, setStartMonth] = useState<string>('');
  const [startYear, setStartYear] = useState<string>('');
  const [endDay, setEndDay] = useState<string>('');
  const [endMonth, setEndMonth] = useState<string>('');
  const [endYear, setEndYear] = useState<string>('');
  const [appliedStartDate, setAppliedStartDate] = useState<string>('');
  const [appliedEndDate, setAppliedEndDate] = useState<string>('');
  const [aggregatedData, setAggregatedData] = useState<DeptoRow[]>([]);
  const [totalSummary, setTotalSummary] = useState<DeptoRow>({
    depto: 'TOTAL',
    subdepto: '',
    ventas: 0,
    costo: 0,
    descuentos: 0,
    utilidad: 0
  });
  const [rawData, setRawData] = useState<TableRow[]>([]);
  const [deptosMap, setDeptosMap] = useState<Map<string, string>>(new Map());
  
  // Estados para ordenamiento
  const [sortColumn, setSortColumn] = useState<keyof DeptoRow>('depto');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Estados para modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalData, setModalData] = useState<TableRow[]>([]);
  const [selectedDepto, setSelectedDepto] = useState<{ depto: string; subdepto: string; nombre: string } | null>(null);

  // --- Effects ---
  // Cargar tabla de departamentos
  useEffect(() => {
    const fetchDeptos = async () => {
      const { data, error } = await supabase
        .from('deptos')
        .select('depto, subdepto, nombre');

      if (error) {
        console.error('Error cargando departamentos:', error);
        return;
      }

      const newMap = new Map();
      data?.forEach(depto => {
        const key = `${depto.depto}-${depto.subdepto}`;
        newMap.set(key, depto.nombre);
      });
      setDeptosMap(newMap);
    };

    fetchDeptos();
  }, []);

  // Initialize date range
  useEffect(() => {
    const fetchDateRange = async () => {
      setLoading(true);
      const today = new Date();
      const defaultDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      try {
        const { data, error } = await supabase
          .from('date_range')
          .select('start_date, end_date')
          .single();

        if (error) throw error;

        const startDate = data?.start_date || defaultDate;
        const endDate = data?.end_date || defaultDate;
        
        const [sYear, sMonth, sDay] = startDate.split('-');
        const [eYear, eMonth, eDay] = endDate.split('-');
        
        setStartYear(sYear);
        setStartMonth(sMonth);
        setStartDay(sDay);
        setEndYear(eYear);
        setEndMonth(eMonth);
        setEndDay(eDay);
        setAppliedStartDate(startDate);
        setAppliedEndDate(endDate);

      } catch (err) {
        console.error('Error setting initial date range:', err);
        setError('Error al cargar el rango de fechas inicial');
        setStartYear(String(today.getFullYear()));
        setStartMonth(String(today.getMonth() + 1).padStart(2, '0'));
        setStartDay(String(today.getDate()).padStart(2, '0'));
        setEndYear(String(today.getFullYear()));
        setEndMonth(String(today.getMonth() + 1).padStart(2, '0'));
        setEndDay(String(today.getDate()).padStart(2, '0'));
        setAppliedStartDate(defaultDate);
        setAppliedEndDate(defaultDate);
      } finally {
        setLoading(false);
      }
    };

    fetchDateRange();
  }, []);

  // Fetch and aggregate data
  useEffect(() => {
    if (!appliedStartDate || !appliedEndDate) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setAggregatedData([]);
      setRawData([]);
      
      try {
        const branchesToFetch = selectedBranch === 'General' ? branches : [selectedBranch];
        const allData: TableRow[] = [];

        for (const branch of branchesToFetch) {
          try {
            // 1. Obtener datos de ventas
            const { data: ventasData, error: ventasError } = await supabase
              .from(branch)
              .select('*')
              .gte('fecha', `${appliedStartDate} 00:00:00`)
              .lte('fecha', `${appliedEndDate} 23:59:59`)
              .eq('movto', '1');

            if (ventasError) throw ventasError;
            if (!ventasData || ventasData.length === 0) continue;

            // 2. Obtener códigos de artículos únicos
            const codigosArticulos = [...new Set(ventasData.map(item => item.articulo))];
            
            // 3. Obtener datos de artículos por lotes
            const articulosMap = await fetchArticulosData(branch, codigosArticulos);

            // 4. Procesar datos combinados
            const branchData = ventasData.map((item): TableRow => {
              const cantidad = safeParseFloatAndRound(item.cantidad);
              const costo = safeParseFloatAndRound(item.costo);
              const ppub = safeParseFloatAndRound(item.ppub);
              const dscto = safeParseFloatAndRound(item.dscto);
              const costoTotal = safeParseFloatAndRound(cantidad * costo);
              const precioFinal = safeParseFloatAndRound(cantidad * ppub);
              const utilidad = safeParseFloatAndRound(precioFinal - costoTotal - dscto);

              const articuloInfo = articulosMap.get(item.articulo) || {
                depto: 'Sin depto',
                subdepto: 'Sin subdepto',
                nombre_comer: 'Sin nombre'
              };

              return {
                articulo: item.articulo || '',
                fecha: item.fecha?.split('T')[0] || 'N/A',
                cantidad,
                costo,
                ppub,
                dscto,
                costoTotal,
                precioFinal,
                utilidad,
                sucursal: branch,
                depto: articuloInfo.depto,
                subdepto: articuloInfo.subdepto,
                nombre_comer: articuloInfo.nombre_comer // Guardar nombre comercial
              };
            });

            allData.push(...branchData);
          } catch (err) {
            console.error(`Error processing ${branch}:`, err);
            setError(`Error en ${branch}: ${err}`);
          }
        }

        if (allData.length === 0) {
          setError('No se encontraron registros de ventas');
          return;
        }

        setRawData(allData); // Guardar datos sin agrupar para el modal

        // 5. Agregar datos por departamento
        const aggregation: Record<string, DeptoRow> = {};
        let totalVentas = 0;
        let totalCosto = 0;
        let totalDescuentos = 0;
        let totalUtilidad = 0;

        allData.forEach(item => {
          const deptoKey = item.depto || 'Sin depto';
          const subdeptoKey = item.subdepto || 'Sin subdepto';
          const key = `${deptoKey}-${subdeptoKey}`;

          // Obtener nombre del departamento desde deptosMap
          const deptoName = deptosMap.get(key) || `${deptoKey}-${subdeptoKey}`;

          if (!aggregation[key]) {
            aggregation[key] = {
              depto: deptoKey,
              subdepto: subdeptoKey,
              ventas: 0,
              costo: 0,
              descuentos: 0,
              utilidad: 0,
              nombre: deptoName // Agregar nombre
            };
          }

          aggregation[key].ventas += item.precioFinal;
          aggregation[key].costo += item.costoTotal;
          aggregation[key].descuentos += item.dscto;
          aggregation[key].utilidad += item.utilidad;

          totalVentas += item.precioFinal;
          totalCosto += item.costoTotal;
          totalDescuentos += item.dscto;
          totalUtilidad += item.utilidad;
        });

        // 6. Convertir a array
        let aggregatedArray = Object.values(aggregation);
        
        // Ordenar según la columna seleccionada
        aggregatedArray.sort((a, b) => {
          const aValue = a[sortColumn];
          const bValue = b[sortColumn];
          
          if (typeof aValue === 'number' && typeof bValue === 'number') {
            return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
          }
          
          // Para strings (departamento y subdepartamento)
          const aStr = String(aValue);
          const bStr = String(bValue);
          return sortDirection === 'asc' 
            ? aStr.localeCompare(bStr) 
            : bStr.localeCompare(aStr);
        });

        setAggregatedData(aggregatedArray);
        setTotalSummary({
          depto: 'TOTAL',
          subdepto: '',
          ventas: totalVentas,
          costo: totalCosto,
          descuentos: totalDescuentos,
          utilidad: totalUtilidad,
          nombre: ''
        });

      } catch (err) {
        console.error('General fetch error:', err);
        setError(`Error general: ${err}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [appliedStartDate, appliedEndDate, selectedBranch, sortColumn, sortDirection, deptosMap]);

  // --- Handlers ---
  const handleBranchChange = (e: Event) => {
    const target = e.target as HTMLSelectElement;
    setSelectedBranch(target.value);
  };

  const handleApplyDates = () => {
    if (!startYear || !startMonth || !startDay || !endYear || !endMonth || !endDay) {
      setError('Por favor seleccione fechas completas');
      return;
    }

    const newStart = `${startYear}-${startMonth}-${startDay}`;
    const newEnd = `${endYear}-${endMonth}-${endDay}`;
    
    const startDate = new Date(newStart);
    const endDate = new Date(newEnd);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      setError('Fechas inválidas');
      return;
    }
    
    if (startDate > endDate) {
      setError('La fecha de inicio no puede ser mayor a la fecha final');
      return;
    }

    setError(null);
    setAppliedStartDate(newStart);
    setAppliedEndDate(newEnd);
  };

  // Función para ordenamiento de columnas
  const handleSort = (column: keyof DeptoRow) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Función para mostrar modal con detalles
  const handleRowClick = (depto: string, subdepto: string, nombre: string) => {
    // Filtrar datos originales por departamento y subdepartamento
    const detailData = rawData.filter(
      item => item.depto === depto && item.subdepto === subdepto
    );
    
    setModalData(detailData);
    setSelectedDepto({ depto, subdepto, nombre });
    setIsModalOpen(true);
  };

  // --- Memoized Options ---
  const yearOptions = useMemo(() => 
    years.map(year => <option key={year} value={year}>{year}</option>), 
    []);

  const monthOptions = useMemo(() => 
    months.map(month => (
      <option key={month.value} value={month.value}>{month.name}</option>
    )), []);

  const dayOptions = useMemo(() => 
    days.map(day => <option key={day} value={day}>{day}</option>), []);

  // --- Render ---
  return (
    <div class="utilidad-depto-container">
      <h2>Utilidad por Departamento</h2>

      {/* Filtros */}
      <div class="row g-2 mb-3 align-items-end">
        <div class="col-12 col-md-6 col-lg-3">
          <label class="form-label form-label-sm">Fecha Inicio:</label>
          <div class="input-group input-group-sm">
            <select 
              class="form-select" 
              value={startDay} 
              onChange={(e) => setStartDay((e.target as HTMLSelectElement).value)}
              disabled={loading}
            >
              <option value="">Día</option>
              {dayOptions}
            </select>
            <select 
              class="form-select" 
              value={startMonth} 
              onChange={(e) => setStartMonth((e.target as HTMLSelectElement).value)}
              disabled={loading}
            >
              <option value="">Mes</option>
              {monthOptions}
            </select>
            <select 
              class="form-select" 
              value={startYear} 
              onChange={(e) => setStartYear((e.target as HTMLSelectElement).value)}
              disabled={loading}
            >
              <option value="">Año</option>
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
              onChange={(e) => setEndDay((e.target as HTMLSelectElement).value)}
              disabled={loading}
            >
              <option value="">Día</option>
              {dayOptions}
            </select>
            <select 
              class="form-select" 
              value={endMonth} 
              onChange={(e) => setEndMonth((e.target as HTMLSelectElement).value)}
              disabled={loading}
            >
              <option value="">Mes</option>
              {monthOptions}
            </select>
            <select 
              class="form-select" 
              value={endYear} 
              onChange={(e) => setEndYear((e.target as HTMLSelectElement).value)}
              disabled={loading}
            >
              <option value="">Año</option>
              {yearOptions}
            </select>
          </div>
        </div>
        
        <div class="col-12 col-md-3 col-lg-1">
          <button 
            class="btn btn-primary btn-sm w-100 mt-3 mt-md-0" 
            onClick={handleApplyDates}
            disabled={loading}
          >
            Aplicar
          </button>
        </div>
        
        <div class="col-6 col-md-4 col-lg-2">
          <label class="form-label form-label-sm">Sucursal:</label>
          <select 
            class="form-select form-select-sm" 
            value={selectedBranch} 
            onChange={handleBranchChange}
            disabled={loading}
          >
            <option value="General">General</option>
            {branches.map(branch => (
              <option key={branch} value={branch}>
                {branch.replace('Kardex', '')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Mensajes de estado */}
      {error && <div class="alert alert-danger">{error}</div>}
      
      {loading && (
        <div class="d-flex justify-content-center my-4">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Cargando...</span>
          </div>
        </div>
      )}

      {/* Tabla de resultados */}
      {!loading && aggregatedData.length > 0 && (
        <div class="table-responsive">
          <table class="table table-striped table-hover">
            <thead>
              <tr>
                <th onClick={() => handleSort('depto')} style={{ cursor: 'pointer' }}>
                  Depto {sortColumn === 'depto' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => handleSort('subdepto')} style={{ cursor: 'pointer' }}>
                  Subdepto {sortColumn === 'subdepto' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th style={{ cursor: 'default' }}>Nombre</th>
                <th 
                  class="text-end" 
                  onClick={() => handleSort('ventas')} 
                  style={{ cursor: 'pointer' }}
                >
                  Ventas {sortColumn === 'ventas' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th 
                  class="text-end" 
                  onClick={() => handleSort('costo')} 
                  style={{ cursor: 'pointer' }}
                >
                  Costo {sortColumn === 'costo' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th 
                  class="text-end" 
                  onClick={() => handleSort('descuentos')} 
                  style={{ cursor: 'pointer' }}
                >
                  Descuentos {sortColumn === 'descuentos' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th 
                  class="text-end" 
                  onClick={() => handleSort('utilidad')} 
                  style={{ cursor: 'pointer' }}
                >
                  Utilidad {sortColumn === 'utilidad' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </th>
              </tr>
            </thead>
            <tbody>
              {aggregatedData.map((row, index) => (
                <tr 
                  key={index} 
                  onClick={() => handleRowClick(row.depto, row.subdepto, row.nombre || '')}
                  style={{ cursor: 'pointer' }}
                >
                  <td>{row.depto}</td>
                  <td>{row.subdepto}</td>
                  <td>{row.nombre}</td>
                  <td class="text-end">
                    {row.ventas.toLocaleString('es-MX', {
                      style: 'currency',
                      currency: 'MXN'
                    })}
                  </td>
                  <td class="text-end">
                    {row.costo.toLocaleString('es-MX', {
                      style: 'currency',
                      currency: 'MXN'
                    })}
                  </td>
                  <td class="text-end">
                    {row.descuentos.toLocaleString('es-MX', {
                      style: 'currency',
                      currency: 'MXN'
                    })}
                  </td>
                  <td class={`text-end ${row.utilidad < 0 ? 'text-danger' : 'text-success'}`}>
                    {row.utilidad.toLocaleString('es-MX', {
                      style: 'currency',
                      currency: 'MXN'
                    })}
                  </td>
                </tr>
              ))}
              {/* Total General */}
              <tr class="table-active fw-bold">
                <td colSpan={2}>{totalSummary.depto}</td>
                <td></td>
                <td class="text-end">
                  {totalSummary.ventas.toLocaleString('es-MX', {
                    style: 'currency',
                    currency: 'MXN'
                  })}
                </td>
                <td class="text-end">
                  {totalSummary.costo.toLocaleString('es-MX', {
                    style: 'currency',
                    currency: 'MXN'
                  })}
                </td>
                <td class="text-end">
                  {totalSummary.descuentos.toLocaleString('es-MX', {
                    style: 'currency',
                    currency: 'MXN'
                  })}
                </td>
                <td class={`text-end ${totalSummary.utilidad < 0 ? 'text-danger' : 'text-success'}`}>
                  {totalSummary.utilidad.toLocaleString('es-MX', {
                    style: 'currency',
                    currency: 'MXN'
                  })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {!loading && aggregatedData.length === 0 && !error && (
        <div class="alert alert-info mt-3">
          No se encontraron datos para el rango seleccionado
        </div>
      )}

      {/* Modal de Detalle */}
      {isModalOpen && (
        <div className="modal-backdrop" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1050
        }}>
          <div className="modal-content" style={{
            backgroundColor: '#fff',
            padding: '20px',
            borderRadius: '5px',
            width: '90%',
            maxWidth: '1200px',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)'
          }}>
            <div className="modal-header" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid #dee2e6',
              paddingBottom: '15px',
              marginBottom: '15px'
            }}>
              <h5 className="modal-title">
                Detalle de ventas: {selectedDepto?.nombre || `${selectedDepto?.depto}-${selectedDepto?.subdepto}`}
              </h5>
              <button 
                type="button" 
                className="btn-close" 
                onClick={() => setIsModalOpen(false)}
                aria-label="Cerrar"
              ></button>
            </div>
            
            <div className="modal-body">
              <div className="table-responsive">
                <table className="table table-sm table-hover">
                  <thead>
                    <tr>
                      <th>Artículo</th>
                      <th>Nombre</th>
                      <th>Fecha</th>
                      <th>Cantidad</th>
                      <th>P. Unitario</th>
                      <th>Descuento</th>
                      <th>Total</th>
                      <th>Costo</th>
                      <th>Utilidad</th>
                      <th>Sucursal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalData.map((item, index) => (
                      <tr key={index}>
                        <td>{item.articulo}</td>
                        <td>{item.nombre_comer}</td>
                        <td>{item.fecha}</td>
                        <td class="text-end">{item.cantidad.toLocaleString('es-MX')}</td>
                        <td class="text-end">
                          {item.ppub.toLocaleString('es-MX', { 
                            style: 'currency', 
                            currency: 'MXN' 
                          })}
                        </td>
                        <td class="text-end">
                          {item.dscto.toLocaleString('es-MX', { 
                            style: 'currency', 
                            currency: 'MXN' 
                          })}
                        </td>
                        <td class="text-end">
                          {item.precioFinal.toLocaleString('es-MX', { 
                            style: 'currency', 
                            currency: 'MXN' 
                          })}
                        </td>
                        <td class="text-end">
                          {item.costoTotal.toLocaleString('es-MX', { 
                            style: 'currency', 
                            currency: 'MXN' 
                          })}
                        </td>
                        <td class={`text-end ${item.utilidad < 0 ? 'text-danger' : 'text-success'}`}>
                          {item.utilidad.toLocaleString('es-MX', { 
                            style: 'currency', 
                            currency: 'MXN' 
                          })}
                        </td>
                        <td>{item.sucursal.replace('Kardex', '')}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="table-active fw-bold">
                      <td colSpan={5} className="text-end">Total:</td>
                      <td className="text-end">
                        {modalData.reduce((sum, item) => sum + item.dscto, 0).toLocaleString('es-MX', {
                          style: 'currency',
                          currency: 'MXN'
                        })}
                      </td>
                      <td className="text-end">
                        {modalData.reduce((sum, item) => sum + item.precioFinal, 0).toLocaleString('es-MX', {
                          style: 'currency',
                          currency: 'MXN'
                        })}
                      </td>
                      <td className="text-end">
                        {modalData.reduce((sum, item) => sum + item.costoTotal, 0).toLocaleString('es-MX', {
                          style: 'currency',
                          currency: 'MXN'
                        })}
                      </td>
                      <td className={`text-end ${
                        modalData.reduce((sum, item) => sum + item.utilidad, 0) < 0 
                          ? 'text-danger' 
                          : 'text-success'
                      }`}>
                        {modalData.reduce((sum, item) => sum + item.utilidad, 0).toLocaleString('es-MX', {
                          style: 'currency',
                          currency: 'MXN'
                        })}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            
            <div className="modal-footer" style={{
              borderTop: '1px solid #dee2e6',
              paddingTop: '15px',
              marginTop: '15px'
            }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setIsModalOpen(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Utilidadxdepto;