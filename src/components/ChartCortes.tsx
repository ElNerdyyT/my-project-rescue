// --- START OF FILE ChartCortes.tsx ---

import { useState, useEffect } from 'preact/hooks';
import ApexCharts from 'apexcharts';
import { supabase } from '../utils/supabaseClient';

// --- Helper Functions ---

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


// Helper function to safely parse and sum numbers
const safeParseAndSum = (val1: any, val2: any): number => {
    const str1 = String(val1 ?? '0');
    const str2 = String(val2 ?? '0');
    const num1 = parseFloat(str1.replace(/,/g, '.')) || 0;
    const num2 = parseFloat(str2.replace(/,/g, '.')) || 0;
    return parseFloat((num1 + num2).toFixed(2));
};

// Helper function to format numbers as Mexican Peso currency
const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '$0.00';
    return `$${value.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};


const ChartCortes = () => {
    // State for original date strings
    const [dates, setDates] = useState<string[]>([]);

    // State for branch daily totals (aligned with original dates)
    const [totalsMexico, setTotalsMexico] = useState<number[]>([]);
    const [totalsMadero, setTotalsMadero] = useState<number[]>([]);
    const [totalsEcono1, setTotalsEcono1] = useState<number[]>([]);
    const [totalsLopezM, setTotalsLopezM] = useState<number[]>([]);
    const [totalsEcono2, setTotalsEcono2] = useState<number[]>([]);
    const [totalsBaja, setTotalsBaja] = useState<number[]>([]);
    const [totalsLolita, setTotalsLolita] = useState<number[]>([]);

    // State for branch total sums
    const [sumMexico, setSumMexico] = useState<number>(0);
    const [sumMadero, setSumMadero] = useState<number>(0);
    const [sumEcono1, setSumEcono1] = useState<number>(0);
    const [sumLopezM, setSumLopezM] = useState<number>(0);
    const [sumEcono2, setSumEcono2] = useState<number>(0);
    const [sumBaja, setSumBaja] = useState<number>(0);
    const [sumLolita, setSumLolita] = useState<number>(0);

    // Loading and error state
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchChartData = async () => {
            setIsLoading(true); setError(null);
            // Reset
            setTotalsMexico([]); setTotalsMadero([]); setTotalsEcono1([]); setTotalsLopezM([]);
            setTotalsEcono2([]); setTotalsBaja([]); setTotalsLolita([]);
            setSumMexico(0); setSumMadero(0); setSumEcono1(0); setSumLopezM(0);
            setSumEcono2(0); setSumBaja(0); setSumLolita(0);
            setDates([]);

            try {
                // 1. Fetch date range
                const { data: dateRangeData, error: dateRangeError } = await supabase.from('date_range').select('start_date, end_date').single();
                if (dateRangeError || !dateRangeData || !dateRangeData.start_date || !dateRangeData.end_date) {
                     throw new Error(dateRangeError?.message || 'No se pudo obtener el rango de fechas válido.');
                }
                const { start_date, end_date } = dateRangeData;
                console.log(`Fetched date range: ${start_date} to ${end_date}`);

                // 2. Generate the original date strings
                const originalDates = generateDateRange(start_date, end_date);
                 if (originalDates.length === 0) { throw new Error("No se pudo generar el rango de fechas."); }
                setDates(originalDates); // Store original dates
                console.log("Generated original dates:", originalDates);

                // 3. Generic function to fetch and process data
                // Define the expected shape of the result from fetchData
                type FetchResult = { totals: number[], sum: number };

                const fetchData = async (tableName: string): Promise<FetchResult> => { // Return FetchResult
                    console.log(`Fetching data for ${tableName}...`);
                     // Use Option B (timestamp query) by default
                     const dayAfterEnd = (() => { const d=new Date(end_date+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+1); return d.toISOString().split('T')[0]; })();
                     const { data, error: fetchError } = await supabase
                         .from(tableName).select('fecha, totentreg, tottarj')
                         .gte('fecha', start_date).lt('fecha', dayAfterEnd)
                         .order('fecha', { ascending: true });

                    if (fetchError) {
                        console.error(`Error fetching ${tableName}:`, fetchError.message);
                        // Don't set global error here, just return default for this branch
                        // setError(prev => prev ? `${prev}, ${tableName}` : `Error en ${tableName}`);
                        return { totals: new Array(originalDates.length).fill(0), sum: 0 }; // Return default object on error
                    }

                    const dailyTotalsMap = new Map<string, number>();
                    if (data) {
                        data.forEach((row: any) => {
                            let entryDateStr: string | null = null;
                            let fechaValue = row.fecha;
                            // --- Use robust date extraction logic ---
                            if (fechaValue) {
                                if (fechaValue instanceof Date) { try { entryDateStr = fechaValue.toISOString().split('T')[0]; } catch(e) { console.error("Error formatting Date:", fechaValue, e); } }
                                else if (typeof fechaValue === 'string') { try { const d = new Date(fechaValue.replace(' ', 'T') + 'Z'); if (!isNaN(d.getTime())) { entryDateStr = d.toISOString().split('T')[0]; } else if (/^\d{4}-\d{2}-\d{2}$/.test(fechaValue)) { entryDateStr = fechaValue; } } catch (e) { if (/^\d{4}-\d{2}-\d{2}$/.test(fechaValue)) { entryDateStr = fechaValue; } } }
                                else if (typeof fechaValue === 'number') { try { const d = new Date(fechaValue); if (!isNaN(d.getTime())) { entryDateStr = d.toISOString().split('T')[0]; } } catch (e) { console.error("Error formatting Number date:", fechaValue, e); } }
                            }
                             // --- End date extraction ---

                            if (!entryDateStr) { /*...*/ return; }
                            const currentTotal = dailyTotalsMap.get(entryDateStr) || 0;
                            const newTotal = currentTotal + safeParseAndSum(row.totentreg, row.tottarj);
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

                    console.log(`Processing complete for ${tableName}. Sum: ${totalSum.toFixed(2)}`);
                    return { totals: totalsArray, sum: parseFloat(totalSum.toFixed(2)) };
                };

                // 4. Fetch data concurrently
                // Explicitly type the result of Promise.all
                const results: FetchResult[] = await Promise.all([
                    fetchData('CortesMexico'),
                    fetchData('CortesMadero'),
                    fetchData('CortesEcono1'),
                    fetchData('CortesLopezM'),
                    fetchData('CortesEcono2'),
                    fetchData('CortesBaja'),
                    fetchData('CortesLolita')
                ]);

                // 5. Set state for all branches
                // Add checks just in case a promise somehow failed unexpectedly,
                if (results && results.length === 7) {
                    setTotalsMexico(results[0].totals); setSumMexico(results[0].sum);
                    setTotalsMadero(results[1].totals); setSumMadero(results[1].sum);
                    setTotalsEcono1(results[2].totals); setSumEcono1(results[2].sum);
                    setTotalsLopezM(results[3].totals); setSumLopezM(results[3].sum);
                    setTotalsEcono2(results[4].totals); setSumEcono2(results[4].sum);
                    setTotalsBaja(results[5].totals);   setSumBaja(results[5].sum);
                    setTotalsLolita(results[6].totals); setSumLolita(results[6].sum);
                } else {
                     console.error("Promise.all did not return the expected number of results.", results);
                     throw new Error("Error procesando los datos de las sucursales."); // Throw error to be caught below
                }

            } catch (err: any) {
                console.error("Error general:", err);
                setError(err.message || 'Error inesperado.');
                // Clear states
                setDates([]);
                setTotalsMexico([]); setTotalsMadero([]); setTotalsEcono1([]); setTotalsLopezM([]);
                setTotalsEcono2([]); setTotalsBaja([]); setTotalsLolita([]);
                setSumMexico(0); setSumMadero(0); setSumEcono1(0); setSumLopezM(0);
                setSumEcono2(0); setSumBaja(0); setSumLolita(0);
            } finally {
                setIsLoading(false);
            }
        };
        fetchChartData();
    }, []);

    // --- Effect to Render Chart ---
    useEffect(() => {
        // Use original dates length for checks
        const canRenderChart = !isLoading && !error && dates.length > 0;
        const chartElement = document.getElementById('chart-cortes');

        if (canRenderChart && chartElement) {
             // Check data against original dates length
             const dataReady = [
                 totalsMexico, totalsMadero, totalsEcono1, totalsLopezM,
                 totalsEcono2, totalsBaja, totalsLolita
             ].every(arr => arr.length === dates.length);

             if (!dataReady) {
                 console.warn("Chart rendering skipped: Data arrays length mismatch.");
                  chartElement.innerHTML = '<div class="text-center text-gray-500 p-4">Error: Discrepancia en los datos cargados.</div>';
                 return;
             }

            // ***** CREATE SHIFTED DATES FOR DISPLAY *****
            const shiftedDates = dates.map(shiftDateForward);
            console.log("Rendering ApexChart with SHIFTED dates for axis:", shiftedDates);

            const options: ApexCharts.ApexOptions = {
                chart: {
                    type: 'line',
                    height: 400,
                    zoom: { enabled: true },
                    toolbar: { show: true, tools: { download: true, selection: true, zoom: true, zoomin: true, zoomout: true, pan: true, reset: true }, autoSelected: 'zoom' }
                },
                series: [ // Data aligns with ORIGINAL dates order
                    { name: `Mexico (${formatCurrency(sumMexico)})`, data: totalsMexico, color: '#3b82f6' },
                    { name: `Madero (${formatCurrency(sumMadero)})`, data: totalsMadero, color: '#10b981' },
                    { name: `Econo 1 (${formatCurrency(sumEcono1)})`, data: totalsEcono1, color: '#ef4444' },
                    { name: `Lopez M (${formatCurrency(sumLopezM)})`, data: totalsLopezM, color: '#f97316' },
                    { name: `Econo 2 (${formatCurrency(sumEcono2)})`, data: totalsEcono2, color: '#8b5cf6' },
                    { name: `Baja (${formatCurrency(sumBaja)})`, data: totalsBaja, color: '#d946ef' },
                    { name: `Lolita (${formatCurrency(sumLolita)})`, data: totalsLolita, color: '#0891b2' }
                ],
                xaxis: {
                    // ***** Use SHIFTED date strings for categories *****
                    categories: shiftedDates,
                    type: 'datetime',
                    labels: {
                        style: { colors: '#6b7280', fontSize: '12px' },
                        format: 'dd MMM', // Built-in format string
                        datetimeUTC: false, // Display based on local time
                        rotate: -30,
                        rotateAlways: false,
                    },
                    tickAmount: 10, // Optional
                    tooltip: { enabled: true }
                },
                yaxis: {
                    labels: { style: { colors: '#6b7280', fontSize: '12px' }, formatter: (value: number) => formatCurrency(value) },
                    title: { text: 'Total Ventas (Efectivo + Tarjeta)', style: { color: '#6b7280', fontSize: '12px', fontWeight: 500 } }
                },
                grid: { borderColor: '#e5e7eb', strokeDashArray: 4 },
                tooltip: {
                    x: { format: 'dd MMM yyyy' }, // Tooltip header will show the SHIFTED date
                    y: { formatter: (value: number) => formatCurrency(value) },
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
              },ive: [{
                    breakpoint: 768,
                    options: {
                        chart: { height: 300 },
                        legend: { position: 'bottom', horizontalAlign: 'center', fontSize: '12px', itemMargin: { horizontal: 5, vertical: 3 } },
                        yaxis: { title: { text: undefined } }
                    }
                }]
            };

            chartElement.innerHTML = '';
            const chart = new ApexCharts(chartElement, options);
            chart.render();
            return () => { chart.destroy(); };

        } else if (!isLoading && chartElement) {
             chartElement.innerHTML = '';
        }
    // Update dependencies to use original dates state
    }, [isLoading, error, dates, // Use original dates here
        totalsMexico, totalsMadero, totalsEcono1, totalsLopezM, totalsEcono2, totalsBaja, totalsLolita,
        sumMexico, sumMadero, sumEcono1, sumLopezM, sumEcono2, sumBaja, sumLolita
    ]);

    // --- Render Logic ---
    return (
        <div className="card bg-white shadow-lg rounded-lg overflow-hidden border border-gray-200">
            <div className="card-body p-4 sm:p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-1">Evolución de Cortes Diarios</h3>
                <p className="text-sm text-gray-500 mb-4">Suma de Efectivo y Tarjeta por Sucursal</p>

                {/* FIX for JSX syntax */}
                {isLoading && (
                    <div className="flex justify-center items-center py-10" style={{ minHeight: '400px' }}>
                         <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                         <span className="ms-3 text-gray-600">Cargando datos...</span>
                    </div>
                 )}
                 {error && !isLoading && (
                    <div className="alert alert-danger text-center p-4 rounded bg-red-100 border border-red-400 text-red-700" style={{ minHeight: '400px' }}>
                        <strong className="font-bold">Error al cargar el gráfico:</strong>
                        <span className="block sm:inline ml-1">{error}</span>
                    </div>
                 )}
                 {/* Check original dates for empty state */}
                 {!isLoading && !error && dates.length === 0 && (
                     <div className="text-center text-gray-500 py-10" style={{ minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                         No hay datos disponibles para el rango de fechas seleccionado o no se pudo generar el rango.
                     </div>
                 )}

                 <div id="chart-cortes" className="w-full" style={{ minHeight: '400px' }}></div>
            </div>
        </div>
    );
};

export default ChartCortes;
// --- END OF FILE ChartCortes.tsx ---