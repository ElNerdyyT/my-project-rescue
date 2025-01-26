import { useState, useEffect } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';

interface TableRow {
  id: number;
  cve_empleado: string;
  cve_art: string;
  nombresArticulo: string;
  cantidad: number;
  precio_vta: number;
  costo: number;
  importe_tot: number;
  folio: string;
  nombre: string;
  fecha: string;
}

const DataTable = () => {
  const [data, setData] = useState<TableRow[]>([]);
  const [filteredData, setFilteredData] = useState<TableRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(8);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState<boolean>(true);
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
    if (!startDate || !endDate) {
      return;
    }

    const fetchData = async () => {
      const formattedStartDate = new Date(startDate).toISOString().split('T').join(' ').split('.')[0];
      const formattedEndDate = new Date(endDate).toISOString().split('T').join(' ').split('.')[0];
  
      const { data: supabaseData, error, count } = await supabase
        .from('ComisionesMexico')
        .select('*', { count: 'exact' })
        .gte('fecha', formattedStartDate)
        .lte('fecha', formattedEndDate)
        .order('fecha', { ascending: false })
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);

      if (error) {
        console.error('Error fetching data:', error.message);
      } else {
        // Obtener los cve_art únicos para hacer una consulta a ArticulosMexico
        const cveArts = [...new Set(supabaseData.map((item: any) => item.cve_art))];

        // Obtener los nombres de los artículos desde ArticulosMexico
        const { data: articlesData, error: articlesError } = await supabase
          .from('ArticulosMexico')
          .select('cve_articulo_a, nombre_comer_a')
          .in('cve_articulo_a', cveArts);

        if (articlesError) {
          console.error('Error al obtener nombres de artículos:', articlesError.message);
        }

        // Crear un mapa de cve_art a nombre_comer_a
        const articlesMap = articlesData?.reduce((map: any, article: any) => {
          map[article.cve_articulo_a] = article.nombre_comer_a;
          return map;
        }, {});

        // Mapear los datos transformados con los nombres correspondientes
        const transformedData = (supabaseData || []).map(item => ({
          ...item,
          fecha: item.fecha.split(' ')[0],
          cantidad: parseFloat(parseFloat(item.cantidad).toFixed(2)),
          precio_vta: parseFloat(parseFloat(item.precio_vta).toFixed(2)),
          costo: parseFloat(parseFloat(item.costo).toFixed(2)),
          importe_tot: parseFloat(parseFloat(item.importe_tot).toFixed(2)),
          nombresArticulo: articlesMap[item.cve_art] || 'Nombre no disponible', // Agregar nombresArticulo
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
            <h3 class="card-title">Comisiones México</h3>
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
                  <th>Cve Empleado</th>
                  <th>Cve Art</th>
                  <th>Nombres Articulo</th> {/* Agregado después de cve_art */}
                  <th>Cantidad</th>
                  <th>Precio Vta</th>
                  <th>Costo</th>
                  <th>Importe Total</th>
                  <th>Folio</th>
                  <th>Nombre</th> {/* Mantenemos el nombre original */}
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row) => (
                  <tr key={row.id}>
                    <td>{row.cve_empleado}</td>
                    <td>{row.cve_art}</td>
                    <td>{row.nombresArticulo}</td> {/* Nombre comercial de artículo */}
                    <td>{row.cantidad}</td>
                    <td>{row.precio_vta}</td>
                    <td>{row.costo}</td>
                    <td>{row.importe_tot}</td>
                    <td>{row.folio}</td>
                    <td>{row.nombre}</td> {/* Nombre en la tabla ComisionesMexico */}
                    <td>{row.fecha}</td>
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
