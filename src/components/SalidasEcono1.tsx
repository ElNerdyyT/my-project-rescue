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

const SalidasMexico = () => {
  const [data, setData] = useState<TableRow[]>([]);
  const [filteredData, setFilteredData] = useState<TableRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(8); // Puedes ajustar el número de elementos por página aquí
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [startDate, setStartDate] = useState<string>('');  // Fecha de inicio
  const [endDate, setEndDate] = useState<string>('');      // Fecha de fin

  useEffect(() => {
    const fetchDateRange = async () => {
      const { data, error } = await supabase
        .from('date_range')
        .select('start_date, end_date')
        .single();  // Asumimos que solo hay un registro

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
    if (!startDate || !endDate) {
      return;
    }

    const fetchData = async () => {
      const formattedStartDate = new Date(startDate).toISOString().split('T').join(' ').split('.')[0];
      const formattedEndDate = new Date(endDate).toISOString().split('T').join(' ').split('.')[0];

      const { data: supabaseData, error, count } = await supabase
        .from('SalidasEcono1')
        .select('*', { count: 'exact' })
        .gte('fec', formattedStartDate)
        .lte('fec', formattedEndDate)
        .order('fec', { ascending: false })
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);

      if (error) {
        console.error('Error fetching data:', error.message);
      } else {
        const transformedData = (supabaseData || []).map(item => ({
          ...item,
          fec: item.fec.split(' ')[0], // Formatear la fecha
          hor: item.hor.split(' ')[1] || '', // Solo mostrar la hora
          cant: parseFloat(parseFloat(item.cant).toFixed(2)),
        }));

        setData(transformedData);
        setTotalPages(count ? Math.ceil(count / itemsPerPage) : 1);
      }
      setLoading(false);
    };

    fetchData();
  }, [currentPage, itemsPerPage, startDate, endDate]);

  useEffect(() => {
    if (searchQuery) {
      setFilteredData(
        data.filter((row) =>
          Object.values(row).some((value) =>
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
    return <p>Cargando datos...</p>;
  }

  return (
    <>
      <div class="col-12">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Datos de Salidas Econo1</h3>
          </div>
          <div class="card-body border-bottom py-3">
            <div class="d-flex">
              <div class="text-secondary">
                Mostrar
                <div class="mx-2 d-inline-block">
                  <input
                    type="text"
                    class="form-control form-control-sm"
                    value={itemsPerPage}
                    aria-label="Contador de elementos"
                    readOnly
                  />
                </div>
                entradas
              </div>
              <div class="ms-auto text-secondary">
                Buscar:
                <div class="ms-2 d-inline-block">
                  <input
                    type="text"
                    class="form-control form-control-sm"
                    value={searchQuery}
                    onInput={(e) => setSearchQuery(e.currentTarget.value)}
                    aria-label="Buscar"
                  />
                </div>
              </div>
            </div>
          </div>
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
                {filteredData.map((row) => (
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
          <div class="card-footer d-flex align-items-center">
            <p class="m-0 text-secondary">
              Mostrando <span>{(currentPage - 1) * itemsPerPage + 1}</span> a <span>{Math.min(currentPage * itemsPerPage, filteredData.length)}</span> de <span>{filteredData.length}</span> entradas
            </p>
            <ul class="pagination m-0 ms-auto">
              <li class={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                <button
                  class="page-link"
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentPage > 1) {
                      handlePageChange(currentPage - 1);
                    }
                  }}
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
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentPage < totalPages) {
                      handlePageChange(currentPage + 1);
                    }
                  }}
                >
                  Siguiente
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
};

export default SalidasMexico;
