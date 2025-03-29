// --- START OF FILE src/components/SingleMetricChart.tsx ---

import { useState, useEffect } from 'preact/hooks';
import ApexCharts from 'apexcharts';
import { supabase } from '../utils/supabaseClient';

// --- Helper Functions (copied and potentially adapted from ChartCortes) ---

// Function to generate an array of dates (YYYY-MM-DD strings) in UTC
const generateDateRange = (startDate: string, endDate: string): string[] => {
    const dates: string[] = [];
    try {
        const start = new Date(startDate + 'T00:00:00Z');
        const end = new Date(endDate + 'T00:00:00Z');
        if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
             console.error("Invalid date range provided:", startDate, endDate);
             return [];
        }
        let current = new Date(start);
        while (current <= end) {
            dates.push(current.toISOString().split('T')[0]); // YYYY-MM-DD string
            current.setUTCDate(current.getUTCDate() + 1);
        }
    } catch (e) {
        console.error("Error generating date range:", e); return [];
    }
    return dates;
};

// Function to shift a YYYY-MM-DD date string forward by one day (for display)
const shiftDateForward = (dateString: string): string => {
    try {
        const date = new Date(dateString + 'T00:00:00Z'); // Parse as UTC
        if (isNaN(date.getTime())) return dateString; // Return original if invalid
        date.setUTCDate(date.getUTCDate() + 1); // Add one day in UTC
        return date.toISOString().split('T')[0]; // Format back to YYYY-MM-DD
    } catch (e) {
        console.error("Error shifting date:", dateString, e);
        return dateString; // Return original on error
    }
};

// Helper function to safely parse numbers (simpler version for single value)
const safeParse = (val: any): number => {
    const str = String(val ?? '0');
    const num = parseFloat(str.replace(/,/g, '.')) || 0;
    // Ensure we return a number with max 2 decimal places, common for currency
    return parseFloat(num.toFixed(2));
};


// Helper function to format numbers as Mexican Peso currency
const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '$0.00';
    // Handle potential negative values for Faltantes
    const absValue = Math.abs(value);
    const formatted = absValue.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return value < 0 ? `-$${formatted}` : `$${formatted}`;
};

// --- Component Props Interface ---
interface SingleMetricChartProps {
    metricKey: 'totentreg' | 'tottarj' | 'faltan' | 'sobran' | 'gas' | 'com'; // DB column name
    chartTitle: string;        // Title above the chart
    yAxisTitle: string;        // Label for the Y-axis
    chartId: string;           // Unique ID for the chart div
    metricNamePrefix: string;  // Prefix for series names in legend (e.g., "Efectivo")
    isCurrency?: boolean;      // Format Y-axis and tooltip as currency (default: true)
    colors?: string[];         // Optional custom colors for series
}

// Define Branch names and corresponding table names
const branches = [
    { name: 'Mexico', table: 'CortesMexico', color: '#3b82f6' },
    { name: 'Madero', table: 'CortesMadero', color: '#10b981' },
    { name: 'Econo 1', table: 'CortesEcono1', color: '#ef4444' },
    { name: 'Lopez M', table: 'CortesLopezM', color: '#f97316' },
    { name: 'Econo 2', table: 'CortesEcono2', color: '#8b5cf6' },
    { name: 'Baja', table: 'CortesBaja', color: '#d946ef' },
    { name: 'Lolita', table: 'CortesLolita', color: '#0891b2' }
];

// --- Reusable Chart Component ---
const SingleMetricChart = ({
    metricKey,
    chartTitle,
    yAxisTitle,
    chartId,
    metricNamePrefix,
    isCurrency = true, // Default to true
    colors = branches.map(b => b.color) // Default colors
}: SingleMetricChartProps) => {

    // State for original date strings
    const [dates, setDates] = useState<string[]>([]);

    // State for branch daily totals (aligned with original dates)
    // Use a map for easier state management
    const [branchTotals, setBranchTotals] = useState<Record<string, number[]>>({});
    const [branchSums, setBranchSums] = useState<Record<string, number>>({});

    // Loading and error state
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchChartData = async () => {
            setIsLoading(true); setError(null);
            // Reset
            setBranchTotals({});
            setBranchSums({});
            setDates([]);

            try {
                // 1. Fetch date range
                const { data: dateRangeData, error: dateRangeError } = await supabase.from('date_range').select('start_date, end_date').single();
                if (dateRangeError || !dateRangeData || !dateRangeData.start_date || !dateRangeData.end_date) {
                     throw new Error(dateRangeError?.message || 'No se pudo obtener el rango de fechas válido.');
                }
                const { start_date, end_date } = dateRangeData;
                console.log(`[${chartId}] Fetched date range: ${start_date} to ${end_date}`);

                // 2. Generate the original date strings
                const originalDates = generateDateRange(start_date, end_date);
                 if (originalDates.length === 0) { throw new Error("No se pudo generar el rango de fechas."); }
                setDates(originalDates); // Store original dates
                console.log(`[${chartId}] Generated original dates:`, originalDates);

                // 3. Generic function to fetch and process data for a single metric
                type FetchResult = { totals: number[], sum: number };

                const fetchData = async (tableName: string, branchName: string): Promise<FetchResult> => {
                    console.log(`[${chartId}] Fetching ${metricKey} for ${tableName} (${branchName})...`);
                     const dayAfterEnd = (() => { const d=new Date(end_date+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+1); return d.toISOString().split('T')[0]; })();

                     // Select only 'fecha' and the required metricKey
                     const { data, error: fetchError } = await supabase
                         .from(tableName).select(`fecha, ${metricKey}`)
                         .gte('fecha', start_date).lt('fecha', dayAfterEnd)
                         .order('fecha', { ascending: true });

                    if (fetchError) {
                        console.error(`[${chartId}] Error fetching ${tableName}:`, fetchError.message);
                        // Return default object on error for this branch
                        return { totals: new Array(originalDates.length).fill(0), sum: 0 };
                    }

                    const dailyTotalsMap = new Map<string, number>();
                    if (data) {
                        data.forEach((row: any) => {
                            let entryDateStr: string | null = null;
                            let fechaValue = row.fecha;
                            // --- Robust date extraction logic (same as before) ---
                            if (fechaValue) {
                                if (fechaValue instanceof Date) { try { entryDateStr = fechaValue.toISOString().split('T')[0]; } catch(e) { /* ignore */ } }
                                else if (typeof fechaValue === 'string') { try { const d = new Date(fechaValue.replace(' ', 'T') + 'Z'); if (!isNaN(d.getTime())) { entryDateStr = d.toISOString().split('T')[0]; } else if (/^\d{4}-\d{2}-\d{2}$/.test(fechaValue)) { entryDateStr = fechaValue; } } catch (e) { if (/^\d{4}-\d{2}-\d{2}$/.test(fechaValue)) { entryDateStr = fechaValue; } } }
                                else if (typeof fechaValue === 'number') { try { const d = new Date(fechaValue); if (!isNaN(d.getTime())) { entryDateStr = d.toISOString().split('T')[0]; } } catch (e) { /* ignore */ } }
                            }
                             // --- End date extraction ---

                            if (!entryDateStr) { /* log? skip? */ return; }

                            const currentTotal = dailyTotalsMap.get(entryDateStr) || 0;
                            // Use safeParse for the specific metric
                            const metricValue = safeParse(row[metricKey]);
                            const newTotal = currentTotal + metricValue; // Sum only the single metric
                            dailyTotalsMap.set(entryDateStr, parseFloat(newTotal.toFixed(2)));
                        });
                    }

                    // Map using the originalDates order
                    let totalSum = 0;
                    const totalsArray = originalDates.map(originalDateString => {
                        const dayTotal = dailyTotalsMap.get(originalDateString) || 0;
                        totalSum += dayTotal;
                        return dayTotal;
                    });

                    console.log(`[${chartId}] Processing complete for ${tableName} (${branchName}). ${metricKey} Sum: ${totalSum.toFixed(2)}`);
                    return { totals: totalsArray, sum: parseFloat(totalSum.toFixed(2)) };
                };

                // 4. Fetch data concurrently for all branches
                const promises = branches.map(branch => fetchData(branch.table, branch.name));
                const results: FetchResult[] = await Promise.all(promises);

                // 5. Set state using maps
                if (results && results.length === branches.length) {
                    const newBranchTotals: Record<string, number[]> = {};
                    const newBranchSums: Record<string, number> = {};
                    branches.forEach((branch, index) => {
                        newBranchTotals[branch.name] = results[index].totals;
                        newBranchSums[branch.name] = results[index].sum;
                    });
                    setBranchTotals(newBranchTotals);
                    setBranchSums(newBranchSums);
                } else {
                     console.error(`[${chartId}] Promise.all did not return the expected number of results.`, results);
                     throw new Error("Error procesando los datos de las sucursales.");
                }

            } catch (err: any) {
                console.error(`[${chartId}] Error general:`, err);
                setError(err.message || 'Error inesperado.');
                // Clear states
                setDates([]);
                setBranchTotals({});
                setBranchSums({});
            } finally {
                setIsLoading(false);
            }
        };
        fetchChartData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chartId, metricKey]); // Re-fetch if metricKey or chartId changes (though chartId likely won't)

    // --- Effect to Render Chart ---
    useEffect(() => {
        const canRenderChart = !isLoading && !error && dates.length > 0 && Object.keys(branchTotals).length === branches.length;
        const chartElement = document.getElementById(chartId);

        if (canRenderChart && chartElement) {
             // Check data arrays length against original dates length for all branches
             const dataReady = branches.every(branch =>
                 branchTotals[branch.name]?.length === dates.length
             );

             if (!dataReady) {
                 console.warn(`[${chartId}] Chart rendering skipped: Data arrays length mismatch.`);
                 if (chartElement) chartElement.innerHTML = `<div class="text-center text-gray-500 p-4" style="min-height: 400px; display: flex; align-items: center; justify-content: center;">Error: Discrepancia en los datos cargados para ${metricNamePrefix}.</div>`;
                 return;
             }

            // ***** CREATE SHIFTED DATES FOR DISPLAY *****
            const shiftedDates = dates.map(shiftDateForward);
            console.log(`[${chartId}] Rendering ApexChart with SHIFTED dates for axis:`, shiftedDates);

             // Prepare series dynamically
             const seriesData = branches.map((branch, index) => ({
                name: `${metricNamePrefix} ${branch.name} (${isCurrency ? formatCurrency(branchSums[branch.name]) : branchSums[branch.name]})`,
                data: branchTotals[branch.name],
                color: colors[index % colors.length] // Use provided or default colors
             }));

            const options: ApexCharts.ApexOptions = {
                chart: {
                    type: 'line',
                    height: 400,
                    zoom: { enabled: true },
                    toolbar: { show: true, tools: { download: true, selection: true, zoom: true, zoomin: true, zoomout: true, pan: true, reset: true }, autoSelected: 'zoom' }
                },
                series: seriesData,
                xaxis: {
                    categories: shiftedDates, // Use SHIFTED dates
                    type: 'datetime',
                    labels: {
                        style: { colors: '#6b7280', fontSize: '12px' },
                        format: 'dd MMM',
                        datetimeUTC: false,
                        rotate: -30,
                        rotateAlways: false,
                    },
                    tickAmount: 10,
                    tooltip: { enabled: true }
                },
                yaxis: {
                    labels: {
                        style: { colors: '#6b7280', fontSize: '12px' },
                        formatter: (value: number) => isCurrency ? formatCurrency(value) : value.toLocaleString('es-MX') // Format conditionally
                    },
                    title: { text: yAxisTitle, style: { color: '#6b7280', fontSize: '12px', fontWeight: 500 } }
                },
                grid: { borderColor: '#e5e7eb', strokeDashArray: 4 },
                tooltip: {
                    x: { format: 'dd MMM yyyy' }, // Tooltip header will show the SHIFTED date
                    y: { formatter: (value: number) => isCurrency ? formatCurrency(value) : value.toLocaleString('es-MX') }, // Format conditionally
                    shared: true,
                    intersect: false
                },
                stroke: { curve: 'smooth', width: 2 },
                markers: { size: 0, hover: { size: 5 } },
                legend: {
                    position: 'top',
                    horizontalAlign: 'left',
                    fontSize: '13px',
                    fontWeight: 500,
                    offsetY: 5,
                    itemMargin: { horizontal: 10, vertical: 4 },
                     markers: { // Make legend markers slightly bigger
                         // @ts-ignore - Known valid properties for legend.markers, but TS types might be inaccurate
                         width: 10,
                         height: 10,
                         radius: 5, // Rounded markers
                         offsetY: 1 // Align vertically
                    },
                    // ... rest of legend config
                },
                responsive: [{
                    breakpoint: 768,
                    options: {
                        chart: { height: 300 },
                        legend: { position: 'bottom', horizontalAlign: 'center', fontSize: '12px', itemMargin: { horizontal: 5, vertical: 3 } },
                        yaxis: { title: { text: undefined } }
                    }
                }]
            };

            chartElement.innerHTML = ''; // Clear previous potentially error message
            const chart = new ApexCharts(chartElement, options);
            chart.render();
            return () => { chart.destroy(); }; // Cleanup

        } else if (!isLoading && chartElement) {
             // Ensure chart area is cleared if not loading but cannot render
             chartElement.innerHTML = '';
        }
    // Update dependencies: include state derived from props and props used in effects
    }, [isLoading, error, dates, branchTotals, branchSums, // State
        chartId, metricNamePrefix, yAxisTitle, isCurrency, colors // Props affecting render
    ]);

    // --- Render Logic ---
    return (
        <div className="card bg-white shadow-lg rounded-lg overflow-hidden border border-gray-200">
            <div className="card-body p-4 sm:p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-1">{chartTitle}</h3>
                <p className="text-sm text-gray-500 mb-4">Total Diario por Sucursal</p>

                {isLoading && (
                    <div className="flex justify-center items-center py-10" style={{ minHeight: '400px' }}>
                         <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                         <span className="ms-3 text-gray-600">Cargando datos...</span>
                    </div>
                 )}
                 {error && !isLoading && (
                    <div className="alert alert-danger text-center p-4 rounded bg-red-100 border border-red-400 text-red-700" style={{ minHeight: '400px' }}>
                        <strong className="font-bold">Error al cargar el gráfico ({metricNamePrefix}):</strong>
                        <span className="block sm:inline ml-1">{error}</span>
                    </div>
                 )}
                 {!isLoading && !error && dates.length === 0 && Object.keys(branchTotals).length === 0 && (
                     <div className="text-center text-gray-500 py-10" style={{ minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                         No hay datos disponibles para el rango de fechas o no se pudo generar.
                     </div>
                 )}

                 {/* Container for the chart */}
                 <div id={chartId} className="w-full" style={{ minHeight: '400px' }}>
                     {/* ApexCharts will render here. We might show a placeholder if data is missing after load */}
                     {!isLoading && !error && dates.length > 0 && Object.keys(branchTotals).length !== branches.length && (
                          <div className="text-center text-gray-500 p-4" style={{ minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              Esperando datos completos...
                          </div>
                     )}
                 </div>
            </div>
        </div>
    );
};

export default SingleMetricChart;

// --- END OF FILE src/components/SingleMetricChart.tsx ---