import { useState, useEffect } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';
import '../css/CardsCortes.css';

interface KardexRow {
  cantidad: number;
  costo: number;
  ppub: number;
  movto: string;
}

const VentasCards = () => {
  const [data, setData] = useState({
    productosVendidos: 0,
    costoTotal: 0,
    precioPublico: 0,
    precioFinal: 0
  });

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    const fetchDateRange = async () => {
      const { data, error } = await supabase
        .from('date_range')
        .select('start_date, end_date')
        .single();

      if (error) {
        console.error('Error al obtener el rango de fechas:', error.message);
        return;
      }

      if (data) {
        setStartDate(data.start_date);
        setEndDate(data.end_date);
      }
    };

    fetchDateRange();
  }, []);

  useEffect(() => {
    if (!startDate || !endDate) return;

    const fetchData = async () => {
      const formattedStartDate = new Date(startDate).toISOString().split('T').join(' ').split('.')[0];
      const formattedEndDate = new Date(endDate).toISOString().split('T').join(' ').split('.')[0];

      const { data: kardexData, error } = await supabase
        .from('KardexMexico')
        .select('cantidad, costo, ppub, movto')
        .gte('fecha', formattedStartDate)
        .lte('fecha', formattedEndDate)
        .eq('movto', '1'); // Filtrar solo ventas de caja

      if (error) {
        console.error('Error fetching Kardex data:', error.message);
        return;
      }

      if (kardexData) {
        const ventasData = kardexData as KardexRow[];
        
        const productosVendidos = ventasData.reduce((sum, row) => sum + row.cantidad, 0);
        const costoTotal = ventasData.reduce((sum, row) => sum + (row.cantidad * row.costo), 0);
        const precioPublico = ventasData.reduce((sum, row) => sum + (row.cantidad * row.ppub), 0);
        const precioFinal = precioPublico - costoTotal;

        setData({
          productosVendidos: parseFloat(productosVendidos.toFixed(2)),
          costoTotal: parseFloat(costoTotal.toFixed(2)),
          precioPublico: parseFloat(precioPublico.toFixed(2)),
          precioFinal: parseFloat(precioFinal.toFixed(2))
        });
      }
    };

    fetchData();
  }, [startDate, endDate]);

  const Card = ({ title, value, isCurrency }: { 
    title: string,
    value: number,
    isCurrency: boolean
  }) => {
    const icons = {
      "Productos Vendidos": "shopping_cart",
      "Costo": "attach_money",
      "Precio Público": "price_check",
      "Precio Final": "calculate"
    };

    return (
      <div className="responsive-card">
        <span className="material-icons card-icon">
          {icons[title as keyof typeof icons]}
        </span>
        <div className="card-content">
          <h3 className="card-title">{title}</h3>
          <p className="card-value">
            {isCurrency ? `$${value.toLocaleString('es-MX')}` : value}
          </p>
        </div>
      </div>
    );
  };

  const cardsConfig = [
    { title: "Productos Vendidos", value: data.productosVendidos, isCurrency: false },
    { title: "Costo", value: data.costoTotal, isCurrency: true },
    { title: "Precio Público", value: data.precioPublico, isCurrency: true },
    { title: "Precio Final", value: data.precioFinal, isCurrency: true }
  ];

  return (
    <div className="cards-container">
      {cardsConfig.map((card, index) => (
        <Card
          key={index}
          title={card.title}
          value={card.value}
          isCurrency={card.isCurrency}
        />
      ))}
    </div>
  );
};

export default VentasCards;
