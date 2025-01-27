import { useState, useEffect } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';

// Definir una interfaz para los datos que esperamos
interface VentaData {
  articulo: string;
  cantidad: number;
  costo: number;
  dscto: number;
  ppub: number;
}

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
    error: null
  });

  const [startDate, setStartDate] = useState<string>('');  // Fecha de inicio
  const [endDate, setEndDate] = useState<string>('');      // Fecha de fin

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

        // Validar que las fechas sean válidas
        const start = new Date(data.start_date);
        const end = new Date(data.end_date);
        
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          throw new Error('Fechas inválidas en la base de datos');
        }

        setStartDate(data.start_date);
        setEndDate(data.end_date);
      } catch (error) {
        setData(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Error desconocido'
        }));
        console.error('Error al obtener el rango de fechas:', error);
      }
    };

    fetchDateRange();
  }, []);

  useEffect(() => {
    if (!startDate || !endDate) return;

    const fetchData = async () => {
      setData(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        const formattedStartDate = new Date(startDate).toISOString();
        const formattedEndDate = new Date(endDate).toISOString();

        const { data: result, error } = await supabase
          .from('KardexMexico')
          .select('cantidad, costo, ppub')
          .eq('movto', '1')  // Filtrar solo ventas de caja
          .gte('fecha', formattedStartDate)
          .lte('fecha', formattedEndDate)
          .returns<VentaData[]>();

        if (error) throw error;

        if (!result) {
          throw new Error('No se encontraron datos para el rango de fechas especificado');
        }

        // Calcular los totales
        const productosVendidos = result.reduce((sum, item) => sum + item.cantidad, 0);
        const costoTotal = result.reduce((sum, item) => sum + (item.cantidad * item.costo), 0);
        const precioPublico = result.reduce((sum, item) => sum + (item.cantidad * item.ppub), 0);
        const descuentoFinnal = result.reduce((sum, item) => sum + (item.cantidad * item.dscto), 0);
        const precioFinal = precioPublico - descuentoFinnal;

        setData({
          ProductosVendidos: productosVendidos,
          CostoTotal: costoTotal,
          PrecioPublico: precioPublico,
          DescuentoFinal: descuentoFinnal,
          PrecioFinal: precioFinal,
          isLoading: false,
          error: null
        });

      } catch (error) {
        setData(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Error desconocido'
        }));
        console.error('Error al obtener datos:', error);
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
                <div className="h1 mb-3">${data.CostoTotal.toFixed(2)}</div>
              </div>
            </div>
          </div>

          <div className="col-sm-6 col-lg-3">
            <div className="card">
              <div className="card-body">
                <div className="subheader">Precio Público</div>
                <div className="h1 mb-3">${data.PrecioPublico.toFixed(2)}</div>
              </div>
            </div>
          </div>

          <div className="col-sm-6 col-lg-3">
            <div className="card">
              <div className="card-body">
                <div className="subheader">Descuento Final</div>
                <div className="h1 mb-3">${data.DescuentoFinal.toFixed(2)}</div>
              </div>
            </div>
          </div>

          <div className="col-sm-6 col-lg-3">
            <div className="card">
              <div className="card-body">
                <div className="subheader">Precio Final</div>
                <div className="h1 mb-3">${data.PrecioFinal.toFixed(2)}</div>
              </div>
            </div>
          </div>
      </div>
      )}
    </div>
  );
};

export default Dashboard;
