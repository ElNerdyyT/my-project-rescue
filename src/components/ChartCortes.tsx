import { useState, useEffect } from 'preact/hooks';
import ApexCharts from 'apexcharts';
import { supabase } from '../utils/supabaseClient';

// Función para generar un array de fechas entre start_date y end_date
const generateDateRange = (startDate: string, endDate: string): string[] => {
  const dates: string[] = [];
  // Ensure dates are treated in UTC to avoid timezone issues with date math
  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  let current = start; // Use a separate variable for iteration

  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    // Increment date safely in UTC
    current = new Date(current.setDate(current.getDate() + 1));
  }
  return dates;
};

// Helper function to safely parse and sum numbers
const safeParseAndSum = (val1: any, val2: any): number => {
    const num1 = parseFloat(String(val1).replace(/,/g, '.')) || 0; // Default to 0 if parsing fails
    const num2 = parseFloat(String(val2).replace(/,/g, '.')) || 0;
    // Round the sum to avoid floating point inaccuracies with currency
    return parseFloat((num1 + num2).toFixed(2));
};

const ChartCortes = () => {
  const [dates, setDates] = useState<string[]>([]);
  // State for all 7 branches
  const [totalsMexico, setTotalsMexico] = useState<number[]>([]);
  const [totalsMadero, setTotalsMadero] = useState<number[]>([]);
  const [totalsEcono1, setTotalsEcono1] = useState<number[]>([]);
  const [totalsLopezM, setTotalsLopezM] = useState<number[]>([]);
  const [totalsEcono2, setTotalsEcono2] = useState<number[]>([]);
  const [totalsBaja, setTotalsBaja] = useState<number[]>([]); // Added Baja
  const [totalsLolita, setTotalsLolita] = useState<number[]>([]); // Added Lolita

  // Loading and error state
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    const fetchChartData = async () => {
      setIsLoading(true); // Start loading
      setError(null); // Clear previous errors

      try {
        // Fetch date range first
        const { data: dateRangeData, error: dateRangeError } = await supabase
          .from('date_range') // Assuming this table holds the global date range
          .select('start_date, end_date')
          .single();

        if (dateRangeError || !dateRangeData) {
          throw new Error(dateRangeError?.message || 'No se pudo obtener el rango de fechas.');
        }

        // Generate the full date range for the x-axis
        const allDates = generateDateRange(dateRangeData.start_date, dateRangeData.end_date);
        setDates(allDates);

        // Generic function to fetch and process data for any Cortes table
        const fetchData = async (tableName: string): Promise<number[]> => {
          console.log(`Fetching data for ${tableName}...`); // Log start
          const { data, error } = await supabase
            .from(tableName)
            .select('fecha, totentreg, tottarj') // Only select needed columns
            .gte('fecha', dateRangeData.start_date + ' 00:00:00')
            .lte('fecha', dateRangeData.end_date + ' 23:59:59')
            .order('fecha', { ascending: true });

          if (error) {
            // Log error but don't stop other fetches immediately, return empty array for this branch
            console.error(`Error al obtener datos de ${tableName}:`, error.message);
            setError(prev => prev ? `${prev}, ${tableName}` : `Error en ${tableName}`); // Append to existing errors
            return new Array(allDates.length).fill(0); // Return array of zeros on error
          }
          console.log(`Data received for ${tableName}, processing...`); // Log success

          // Create a map for quick lookup of totals by date
          const dailyTotalsMap = new Map<string, number>();
          if (data) {
            data.forEach((row: any) => {
                const entryDate = row.fecha.split(' ')[0]; // Get date part YYYY-MM-DD
                const currentTotal = dailyTotalsMap.get(entryDate) || 0;
                // Use safeParseAndSum for robust calculation
                const newTotal = currentTotal + safeParseAndSum(row.totentreg, row.tottarj);
                dailyTotalsMap.set(entryDate, parseFloat(newTotal.toFixed(2))); // Store rounded total
            });
          }

          // Map allDates to the totals, filling in 0 for dates with no entries
          const totals = allDates.map(date => dailyTotalsMap.get(date) || 0);
          console.log(`Processing complete for ${tableName}.`); // Log completion
          return totals;
        };

        // Fetch data for all branches concurrently
        const [
            mexicoTotals,
            maderoTotals,
            econo1Totals,
            lopezMTotals,
            econo2Totals,
            bajaTotals,   // Added Baja
            lolitaTotals  // Added Lolita
        ] = await Promise.all([
            fetchData('CortesMexico'),
            fetchData('CortesMadero'),
            fetchData('CortesEcono1'),
            fetchData('CortesLopezM'),
            fetchData('CortesEcono2'),
            fetchData('CortesBaja'),   // Added Baja fetch
            fetchData('CortesLolita')  // Added Lolita fetch
        ]);

        // Set state for all branches
        setTotalsMexico(mexicoTotals);
        setTotalsMadero(maderoTotals);
        setTotalsEcono1(econo1Totals);
        setTotalsLopezM(lopezMTotals);
        setTotalsEcono2(econo2Totals);
        setTotalsBaja(bajaTotals);       // Added Baja state update
        setTotalsLolita(lolitaTotals);   // Added Lolita state update

      } catch (err: any) {
          console.error("Error general en fetchChartData:", err);
          setError(err.message || 'Ocurrió un error inesperado al cargar datos del gráfico.');
          // Optionally clear data states on major error
          setDates([]);
          setTotalsMexico([]);
          setTotalsMadero([]);
          setTotalsEcono1([]);
          setTotalsLopezM([]);
          setTotalsEcono2([]);
          setTotalsBaja([]);
          setTotalsLolita([]);
      } finally {
          setIsLoading(false); // Finish loading regardless of success/error
      }
    };

    fetchChartData();
  }, []); // Empty dependency array means this runs once on mount

  useEffect(() => {
    // Ensure data is loaded, not currently loading, and there are dates before rendering chart
    if (!isLoading && dates.length > 0 && !error) { // Check for !isLoading and !error

        // Ensure all expected totals arrays have the same length as dates
        const dataReady = [
            totalsMexico, totalsMadero, totalsEcono1, totalsLopezM,
            totalsEcono2, totalsBaja, totalsLolita
        ].every(arr => arr.length === dates.length);

        if (!dataReady) {
            console.warn("Chart rendering skipped: Data arrays length mismatch or not ready.");
            // Optionally show a message or different state if data isn't fully aligned
            return;
        }

      console.log("Rendering ApexChart..."); // Log chart render start
      const options: ApexCharts.ApexOptions = { // Use ApexOptions type
        chart: {
          type: 'line',
          height: '100%', // Use 100% for responsiveness within parent container
          zoom: {
            enabled: true // Enable zooming
          },
          toolbar: {
            show: true, // Show toolbar for zoom/pan/download
            tools: {
              download: true,
              selection: true,
              zoom: true,
              zoomin: true,
              zoomout: true,
              pan: true,
              reset: true
            },
            autoSelected: 'zoom'
          }
        },
        series: [ // Add all 7 series
          {
            name: 'Mexico', // Simplified name
            data: totalsMexico,
            color: '#3b82f6' // Blue
          },
          {
            name: 'Madero',
            data: totalsMadero,
            color: '#10b981' // Green
          },
          {
            name: 'Econo 1',
            data: totalsEcono1,
            color: '#ef4444' // Red
          },
          {
            name: 'Lopez M',
            data: totalsLopezM,
            color: '#f97316' // Orange
          },
          {
            name: 'Econo 2',
            data: totalsEcono2,
            color: '#8b5cf6' // Purple
          },
          {
            name: 'Baja', // Added Baja
            data: totalsBaja,
            color: '#d946ef' // Fuchsia/Pink
          },
          {
            name: 'Lolita', // Added Lolita
            data: totalsLolita,
            color: '#0891b2' // Cyan/Teal
          }
        ],
        xaxis: {
          categories: dates,
          type: 'datetime', // Treat categories as dates
          labels: {
            style: {
              colors: '#6b7280', // Tailwind gray-500
              fontSize: '12px'
            },
            datetimeUTC: false, // Display in local time if preferred
          },
          tooltip: {
            enabled: true // Show date in tooltip
          }
        },
        yaxis: {
          labels: {
            style: {
              colors: '#6b7280',
              fontSize: '12px'
            },
            // Format y-axis labels as currency
            formatter: function (value: number) {
              return `$${value.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }
          }
        },
        grid: {
          borderColor: '#e5e7eb', // Tailwind gray-200
          strokeDashArray: 4
        },
        tooltip: {
          x: {
             format: 'dd MMM yyyy' // Format date in tooltip
          },
          y: {
            // Format tooltip value as currency
            formatter: function (value: number) {
              return `$${value.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }
          },
          shared: true, // Show all series values on hover
          intersect: false // Tooltip appears even if not directly hovering over line/marker
        },
        stroke: {
          curve: 'smooth', // Smoother lines
          width: 2 // Line width
        },
        markers: {
            size: 0, // Hide markers by default
            hover: {
                size: 5 // Show marker on hover
            }
        },
        legend: {
            position: 'top',
            horizontalAlign: 'left',
            fontSize: '14px',
            markers: {
            },
            itemMargin: {
                horizontal: 10,
                vertical: 5
            }
        },
        responsive: [{ // Responsive adjustments
          breakpoint: 768, // Medium screens and below
          options: {
            chart: {
              height: 300 // Smaller height
            },
            xaxis: {
              labels: {
                // rotate: -45, // Optionally rotate labels on smaller screens if needed
                // rotateAlways: false
              }
            },
            legend: {
                position: 'bottom',
                horizontalAlign: 'center'
            }
          }
        }]
      };

      const chartElement = document.getElementById('chart-cortes');
      if (chartElement) { // Ensure element exists
        const chart = new ApexCharts(chartElement, options);
        chart.render();

        // Cleanup function to destroy chart instance on component unmount or re-render
        return () => {
          console.log("Destroying ApexChart..."); // Log chart destroy
          chart.destroy();
        };
      } else {
          console.error("Chart element #chart-cortes not found");
      }
    } else {
        console.log("Chart rendering skipped: Loading or no dates/error present."); // Log skip reason
        // Optional: Clear previous chart if loading/error occurs after initial render
        const chartElement = document.getElementById('chart-cortes');
        if (chartElement) {
            chartElement.innerHTML = ''; // Clear previous chart drawing
        }
    }
    // Dependencies for the chart rendering effect
  }, [isLoading, error, dates, totalsMexico, totalsMadero, totalsEcono1, totalsLopezM, totalsEcono2, totalsBaja, totalsLolita]);

  return (
    <div className="card bg-white shadow-sm rounded-lg overflow-hidden">
      <div className="card-body p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Evolución de Cortes Diarios (Efectivo + Tarjeta)</h3>
        {isLoading && (
            <div className="flex justify-center items-center" style={{ minHeight: '350px' }}>
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Cargando datos del gráfico...</span>
                </div>
                <span className="ms-2 text-muted">Cargando datos...</span>
            </div>
        )}
        {error && !isLoading && (
            <div className="alert alert-danger text-center" style={{ minHeight: '350px' }}>
                <strong>Error al cargar el gráfico:</strong> {error}
            </div>
        )}
        {!isLoading && !error && dates.length === 0 && (
             <div className="text-center text-gray-500" style={{ minHeight: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 No hay datos disponibles para el rango seleccionado.
             </div>
        )}
        {/* Chart container will be populated by ApexCharts */}
        <div id="chart-cortes" className="w-full" style={{ minHeight: '350px' }}></div>
      </div>
    </div>
  );
};

export default ChartCortes;