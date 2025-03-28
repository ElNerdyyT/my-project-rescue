import { useState, useEffect } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';

interface TableRow {
  id: number;
  articulo: string;
  fecha: string;
  tipo: string;
  movto: string;
  desc_movto: string;
  cantidad: number;
  costo: number;
  referencia: string;
  hora: string;
  nombre: string;
  turno: string;
  ppub: number;
  autonumber: number;
  fol: string;
}

const branches = [
  { value: 'General', label: 'General' },
  { value: 'KardexEcono1', label: 'Econo1' },
  { value: 'KardexMadero', label: 'Madero' },
  { value: 'KardexMexico', label: 'México' },
  { value: 'KardexLolita', label: 'Lolita' },
  { value: 'KardexLopezM', label: 'López Mateos' },
  { value: 'KardexBaja', label: 'Baja' },
  { value: 'KardexEcono2', label: 'Econo2' },
];

// Opciones para el filtro de desc_movto
const descMovtoOptions = [
  { value: '', label: 'Todos' },
  { value: 'VENTA DE CAJA', label: 'VENTA DE CAJA' },
  { value: 'ENTRADA DE FACTURA', label: 'ENTRADA DE FACTURA' },
  { value: 'ENTRADA DE TRANSFERENCIA', label: 'ENTRADA DE TRANSFERENCIA' },
  { value: 'SALIDA DE TRANSFERENCIA', label: 'SALIDA DE TRANSFERENCIA' },
  { value: 'AJUSTE NEGATIVO', label: 'AJUSTE NEGATIVO' },
  { value: 'AJUSTE POSITIVO', label: 'AJUSTE POSITIVO' },
  { value: 'VENTA CREDITO', label: 'VENTA CREDITO' },
  { value: 'SALIDA DE CAJA', label: 'SALIDA DE CAJA' },
  { value: 'ENTRADA DE PRODUCTO INDIVIDUAL', label: 'ENTRADA DE PRODUCTO INDIVIDUAL' },
  { value: 'DEVOLUCION CT DE VENTA', label: 'DEVOLUCION CT DE VENTA' },
  { value: 'DEVOLUCION A PROVEEDOR', label: 'DEVOLUCION A PROVEEDOR' },
  { value: 'CANCELACION DE FACTURA', label: 'CANCELACION DE FACTURA' },
];

const DataTable = () => {
  // Estados para datos y paginación
  const [data, setData] = useState<TableRow[]>([]);
  const [filteredData, setFilteredData] = useState<TableRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(1000);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('KardexEcono1');

  // Estado para el filtro específico de desc_movto
  const [filterDescMovto, setFilterDescMovto] = useState<string>('');

  // Obtener el rango de fechas
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

  // Reiniciar la página cuando se cambia la sucursal
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedBranch]);

  // Obtener datos desde Supabase según la sucursal y el rango de fechas
  useEffect(() => {
    if (!startDate || !endDate) return;

    const fetchData = async () => {
      setLoading(true);
      // Formatear las fechas para la consulta
      const formattedStartDate = new Date(startDate)
        .toISOString()
        .split('T')
        .join(' ')
        .split('.')[0];
      const formattedEndDate = new Date(endDate)
        .toISOString()
        .split('T')
        .join(' ')
        .split('.')[0];

      // Función para transformar cada fila (dar formato a fecha, hora y números)
      const transformRow = (item: any): TableRow => ({
        ...item,
        fecha: item.fecha.split(' ')[0],
        hora: item.hora.split(' ')[1] || '',
        cantidad: parseFloat(parseFloat(item.cantidad).toFixed(2)),
        costo: parseFloat(parseFloat(item.costo).toFixed(2)),
        ppub: parseFloat(parseFloat(item.ppub).toFixed(2)),
      });

      if (selectedBranch === 'General') {
        const allTables = [
          'KardexEcono1',
          'KardexMadero',
          'KardexMexico',
          'KardexLolita',
          'KardexLopezM',
          'KardexBaja',
          'KardexEcono2',
        ];

        let allData: TableRow[] = [];

        for (const table of allTables) {
          const { data: tableData, error } = await supabase
            .from(table)
            .select('*')
            .gte('fecha', formattedStartDate)
            .lte('fecha', formattedEndDate)
            .order('fecha', { ascending: false })
            .order('hora', { ascending: false });

          if (!error && tableData) {
            allData = [
              ...allData,
              ...tableData.map((item: any) => transformRow(item)),
            ];
          }
        }

        // Ordenar los datos combinados por fecha y hora
        allData.sort((a, b) => {
          const dateCompare =
            new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
          return dateCompare !== 0 ? dateCompare : b.hora.localeCompare(a.hora);
        });

        const startIndex = (currentPage - 1) * itemsPerPage;
        const paginatedData = allData.slice(startIndex, startIndex + itemsPerPage);

        setData(paginatedData);
        setTotalPages(Math.ceil(allData.length / itemsPerPage));
      } else {
        const { data: supabaseData, error, count } = await supabase
          .from(selectedBranch)
          .select('*', { count: 'exact' })
          .gte('fecha', formattedStartDate)
          .lte('fecha', formattedEndDate)
          .order('fecha', { ascending: false })
          .order('hora', { ascending: false })
          .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);

        if (!error && supabaseData) {
          setData(supabaseData.map((item: any) => transformRow(item)));
          setTotalPages(count ? Math.ceil(count / itemsPerPage) : 1);
        }
      }
      setLoading(false);
    };

    fetchData();
  }, [currentPage, itemsPerPage, startDate, endDate, selectedBranch]);

  // Filtrado de datos combinando búsqueda general y filtro por desc_movto
  useEffect(() => {
    setFilteredData(
      data.filter(row => {
        // Filtro de búsqueda general en todas las propiedades
        const matchesSearch = searchQuery
          ? Object.values(row)
              .some(value =>
                value.toString().toLowerCase().includes(searchQuery.toLowerCase())
              )
          : true;
        // Filtro específico para desc_movto
        const matchesDescMovto = filterDescMovto
          ? row.desc_movto.toLowerCase() === filterDescMovto.toLowerCase()
          : true;
        return matchesSearch && matchesDescMovto;
      })
    );
  }, [searchQuery, filterDescMovto, data]);

  // Función para cambiar de página
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    document
      .querySelector('.table-wrapper')
      ?.scrollIntoView({ behavior: 'smooth' });
  };

  if (loading) return <p>Cargando datos...</p>;

  return (
    <div class="col-12">
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <h3 class="card-title">
            Kardex {branches.find(b => b.value === selectedBranch)?.label}
          </h3>
          <select
            class="form-select form-select-sm w-25"
            value={selectedBranch}
            onChange={e => setSelectedBranch(e.currentTarget.value)}
          >
            {branches.map(branch => (
              <option key={branch.value} value={branch.value}>
                {branch.label}
              </option>
            ))}
          </select>
        </div>

        {/* Filtros y búsqueda */}
        <div class="card-body border-bottom py-3">
          <div class="d-flex flex-wrap align-items-center">
            <div class="text-secondary me-3">
              Mostrar{' '}
              <input
                type="text"
                class="form-control form-control-sm d-inline-block mx-2"
                value={itemsPerPage}
                readOnly
                style={{ width: '60px' }}
              />{' '}
              entradas
            </div>
            <div class="d-flex align-items-center ms-auto">
              <label class="me-2 text-secondary" for="descMovtoSelect">
                Filtrar Desc Movimiento:
              </label>
              <select
                id="descMovtoSelect"
                class="form-select form-select-sm me-3"
                style={{ width: '200px' }}
                value={filterDescMovto}
                onChange={e => setFilterDescMovto(e.currentTarget.value)}
              >
                {descMovtoOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <label class="me-2 text-secondary" for="searchInput">
                Buscar:
              </label>
              <input
                id="searchInput"
                type="text"
                class="form-control form-control-sm"
                style={{ width: '200px' }}
                value={searchQuery}
                onInput={e => setSearchQuery(e.currentTarget.value)}
              />
            </div>
          </div>
        </div>

        {/* Tabla de datos */}
        <div class="table-wrapper" style={{ overflowX: 'auto', width: '100%' }}>
          <table class="table card-table table-vcenter text-nowrap">
            <thead>
              <tr>
                <th>Artículo</th>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Movimiento</th>
                <th>Desc Movimiento</th>
                <th>Cantidad</th>
                <th>Costo</th>
                <th>Referencia</th>
                <th>Hora</th>
                <th>Nombre</th>
                <th>Turno</th>
                <th>Precio Público</th>
                <th>Folio</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map(row => (
                <tr key={row.id}>
                  <td>{row.articulo}</td>
                  <td>{row.fecha}</td>
                  <td>{row.tipo}</td>
                  <td>{row.movto}</td>
                  <td>{row.desc_movto}</td>
                  <td>{row.cantidad.toFixed(2)}</td>
                  <td>${row.costo.toFixed(2)}</td>
                  <td>{row.referencia}</td>
                  <td>{row.hora}</td>
                  <td>{row.nombre}</td>
                  <td>{row.turno}</td>
                  <td>${row.ppub.toFixed(2)}</td>
                  <td>{row.fol}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div class="card-footer d-flex align-items-center">
          <p class="m-0 text-secondary">
            Mostrando{' '}
            <span>{(currentPage - 1) * itemsPerPage + 1}</span> a{' '}
            <span>
              {Math.min(currentPage * itemsPerPage, filteredData.length)}
            </span>{' '}
            de <span>{filteredData.length}</span> entradas
          </p>
          <ul class="pagination m-0 ms-auto">
            <li class={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
              <button
                class="page-link"
                onClick={() => handlePageChange(currentPage - 1)}
              >
                Anterior
              </button>
            </li>
            <li class="page-item active">
              <span class="page-link">{currentPage}</span>
            </li>
            <li
              class={`page-item ${
                currentPage === totalPages ? 'disabled' : ''
              }`}
            >
              <button
                class="page-link"
                onClick={() => handlePageChange(currentPage + 1)}
              >
                Siguiente
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DataTable;
