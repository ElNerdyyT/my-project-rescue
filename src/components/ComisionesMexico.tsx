import { useState, useEffect } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface TableRow {
  id: number;
  cve_empleado: string;
  cve_art: string;
  nombresArticulo: string;
  cantidad: number; // Should be number after transformation
  precio_vta: number; // Should be number after transformation
  costo: number; // Should be number after transformation
  importe_tot: number; // Should be number after transformation
  folio: string;
  nombre: string;
  fecha: string; // Expecting 'YYYY-MM-DD' format after transformation from DB (but source is YYYY-MM-DD HH:MM:SS)
}

// Type for the summary data calculated per salesperson
interface TotalsSummary {
  name: string;
  totalCosto: number;
  totalImporte: number;
  totalUtilidad: number;
}

// Type for Supabase data before transformation
// Use 'any' for flexibility or define a more specific type if structure is consistent
type SupabaseDataRow = any;

// Define types for Supabase responses for better safety
interface DateRangeResponse {
  start_date: string;
  end_date: string;
}

interface ArticleResponse {
  cve_articulo_a: string;
  nombre_comer_a: string;
}

const DataTable = () => {
  const [data, setData] = useState<TableRow[]>([]);
  const [filteredData, setFilteredData] = useState<TableRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null); // Added error state
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [modalData, setModalData] = useState<TableRow[]>([]);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [selectedSucursal, setSelectedSucursal] = useState<string>('General'); // Default to General

  const SUCURSAL_TABLES: Record<string, string> = {
      'Econo1': 'ComisionesEcono1',
      'México': 'ComisionesMexico',
      'Madero': 'ComisionesMadero',
      'LopezM': 'ComisionesLopezM',
      'Lolita': 'ComisionesLolita',
      'Baja': 'ComisionesBaja',
      'Econo2': 'ComisionesEcono2',
      // Add more if needed
  };
  const ALL_TABLE_NAMES = Object.values(SUCURSAL_TABLES);

  // Fetch initial date range
  useEffect(() => {
    const fetchDateRange = async () => {
      setError(null); // Reset error on new attempt
      setLoading(true); // Start loading indicator for dates
      try {
        const { data: dateData, error: dateError } = await supabase
          .from('date_range')
          .select('start_date, end_date')
          .single<DateRangeResponse>(); // Specify type

        if (dateError) {
          throw new Error(`Error al obtener el rango de fechas: ${dateError.message}`);
        }

        if (dateData) {
          // Basic validation or default setting if needed
          setStartDate(dateData.start_date || '');
          setEndDate(dateData.end_date || '');
        } else {
             throw new Error('No se encontró el rango de fechas.');
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Ocurrió un error al cargar el rango de fechas.');
        // Don't set loading to false here, let the main data fetch handle it
      }
      // setLoading(false); // Loading state will be managed by the main data fetch useEffect
    };

    fetchDateRange();
  }, []); // Runs once on mount

  // Fetch main commission data when dates or sucursal change
  useEffect(() => {
    if (!startDate || !endDate) {
      // Don't fetch if dates are not set
      setLoading(false); // Ensure loading is false if we skip fetching
      return;
    }

    let isCancelled = false; // Flag to prevent state updates after unmount or quick changes
    const currentSelectedSucursal = selectedSucursal; // Capture state for async operation

    const fetchData = async () => {
      // Only set loading=true if we are actually going to fetch for the CURRENT selection
      if (!isCancelled && currentSelectedSucursal === selectedSucursal) {
          setLoading(true);
          setError(null); // Reset error state
          setData([]); // Clear previous data
          setFilteredData([]); // Clear previous filtered data
      } else {
          // If the selection changed before fetch started, just bail out
          return;
      }


      // ----- START OF MODIFICATION: Adapt query date format -----
      let formattedStartDate: string;
      let formattedEndDate: string;
      try {
        // Basic validation to ensure startDate and endDate look like YYYY-MM-DD
        if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
             throw new Error("Formato de fecha inválido. Use YYYY-MM-DD.");
        }

        // Format dates as strings matching the TEXT column 'YYYY-MM-DD HH:MM:SS'
        // This allows lexicographical comparison to work correctly for the text 'fecha' column
        formattedStartDate = startDate + ' 00:00:00'; // e.g., "2025-03-17 00:00:00"
        formattedEndDate = endDate + ' 23:59:59';     // e.g., "2025-03-17 23:59:59" (Inclusive end for the day)

      } catch (dateError: any) {
          console.error("Error al formatear fechas para consulta:", startDate, endDate, dateError);
          if (!isCancelled) {
             setError(dateError.message || "Las fechas seleccionadas son inválidas o no se pudieron formatear.");
             setLoading(false);
          }
          return;
      }
      // ----- END OF MODIFICATION -----


      let supabaseData: SupabaseDataRow[] = [];
      let fetchError: string | null = null;

      try {
        if (currentSelectedSucursal === 'General') {
          // Fetch from all tables concurrently
          const promises = ALL_TABLE_NAMES.map((tableName) =>
            supabase
              .from(tableName)
              .select('*')
              .gte('fecha', formattedStartDate) // Use the text-formatted date
              .lte('fecha', formattedEndDate)   // Use the text-formatted date
              // Order within each table fetch if needed, but global sort happens later
              // .order('fecha', { ascending: false }) // Ordering text might be lexicographical, not chronological
          );
          const results = await Promise.all(promises);

          if (isCancelled) return; // Check cancellation after await

          results.forEach((result, index) => {
            if (result.error) {
              console.error(`Error al obtener datos de ${ALL_TABLE_NAMES[index]}:`, result.error.message);
              // Optionally collect errors: fetchError = fetchError ? `${fetchError}\n${result.error.message}` : result.error.message;
            } else if (result.data) {
              supabaseData = supabaseData.concat(result.data);
            }
          });
          // Global sort after merging - IMPORTANT: sorting text dates might be incorrect if format varies!
          // This assumes all 'fecha' strings are in YYYY-MM-DD HH:MM:SS format for correct sorting.
          supabaseData.sort((a, b) => {
             // Use string comparison, but it's less reliable than date objects
             if (a.fecha < b.fecha) return 1;
             if (a.fecha > b.fecha) return -1;
             return 0;
          });


        } else {
          // Fetch from the selected single table
          const tableName = SUCURSAL_TABLES[currentSelectedSucursal];
          if (!tableName) {
              throw new Error(`Nombre de sucursal no válido: ${currentSelectedSucursal}`);
          }
          const { data: dataFromTable, error: tableError } = await supabase
            .from(tableName)
            .select('*')
            .gte('fecha', formattedStartDate) // Use the text-formatted date
            .lte('fecha', formattedEndDate)   // Use the text-formatted date
            .order('fecha', { ascending: false }); // Ordering text might be lexicographical

          if (isCancelled) return; // Check cancellation after await

          if (tableError) {
            throw new Error(`Error al obtener datos de ${tableName}: ${tableError.message}`);
          }
          supabaseData = dataFromTable || [];
        }

        if (isCancelled) return; // Final check before potentially long processing

        if (fetchError) {
            // If there were non-critical errors during 'General' fetch, set the error state
            setError((prevError) => prevError ? `${prevError}\nAlgunos datos no pudieron ser cargados: ${fetchError}` : `Algunos datos no pudieron ser cargados: ${fetchError}`);
        }

        // --- Fetch Article Names ---
        if (supabaseData.length === 0) {
           // No data found for the period/branch
           setData([]);
           // setLoading(false); // setLoading should be handled in finally
           return; // Exit early
        }

        const cveArts = [...new Set(supabaseData.map((item) => item.cve_art))].filter(Boolean); // Filter out null/empty keys
        let articlesMap: Record<string, string> = {};

        if (cveArts.length > 0) {
            const { data: articlesData, error: articlesError } = await supabase
            .from('ArticulosMexico') // Assuming this table applies to all branches or is the master list
            .select('cve_articulo_a, nombre_comer_a')
            .in('cve_articulo_a', cveArts);

             if (isCancelled) return; // Check cancellation after await

            if (articlesError) {
              console.error('Error al obtener nombres de artículos:', articlesError.message);
              setError((prevError) => prevError ? `${prevError}\nError al obtener nombres de artículos.` : 'Error al obtener nombres de artículos.');
            } else if (articlesData) {
              articlesMap = articlesData.reduce((map, article: ArticleResponse) => {
                  map[article.cve_articulo_a] = article.nombre_comer_a;
                  return map;
              }, {} as Record<string, string>);
            }
        }

        // --- Transform Data ---
        // Helper function for safely parsing string/number inputs to float
        const safeParseFloat = (value: any): number => {
            if (value === null || value === undefined) {
                return 0; // Handle null/undefined explicitly
            }
            const num = parseFloat(value);
            return isNaN(num) ? 0 : num;
        };

        const transformedData = supabaseData.map((item): TableRow => {
             return {
                 id: item.id,
                 cve_empleado: item.cve_empleado || '',
                 cve_art: item.cve_art || '',
                 folio: item.folio || '',
                 nombre: item.nombre || 'Desconocido',
                 // Keep the original date string format for display, but take only date part
                 // Note: This assumes the format is always 'YYYY-MM-DD HH:MM:SS'
                 fecha: item.fecha ? item.fecha.substring(0, 10) : 'Fecha inválida',
                 nombresArticulo: articlesMap[item.cve_art] || 'Nombre no disponible',
                 cantidad: safeParseFloat(item.cantidad),
                 precio_vta: safeParseFloat(item.precio_vta),
                 costo: safeParseFloat(item.costo),
                 importe_tot: safeParseFloat(item.importe_tot),
             };
         });

        if (!isCancelled) { // Final check before setting state
            setData(transformedData);
        }

      } catch (err: any) {
        console.error('Error en fetchData:', err);
        if (!isCancelled) { // Only set error if not cancelled
             setError(err.message || 'Ocurrió un error desconocido al cargar los datos.');
             setData([]); // Clear data on critical error
        }
      } finally {
         if (!isCancelled) { // Only set loading false if not cancelled
            setLoading(false);
         }
      }
    };

    fetchData();

    // Cleanup function to set the flag on unmount or dependency change
    return () => {
      isCancelled = true;
    };

  }, [startDate, endDate, selectedSucursal]); // Dependencies: run when these change

  // Update filtered data when search query or raw data changes
  useEffect(() => {
    if (!searchQuery) {
      setFilteredData(data); // No search, show all data
    } else {
      const lowerCaseQuery = searchQuery.toLowerCase();
      setFilteredData(
        data.filter((row) =>
          Object.values(row).some((value) =>
            value?.toString().toLowerCase().includes(lowerCaseQuery) // Add null check for safety
          )
        )
      );
    }
  }, [searchQuery, data]); // Dependencies: search query and the main data array

  // --- Calculations ---
  // Group data by salesperson name using the filtered data
  const groupedData = filteredData.reduce((acc, row) => {
    const nameKey = row.nombre || 'Desconocido'; // Handle potential undefined names
    if (!acc[nameKey]) {
      acc[nameKey] = [];
    }
    acc[nameKey].push(row);
    return acc;
  }, {} as Record<string, TableRow[]>);

  // Calculate totals per salesperson and sort them
  const totalsByName: TotalsSummary[] = Object.keys(groupedData)
    .map((name) => {
      const rows = groupedData[name];
      const totalCosto = rows.reduce((sum, row) => sum + (row.costo * row.cantidad), 0);
      const totalImporte = rows.reduce((sum, row) => sum + row.importe_tot, 0);
      const totalUtilidad = totalImporte - totalCosto;
      return { name, totalCosto, totalImporte, totalUtilidad };
    })
    .sort((a, b) => b.totalImporte - a.totalImporte); // Sort by total sales amount

  // Calculate overall totals using the filtered data
  const overallTotalCosto = totalsByName.reduce((sum, totals) => sum + totals.totalCosto, 0);
  const overallTotalImporte = totalsByName.reduce((sum, totals) => sum + totals.totalImporte, 0);
  const overallTotalUtilidad = totalsByName.reduce((sum, totals) => sum + totals.totalUtilidad, 0);

  // --- Modal Handlers ---
  const handleOpenModal = (name: string) => {
    // Sort modal data by the transformed 'fecha' string (YYYY-MM-DD)
    const dataForModal = (groupedData[name] || []).sort((a, b) => {
        if (a.fecha < b.fecha) return 1; // Descending sort
        if (a.fecha > b.fecha) return -1;
        return 0;
    });
    setModalData(dataForModal);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setModalData([]);
  };

  // --- PDF Generation ---
  const generatePdf = () => {
    if (totalsByName.length === 0) {
        console.warn("No data available to generate PDF.");
        alert("No hay datos disponibles para generar el PDF."); // Inform user
        return;
    }
    const doc = new jsPDF();
    const tableColumn: string[] = ["Nombre", "Total Costo", "Total Importe", "Utilidad Total", "Comisión (10%)"];
    const tableRows: (string | number)[][] = [];

    totalsByName.forEach(totals => {
      const commission = totals.totalUtilidad * 0.10;
      const rowData = [
        totals.name,
        `$${totals.totalCosto.toFixed(2)}`,
        `$${totals.totalImporte.toFixed(2)}`,
        `$${totals.totalUtilidad.toFixed(2)}`,
        `$${commission.toFixed(2)}`
      ];
      tableRows.push(rowData);
    });

    const dateStr = startDate && endDate ? `${startDate} al ${endDate}` : 'Rango no definido';
    const branchName = selectedSucursal === 'General' ? 'Todas las Sucursales' : selectedSucursal;
    const title = `Reporte de Comisiones - ${branchName}`;

    doc.setFontSize(18);
    doc.text(title, 14, 20);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Periodo: ${dateStr}`, 14, 30);

    // Add table using autoTable
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 35, // Start table below the title and date
      theme: 'striped', // Optional theme: 'striped', 'grid', 'plain'
      headStyles: { fillColor: [22, 160, 133] }, // Green header
       foot: [[ // Footer row data
           'TOTAL GENERAL',
           `$${overallTotalCosto.toFixed(2)}`,
           `$${overallTotalImporte.toFixed(2)}`,
           `$${overallTotalUtilidad.toFixed(2)}`,
           `$${(overallTotalUtilidad * 0.10).toFixed(2)}`
       ]],
       footStyles: { fillColor: [211, 211, 211], textColor: 0, fontStyle: 'bold'}, // Style footer
    });

    // Add filename with dates and branch
     const filename = `Reporte_Comisiones_${branchName.replace(/\s+/g, '_')}_${startDate}_al_${endDate}.pdf`;
    doc.save(filename);
  };

  // --- Render Logic ---
  // Display loading indicator more consistently
  const renderLoading = () => (
     <div class="text-center p-4">
         <div class="spinner-border text-primary" role="status"></div>
         <p class="mt-2">{!startDate || !endDate ? 'Esperando rango de fechas...' : 'Cargando datos...'}</p>
     </div>
  );

  if (loading) {
     return renderLoading();
  }

  if (error) {
    // Show error but still allow controls if dates loaded successfully
    if (!startDate || !endDate) {
        return <div class="alert alert-danger m-3" role="alert">Error al cargar rango de fechas: {error}</div>;
    }
    // If dates loaded but data fetch failed, show controls + error
  }

  // Main component render
  return (
    <>
      {/* --- Controls: Sucursal Selector --- */}
      <div class="row mb-3 align-items-end px-3">
        <div class="col-md-4">
          <label for="sucursalSelect" class="form-label">Seleccionar Sucursal:</label>
          <select
            id="sucursalSelect"
            class="form-select"
            value={selectedSucursal}
            onChange={(e) => {
                // No need to set loading here, useEffect dependency change handles it
                setSelectedSucursal((e.target as HTMLSelectElement).value);
            }}
            disabled={loading} // Disable while loading
          >
            <option value="General">General (Todas)</option>
            {Object.keys(SUCURSAL_TABLES).map(sucursalKey => (
                 <option key={sucursalKey} value={sucursalKey}>{sucursalKey}</option>
            ))}
          </select>
        </div>
        {/* Add placeholder for future date inputs if needed */}
        {/* <div class="col-md-4"> Placeholder for date inputs </div> */}
         <div class="col-md-4 text-md-end mt-2 mt-md-0 ms-auto"> {/* Use ms-auto to push button right */}
             <button
               class="btn btn-secondary"
               onClick={generatePdf}
               disabled={totalsByName.length === 0 || loading} // Also disable while loading
               title={totalsByName.length === 0 ? "No hay datos para generar el PDF" : "Generar Reporte PDF"}
             >
               <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-file-download" width="24" height="24" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" /><path d="M12 17v-6" /><path d="M9.5 14.5l2.5 2.5l2.5 -2.5" /></svg>
               <span class="ms-1">Generar PDF</span>
             </button>
         </div>
      </div>

      {/* --- Display Error if any, after controls --- */}
      {error && <div class="alert alert-warning m-3" role="alert">Advertencia: {error}</div>}


      {/* --- Overall Totals Cards --- */}
      <div class="row mb-4 px-3">
        <div class="col-lg-4 col-md-6 mb-3">
          <div class="card text-white bg-danger h-100">
            <div class="card-body">
              <h5 class="card-title">Total Costo General</h5>
              <p class="card-text fs-4 fw-bold">${overallTotalCosto.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div class="col-lg-4 col-md-6 mb-3">
          <div class="card text-white bg-success h-100">
            <div class="card-body">
              <h5 class="card-title">Total Importe General</h5>
              <p class="card-text fs-4 fw-bold">${overallTotalImporte.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div class="col-lg-4 col-md-12 mb-3">
           <div class="card text-dark bg-warning h-100">
            <div class="card-body">
              <h5 class="card-title">Utilidad Total General</h5>
              <p class="card-text fs-4 fw-bold">${overallTotalUtilidad.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* --- Summary Table per Salesperson --- */}
      <div class="col-12 px-3">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">
              {selectedSucursal === 'General'
                ? 'Resumen de Comisiones por Vendedor (Todas las Sucursales)'
                : `Resumen de Comisiones por Vendedor (${selectedSucursal})`}
                <span class="ms-2 text-muted fs-5">({startDate} al {endDate})</span>
            </h3>
          </div>
          <div class="card-body border-bottom py-3">
            <div class="d-flex flex-wrap justify-content-between">
              <div class="text-secondary mb-2 mb-md-0">
                {/* Show count based on filtered summary data */}
                {totalsByName.length} Vendedor{totalsByName.length !== 1 ? 'es' : ''} encontrado{totalsByName.length !== 1 ? 's' : ''}
                {searchQuery && ` (filtrado de ${data.length} registros totales)`}
              </div>
              <div class="ms-md-auto text-secondary">
                Buscar en detalles (afecta cálculos):
                <div class="ms-2 d-inline-block" style={{minWidth: '200px'}}>
                  <input
                    type="search"
                    class="form-control form-control-sm"
                    value={searchQuery}
                    onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
                    aria-label="Buscar en detalles"
                    placeholder="Buscar por artículo, folio, etc..."
                    disabled={loading} // Disable search while loading affects filteredData
                  />
                </div>
              </div>
            </div>
          </div>

          <div class="table-responsive">
            <table class="table card-table table-vcenter text-nowrap datatable table-hover">
              <thead>
                <tr>
                  <th>Nombre Vendedor</th>
                  <th class="text-end">Total Costo</th>
                  <th class="text-end">Total Importe</th>
                  <th class="text-end">Utilidad Total</th>
                  <th class="text-center">Acción</th>
                </tr>
              </thead>
              <tbody>
                {totalsByName.length > 0 ? (
                  totalsByName.map((totals) => (
                    <tr key={totals.name}>
                      <td>{totals.name}</td>
                      <td class="text-end">${totals.totalCosto.toFixed(2)}</td>
                      <td class="text-end">${totals.totalImporte.toFixed(2)}</td>
                      <td class="text-end">${totals.totalUtilidad.toFixed(2)}</td>
                      <td class="text-center">
                        <button class="btn btn-info btn-sm" onClick={() => handleOpenModal(totals.name)} disabled={loading}>
                          Ver Detalles
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} class="text-center text-secondary py-4">
                        {/* Message depends on why it's empty */}
                        {loading ? 'Cargando...' : (searchQuery ? 'No hay coincidencias con la búsqueda.' : 'No hay datos para mostrar con los filtros actuales.')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* --- Modal for Sale Details --- */}
      {showModal && (
        <>
          {/* Backdrop */}
          <div
            class="modal-backdrop fade show"
            style={{ zIndex: 1050 }}
            onClick={handleCloseModal}
          ></div>
          {/* Modal Dialog */}
          <div
            class="modal fade show d-block"
            tabIndex={-1}
            aria-modal="true"
            role="dialog"
            style={{ zIndex: 1055 }}
            onClick={(e) => { if (e.target === e.currentTarget) handleCloseModal(); }} // Close on click outside modal content
          >
            <div class="modal-dialog modal-xl modal-dialog-scrollable"> {/* Increased size and scrollable */}
              <div class="modal-content">
                <div class="modal-header">
                  <h5 class="modal-title">Detalles de Ventas: {modalData[0]?.nombre || 'N/A'}</h5>
                  <button type="button" class="btn-close" onClick={handleCloseModal} aria-label="Close"></button>
                </div>
                <div class="modal-body">
                  {modalData.length > 0 ? (
                    <div class="table-responsive">
                      <table class="table table-striped table-hover table-sm"> {/* Added table-sm */}
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Folio</th>
                            <th>Articulo (Código)</th> {/* Updated header */}
                            <th class="text-end">Cantidad</th>
                            <th class="text-end">Precio Vta.</th>
                            <th class="text-end">Costo Unit.</th>
                            <th class="text-end">Importe Total</th>
                            {/* Uncomment if needed, but calculation is simple
                             <th class="text-end">Utilidad Artículo</th>
                             */}
                          </tr>
                        </thead>
                        <tbody>
                          {modalData.map((row) => (
                            // Use a more robust key if id is not unique across tables/fetches
                            <tr key={`${row.id}-${row.folio}-${row.cve_art}-${row.fecha}`}>
                              <td>{row.fecha}</td> {/* Already YYYY-MM-DD from transformation */}
                              <td>{row.folio}</td>
                              <td>{row.nombresArticulo} ({row.cve_art})</td>
                              <td class="text-end">{row.cantidad.toFixed(2)}</td>
                              <td class="text-end">${row.precio_vta.toFixed(2)}</td>
                              <td class="text-end">${row.costo.toFixed(2)}</td>
                              <td class="text-end">${row.importe_tot.toFixed(2)}</td>
                              {/* Uncomment if needed
                              <td class="text-end">${(row.importe_tot - (row.costo * row.cantidad)).toFixed(2)}</td>
                              */}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p class="text-center text-secondary">No hay detalles disponibles.</p>
                  )}
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