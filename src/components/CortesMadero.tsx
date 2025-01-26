import { useState, useEffect } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';

interface TableRow {
  id: number;
  corte: string;
  turno: string;
  fecha: string;
  hora: string;
  folini: string;
  folfin: string;
  totentreg: string;
  tottarj: string;
  faltan: string;
  sobran: string;
  encar: string;
  cajer: string;
  gas: string;
  com: string;
  val: string;
  totret: string;
}

const DataTable = () => {
  const [data, setData] = useState<TableRow[]>([]);
  const [filteredData, setFilteredData] = useState<TableRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(8); // Puedes ajustar el número de elementos por página aquí
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [startDate, setStartDate] = useState<string>('');  // Fecha de inicio
  const [endDate, setEndDate] = useState<string>('');     

  useEffect(() => {
    // Función para obtener las fechas desde la tabla date_range
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
      // Formatear las fechas de inicio y fin para que coincidan con el formato de la base de datos
      const formattedStartDate = new Date(startDate).toISOString().split('T').join(' ').split('.')[0]; // "YYYY-MM-DD HH:MM:SS"
      const formattedEndDate = new Date(endDate).toISOString().split('T').join(' ').split('.')[0]; // "YYYY-MM-DD HH:MM:SS"
  
      console.log('Fechas formateadas:', { formattedStartDate, formattedEndDate });
  
      const { data: supabaseData, error, count } = await supabase
        .from('CortesMadero')
        .select('*', { count: 'exact' })
        .gte('fecha', formattedStartDate) // Filtra desde la fecha de inicio
        .lte('fecha', formattedEndDate)   // Filtra hasta la fecha final
        .order('corte', { ascending: false })
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);
  
      if (error) {
        console.error('Error fetching data:', error.message);
      } else {
        const transformedData = (supabaseData || []).map(item => ({
          ...item,
          fecha: item.fecha.split(' ')[0], // Quitar la hora de 'fecha'
          hora: item.hora.split(' ')[1] || '', // Obtener solo la parte de la hora si es necesario
          folini: parseInt(item.folini, 10),
          folfin: parseInt(item.folfin, 10),
          totentreg: parseFloat(parseFloat(item.totentreg).toFixed(2)),
          tottarj: parseFloat(parseFloat(item.tottarj).toFixed(2)),
          faltan: parseFloat(parseFloat(item.faltan).toFixed(2)),
          sobran: parseFloat(parseFloat(item.sobran).toFixed(2)),
          gas: parseFloat(parseFloat(item.gas).toFixed(2)),
          com: parseFloat(parseFloat(item.com).toFixed(2)),
          val: parseFloat(parseFloat(item.val).toFixed(2)),
          totret: parseFloat(parseFloat(item.totret).toFixed(2)),
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
            <h3 class="card-title">Datos de Cortes Madero</h3>
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
                  <th>Corte</th>
                  <th>Turno</th>
                  <th>Fecha</th>
                  <th>Hora</th>
                  <th>Folio I</th>
                  <th>Folio F</th>
                  <th>Total Ef</th>
                  <th>Total Tar</th>
                  <th>Faltante</th>
                  <th>Sobrante</th>
                  <th>Encar</th>
                  <th>Cajero</th>
                  <th>Gastos</th>
                  <th>Compras</th>
                  <th>Vales</th>
                  <th>TotRet</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row) => (
                  <tr key={row.id}>
                    <td>{row.corte}</td>
                    <td>{row.turno}</td>
                    <td>{row.fecha}</td>
                    <td>{row.hora}</td>
                    <td>{row.folini}</td>
                    <td>{row.folfin}</td>
                    <td>{row.totentreg}</td>
                    <td>{row.tottarj}</td>
                    <td>{row.faltan}</td>
                    <td>{row.sobran}</td>
                    <td>{row.encar}</td>
                    <td>{row.cajer}</td>
                    <td>{row.gas}</td>
                    <td>{row.com}</td>
                    <td>{row.val}</td>
                    <td>{row.totret}</td>
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

export default DataTable;
