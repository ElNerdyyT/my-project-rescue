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
  const [itemsPerPage] = useState(8);
  const [loading, setLoading] = useState<boolean>(true);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [modalData, setModalData] = useState<TableRow[]>([]);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [selectedSucursal, setSelectedSucursal] = useState<string>('ComisionesEcono1');

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
      setLoading(true);
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
      let supabaseData: any[] = [];

      if (selectedSucursal === 'General') {
        // Se unen los datos de las 3 sucursales
        const tables = ['ComisionesEcono1', 'ComisionesMexico', 'ComisionesMadero'];
        const promises = tables.map((tableName) =>
          supabase
            .from(tableName)
            .select('*')
            .gte('fecha', formattedStartDate)
            .lte('fecha', formattedEndDate)
            .order('fecha', { ascending: false })
        );
        const results = await Promise.all(promises);
        results.forEach((result) => {
          if (result.error) {
            console.error('Error al obtener datos de la tabla:', result.error.message);
          } else {
            supabaseData = supabaseData.concat(result.data);
          }
        });
        // Ordenamos globalmente por fecha de mayor a menor
        supabaseData.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
      } else {
        const { data: dataFromTable, error } = await supabase
          .from(selectedSucursal)
          .select('*', { count: 'exact' })
          .gte('fecha', formattedStartDate)
          .lte('fecha', formattedEndDate)
          .order('fecha', { ascending: false });
        if (error) {
          console.error('Error fetching data:', error.message);
        } else {
          supabaseData = dataFromTable;
        }
      }

      const cveArts = [...new Set(supabaseData.map((item: any) => item.cve_art))];

      const { data: articlesData, error: articlesError } = await supabase
        .from('ArticulosMexico')
        .select('cve_articulo_a, nombre_comer_a')
        .in('cve_articulo_a', cveArts);

      if (articlesError) {
        console.error('Error al obtener nombres de artículos:', articlesError.message);
      }

      const articlesMap = articlesData?.reduce((map: any, article: any) => {
        map[article.cve_articulo_a] = article.nombre_comer_a;
        return map;
      }, {});

      const transformedData = (supabaseData || []).map((item) => ({
        ...item,
        fecha: item.fecha.split(' ')[0],
        cantidad: parseFloat(parseFloat(item.cantidad).toFixed(2)),
        precio_vta: parseFloat(parseFloat(item.precio_vta).toFixed(2)),
        costo: parseFloat(parseFloat(item.costo).toFixed(2)),
        importe_tot: parseFloat(parseFloat(item.importe_tot).toFixed(2)),
        nombresArticulo: articlesMap[item.cve_art] || 'Nombre no disponible',
      }));

      setData(transformedData);
      setLoading(false);
    };

    fetchData();
  }, [startDate, endDate, selectedSucursal]);

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

  // Agrupamos los datos por nombre
  const groupedData = filteredData.reduce((acc, row) => {
    if (!acc[row.nombre]) {
      acc[row.nombre] = [];
    }
    acc[row.nombre].push(row);
    return acc;
  }, {} as Record<string, TableRow[]>);

  // Calculamos los totales generales
  const totalCosto = filteredData.reduce((sum, row) => sum + row.costo * row.cantidad, 0);
  const totalImporte = filteredData.reduce((sum, row) => sum + row.importe_tot, 0);
  const totalUtilidad = totalImporte - totalCosto;

  // Calculamos y ordenamos los totales por nombre (de mayor a menor por Importe Total)
  const totalsByName = Object.keys(groupedData)
    .map((name) => {
      const rows = groupedData[name];
      const totalCosto = rows.reduce((sum, row) => sum + row.costo * row.cantidad, 0);
      const totalImporte = rows.reduce((sum, row) => sum + row.importe_tot, 0);
      const totalUtilidad = totalImporte - totalCosto;
      return { name, totalCosto, totalImporte, totalUtilidad };
    })
    .sort((a, b) => b.totalImporte - a.totalImporte);

  const handleOpenModal = (name: string) => {
    const dataForModal = groupedData[name] || [];
    // Ordenamos los detalles de mayor a menor (por fecha)
    const sortedDataForModal = dataForModal.sort(
      (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
    );
    setModalData(sortedDataForModal);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setModalData([]);
  };

  if (loading) {
    return <p>Cargando datos...</p>;
  }

  return (
    <>
      {/* Selector de Sucursal */}
      <div class="row mb-3">
        <div class="col-md-4">
          <label for="sucursalSelect">Seleccionar Sucursal:</label>
          <select
            id="sucursalSelect"
            class="form-control"
            value={selectedSucursal}
            onChange={(e) => setSelectedSucursal(e.currentTarget.value)}
          >
            <option value="ComisionesEcono1">Econo1</option>
            <option value="ComisionesMexico">México</option>
            <option value="ComisionesMadero">Madero</option>
            <option value="General">General (Todas)</option>
          </select>
        </div>
      </div>

      {/* Card General con Totales */}
      <div class="row mb-4">
        <div class="col-md-4">
          <div class="card text-white bg-primary">
            <div class="card-body">
              <h5 class="card-title">Total Costo General</h5>
              <p class="card-text">${totalCosto.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card text-white bg-success">
            <div class="card-body">
              <h5 class="card-title">Total Importe General</h5>
              <p class="card-text">${totalImporte.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card text-white bg-info">
            <div class="card-body">
              <h5 class="card-title">Utilidad Total General</h5>
              <p class="card-text">${totalUtilidad.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de Datos por Nombre */}
      <div class="col-12">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">
              {selectedSucursal === 'General'
                ? 'Comisiones de Todas las Sucursales'
                : `Comisiones ${selectedSucursal.replace('Comisiones', '')} por Nombre`}
            </h3>
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
                  <th>Nombre</th>
                  <th>Total Costo</th>
                  <th>Total Importe</th>
                  <th>Utilidad Total</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {totalsByName.map((totals) => (
                  <tr key={totals.name}>
                    <td>{totals.name}</td>
                    <td>${totals.totalCosto.toFixed(2)}</td>
                    <td>${totals.totalImporte.toFixed(2)}</td>
                    <td>${totals.totalUtilidad.toFixed(2)}</td>
                    <td>
                      <button class="btn btn-info" onClick={() => handleOpenModal(totals.name)}>
                        Ver Detalles
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal con detalles de ventas */}
      {showModal && (
        <>
          <div
            class="modal-overlay"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 1040,
            }}
            onClick={handleCloseModal}
          ></div>
          <div class="modal fade show" style={{ display: 'block', zIndex: 1050 }} aria-modal="true" role="dialog">
            <div class="modal-dialog modal-lg">
              <div class="modal-content">
                <div class="modal-header">
                  <h5 class="modal-title">Detalles de Ventas: {modalData[0]?.nombre}</h5>
                  <button type="button" class="btn-close" onClick={handleCloseModal} aria-label="Close"></button>
                </div>
                <div class="modal-body">
                  <table class="table">
                    <thead>
                      <tr>
                        <th>Articulo</th>
                        <th>Cantidad</th>
                        <th>Precio de Venta</th>
                        <th>Costo</th>
                        <th>Importe Total</th>
                        <th>Folio</th>
                        <th>Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modalData.map((row) => (
                        <tr key={row.id}>
                          <td>{row.nombresArticulo}</td>
                          <td>{row.cantidad}</td>
                          <td>{row.precio_vta}</td>
                          <td>{row.costo}</td>
                          <td>{row.importe_tot}</td>
                          <td>{row.folio}</td>
                          <td>{row.fecha}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-secondary" onClick={handleCloseModal}>
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default DataTable;
