import { useState, useEffect } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';

interface TableRow {
  id: number;
  usu: string;
  fec: string;
  hor: string;
  cant: number;
  tipo: string;
  nota: string;
  mot: string;
  tur: string;
  fol: string;
  cor: string;
  nomtip: string;
}

// Definición de las sucursales (tablas) de Salidas, se incluye la opción General
const branches = [
  { value: 'General', label: 'General' },
  { value: 'SalidasEcono1', label: 'Econo1' },
  { value: 'SalidasMadero', label: 'Madero' },
  { value: 'SalidasMexico', label: 'México' },
  { value: 'SalidasLolita', label: 'Lolita' },
  { value: 'SalidasLopezM', label: 'López Mateos' },
  { value: 'SalidasBaja', label: 'Baja' },
  { value: 'SalidasEcono2', label: 'Econo2' },
];

const Salidas = () => {
  // Estados para datos y paginación
  const [data, setData] = useState<TableRow[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(1000);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState<boolean>(true);

  // Fechas para el rango
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Estado para la sucursal seleccionada
  const [selectedBranch, setSelectedBranch] = useState<string>('SalidasEcono1');

  // Obtener el rango de fechas desde la tabla date_range
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
      // Formatear fechas para la consulta
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

      // Función para transformar cada fila (formato de fecha, hora y números)
      const transformRow = (item: any): TableRow => ({
        ...item,
        // Se formatea la fecha (se asume formato "YYYY-MM-DD HH:MM:SS")
        fec: item.fec.split(' ')[0],
        // Extraer solo la hora (si la cadena tiene formato "YYYY-MM-DD HH:MM:SS")
        hor: item.hor.split(' ')[1] || '',
        cant: parseFloat(parseFloat(item.cant).toFixed(2)),
      });

      // Si se selecciona "General", se combinan los datos de todas las sucursales
      if (selectedBranch === 'General') {
        // Excluir la opción "General" para obtener los nombres reales de las tablas
        const allTables = branches
          .filter((branch) => branch.value !== 'General')
          .map((branch) => branch.value);

        let allData: TableRow[] = [];

        // Iterar sobre cada tabla para obtener los datos
        for (const table of allTables) {
          const { data: tableData, error } = await supabase
            .from(table)
            .select('*')
            .gte('fec', formattedStartDate)
            .lte('fec', formattedEndDate)
            .order('fec', { ascending: false });

          if (!error && tableData) {
            allData = [
              ...allData,
              ...tableData.map((item: any) => transformRow(item)),
            ];
          }
        }

        // Ordenar los datos combinados por fecha descendente y, si es necesario, por hora
        allData.sort((a, b) => {
          const dateDiff = new Date(b.fec).getTime() - new Date(a.fec).getTime();
          if (dateDiff !== 0) return dateDiff;
          return b.hor.localeCompare(a.hor);
        });

        // Paginación manual de los datos combinados
        const startIndex = (currentPage - 1) * itemsPerPage;
        const paginatedData = allData.slice(startIndex, startIndex + itemsPerPage);
        setData(paginatedData);
        setTotalPages(Math.ceil(allData.length / itemsPerPage));
      } else {
        // Consulta para una única sucursal
        const { data: supabaseData, error, count } = await supabase
          .from(selectedBranch)
          .select('*', { count: 'exact' })
          .gte('fec', formattedStartDate)
          .lte('fec', formattedEndDate)
          .order('fec', { ascending: false })
          .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);

        if (error) {
          console.error('Error al obtener los datos:', error.message);
        } else if (supabaseData) {
          setData(supabaseData.map((item: any) => transformRow(item)));
          setTotalPages(count ? Math.ceil(count / itemsPerPage) : 1);
        }
      }
      setLoading(false);
    };

    fetchData();
  }, [currentPage, itemsPerPage, startDate, endDate, selectedBranch]);

  // Función para cambiar de página
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    const tableContainer = document.querySelector('.table-wrapper');
    if (tableContainer) {
      tableContainer.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (loading) return <p>Cargando datos...</p>;

  return (
    <div class="col-12">
      <div class="card">
        {/* Encabezado con selección de sucursal */}
        <div class="card-header d-flex justify-content-between align-items-center">
          <h3 class="card-title">
            Datos de Salidas{' '}
            {selectedBranch === 'General'
              ? 'General'
              : branches.find(b => b.value === selectedBranch)?.label}
          </h3>
          <select
            class="form-select form-select-sm w-25"
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.currentTarget.value)}
          >
            {branches.map((branch) => (
              <option key={branch.value} value={branch.value}>
                {branch.label}
              </option>
            ))}
          </select>
        </div>

        {/* Información de entradas mostradas */}
        <div class="card-body border-bottom py-3">
          <div class="d-flex">
            <div class="text-secondary">
              Mostrar
              <div class="mx-2 d-inline-block">
                <input
                  type="text"
                  class="form-control form-control-sm"
                  value={itemsPerPage}
                  readOnly
                  aria-label="Cantidad de entradas por página"
                  style={{ width: '60px' }}
                />
              </div>
              entradas
            </div>
          </div>
        </div>

        {/* Tabla de datos */}
        <div class="table-wrapper" style={{ overflowX: 'auto', width: '100%' }}>
          <table class="table card-table table-vcenter text-nowrap">
            <thead>
              <tr>
                <th>Usu</th>
                <th>Fecha</th>
                <th>Hora</th>
                <th>Cant</th>
                <th>Tipo</th>
                <th>Nota</th>
                <th>Motivo</th>
                <th>Turno</th>
                <th>Folio</th>
                <th>Cor</th>
                <th>NomTip</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id}>
                  <td>{row.usu}</td>
                  <td>{row.fec}</td>
                  <td>{row.hor}</td>
                  <td>{row.cant}</td>
                  <td>{row.tipo}</td>
                  <td>{row.nota}</td>
                  <td>{row.mot}</td>
                  <td>{row.tur}</td>
                  <td>{row.fol}</td>
                  <td>{row.cor}</td>
                  <td>{row.nomtip}</td>
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
            <span>{Math.min(currentPage * itemsPerPage, data.length)}</span> de{' '}
            <span>{data.length}</span> entradas
          </p>
          <ul class="pagination m-0 ms-auto">
            <li class={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
              <button
                class="page-link"
                onClick={() => currentPage > 1 && handlePageChange(currentPage - 1)}
              >
                Anterior
              </button>
            </li>
            <li class="page-item active">
              <span class="page-link">{currentPage}</span>
            </li>
            <li class={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
              <button
                class="page-link"
                onClick={() =>
                  currentPage < totalPages && handlePageChange(currentPage + 1)
                }
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

export default Salidas;
