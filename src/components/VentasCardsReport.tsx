import { useState, useEffect } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';

// Interfaz para los datos de la tabla KardexMexico
interface VentaData {
  articulo: string; // Este campo no se usa, pero se incluye si está en la tabla
  cantidad: string; // Los valores vienen como texto desde la base de datos
  costo: string;
  dscto: string;
  ppub: string;
}

// Interfaz para el estado del dashboard
interface DashboardState {
  ProductosVendidos: number;
  CostoTotal: number;
  PrecioPublico: number;
  DescuentoFinal: number;
  PrecioFinal: number;
  isLoading: boolean;
  error: string | null;
}

const Dashboard = () => {
  const [data, setData] = useState<DashboardState>({
    ProductosVendidos: 0,
    CostoTotal: 0,
    PrecioPublico: 0,
    DescuentoFinal: 0,
    PrecioFinal: 0,
    isLoading: false,
    error: null,
  });

  const [startDate, setStartDate] = useState<string>(''); // Fecha de inicio
  const [endDate, setEndDate] = useState<string>('');     // Fecha de fin

  // Obtener el rango de fechas al cargar el componente
  useEffect(() => {
    const fetchDateRange = async () => {
      try {
        const { data, error } = await supabase
          .from('date_range')
          .select('start_date, end_date')
          .single();

        if (error) throw error;

        if (!data) {
          throw new Error('No se encontró el rango de fechas');
        }

        const start = new Date(data.start_date);
        const end = new Date(data.end_date);
        

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          throw new Error('Fechas inválidas en la base de datos');
        }

        setStartDate(data.start_date);
        setEndDate(data.end_date);
      } catch (error) {
        setData((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Error desconocido',
        }));
        console.error('Error al obtener el rango de fechas:', error);
      }
    };

    fetchDateRange();
  }, []);

  // Obtener datos basados en el rango de fechas
  useEffect(() => {
    if (!startDate || !endDate) return;

    const fetchData = async () => {
      setData((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const formattedStartDate = new Date(startDate).toISOString().split('T').join(' ').split('.')[0];
        const formattedEndDate = new Date(endDate).toISOString().split('T').join(' ').split('.')[0];

        // Tipar correctamente el resultado con VentaData[]
        const { data: result, error } = await supabase
          .from('KardexEcono2')
          .select('cantidad, costo, ppub, dscto')
          .eq('movto', 1)
          .gte('fecha', formattedStartDate)
          .lte('fecha', formattedEndDate)
          .returns<VentaData[]>(); // Usar VentaData aquí

        if (error) throw error;

        if (!result || result.length === 0) {
          console.log('Rango de fechas:', formattedStartDate, 'a', formattedEndDate);
          throw new Error('No se encontraron datos para el rango de fechas especificado');
        }

        // Convertir valores a números y realizar cálculos
        const parsedData = result.map((item) => ({
          cantidad: parseFloat(item.cantidad) || 0,
          costo: parseFloat(item.costo) || 0,
          dscto: parseFloat(item.dscto) || 0,
          ppub: parseFloat(item.ppub) || 0,
        }));

        const productosVendidos = parsedData.reduce((sum, item) => sum + item.cantidad, 0);
        const costoTotal = parsedData.reduce((sum, item) => sum + item.cantidad * item.costo, 0);
        const precioPublico = parsedData.reduce((sum, item) => sum + item.cantidad * item.ppub, 0);
        const descuentoFinal = parsedData.reduce((sum, item) => sum + item.dscto, 0);
        const precioFinal = precioPublico - descuentoFinal - costoTotal;

        setData({
          ProductosVendidos: productosVendidos,
          CostoTotal: costoTotal,
          PrecioPublico: precioPublico,
          DescuentoFinal: descuentoFinal,
          PrecioFinal: precioFinal,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        setData((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Error desconocido',
        }));
        console.error('Error al obtener los datos:', error);
      }
    };

    fetchData();
  }, [startDate, endDate]);

  return (
    <div className="container-xl">
      {data.error && (
        <div className="alert alert-danger">
          Error: {data.error}
        </div>
      )}

      {data.isLoading ? (
        <div className="d-flex justify-content-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      ) : (
        <div className="row row-deck row-cards">
          <div className="col-sm-6 col-lg-3">
            <div className="card">
              <div className="card-body">
                <div className="subheader">Productos Vendidos</div>
                <div className="h1 mb-3">{data.ProductosVendidos}</div>
              </div>
            </div>
          </div>

          <div className="col-sm-6 col-lg-3">
            <div className="card">
              <div className="card-body">
                <div className="subheader">Costo Total</div>
                <div className="h1 mb-3"> ${data.CostoTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
            </div>
          </div>

          <div className="col-sm-6 col-lg-3">
            <div className="card">
              <div className="card-body">
                <div className="subheader">Precio Público</div>
                <div className="h1 mb-3"> ${data.PrecioPublico.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
            </div>
          </div>

          <div className="col-sm-6 col-lg-3">
            <div className="card">
              <div className="card-body">
                <div className="subheader">Descuento Final</div>
                <div className="h1 mb-3"> ${data.DescuentoFinal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
            </div>
          </div>

          <div className="col-sm-6 col-lg-3">
            <div className="card">
              <div className="card-body">
              <div className="subheader text" style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Utilidad</div>
                <div className="h1 mb-3 text-success" style={{ fontSize: '2rem' }}> ${data.PrecioFinal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
