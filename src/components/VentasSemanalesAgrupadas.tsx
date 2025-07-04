// --- START OF FILE VentasSemanalesAgrupadas.tsx ---

import { useState, useEffect, useMemo } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';
import './VentasReport.css'; // Asegúrate que el archivo CSS exista y añade los nuevos estilos de abajo

// --- Interfaces, Constantes y Helpers ---
interface TableRow {
  id?: number; articulo: string; fecha: string; tipo: string; movto: string; desc_movto: string; cantidad: number; costo: number; referencia: string; hora: string; nombre: string; turno: string; ppub: number; autonumber: number; fol: string; dscto: number; costoTotal: number; precioFinal: number; utilidad: number; sucursal: string;
}

const branches: string[] = [ 'KardexEcono1', 'KardexMexico', 'KardexMadero', 'KardexLopezM', 'KardexBaja', 'KardexEcono2', 'KardexLolita' ];

// Helper para calcular el número de semana ISO 8601
const getISOWeek = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Hacemos el jueves el día clave de la semana
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  // Calcular la diferencia en días y dividir por 7
  const weekNo = Math.ceil((((d.valueOf() - yearStart.valueOf()) / 86400000) + 1) / 7);
  return weekNo;
};

// Objeto para agrupar datos: la clave es el nombre del grupo (ej. "Semana 1 FS") y el valor es la lista de ventas
type GroupedData = {
  [key: string]: TableRow[];
};

const VentasSemanalesAgrupadas = () => {
  // --- State ---
  const [allData, setAllData] = useState<TableRow[]>([]);
  const [groupedData, setGroupedData] = useState<GroupedData>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('General');

  // Fechas fijas para el año 2025
  const appliedStartDate = '2025-01-01';
  const appliedEndDate = '2025-12-31';

  // --- Data Fetching (similar a la versión anterior) ---
  useEffect(() => {
    const fetchDataFromBranch = async (branch: string): Promise<TableRow[]> => {
      // ... (la función interna de fetch es la misma, no se necesita copiar de nuevo)
      try {
        const { data, error: dbError } = await supabase.from(branch).select('*').gte('fecha', `${appliedStartDate} 00:00:00`).lte('fecha', `${appliedEndDate} 23:59:59`).eq('movto', '1').returns<any[]>();
        if (dbError) throw dbError;
        if (!data) return [];
        return data.map((item: any): TableRow => {
            const cantidad = parseFloat(String(item.cantidad || 0).replace(',', '.'));
            const ppub = parseFloat(String(item.ppub || 0).replace(',', '.'));
            const dscto = parseFloat(String(item.dscto || 0).replace(',', '.'));
            const costo = parseFloat(String(item.costo || 0).replace(',', '.'));
            const precioFinal = cantidad * ppub;
            const costoTotal = cantidad * costo;
            const utilidad = precioFinal - costoTotal - dscto;
            return {
                id: item.id, articulo: item.articulo, fecha: String(item.fecha).split('T')[0], tipo: item.tipo, movto: item.movto,
                desc_movto: item.desc_movto, cantidad, costo, referencia: item.referencia, hora: item.hora, nombre: item.nombre,
                turno: item.turno, ppub, autonumber: item.autonumber, fol: item.fol, dscto, costoTotal, precioFinal, utilidad,
                sucursal: branch.replace('Kardex', '')
            };
        });
      } catch (err: any) {
        console.error(`Error fetching data from ${branch}:`, err.message);
        setError(`Error getting data from ${branch}.`);
        return [];
      }
    };
    
    const fetchAllData = async () => {
      setLoading(true); setError(null);
      const branchesToFetch = selectedBranch === 'General' ? branches : [selectedBranch];
      const promises = branchesToFetch.map(branch => fetchDataFromBranch(branch));
      const results = await Promise.allSettled(promises);
      let combinedData: TableRow[] = [];
      results.forEach(result => {
        if (result.status === 'fulfilled') combinedData = combinedData.concat(result.value);
      });
      setAllData(combinedData);
      setLoading(false);
    };

    fetchAllData();
  }, [selectedBranch]);


  // --- Effect para Agrupar, Filtrar y Ordenar los datos ---
  useEffect(() => {
    // 1. Filtrar datos primero basado en la búsqueda
    let filtered = allData;
    if (searchQuery) {
      const lowerCaseQuery = searchQuery.toLowerCase();
      filtered = allData.filter(row =>
        Object.values(row).some(value =>
          value?.toString().toLowerCase().includes(lowerCaseQuery)
        )
      );
    }

    // 2. Agrupar los datos filtrados
    const groups: GroupedData = filtered.reduce((acc, row) => {
      const date = new Date(row.fecha + 'T00:00:00');
      const dayOfWeek = date.getDay(); // Domingo=0, Lunes=1, ..., Sábado=6
      const weekNum = getISOWeek(date);

      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const key = isWeekend ? `Semana ${weekNum} FS` : `Semana ${weekNum}`;

      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(row);
      return acc;
    }, {} as GroupedData);

    // 3. Ordenar los datos dentro de cada grupo por fecha y hora
    for (const key in groups) {
      groups[key].sort((a, b) => {
        const dateComparison = a.fecha.localeCompare(b.fecha);
        if (dateComparison !== 0) return dateComparison;
        return String(a.hora).localeCompare(String(b.hora));
      });
    }

    setGroupedData(groups);

  }, [allData, searchQuery]);
  
  // --- Memo para ordenar las claves de los grupos para el renderizado ---
  const sortedGroupKeys = useMemo(() => {
    return Object.keys(groupedData).sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || '0');
      const numB = parseInt(b.match(/\d+/)?.[0] || '0');
      if (numA !== numB) return numA - numB;
      // Si el número de semana es el mismo, "Semana X" va antes que "Semana X FS"
      return a.includes('FS') ? 1 : -1;
    });
  }, [groupedData]);


  // --- Render ---
  return (
    <div class="ventas-report-container">
      <h2>Reporte de Ventas Semanales 2025</h2>
      
      <div class="row g-2 mb-3 align-items-end filter-controls-row">
        <div class="col-6 col-md-4 col-lg-3">
          <label htmlFor="branch-select" class="form-label form-label-sm">Sucursal:</label>
          <select id="branch-select" class="form-select form-select-sm" value={selectedBranch} onChange={(e) => setSelectedBranch((e.target as HTMLSelectElement).value)} disabled={loading}>
            <option value="General">General</option>
            {branches.map((branch) => (<option key={branch} value={branch}>{branch.replace('Kardex', '')}</option>))}
          </select>
        </div>
        <div class="col-6 col-md-5 col-lg-4">
          <label htmlFor="search-input" class="form-label form-label-sm">Buscar Artículo o Folio:</label>
          <input type="search" id="search-input" class="form-control form-control-sm" placeholder="Buscar en todos los grupos..." value={searchQuery} onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)} disabled={loading || allData.length === 0} />
        </div>
      </div>

      {loading && <div class="text-center p-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Cargando...</span></div></div>}
      {error && <div class="alert alert-danger">{error}</div>}

      {!loading && (
        <div class="accordion-container">
          {sortedGroupKeys.length > 0 ? (
            sortedGroupKeys.map(key => {
              const groupRows = groupedData[key];
              const totalVenta = groupRows.reduce((sum, row) => sum + row.precioFinal, 0);
              const totalItems = groupRows.reduce((sum, row) => sum + row.cantidad, 0);

              return (
                <details key={key} class="accordion-item">
                  <summary class="accordion-header">
                    <span class="group-title">{key}</span>
                    <span class="group-summary">
                        {totalItems.toLocaleString('es-MX')} artículos | Total: {totalVenta.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                    </span>
                  </summary>
                  <div class="accordion-content">
                    <div class="table-container">
                        <table class="data-table data-table-sm">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Sucursal</th>
                                    <th>Artículo</th>
                                    <th class="text-end">Cantidad</th>
                                    <th class="text-end">P. Final</th>
                                    <th class="text-end">Utilidad</th>
                                    <th>Folio</th>
                                </tr>
                            </thead>
                            <tbody>
                                {groupRows.map(row => (
                                    <tr key={`${row.sucursal}-${row.autonumber}-${row.id || Math.random()}`}>
                                        <td>{row.fecha}</td>
                                        <td>{row.sucursal}</td>
                                        <td class="articulo-cell">{row.articulo} - {row.nombre}</td>
                                        <td class="number-cell">{row.cantidad.toLocaleString('es-MX')}</td>
                                        <td class="currency-cell">{row.precioFinal.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</td>
                                        <td class={`currency-cell ${row.utilidad < 0 ? 'negative-utilidad' : ''}`}>{row.utilidad.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</td>
                                        <td>{row.fol}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                  </div>
                </details>
              );
            })
          ) : (
            <div class="alert alert-info mt-3 text-center">
              {searchQuery ? 'No se encontraron resultados para su búsqueda.' : 'No hay datos de ventas para mostrar.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VentasSemanalesAgrupadas;

// --- END OF FILE VentasSemanalesAgrupadas.tsx ---
