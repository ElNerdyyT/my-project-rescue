// --- START OF FILE ResumenVentasSemanales.tsx ---

import { useState, useEffect, useMemo } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';
import './VentasReport.css'; // Reutiliza el CSS existente
import VentasCardsReport from './VentasCardsReport';
import Gastos from './Gastos';

// --- Interfaces, Constantes y Helpers ---
interface TableRow {
  fecha: string;
  dscto: number;
  costoTotal: number;
  precioFinal: number;
  utilidad: number;
}

interface WeeklySummary {
  semana: number;
  periodo: string;
  totalVentaNeta: number;
  totalCosto: number;
  totalUtilidad: number;
}

const branches: string[] = ['KardexEcono1', 'KardexMexico', 'KardexMadero', 'KardexLopezM', 'KardexBaja', 'KardexEcono2', 'KardexLolita'];

// Helper para calcular el número de semana ISO 8601
const getISOWeek = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.valueOf() - yearStart.valueOf()) / 86400000) + 1) / 7);
  return weekNo;
};

// Helper para formatear fechas como DD/MM
const formatDate = (date: Date): string => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
}


const ResumenVentasSemanales = () => {
  const [weeklySummaries, setWeeklySummaries] = useState<WeeklySummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>('General');
  const [operatingExpenses, setOperatingExpenses] = useState<number>(0);

  const appliedStartDate = '2025-01-01';
  const appliedEndDate = '2025-12-31';

  // --- Effect para obtener y procesar los datos ---
  useEffect(() => {
    const fetchAndProcessData = async () => {
      setLoading(true);
      setError(null);
      setWeeklySummaries([]);

      const branchesToFetch = selectedBranch === 'General' ? branches : [selectedBranch];
      let allSales: TableRow[] = [];

      try {
        // 1. Obtener los datos de todas las sucursales
        for (const branch of branchesToFetch) {
          const { data, error: dbError } = await supabase
            .from(branch)
            .select('fecha, dscto, costoTotal, precioFinal, utilidad')
            .gte('fecha', `${appliedStartDate} 00:00:00`)
            .lte('fecha', `${appliedEndDate} 23:59:59`)
            .eq('movto', '1')
            .returns<TableRow[]>();

          if (dbError) throw dbError;
          if (data) allSales = allSales.concat(data);
        }
        
        // 2. Agrupar los datos por semana y calcular totales
        const weeklyAggregates: {
            [weekNum: number]: {
                ventaNeta: number;
                costo: number;
                utilidad: number;
                minDate: Date;
                maxDate: Date;
            }
        } = {};

        for (const row of allSales) {
            const date = new Date(row.fecha + 'T00:00:00');
            const weekNum = getISOWeek(date);

            if (!weeklyAggregates[weekNum]) {
                weeklyAggregates[weekNum] = {
                    ventaNeta: 0,
                    costo: 0,
                    utilidad: 0,
                    minDate: date,
                    maxDate: date,
                }
            }
            // Sumar los valores
            weeklyAggregates[weekNum].ventaNeta += (row.precioFinal || 0) - (row.dscto || 0);
            weeklyAggregates[weekNum].costo += row.costoTotal || 0;
            weeklyAggregates[weekNum].utilidad += row.utilidad || 0;

            // Actualizar el rango de fechas de la semana
            if (date < weeklyAggregates[weekNum].minDate) weeklyAggregates[weekNum].minDate = date;
            if (date > weeklyAggregates[weekNum].maxDate) weeklyAggregates[weekNum].maxDate = date;
        }

        // 3. Formatear los datos agregados para la tabla final
        const summaries: WeeklySummary[] = Object.keys(weeklyAggregates).map(weekNumStr => {
            const weekNum = parseInt(weekNumStr);
            const data = weeklyAggregates[weekNum];
            return {
                semana: weekNum,
                periodo: `${formatDate(data.minDate)} - ${formatDate(data.maxDate)}`,
                totalVentaNeta: data.ventaNeta,
                totalCosto: data.costo,
                totalUtilidad: data.utilidad,
            };
        }).sort((a, b) => a.semana - b.semana); // Ordenar por número de semana

        setWeeklySummaries(summaries);

      } catch (err: any) {
        console.error("Error fetching or processing data:", err);
        setError("Ocurrió un error al obtener o procesar los datos.");
      } finally {
        setLoading(false);
      }
    };

    fetchAndProcessData();
  }, [selectedBranch]);


  return (
    <>
        {/* Los componentes de tarjetas y gastos se mantienen para dar un resumen anual total */}
        <VentasCardsReport startDate={appliedStartDate} endDate={appliedEndDate} selectedBranch={selectedBranch} operatingExpenses={operatingExpenses} />
        <Gastos startDate={appliedStartDate} endDate={appliedEndDate} selectedBranch={selectedBranch} onExpensesCalculated={(exp) => setOperatingExpenses(exp)} />

        <div class="ventas-report-container">
            <h2>Resumen de Ventas Semanales 2025</h2>
            
            <div class="row g-2 mb-3 align-items-end filter-controls-row">
                <div class="col-12 col-md-4 col-lg-3">
                    <label htmlFor="branch-select" class="form-label form-label-sm">Sucursal:</label>
                    <select id="branch-select" class="form-select form-select-sm" value={selectedBranch} onChange={(e) => setSelectedBranch((e.target as HTMLSelectElement).value)} disabled={loading}>
                        <option value="General">General</option>
                        {branches.map((branch) => (<option key={branch} value={branch}>{branch.replace('Kardex', '')}</option>))}
                    </select>
                </div>
            </div>

            {loading && <div class="text-center p-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Cargando...</span></div></div>}
            {error && <div class="alert alert-danger">{error}</div>}

            {!loading && !error && (
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Semana</th>
                                <th>Periodo</th>
                                <th class="text-end">Venta Neta</th>
                                <th class="text-end">Costo Total</th>
                                <th class="text-end">Utilidad Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {weeklySummaries.length > 0 ? (
                                weeklySummaries.map(summary => (
                                    <tr key={summary.semana}>
                                        <td>{summary.semana}</td>
                                        <td>{summary.periodo}</td>
                                        <td class="currency-cell">{summary.totalVentaNeta.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</td>
                                        <td class="currency-cell">{summary.totalCosto.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</td>
                                        <td class={`currency-cell ${summary.totalUtilidad < 0 ? 'negative-utilidad' : ''}`}>
                                            {summary.totalUtilidad.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} class="text-center p-4">No se encontraron datos de ventas para el año 2025.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    </>
  );
};

export default ResumenVentasSemanales;
// --- END OF FILE ResumenVentasSemanales.tsx ---
