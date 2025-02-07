import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import '../css/HojaCorte.css';

interface Corte {
  corte: string;
  fecha: string;
  hora: string;
  folini: string;
  folfin: string;
  totentreg: number;
  tottarj: number;
  faltan: number;
  sobran: number;
  encar: string;
  cajer: string;
  gas: number;
  com: number;
  val: number;
  totret: number;
  turno: string;
}

const HojaCorte = () => {
  const [cortes, setCortes] = useState<Corte[]>([]);
  const [selectedSucursal, setSelectedSucursal] = useState('ECONOFARMA');
  const [selectedTurno, setSelectedTurno] = useState('TURNO PRIMERO');
  const [selectedFecha, setSelectedFecha] = useState('');

  const getTableName = () => {
    switch (selectedSucursal) {
      case 'ECONOFARMA': return 'CortesEcono1';
      case 'MEXICO': return 'CortesMexico';
      case 'MADERO': return 'CortesMadero';
      default: return 'CortesEcono1';
    }
  };

  const formatFechaForQuery = (fecha: string) => {
    if (!fecha) return '';
    const dateObj = new Date(fecha);
    return dateObj.toISOString().split('T')[0]; // Convierte a "YYYY-MM-DD"
  };
  
  useEffect(() => {
    const fetchCortes = async () => {
      console.log("Fetching data for:", selectedSucursal, selectedTurno, selectedFecha);
  
      const tableName = getTableName();
      let query = supabase
        .from(tableName)
        .select('corte, fecha, hora, folini, folfin, totentreg, tottarj, faltan, sobran, encar, cajer, gas, com, val, totret, turno')
        .eq('turno', selectedTurno);
  
      const formattedFecha = formatFechaForQuery(selectedFecha);
      if (formattedFecha) {
        query = query.like('fecha', `${formattedFecha}%`); // Filtra ignorando la hora
      }
  
        const { data, error } = await query;
        
        if (error) {
          console.error('Error fetching cortes:', error);
          return;
        }
  

      console.log("Data fetched:", data);

      // Convertir datos de texto a número
      const formattedData = data.map(corte => ({
        ...corte,
        totentreg: parseFloat(corte.totentreg) || 0,
        tottarj: parseFloat(corte.tottarj) || 0,
        faltan: parseFloat(corte.faltan) || 0,
        sobran: parseFloat(corte.sobran) || 0,
        gas: parseFloat(corte.gas) || 0,
        com: parseFloat(corte.com) || 0,
        val: parseFloat(corte.val) || 0,
        totret: parseFloat(corte.totret) || 0,
      }));

      setCortes(formattedData);
    };

    fetchCortes();
  }, [selectedSucursal, selectedTurno, selectedFecha]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(value);
  };

  return (
    <div className="hoja-corte">
      <h1>F A R M A C I A SAN RAMON</h1>
      <p>Fecha: {new Date().toLocaleDateString()}</p>

      <div>
        <p>Total Entregado: {formatCurrency(cortes[0]?.totentreg || 0)}</p>
        <p>Retiro en Efectivo: {formatCurrency(cortes[0]?.totret || 0)}</p>
        <p>Tarjetas: {formatCurrency(cortes[0]?.tottarj || 0)}</p>
        <p>Gastos: {formatCurrency(cortes[0]?.gas || 0)}</p>
        <p>Compras en Efectivo: {formatCurrency(cortes[0]?.com || 0)}</p>
        <p>Vales de Empleado: {formatCurrency(cortes[0]?.val || 0)}</p>
        <p className="texto-negrita">Gran Total: {formatCurrency(
          (cortes[0]?.totentreg || 0) +
          (cortes[0]?.tottarj || 0) +
          (cortes[0]?.gas || 0) +
          (cortes[0]?.com || 0) +
          (cortes[0]?.val || 0)
        )}</p>
      </div>

      <div>
        <p>Sobrante: {formatCurrency(cortes[0]?.sobran || 0)}</p>
        <p>Faltante: {formatCurrency(cortes[0]?.faltan || 0)}</p>
      </div>

      <div className="filtros">
        <select value={selectedSucursal} onChange={(e) => setSelectedSucursal(e.currentTarget.value)}>
          <option value="ECONOFARMA">ECONOFARMA</option>
          <option value="MEXICO">MEXICO</option>
          <option value="MADERO">MADERO</option>
        </select>

        <select value={selectedTurno} onChange={(e) => setSelectedTurno(e.currentTarget.value)}>
          <option value="TURNO PRIMERO">TURNO PRIMERO</option>
          <option value="TURNO SEGUNDO">TURNO SEGUNDO</option>
          <option value="TURNO TERCERO">TURNO TERCERO</option>
        </select>

        <input type="date" value={selectedFecha} onChange={(e) => setSelectedFecha(e.currentTarget.value)} />
      </div>
    </div>
  );
};

export default HojaCorte;
