import { useState, useEffect } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';

interface Transferencia {
  origen: string;
  destino: string;
  fecha: string;
  codigo: string;
  articulo: string;
  costo_origen: number;
  costo_destino: number;
  cantidad_origen: number;
  cantidad_destino: number;
  discrepancia: boolean;
  credito_origen: number;
  credito_destino: number;
}

interface TotalesGlobales {
  enviado: number;
  recibido: number;
  balance: number;
  discrepancias: number;
}

const extractDestinoFromReferencia = (referencia: string): string => {
  const match = referencia.match(/A SUC\. #\s*\d+\s*(\w+)/i);
  if (match && match[1]) {
    const rawDestino = match[1].toUpperCase();
    const mapping: Record<string, string> = {
      ECONOFARMA: 'Econo1',
      MEXICO: 'Mexico',
      ECONO1: 'Econo1',
      ECONOFAMRA2: 'Econo2',
      BAJA: 'Baja',
      SUC2: 'Mexico',
    };
    return mapping[rawDestino] || 'Desconocido';
  }
  return 'Desconocido';
};

const TraspasosSuc = () => {
  const [transferencias, setTransferencias] = useState<Transferencia[]>([]);
  const [totalesGlobales, setTotalesGlobales] = useState<TotalesGlobales>({
    enviado: 0,
    recibido: 0,
    balance: 0,
    discrepancias: 0,
  });
  const [selectedSucursal, setSelectedSucursal] = useState('Mexico');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const sucursalesValidas = ['Mexico', 'Econo1','Econo2','Baja'];

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
    const fetchGlobalData = async () => {
      if (!startDate || !endDate) return;
      
      try {
        // Consulta optimizada para ambas sucursales
        const [ 
          { data: mexicoData, error: errorMexico },
          { data: econo1Data, error: errorEcono1 }
        ] = await Promise.all([
          supabase
            .from('KardexMexico')
            .select('*')
            .gte('fecha', startDate)
            .lte('fecha', endDate)
            .in('movto', [7, 8]),
          supabase
            .from('KardexEcono1')
            .select('*')
            .gte('fecha', startDate)
            .lte('fecha', endDate)
            .in('movto', [7, 8])
        ]);

        if (errorMexico || errorEcono1) throw errorMexico || errorEcono1;

        // Combinar todos los movimientos
        const allMovimientos = [...(mexicoData || []), ...(econo1Data || [])];
        
        // Separar en entradas y salidas
        const outgoing = allMovimientos.filter(m => m.movto === 8);
        const incoming = allMovimientos.filter(m => m.movto === 7);

        // Crear mapa de entradas
        const incomingMap = new Map<string, { cantidad: number; costo: number }>();
        incoming.forEach(entrada => {
          const folKey = entrada.fol?.toString().split('.')[0] || '';
          const articulo = entrada.articulo?.trim().toUpperCase() || '';
          incomingMap.set(`${folKey}_${articulo}_${entrada.sucursal}`, {
            cantidad: Number(entrada.cantidad),
            costo: Number(entrada.costo),
          });
        });

        // Calcular totales
        let enviado = 0;
        let recibido = 0;
        let discrepancias = 0;

        outgoing.forEach(salida => {
          const folKey = salida.fol?.toString().split('.')[0] || '';
          const articulo = salida.articulo?.trim().toUpperCase() || '';
          const entrada = incomingMap.get(`${folKey}_${articulo}_${salida.destino}`);
          
          const cantidadSalida = Number(salida.cantidad);
          const costeSalida = Number(salida.costo);
          const cantidadEntrada = entrada?.cantidad || 0;

          enviado += cantidadSalida * costeSalida;
          recibido += cantidadEntrada * (entrada?.costo || 0);
          
          if (Math.abs(cantidadEntrada - cantidadSalida) > 0.01) {
            discrepancias++;
          }
        });

        setTotalesGlobales({
          enviado,
          recibido,
          balance: enviado - recibido,
          discrepancias,
        });
      } catch (err) {
        console.error('Error calculando totales globales:', err);
      }
    };

    fetchGlobalData();
  }, [startDate, endDate]);

  useEffect(() => {
    const fetchTransferencias = async () => {
      if (!startDate || !endDate) return;
      setLoading(true);
      
      try {
        const originSucursal = selectedSucursal;
        const destinationSucursal = selectedSucursal === 'Mexico' ? 'Econo1' : 'Mexico';

        // Consulta optimizada para transferencias
        const { data: originMovimientos, error: originError } = await supabase
          .from(`Kardex${originSucursal}`)
          .select('*')
          .gte('fecha', startDate)
          .lte('fecha', endDate)
          .eq('movto', 8);

        const { data: destMovimientos, error: destError } = await supabase
          .from(`Kardex${destinationSucursal}`)
          .select('*')
          .gte('fecha', startDate)
          .lte('fecha', endDate)
          .eq('movto', 7);

        if (originError || destError) throw originError || destError;

        // Crear mapa de destinos
        const destMap = new Map<string, { cantidad: number; costo: number }>();
        destMovimientos?.forEach((entrada) => {
          const folKey = entrada.fol?.toString().split('.')[0] || '';
          const articulo = entrada.articulo?.trim().toUpperCase() || '';
          destMap.set(`${folKey}_${articulo}`, {
            cantidad: Number(entrada.cantidad),
            costo: Number(entrada.costo),
          });
        });

        // Procesar transferencias
        const transferenciasData: Transferencia[] = (originMovimientos || [])
          .map((salida) => {
            const folKey = salida.fol?.toString().split('.')[0] || '';
            const articulo = salida.articulo?.trim().toUpperCase() || '';
            const entradaData = destMap.get(`${folKey}_${articulo}`);
            const destino = extractDestinoFromReferencia(salida.referencia);

            const cantidad_origen = Number(salida.cantidad);
            const costo_origen = Number(salida.costo);
            const cantidad_destino = entradaData?.cantidad || 0;
            const costo_destino = entradaData?.costo || 0;

            return {
              origen: originSucursal,
              destino: destino,
              fecha: new Date(salida.fecha).toLocaleDateString('es-MX', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              }),
              codigo: folKey,
              articulo: salida.articulo || '',
              costo_origen,
              costo_destino,
              cantidad_origen,
              cantidad_destino,
              discrepancia: Math.abs(cantidad_destino - cantidad_origen) > 0.01,
              credito_origen: costo_origen * cantidad_origen,
              credito_destino: costo_destino * cantidad_destino,
            };
          })
          .filter(t => sucursalesValidas.includes(t.destino));

        setTransferencias(transferenciasData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    };

    fetchTransferencias();
  }, [startDate, endDate, selectedSucursal]);
  return (
    <div className="container mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        Control de Traspasos entre Sucursales
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

      {/* Tarjetas de totales globales */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-md border border-gray-100">
          <h3 className="text-lg font-semibold mb-2 text-gray-800">Total Enviado</h3>
          <div className="text-2xl font-bold text-blue-600">
            {totalesGlobales.enviado.toLocaleString('es-MX', { 
              style: 'currency', 
              currency: 'MXN',
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-md border border-gray-100">
          <h3 className="text-lg font-semibold mb-2 text-gray-800">Total Recibido</h3>
          <div className="text-2xl font-bold text-green-600">
            {totalesGlobales.recibido.toLocaleString('es-MX', {
              style: 'currency',
              currency: 'MXN',
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-md border border-gray-100">
          <h3 className="text-lg font-semibold mb-2 text-gray-800">Balance Total</h3>
          <div className={`text-2xl font-bold ${
            totalesGlobales.balance < 0 ? 'text-red-600' : 'text-green-600'
          }`}>
            {totalesGlobales.balance.toLocaleString('es-MX', {
              style: 'currency',
              currency: 'MXN',
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-md border border-gray-100">
          <h3 className="text-lg font-semibold mb-2 text-gray-800">Discrepancias</h3>
          <div className="text-2xl font-bold text-red-600">
            {totalesGlobales.discrepancias}
          </div>
        </div>
      </div>

      {/* Tabla de transferencias */}
      <div className="mt-8 overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Fecha</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Código</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Artículo</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Origen</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Destino</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Enviado</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Recibido</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Costo Total</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Discrepancia</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {transferencias.map((tr, i) => (
              <tr key={i} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 text-sm text-gray-600">{tr.fecha}</td>
                <td className="px-6 py-4 text-sm text-gray-600">#{tr.codigo}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{tr.articulo}</td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{tr.origen}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{tr.destino}</td>
                <td className="px-6 py-4 text-sm text-right text-gray-600">
                  {tr.cantidad_origen.toLocaleString('es-MX', { maximumFractionDigits: 2 })}
                </td>
                <td className="px-6 py-4 text-sm text-right text-gray-600">
                  {tr.cantidad_destino.toLocaleString('es-MX', { maximumFractionDigits: 2 })}
                </td>
                <td className="px-6 py-4 text-sm text-right text-gray-600">
                  {tr.credito_origen.toLocaleString('es-MX', { 
                    style: 'currency', 
                    currency: 'MXN',
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </td>
                <td className="px-6 py-4 text-center">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                      tr.discrepancia ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {tr.discrepancia ? 'DISCREPANCIA' : 'OK'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(!loading && transferencias.length === 0) && (
        <div className="p-8 text-center text-gray-500">
          No se encontraron transferencias en este período
        </div>
      )}
    </div>
  );
};

export default TraspasosSuc;