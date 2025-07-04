// --- START OF FILE ResumenVentasSemanales.tsx ---

import { useState, useEffect, useCallback } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';
import './VentasReport.css';
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

const getISOWeek = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.valueOf() - yearStart.valueOf()) / 86400000) + 1) / 7);
  return weekNo;
};

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

  const handleExpensesCalculated = useCallback((expenses: number) => {
    setOperatingExpenses(expenses);
  }, []);

  useEffect(() => {
    const fetchAndProcessData = async () => {
      setLoading(true);
      setError(null);
      
      const branchesToFetch = selectedBranch === 'General' ? branches : [selectedBranch];
      let allSales: TableRow[] = [];

      try {
        const fetchPromises = branchesToFetch.map(branch =>
          supabase
            .from(branch)
            .select('fecha, dscto, costoTotal, precioFinal, utilidad')
            .gte('fecha', appliedStartDate)
            .lte('fecha', appliedEndDate)
            .eq('movto', '1')
        );
        
        // **CAMBIO:** Usar Promise.allSettled para no detenerse si una sucursal falla.
        const results = await Promise.allSettled(fetchPromises);

        results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value.data) {
                allSales = allSales.concat(result.value.data as TableRow[]);
            } else if (result.status === 'rejected') {
                console.error(`Error al obtener datos de la sucursal ${branchesToFetch[index]}:`, result.reason);
            }
        });

        // Si después de todo no hay ventas, no hay nada que procesar.
        if (allSales.length === 0) {
            setWeeklySummaries([]);
            setLoading(false);
            return;
        }
        
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
            // **CAMBIO:** Añadir validación de fecha para evitar errores con datos incorrectos.
            if (!row.fecha || typeof row.fecha !== 'string') {
                console.warn('Registro ignorado: fecha faltante o inválida.', row);
                continue;
            }
            const date = new Date(row.fecha + 'T00:00:00');
            if (isNaN(date.getTime())) {
                console.warn('Registro ignorado: formato de fecha inválido.', row);
                continue;
            }

            const weekNum = getISOWeek(date);

            if (!weeklyAggregates[weekNum]) {
                weeklyAggregates[weekNum] = {
                    ventaNeta: 0, costo: 0, utilidad: 0,
                    minDate: date, maxDate: date,
                }
            }
            weeklyAggregates[weekNum].ventaNeta += (row.precioFinal || 0) - (row.dscto || 0);
            weeklyAggregates[weekNum].costo += row.costoTotal || 0;
            weeklyAggregates[weekNum].utilidad += row.utilidad || 0;
            if (date < weeklyAggregates[weekNum].minDate) weeklyAggregates[weekNum].minDate = date;
            if (date > weeklyAggregates[weekNum].maxDate) weeklyAggregates[weekNum].maxDate = date;
        }

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
        }).sort((a, b) => a.semana - b.semana);

        setWeeklySummaries(summaries);

      } catch (err: any) {
        // Este catch ahora es para errores inesperados, no para fallos de fetch individuales.
        console.error("Error inesperado en el procesamiento:", err);
        setError("Ocurrió un error inesperado al procesar los datos.");
      } finally {
        setLoading(false);
      }
    };

    fetchAndProcessData();
  }, [selectedBranch]);

  return (
    <>
        <VentasCardsReport startDate={appliedStartDate} endDate={appliedEndDate} selectedBranch={selectedBranch} operatingExpenses={operatingExpenses} />
        <Gastos startDate={appliedStartDate} endDate={appliedEndDate} selectedBranch={selectedBranch} onExpensesCalculated={handleExpensesCalculated} />

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
                                    <td colSpan={5} class="text-center p-4">No se encontraron datos de ventas para el año 2025 en la sucursal seleccionada.</td>
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
