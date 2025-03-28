import { useState, useEffect } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';
import '../css/CardsCortes.css';

interface Props {
  selectedSucursal: string;
  sucursales: string[];
}

const CardsCortes = ({ selectedSucursal, sucursales }: Props) => {
  const [data, setData] = useState({
    registros: 0,
    sumaTotEntreg: 0,
    sumaTotTarj: 0,
    sumaTot: 0,
    faltan: 0,
    sobran: 0,
    gas: 0,
    com: 0,
    val: 0,
    totret: 0,
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

      const fetchTableData = async (tableName: string) => {
        const { data, error } = await supabase
          .from(tableName)
          .select('totentreg, tottarj, faltan, sobran, gas, com, val, totret, fecha')
          .gte('fecha', formattedStartDate)
          .lte('fecha', formattedEndDate);

        if (error) return [];
        return data;
      };

      let combinedData = [];
      
      if (selectedSucursal === 'General') {
        const sucursalesToFetch = sucursales.filter(s => s !== 'General');
        const dataPromises = sucursalesToFetch.map(sucursal => fetchTableData(sucursal));
        const allData = await Promise.all(dataPromises);
        combinedData = allData.flat();
      } else {
        const dataSucursal = await fetchTableData(selectedSucursal);
        combinedData = dataSucursal;
      }

      interface RowData {
        totentreg: string;
        tottarj: string;
        faltan: string;
        sobran: string;
        gas: string;
        com: string;
        val: string;
        totret: string;
        fecha: string;
      }

      const calculateSum = (key: keyof RowData) => 
        parseFloat(combinedData.reduce((acc, row: RowData) => acc + parseFloat(row[key]) || 0, 0).toFixed(2));

      setData({
        registros: combinedData.length,
        sumaTotEntreg: calculateSum('totentreg'),
        sumaTotTarj: calculateSum('tottarj'),
        sumaTot: calculateSum('totentreg') + calculateSum('tottarj'),
        faltan: calculateSum('faltan'),
        sobran: calculateSum('sobran'),
        gas: calculateSum('gas'),
        com: calculateSum('com'),
        val: calculateSum('val'),
        totret: calculateSum('totret'),
      });
    };

    fetchData();
  }, [startDate, endDate, selectedSucursal]);

  const Card = ({ title, value, isCurrency, isNegative }: { 
    title: string,
    value: number,
    isCurrency: boolean,
    isNegative?: boolean 
  }) => {
    const icons = {
      "Registros": "assignment",
      "Total Efectivo": "payments",
      "Total Tarjeta": "credit_card",
      "Suma Total": "calculate",
      "Faltan": "remove_circle",
      "Sobran": "add_circle",
      "Gastos": "receipt_long",
      "Compras": "shopping_cart"
    };

    return (
      <div className="responsive-card">
        <span className="material-icons card-icon">
          {icons[title as keyof typeof icons]}
        </span>
        <div className="card-content">
          <h3 className="card-title">{title}</h3>
          <p className="card-value" style={{ color: isNegative ? '#DC3545' : '#3b82f6' }}>
            {isCurrency ? `$${value.toLocaleString('es-MX')}` : value}
          </p>
        </div>
      </div>
    );
  };

  const cardsConfig = [
    { title: "Registros", value: data.registros, isCurrency: false },
    { title: "Total Efectivo", value: data.sumaTotEntreg, isCurrency: true },
    { title: "Total Tarjeta", value: data.sumaTotTarj, isCurrency: true },
    { title: "Suma Total", value: data.sumaTot, isCurrency: true },
    { title: "Faltan", value: data.faltan, isCurrency: true, isNegative: true },
    { title: "Sobran", value: data.sobran, isCurrency: true },
    { title: "Gastos", value: data.gas, isCurrency: true },
    { title: "Compras", value: data.com, isCurrency: true }
  ];

  return (
    <div className="cards-container">
      {cardsConfig.map((card, index) => (
        <Card
          key={index}
          title={card.title}
          value={card.value}
          isCurrency={card.isCurrency}
          isNegative={card.isNegative}
        />
      ))}
    </div>
  );
};

export default CardsCortes;