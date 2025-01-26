import { useState, useEffect } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';

// Definir una interfaz para los datos que esperamos
interface DashboardData {
  costo_total: string;
  descuento_total: string;
  precio_total: string;
  utilidad_total: string;
}

interface GetDashboardDataParams {
  start_date: string;
  end_date: string;
}

interface DashboardState {
  Costo: number;
  Precio: number;
  Descuento: number;
  Utilidad: number;
  isLoading: boolean;
  error: string | null;
}

const Dashboard = () => {
const [data, setData] = useState<DashboardState>({
    Costo: 0,
    Precio: 0,
    Descuento: 0,
    Utilidad: 0,
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
          .rpc('get_dashboard_data', {
            start_date: formattedStartDate,
            end_date: formattedEndDate
          })
          .returns<DashboardData[]>();

        if (error) throw error;

        if (!result || result.length === 0) {
          throw new Error('No se encontraron datos para el rango de fechas especificado');
        }

        const { costo_total, descuento_total, precio_total, utilidad_total } = result[0];

        setData({
          Costo: parseFloat(costo_total),
          Precio: parseFloat(precio_total),
          Descuento: parseFloat(descuento_total),
          Utilidad: parseFloat(utilidad_total),
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
                <div className="subheader">Costo Total</div>
                <div className="h1 mb-3">${data.Costo.toFixed(2)}</div>
              </div>
            </div>
          </div>

        <div className="col-sm-6 col-lg-3">
          <div className="card">
            <div className="card-body">
              <div className="subheader">Precio Total</div>
              <div className="h1 mb-3">${data.Precio.toFixed(2)}</div>
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-lg-3">
          <div className="card">
            <div className="card-body">
              <div className="subheader">Descuento Total</div>
              <div className="h1 mb-3">${data.Descuento.toFixed(2)}</div>
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-lg-3">
          <div className="card">
            <div className="card-body">
              <div className="subheader">Utilidad Total</div>
              <div className="h1 mb-3">${data.Utilidad.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

export default Dashboard;
