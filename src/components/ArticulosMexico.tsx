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

const DataTable = () => {
  const [data, setData] = useState<TableRow[]>([]);
  const [filteredData, setFilteredData] = useState<TableRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20); // Ajusta el número de elementos por página aquí
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState<boolean>(true);
  

  // Función para hacer la búsqueda cuando se presiona Enter
  const handleSearch = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      setSearchQuery((e.target as HTMLInputElement).value); // Ejecutar búsqueda al presionar Enter
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // Construye la consulta con búsqueda y paginación
      const { data: supabaseData, error, count } = await supabase
        .from('ArticulosMexico')
        .select(
          'cve_articulo_a, depto_a, subdepto_a, nombre_comer_a, cant_piso_a, preciomn_a, costo_a, comision, fecha_modificacion',
          { count: 'exact' }
        )
        .ilike('nombre_comer_a', `%${searchQuery || ''}%`) // Búsqueda en el servidor
        .order('cve_articulo_a', { ascending: true }) // Ordena por clave artículo
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1); // Paginación

      if (error) {
        console.error('Error al cargar datos:', error.message);
      } else {
        setData(supabaseData || []); // Establece los datos obtenidos
        setTotalPages(count ? Math.ceil(count / itemsPerPage) : 1); // Calcula el número total de páginas
      }

      setLoading(false);
    };

    fetchData();
  }, [currentPage, itemsPerPage, searchQuery]); // Vuelve a ejecutar cuando cambian estos valores

  useEffect(() => {
    if (searchQuery) {
      setFilteredData(
        data.filter(row =>
          Object.values(row).some(value =>
            value.toString().toLowerCase().includes(searchQuery.toLowerCase())
          )
        )
      );
    } else {
      setFilteredData(data);
    }
  }, [searchQuery, data]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    const tableContainer = document.querySelector('.table-wrapper');
    if (tableContainer) {
      tableContainer.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (loading) {
    return (
      <div class="flex justify-center items-center h-64">
        <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div class="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        {/* Header y Buscador mejorado */}
        <div class="px-4 sm:px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <h2 class="text-lg font-semibold text-gray-800">Artículos México</h2>
          <div class="flex-1 sm:max-w-md">
            <div class="relative">
              <input
                type="text"
                class="w-full pl-10 pr-3 py-1.5 rounded-md border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                placeholder="Buscar artículo..."
                value={searchQuery}
                onKeyDown={handleSearch}
              />
              <svg
                class="absolute left-3 top-2.5 h-4 w-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Tabla ajustada */}
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                {[
                  'Cve Artículo',
                  'Depto',
                  'Subdepto',
                  'Nombre Comercial',
                  'Cantidad Piso',
                  'Precio MN',
                  'Costo',
                  'Comisión',
                  'Fecha Modificación'
                ].map((header) => (
                  <th
                    key={header}
                    class="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {filteredData.map((row, index) => (
                <tr key={index} class="hover:bg-gray-50">
                  <td class="px-4 sm:px-6 py-3 text-sm text-gray-900 font-mono">{row.cve_articulo_a}</td>
                  <td class="px-4 sm:px-6 py-3 text-sm text-gray-600">{row.depto_a}</td>
                  <td class="px-4 sm:px-6 py-3 text-sm text-gray-600">{row.subdepto_a}</td>
                  <td class="px-4 sm:px-6 py-3 text-sm text-gray-900 font-medium">{row.nombre_comer_a}</td>
                  <td class="px-4 sm:px-6 py-3 text-sm text-gray-600">{row.cant_piso_a}</td>
                  <td class="px-4 sm:px-6 py-3 text-sm text-gray-600">
  ${Number(row.preciomn_a).toFixed(2)}
</td>
<td class="px-4 sm:px-6 py-3 text-sm text-gray-600">
  ${Number(row.costo_a).toFixed(2)}
</td>
                  <td class="px-4 sm:px-6 py-3 text-sm text-gray-600">{row.comision}</td>
                  <td class="px-4 sm:px-6 py-3 text-sm text-gray-600">
                    {new Date(row.fecha_modificacion).toLocaleDateString('es-MX')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginación ajustada */}
        <div class="px-4 sm:px-6 py-3 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div class="text-sm text-gray-600">
            Mostrando {' '}
            <span class="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> -{' '}
            <span class="font-medium">{Math.min(currentPage * itemsPerPage, filteredData.length)}</span> de{' '}
            <span class="font-medium">{filteredData.length}</span>
          </div>
          
          <div class="flex items-center gap-1.5">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              class="px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Anterior
            </button>
            <span class="px-3 py-1.5 text-sm text-gray-700">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              class="px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataTable;