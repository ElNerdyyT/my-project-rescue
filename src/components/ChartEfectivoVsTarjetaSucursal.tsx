// --- START OF FILE src/components/ChartEfectivoVsTarjetaSucursal.tsx ---

import { useState, useEffect } from 'preact/hooks';
import ApexCharts from 'apexcharts';
import { supabase } from '../utils/supabaseClient';

// --- Helper Functions ---

// Helper function to safely parse numbers (ensure it handles potential decimals correctly)
const safeParse = (val: any): number => {
    const str = String(val ?? '0');
    // Replace comma decimal separators if necessary, then parse
    const num = parseFloat(str.replace(/,/g, '.')) || 0;
    // Return as number, potentially with decimals
    return num;
};

// Helper function to format numbers as Mexican Peso currency
const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) return '$0.00';
    const absValue = Math.abs(value);
    const formatted = absValue.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return value < 0 ? `-$${formatted}` : `$${formatted}`;
};

// Define Branch names and corresponding table names (can be shared or redefined)
const branches = [
    { name: 'Mexico', table: 'CortesMexico', colorEfectivo: '#3b82f6', colorTarjeta: '#60a5fa' }, // Lighter shade for Tarjeta
    { name: 'Madero', table: 'CortesMadero', colorEfectivo: '#10b981', colorTarjeta: '#34d399' },
    { name: 'Econo 1', table: 'CortesEcono1', colorEfectivo: '#ef4444', colorTarjeta: '#f87171' },
    { name: 'Lopez M', table: 'CortesLopezM', colorEfectivo: '#f97316', colorTarjeta: '#fb923c' },
    { name: 'Econo 2', table: 'CortesEcono2', colorEfectivo: '#8b5cf6', colorTarjeta: '#a78bfa' },
    { name: 'Baja', table: 'CortesBaja', colorEfectivo: '#d946ef', colorTarjeta: '#e879f9' },
    { name: 'Lolita', table: 'CortesLolita', colorEfectivo: '#0891b2', colorTarjeta: '#22d3ee' }
];

// --- Component ---
const ChartEfectivoVsTarjetaSucursal = () => {
    // State for branch sums
    const [sumsEfectivo, setSumsEfectivo] = useState<Record<string, number>>({});
    const [sumsTarjeta, setSumsTarjeta] = useState<Record<string, number>>({});
    const [branchNames, setBranchNames] = useState<string[]>([]);

    // Loading and error state
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const chartId = "chart-efectivo-vs-tarjeta-sucursal"; // Unique ID

    useEffect(() => {
        const fetchChartData = async () => {
            setIsLoading(true); setError(null);
            // Reset
            setSumsEfectivo({});
            setSumsTarjeta({});
            setBranchNames(branches.map(b => b.name)); // Set branch names immediately

            try {
                // 1. Fetch date range (needed to filter the sums)
                const { data: dateRangeData, error: dateRangeError } = await supabase.from('date_range').select('start_date, end_date').single();
                if (dateRangeError || !dateRangeData || !dateRangeData.start_date || !dateRangeData.end_date) {
                    throw new Error(dateRangeError?.message || 'No se pudo obtener el rango de fechas válido.');
                }
                const { start_date, end_date } = dateRangeData;
                console.log(`[${chartId}] Fetched date range: ${start_date} to ${end_date}`);

                // 2. Generic function to fetch and sum data for a branch
                type FetchSumResult = { sumEfectivo: number, sumTarjeta: number };

                const fetchAndSumData = async (tableName: string, branchName: string): Promise<FetchSumResult> => {
                    console.log(`[${chartId}] Fetching sums for ${tableName} (${branchName})...`);
                    // Define the day *after* the end date for Supabase '<' operator
                     const dayAfterEnd = (() => { const d=new Date(end_date+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+1); return d.toISOString().split('T')[0]; })();

                    const { data, error: fetchError } = await supabase
                        .from(tableName)
                        .select('totentreg, tottarj') // Select only needed columns
                        .gte('fecha', start_date)
                        .lt('fecha', dayAfterEnd); // Use '<' with day after end date

                    if (fetchError) {
                        console.error(`[${chartId}] Error fetching sums for ${tableName}:`, fetchError.message);
                        // Return zero sums on error for this branch
                        return { sumEfectivo: 0, sumTarjeta: 0 };
                    }

                    let totalEfectivo = 0;
                    let totalTarjeta = 0;

                    if (data) {
                        data.forEach((row: any) => {
                            totalEfectivo += safeParse(row.totentreg);
                            totalTarjeta += safeParse(row.tottarj);
                        });
                    }

                    // Round sums to 2 decimal places
                    totalEfectivo = parseFloat(totalEfectivo.toFixed(2));
                    totalTarjeta = parseFloat(totalTarjeta.toFixed(2));

                    console.log(`[${chartId}] Sums for ${tableName} (${branchName}): Efectivo=${totalEfectivo}, Tarjeta=${totalTarjeta}`);
                    return { sumEfectivo: totalEfectivo, sumTarjeta: totalTarjeta };
                };

                // 3. Fetch sums concurrently for all branches
                const promises = branches.map(branch => fetchAndSumData(branch.table, branch.name));
                const results: FetchSumResult[] = await Promise.all(promises);

                // 4. Set state using maps
                if (results && results.length === branches.length) {
                    const newSumsEfectivo: Record<string, number> = {};
                    const newSumsTarjeta: Record<string, number> = {};
                    branches.forEach((branch, index) => {
                        newSumsEfectivo[branch.name] = results[index].sumEfectivo;
                        newSumsTarjeta[branch.name] = results[index].sumTarjeta;
                    });
                    setSumsEfectivo(newSumsEfectivo);
                    setSumsTarjeta(newSumsTarjeta);
                } else {
                    console.error(`[${chartId}] Promise.all did not return the expected number of results.`, results);
                    throw new Error("Error procesando los datos de las sucursales.");
                }

            } catch (err: any) {
                console.error(`[${chartId}] Error general:`, err);
                setError(err.message || 'Error inesperado.');
                // Clear states
                setSumsEfectivo({});
                setSumsTarjeta({});
            } finally {
                setIsLoading(false);
            }
        };
        fetchChartData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Fetch only once on mount

    // --- Effect to Render Chart ---
    useEffect(() => {
        // Check if we have sums for all expected branches
        const canRenderChart = !isLoading && !error &&
                               Object.keys(sumsEfectivo).length === branches.length &&
                               Object.keys(sumsTarjeta).length === branches.length;

        const chartElement = document.getElementById(chartId);

        if (canRenderChart && chartElement) {
            // Prepare data arrays in the order of branchNames
            const dataEfectivo = branchNames.map(name => sumsEfectivo[name] || 0);
            const dataTarjeta = branchNames.map(name => sumsTarjeta[name] || 0);

            const options: ApexCharts.ApexOptions = {
                chart: {
                    type: 'bar',
                    height: 400,
                    stacked: true, // Key option for stacking
                    toolbar: { show: true },
                    zoom: { enabled: false } // Zoom not very useful on bar charts usually
                },
                series: [
                    {
                        name: 'Efectivo',
                        data: dataEfectivo,
                        color: '#3b82f6' // Example base color for cash
                    },
                    {
                        name: 'Tarjeta',
                        data: dataTarjeta,
                        color: '#60a5fa' // Example slightly lighter color for card
                    }
                ],
                plotOptions: {
                    bar: {
                        horizontal: false, // Vertical bars
                        columnWidth: '60%', // Adjust width as needed
                        // dataLabels: { // Optional: Show labels on bars
                        //     total: {
                        //         enabled: true,
                        //         style: {
                        //             fontSize: '13px',
                        //             fontWeight: 600,
                        //             color: '#373d3f'
                        //         },
                        //          formatter: (val: number) => formatCurrency(val) // Format total label
                        //     }
                        // }
                    },
                },
                dataLabels: { // Optional: Show labels within each segment
                    enabled: false, // Often too cluttered on stacked bars
                    // formatter: (val: number) => formatCurrency(val),
                    // style: {
                    //     colors: ['#fff'] // White text might work depending on bar colors
                    // },
                    // offsetY: -20 // Adjust position if needed
                },
                xaxis: {
                    categories: branchNames, // Branches on the X-axis
                    labels: {
                        style: { colors: '#6b7280', fontSize: '12px' },
                        rotate: -30, // Rotate if names are long
                         rotateAlways: false,
                    }
                },
                yaxis: {
                    title: {
                        text: 'Total Ventas (Efectivo + Tarjeta)',
                        style: { color: '#6b7280', fontSize: '12px', fontWeight: 500 }
                    },
                    labels: {
                        style: { colors: '#6b7280', fontSize: '12px' },
                        formatter: (value: number) => formatCurrency(value) // Format Y-axis labels
                    }
                },
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
                tooltip: {
                    y: {
                        formatter: (value: number) => formatCurrency(value) // Format tooltip values
                    },
                    // Optional: Customize tooltip title or shared behavior if needed
                },
                grid: {
                    borderColor: '#e5e7eb',
                    row: { colors: ['#f3f4f6', 'transparent'], opacity: 0.5 } // Subtle row stripes
                },
                responsive: [{
                    breakpoint: 768, // Example breakpoint
                    options: {
                        chart: { height: 350 },
                         plotOptions: { bar: { columnWidth: '80%' } },
                        xaxis: { labels: { rotate: -45 } }, // Rotate more on smaller screens
                        legend: { position: 'bottom', horizontalAlign: 'center' }
                    }
                }, {
                    breakpoint: 480, // Example smaller breakpoint
                    options: {
                        chart: { height: 300 },
                         plotOptions: { bar: { horizontal: true, dataLabels: { total: { enabled: false } } } }, // Switch to horizontal bars?
                         xaxis: { labels: { rotate: 0 } }, // No rotation if horizontal
                         yaxis: { title: { text: undefined } } // Remove axis title if horizontal
                    }
                }]
            };

            chartElement.innerHTML = ''; // Clear previous content
            const chart = new ApexCharts(chartElement, options);
            chart.render();

            return () => { // Cleanup function
                chart.destroy();
            };

        } else if (!isLoading && chartElement) {
             // Ensure chart area is cleared if not loading but cannot render
             chartElement.innerHTML = '';
        }
    // Dependencies: Re-render if loading/error state changes, or if sum data updates
    }, [isLoading, error, sumsEfectivo, sumsTarjeta, branchNames]);

    // --- Render Logic ---
    return (
        <div className="card bg-white shadow-lg rounded-lg overflow-hidden border border-gray-200">
            <div className="card-body p-4 sm:p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-1">Comparativa Efectivo vs. Tarjeta por Sucursal</h3>
                <p className="text-sm text-gray-500 mb-4">Total acumulado en el periodo seleccionado</p>

                {isLoading && (
                    <div className="flex justify-center items-center py-10" style={{ minHeight: '400px' }}>
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                        <span className="ms-3 text-gray-600">Cargando datos...</span>
                    </div>
                )}
                {error && !isLoading && (
                    <div className="alert alert-danger text-center p-4 rounded bg-red-100 border border-red-400 text-red-700" style={{ minHeight: '400px' }}>
                        <strong className="font-bold">Error al cargar el gráfico comparativo:</strong>
                        <span className="block sm:inline ml-1">{error}</span>
                    </div>
                )}
                {!isLoading && !error && Object.keys(sumsEfectivo).length === 0 && (
                     <div className="text-center text-gray-500 py-10" style={{ minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                         No hay datos de sumas disponibles para el rango de fechas.
                     </div>
                 )}

                {/* Container for the chart */}
                <div id={chartId} className="w-full" style={{ minHeight: '400px' }}>
                   {/* Placeholder shown while loading/error handled above */}
                   {/* ApexCharts renders here */}
                </div>
            </div>
        </div>
    );
};

export default ChartEfectivoVsTarjetaSucursal;

// --- END OF FILE src/components/ChartEfectivoVsTarjetaSucursal.tsx ---