import { useState, useEffect } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';

interface TableRow {
  cve_articulo_a: string;
  depto_a: string;
  subdepto_a: string;
  nombre_comer_a: string;
  cant_piso_a: number;
  preciomn_a: number;
  costo_a: number;
  comision: number;
  fecha_modificacion: string;
}

const Negativos = () => {
  const [data, setData] = useState<TableRow[]>([]);
  const [filteredData, setFilteredData] = useState<TableRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedSucursal, setSelectedSucursal] = useState('Mexico');

  const sucursalesValidas = ['Mexico', 'Econo1', 'Econo2', 'Baja'];

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from(`Articulos${selectedSucursal}`)
          .select('*')
          .order('cve_articulo_a', { ascending: true });

        if (searchQuery.trim()) {
          query = query.ilike('nombre_comer_a', `%${searchQuery}%`);
        }

        const { data: supabaseData, error } = await query;

        if (error) throw error;

        // Filtra los datos para obtener solo aquellos con cant_piso_a negativa
        const negativeData = supabaseData.filter((row) => Number(row.cant_piso_a) < 0);

        setData(negativeData || []);
      } catch (error) {
        console.error('Error al obtener datos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [searchQuery, selectedSucursal]);

  useEffect(() => {
    setFilteredData(
      searchQuery
        ? data.filter((row) =>
            Object.values(row).some((value) =>
              value?.toString().toLowerCase().includes(searchQuery.toLowerCase())
            )
          )
        : data
    );
  }, [searchQuery, data]);

  return (
    <div class="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div class="px-4 sm:px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <h2 class="text-lg font-semibold text-gray-800">Artículos con Existencias Negativas</h2>
          {loading && <p class="text-center text-gray-500 py-4">Cargando datos...</p>}

          <select
            class="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
            value={selectedSucursal}
            onChange={(e) => setSelectedSucursal(e.currentTarget.value)}
          >
            {sucursalesValidas.map((sucursal) => (
              <option value={sucursal} key={sucursal}>
                {sucursal}
              </option>
            ))}
          </select>

          <div class="flex-1 sm:max-w-md">
            <input
              type="text"
              class="w-full pl-10 pr-3 py-1.5 rounded-md border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
              placeholder="Buscar artículo..."
              value={searchQuery}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
            />
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                {['Cve Artículo', 'Depto', 'Subdepto', 'Nombre Comercial', 'Cantidad Piso', 'Precio MN', 'Costo', 'Comisión', 'Fecha Modificación'].map(
                  (header) => (
                    <th key={header} class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {header}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {filteredData.map((row, index) => (
                <tr key={index} class="hover:bg-gray-50">
                  <td class="px-4 py-3 text-sm text-gray-900 font-mono">{row.cve_articulo_a}</td>
                  <td class="px-4 py-3 text-sm text-gray-600">{row.depto_a}</td>
                  <td class="px-4 py-3 text-sm text-gray-600">{row.subdepto_a}</td>
                  <td class="px-4 py-3 text-sm text-gray-900 font-medium">{row.nombre_comer_a}</td>
                  <td class="px-4 py-3 text-sm text-gray-600">{row.cant_piso_a}</td>
                  <td class="px-4 py-3 text-sm text-gray-600">${Number(row.preciomn_a || 0).toFixed(2)}</td>
                  <td class="px-4 py-3 text-sm text-gray-600">${Number(row.costo_a || 0).toFixed(2)}</td>
                  <td class="px-4 py-3 text-sm text-gray-600">{row.comision}</td>
                  <td class="px-4 py-3 text-sm text-gray-600">{new Date(row.fecha_modificacion).toLocaleDateString('es-MX')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Negativos;
