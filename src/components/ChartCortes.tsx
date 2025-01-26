import { useState, useEffect } from 'preact/hooks';
import ApexCharts from 'apexcharts';
import { supabase } from '../utils/supabaseClient';

// Función para generar un array de fechas entre start_date y end_date
const generateDateRange = (startDate: string, endDate: string): string[] => {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  while (start <= end) {
    dates.push(start.toISOString().split('T')[0]);
    start.setDate(start.getDate() + 1);
  }
  return dates;
};

const ChartCortes = () => {
  const [dates, setDates] = useState<string[]>([]);
  const [totalsMexico, setTotalsMexico] = useState<number[]>([]);
  const [totalsMadero, setTotalsMadero] = useState<number[]>([]);
  const [totalsEcono1, setTotalsEcono1] = useState<number[]>([]);

  useEffect(() => {
    const fetchChartData = async () => {
      const { data: dateRangeData, error: dateRangeError } = await supabase
        .from('date_range')
        .select('start_date, end_date')
        .single();

      if (dateRangeError) {
        console.error('Error al obtener el rango de fechas:', dateRangeError.message);
        return;
      }

      const allDates = generateDateRange(dateRangeData.start_date, dateRangeData.end_date);
      setDates(allDates);

      const fetchData = async (tableName: string) => {
        const { data, error } = await supabase
          .from(tableName)
          .select('fecha, totentreg, tottarj')
          .gte('fecha', dateRangeData.start_date + ' 00:00:00')
          .lte('fecha', dateRangeData.end_date + ' 23:59:59')
          .order('fecha', { ascending: true });
      
        if (error) {
          console.error(`Error al obtener datos de ${tableName}:`, error.message);
          return [];
        }
      
        const totals = allDates.map((date) => {
          const entriesForDate = data.filter((row: any) => row.fecha.split(' ')[0] === date);
          if (entriesForDate.length === 0) return 0;
      
          const totalForDate = entriesForDate.reduce((sum: number, entry: any) => {
            const totentreg = parseFloat(parseFloat(entry.totentreg).toFixed(2));
            const tottarj = parseFloat(parseFloat(entry.tottarj).toFixed(2));
            return sum + totentreg + tottarj;
          }, 0);
      
          return totalForDate;
        });
      
        return totals;
      };

      const mexicoTotals = await fetchData('CortesMexico');
      const maderoTotals = await fetchData('CortesMadero');
      const econo1Totals = await fetchData('CortesEcono1');

      setTotalsMexico(mexicoTotals);
      setTotalsMadero(maderoTotals);
      setTotalsEcono1(econo1Totals);
    };

    fetchChartData();
  }, []);

  useEffect(() => {
    if (dates.length > 0 && totalsMexico.length > 0 && totalsMadero.length > 0 && totalsEcono1.length > 0) {
      const options = {
        chart: {
          type: 'line',
          height: '100%',
          toolbar: {
            show: true,
            tools: {
              download: true,
              selection: true,
              zoom: true,
              zoomin: true,
              zoomout: true,
              pan: true,
              reset: true
            }
          }
        },
        series: [
          {
            name: 'Cortes Mexico',
            data: totalsMexico,
            color: '#3b82f6' // Azul
          },
          {
            name: 'Cortes Madero',
            data: totalsMadero,
            color: '#10b981' // Verde
          },
          {
            name: 'Cortes Econo1',
            data: totalsEcono1,
            color: '#ef4444' // Rojo
          }
        ],
        xaxis: {
          categories: dates,
          labels: {
            style: {
              colors: '#6b7280',
              fontSize: '12px'
            }
          }
        },
        yaxis: {
          labels: {
            style: {
              colors: '#6b7280',
              fontSize: '12px'
            },
            formatter: function (value: number) {
              return `$${value.toFixed(2)}`;
            }
          }
        },
        grid: {
          borderColor: '#e5e7eb',
          strokeDashArray: 4
        },
        tooltip: {
          y: {
            formatter: function (value: number) {
              return `$${value.toFixed(2)}`;
            }
          }
        },
        responsive: [{
          breakpoint: 640,
          options: {
            chart: {
              height: 300
            },
            xaxis: {
              labels: {
                rotate: -45
              }
            }
          }
        }]
      };

      const chart = new ApexCharts(document.getElementById('chart-cortes'), options);
      chart.render();

      return () => chart.destroy();
    }
  }, [dates, totalsMexico, totalsMadero, totalsEcono1]);

  return (
    <div className="card bg-white shadow-sm rounded-lg overflow-hidden">
      <div className="card-body p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Evolución de Cortes</h3>
        <div id="chart-cortes" className="w-full" style={{ minHeight: '350px' }}></div>
      </div>
    </div>
  );
};

export default ChartCortes;
