import { useState, useEffect, useRef } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import VentrasCardsReport from './VentasCardsReport'; // Importa el componente desde la carpeta components

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
  dscto: number;
  costoTotal: number;
  precioFinal: number;
  utilidad: number;
}

const DataTable = () => {
  const [allData, setAllData] = useState<TableRow[]>([]); // Datos completos
  const [filteredData, setFilteredData] = useState<TableRow[]>([]); // Datos filtrados
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20); // Número de elementos por página
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const tableRef = useRef(null);

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
    if (!startDate || !endDate) return;
  
    const fetchData = async () => {
      const formattedStartDate = new Date(startDate).toISOString().split('T').join(' ').split('.')[0];
      const formattedEndDate = new Date(endDate).toISOString().split('T').join(' ').split('.')[0];
  
      const { data: supabaseData, error } = await supabase
        .from('KardexMexico')
        .select('*')
        .gte('fecha', formattedStartDate)
        .lte('fecha', formattedEndDate)
        .order('fecha', { ascending: false })
        .order('hora', { ascending: false });
        
  
      if (error) {
        console.error('Error fetching data:', error.message);
      } else {
        const transformedData = (supabaseData || [])
          .filter(item => item.movto === '1')
          .map(item => ({
            ...item,
            fecha: item.fecha.split(' ')[0],
            hora: item.hora.split(' ')[1] || '',
            cantidad: parseFloat(parseFloat(item.cantidad).toFixed(2)),
            costo: parseFloat(parseFloat(item.costo).toFixed(2)),
            ppub: parseFloat(parseFloat(item.ppub).toFixed(2)),
            costoTotal: item.cantidad * item.costo,
            precioFinal: item.cantidad * item.ppub,
            dscto: parseFloat(parseFloat(item.dscto).toFixed(2)),
            utilidad: (item.cantidad * item.ppub) - (item.cantidad * item.costo) - item.dscto,
          }));
  
        setAllData(transformedData);
        setTotalPages(Math.ceil(transformedData.length / itemsPerPage));
      }
      setLoading(false);
    };
  
    fetchData();
  }, [startDate, endDate]);
  

  useEffect(() => {
    // Filtrar los datos según la búsqueda
    const dataToFilter = searchQuery
      ? allData.filter((row) =>
          Object.values(row).some((value) =>
            value.toString().toLowerCase().includes(searchQuery.toLowerCase())
          )
        )
      : allData;

    // Calcular los datos de la página actual
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = currentPage * itemsPerPage;
    setFilteredData(dataToFilter.slice(startIndex, endIndex));
    setTotalPages(Math.ceil(dataToFilter.length / itemsPerPage));
  }, [searchQuery, allData, currentPage, itemsPerPage]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    const tableContainer = document.querySelector('.table-wrapper');
    if (tableContainer) {
      tableContainer.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const exportToPDF = () => {
    if (tableRef.current) {
      html2canvas(tableRef.current, { scale: 2 }).then((canvas) => {
        const imgData = canvas.toDataURL('image/png');
        const doc = new jsPDF('l', 'mm', 'a4');
        doc.addImage(imgData, 'PNG', 10, 10, 280, 150);
        doc.save('reporte_kardex_mexico.pdf');
      });
    }
  };

  const printTable = () => {
    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow?.document.write('<html><head><title>Imprimir Reporte</title></head><body>');
    printWindow?.document.write('<h1>Reporte Kardex México</h1>');
    printWindow?.document.write(document.querySelector('.table-wrapper')?.innerHTML || '');
    printWindow?.document.write('<style>table {width: 100%; border-collapse: collapse;} th, td {border: 1px solid black; padding: 8px; text-align: left;} h1 {text-align: center;}</style>');
    printWindow?.document.write('</body></html>');
    printWindow?.document.close();
    printWindow?.print();
  };

  if (loading) {
    return <p>Cargando datos...</p>;
  }

  return (
    <>
      <div class="col-12">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Ventas Mexico</h3>
          </div>
          <VentrasCardsReport />
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
          <div class="table-wrapper" ref={tableRef} style={{ overflowX: 'auto', width: '100%' }}>
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
                  <th>Costo Total</th> {/* Nueva columna */}
                  <th>Referencia</th>
                  <th>Hora</th>
                  <th>Nombre</th>
                  <th>Turno</th>
                  <th>Precio Público</th>
                  <th>Dscto</th>
                  <th>Precio Final</th> {/* Nueva columna */}
                  <th>Utilidad</th> {/* Nueva columna */}
                  <th>Folio</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row) => (
                  <tr key={row.id}>
                    <td>{row.articulo}</td>
                    <td>{row.fecha}</td>
                    <td>{row.tipo}</td>
                    <td>{row.movto}</td>
                    <td>{row.desc_movto}</td>
                    <td>{row.cantidad}</td>
                    <td>{row.costo}</td>
                    <td>{row.costoTotal}</td> {/* Nueva columna */}
                    <td>{row.referencia}</td>
                    <td>{row.hora}</td>
                    <td>{row.nombre}</td>
                    <td>{row.turno}</td>
                    <td>{row.ppub}</td>
                    <td>{row.dscto}</td>
                    <td>{row.precioFinal}</td> {/* Nueva columna */}
                    <td>{row.utilidad}</td> {/* Nueva columna */}
                    <td>{row.fol}</td>
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
          <div class="d-flex justify-content-end">
            <button class="btn btn-primary me-2" onClick={exportToPDF}>Exportar a PDF</button>
            <button class="btn btn-success" onClick={printTable}>Imprimir</button>
          </div>
        </div>
      </div>
    </>
  );
};

export default DataTable;
