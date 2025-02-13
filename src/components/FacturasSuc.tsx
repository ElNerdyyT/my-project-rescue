import { useState, useEffect } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';

interface Factura {
  fecha: string;
  folio: string;
  proveedor: string;
  articulo: string;
  cantidad: number;
  costo: number;
  total: number;
  sucursal: string;
}

const FacturasSuc = () => {
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [selectedSucursal, setSelectedSucursal] = useState('Mexico');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const sucursalesValidas = ['Mexico', 'Econo1', 'Econo2', 'Baja'];

  useEffect(() => {
    const fetchDateRange = async () => {
      try {
        const { data, error } = await supabase
          .from('date_range')
          .select('start_date, end_date')
          .single();
          
        if (data) {
          setStartDate(data.start_date);
          setEndDate(data.end_date);
        }
        if (error) throw error;
      } catch (error) {
        console.error('Error obteniendo fechas:', error);
      }
    };
    fetchDateRange();
  }, []);

  useEffect(() => {
    const fetchFacturas = async () => {
      if (!startDate || !endDate) return;
      setLoading(true);
      
      try {
        const { data, error } = await supabase
          .from(`Kardex${selectedSucursal}`)
          .select('*')
          .gte('fecha', startDate)
          .lte('fecha', endDate)
          .eq('movto', 9);

        if (error) throw error;

        const facturasData: Factura[] = (data || []).map((factura) => ({
          fecha: new Date(factura.fecha).toLocaleDateString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          }),
          folio: factura.referencia?.toString() || '',
          proveedor: factura.proveedor || '',
          articulo: factura.articulo || '',
          cantidad: Number(factura.cantidad),
          costo: Number(factura.costo),
          total: Number(factura.cantidad) * Number(factura.costo),
          sucursal: selectedSucursal
        }));

        setFacturas(facturasData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    };

    fetchFacturas();
  }, [startDate, endDate, selectedSucursal]);

  const totalFacturas = facturas.reduce((acc, factura) => acc + factura.total, 0);

  return (
    <div className="container mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        Control de Facturas por Sucursal
      </h2>

      <div className="mb-6 flex gap-4 items-center">
        <select
          value={selectedSucursal}
          onChange={(e) => setSelectedSucursal(e.currentTarget.value)}
          className="px-4 py-2 border rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {sucursalesValidas.map((sucursal) => (
            <option value={sucursal} key={sucursal}>
              {sucursal}
            </option>
          ))}
        </select>

        {loading && (
          <div className="flex items-center text-gray-600">
            <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
              {/* Ícono de spinner */}
            </svg>
            Cargando...
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg border border-red-200">
          Error: {error}
        </div>
      )}

      {/* Card con el total */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="text-gray-500 text-sm font-medium">Total Facturas</div>
          <div className="text-2xl font-bold text-gray-800 mt-2">
            {totalFacturas.toLocaleString('es-MX', {
              style: 'currency',
              currency: 'MXN',
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </div>
        </div>
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Fecha</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Folio</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Proveedor</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Artículo</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Cantidad</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Costo Unitario</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {facturas.map((factura, i) => (
              <tr key={i} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 text-sm text-gray-600">{factura.fecha}</td>
                <td className="px-6 py-4 text-sm text-gray-600">#{factura.folio}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{factura.proveedor}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{factura.articulo}</td>
                <td className="px-6 py-4 text-sm text-right text-gray-600">
                  {factura.cantidad.toLocaleString('es-MX', { maximumFractionDigits: 2 })}
                </td>
                <td className="px-6 py-4 text-sm text-right text-gray-600">
                  {factura.costo.toLocaleString('es-MX', { 
                    style: 'currency', 
                    currency: 'MXN',
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </td>
                <td className="px-6 py-4 text-sm text-right text-gray-600">
                  {factura.total.toLocaleString('es-MX', { 
                    style: 'currency', 
                    currency: 'MXN',
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(!loading && facturas.length === 0) && (
        <div className="p-8 text-center text-gray-500">
          No se encontraron facturas en este período
        </div>
      )}
    </div>
  );
};

export default FacturasSuc;
