import { useState, useEffect, useMemo } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';

// --- Interfaces (remain the same) ---
interface OriginalTableRow { id: number; usu: string; fec: string; hor: string; cant: number; tipo: string; nota: string; mot: string; tur: string; fol: string; cor: string; nomtip: string; }
interface RawTableRow { id: number; usu: string; fec: string; hor: string; cant: number | string; tipo: string; nota: string; mot: string; tur: string; fol: string; cor: string; nomtip: string; }
interface AggregatedDailyTotal { date: string; totalQuantity: number; }

// --- Branches Definition (remain the same) ---
const branches = [
    { value: 'General', label: 'General' }, { value: 'SalidasEcono1', label: 'Econo1' }, { value: 'SalidasMadero', label: 'Madero' }, { value: 'SalidasMexico', label: 'México' }, { value: 'SalidasLolita', label: 'Lolita' }, { value: 'SalidasLopezM', label: 'López Mateos' }, { value: 'SalidasBaja', label: 'Baja' }, { value: 'SalidasEcono2', label: 'Econo2' },
];

// --- Helper Functions (remain the same) ---
const transformRow = (item: RawTableRow): OriginalTableRow => ({
    id: item.id, usu: item.usu ?? '', fec: item.fec ? item.fec.split(' ')[0] : 'N/A', hor: item.hor ? item.hor.split(' ')[1] || '00:00:00' : 'N/A', cant: parseFloat(parseFloat(String(item.cant ?? 0)).toFixed(2)) || 0, tipo: item.tipo ?? '', nota: item.nota ?? '', mot: item.mot ?? '', tur: item.tur ?? '', fol: item.fol ?? '', cor: item.cor ?? '', nomtip: item.nomtip ?? '',
});
const formatCurrency = (value: number): string => {
    return `$${(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// --- Component ---
const SalidasSucursalesAgrupadoConModal = () => {
    // State
    const [aggregatedData, setAggregatedData] = useState<AggregatedDailyTotal[]>([]);
    const [loadingAggregated, setLoadingAggregated] = useState<boolean>(false); // Renamed for clarity
    const [initialLoading, setInitialLoading] = useState<boolean>(true); // For date range fetching
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [selectedBranch, setSelectedBranch] = useState<string>('SalidasEcono1');
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [selectedDateForModal, setSelectedDateForModal] = useState<string | null>(null);
    const [modalData, setModalData] = useState<OriginalTableRow[]>([]);
    const [modalLoading, setModalLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null); // Optional: State for errors

    // Fetch date range ONCE on mount
    useEffect(() => {
        let isMounted = true; // Prevent state update on unmounted component
        setInitialLoading(true); // Start initial loading
        setError(null); // Clear previous errors

        const fetchDateRange = async () => {
            try {
                const { data, error: fetchError } = await supabase
                    .from('date_range')
                    .select('start_date, end_date')
                    .single();

                if (!isMounted) return; // Exit if component unmounted

                if (fetchError) {
                    console.error('Error fetching date range:', fetchError.message);
                    setError('Error al obtener el rango de fechas.');
                } else if (data) {
                    setStartDate(data.start_date);
                    setEndDate(data.end_date);
                } else {
                     setError('No se encontró el rango de fechas.');
                }
            } catch (e) {
                 if (!isMounted) return;
                console.error("Unexpected error fetching date range:", e)
                setError('Ocurrió un error inesperado al obtener las fechas.');
            } finally {
                 if (isMounted) {
                    setInitialLoading(false); // Finish initial loading regardless of outcome
                 }
            }
        };

        fetchDateRange();

        return () => {
            isMounted = false; // Cleanup function to set flag on unmount
        };
    }, []); // Empty dependency array means this runs only once on mount


    // Fetch and aggregate data when date range or branch changes
    useEffect(() => {
        // Only run if dates are set AND initial loading is done
        if (!startDate || !endDate || initialLoading) {
            // If dates/initial loading aren't ready, clear previous aggregated data if any
             if (aggregatedData.length > 0) setAggregatedData([]);
             // Don't proceed with fetch
             return;
        }

        let isMounted = true; // Prevent state update on unmounted component
        const fetchDataAndAggregate = async () => {
            // *** Set loading for AGGREGATED data fetch ***
            setLoadingAggregated(true);
            setError(null); // Clear previous errors related to aggregation
            setAggregatedData([]); // Clear previous results

            const formattedStartDate = `${startDate} 00:00:00`;
            const formattedEndDate = `${endDate} 23:59:59`;
            let allRawData: RawTableRow[] = [];
            const tablesToQuery = selectedBranch === 'General'
                ? branches.filter(b => b.value !== 'General').map(b => b.value)
                : [selectedBranch];
            const dailyTotals: { [date: string]: number } = {};

            try {
                for (const table of tablesToQuery) {
                     if (!isMounted) return; // Check before each async operation
                    const { data: tableData, error: fetchError } = await supabase
                        .from(table)
                        .select('*')
                        .gte('fec', formattedStartDate)
                        .lte('fec', formattedEndDate);

                    if (!isMounted) return; // Check after async operation

                    if (fetchError) {
                        console.error(`Error fetching data from ${table}:`, fetchError.message);
                        setError(`Error parcial al obtener datos de ${table}.`); // Show partial error?
                        // Decide if you want to 'continue' or 'throw' to stop aggregation on partial failure
                        continue;
                    } else if (tableData) {
                        allRawData = [...allRawData, ...tableData as RawTableRow[]];
                    }
                }

                // Aggregation logic
                allRawData.forEach((item) => {
                    if (item.fec) {
                         const dateKey = item.fec.split(' ')[0];
                         const quantity = parseFloat(String(item.cant ?? 0)) || 0;
                         dailyTotals[dateKey] = (dailyTotals[dateKey] || 0) + quantity;
                    }
                });

                 const aggregatedResult: AggregatedDailyTotal[] = Object.entries(dailyTotals)
                    .map(([date, totalQuantity]) => ({
                        date: date,
                        totalQuantity: parseFloat(Number(totalQuantity).toFixed(2)) || 0,
                    }))
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Descending sort

                if (isMounted) {
                    setAggregatedData(aggregatedResult); // Set final aggregated data
                }

            } catch (e) {
                 if (isMounted) {
                     console.error("Error during data fetch or aggregation:", e);
                     setError('Error al procesar los datos de salidas.');
                     setAggregatedData([]); // Ensure data is cleared on error
                 }
            } finally {
                // *** Finish loading for AGGREGATED data ***
                 if (isMounted) {
                     setLoadingAggregated(false);
                 }
            }
        };

        fetchDataAndAggregate();

         return () => {
            isMounted = false; // Cleanup function for this effect too
        };

        // *** CRITICAL FIX: Removed 'loadingAggregated' from dependency array ***
        // This effect should ONLY re-run when the inputs (dates, branch) change.
    }, [startDate, endDate, selectedBranch, initialLoading]); // Rerun when dates/branch change OR when initial loading completes


    // Function to fetch detailed data for the modal (no change needed here)
    const fetchModalData = async (date: string) => {
        // ... (implementation remains the same, uses setModalLoading, etc.)
        if (!date) return;
        setModalLoading(true);
        setIsModalOpen(true);
        setSelectedDateForModal(date);
        setModalData([]);
        // ... rest of fetchModalData
         try {
             // ... fetch logic using supabase ...
              let detailedRawData: RawTableRow[] = [];
              const dayStart = `${date} 00:00:00`;
              const dayEnd = `${date} 23:59:59`;
               const tablesToQuery = selectedBranch === 'General'
                   ? branches.filter(b => b.value !== 'General').map(b => b.value)
                   : [selectedBranch];

              for (const table of tablesToQuery) {
                 const { data: tableData, error } = await supabase
                     .from(table)
                     .select('*')
                     .gte('fec', dayStart)
                     .lte('fec', dayEnd)
                     .order('hor', { ascending: true });
                 if (error) { /* handle */ }
                 else if (tableData) { detailedRawData = [...detailedRawData, ...tableData as RawTableRow[]]; }
              }

               const transformedDetails = detailedRawData.map(transformRow);
                if (selectedBranch === 'General') {
                    transformedDetails.sort((a, b) => a.hor.localeCompare(b.hor));
                }
                setModalData(transformedDetails);

         } catch(e) { /* handle */ setModalData([]);}
          finally {setModalLoading(false);}

    };

    const closeModal = () => {
         // ... (implementation remains the same)
         setIsModalOpen(false);
         setSelectedDateForModal(null);
         setModalData([]);
    };

    // Calculate Grand Total (no change needed here)
    const grandTotal = useMemo(() => {
        return aggregatedData.reduce((sum, day) => sum + Number(day.totalQuantity || 0), 0);
    }, [aggregatedData]);


    // --- Render Logic ---

    // 1. Handle Initial Loading (fetching date range)
    if (initialLoading) {
        return (
             <div class="d-flex justify-content-center align-items-center" style={{ height: '200px' }}>
                <div class="spinner-border text-secondary" role="status"></div>
                <span class="ms-3 text-muted">Obteniendo rango de fechas...</span>
             </div>
        );
    }

    // 2. Handle Errors (can be from date range fetch or aggregation fetch)
     if (error) {
         return <div class="alert alert-danger" role="alert">Error: {error}</div>;
     }

     // 3. Handle state where date range fetch finished but dates are missing
     if (!startDate || !endDate) {
          return <div class="alert alert-warning" role="alert">No se pudo determinar el rango de fechas para mostrar los datos.</div>;
     }


    // 4. Render the main component (Card, Table, Modal)
    //    (Uses `loadingAggregated` state for the table body)
    return (
        <div class="col-12">
            {/* --- Main Aggregated Data Card --- */}
            <div class="card shadow-sm mb-4">
                <div class="card-header bg-light bg-opacity-75 border-bottom d-flex justify-content-between align-items-center">
                    <h3 class="card-title mb-0">
                        Total de Salidas por Día -{' '}
                        <span class="fw-bold">{branches.find(b => b.value === selectedBranch)?.label ?? selectedBranch}</span>
                    </h3>
                    <select
                        class="form-select form-select-sm w-auto"
                        value={selectedBranch}
                        // Disable while AGGREGATED data is loading or initial setup isn't done
                        disabled={loadingAggregated || initialLoading}
                        onChange={(e) => setSelectedBranch(e.currentTarget.value)}
                        aria-label="Seleccionar Sucursal"
                    >
                        {branches.map((branch) => (
                            <option key={branch.value} value={branch.value}>
                                {branch.label}
                            </option>
                        ))}
                    </select>
                </div>

                 {/* Date range display */}
                 <div class="card-body border-bottom py-2">
                        <p class="m-0 text-muted">
                            Mostrando totales diarios desde <strong class="text-dark">{startDate}</strong> hasta <strong class="text-dark">{endDate}</strong>. Click en una fila para ver detalles.
                        </p>
                 </div>

                {/* Aggregated Table */}
                <div class="table-responsive">
                    <table class="table card-table table-vcenter text-nowrap table-hover table-striped mb-0">
                        <thead class="thead-light">
                            <tr>
                                <th class="px-3">Fecha</th>
                                <th class="text-end px-3">Total Cantidad</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Use loadingAggregated here */}
                            {loadingAggregated ? (
                                <tr><td colSpan={2} class="text-center p-5"><div class="spinner-border text-primary spinner-border-sm" role="status"></div> <span class="text-muted ms-2">Cargando datos agregados...</span></td></tr>
                            ) : aggregatedData.length > 0 ? (
                                aggregatedData.map((row) => (
                                    // Disable row click if modal is already loading
                                    <tr key={row.date} onClick={() => !modalLoading && fetchModalData(row.date)} style={{ cursor: modalLoading ? 'default' : 'pointer' }} title="Click para ver detalles">
                                        <td class="px-3">{row.date}</td>
                                        <td class="text-end px-3">{formatCurrency(row.totalQuantity)}</td>
                                    </tr>
                                ))
                            ) : (
                                // Message if aggregation finished but no data found
                                <tr><td colSpan={2} class="text-center text-secondary py-4 fst-italic">No hay datos agregados para mostrar en el rango o sucursal seleccionados.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                 {/* Footer with Grand Total */}
                <div class="card-footer bg-light bg-opacity-75 border-top d-flex justify-content-between align-items-center py-2 px-3">
                     <p class="m-0 text-muted small">
                          {/* Reflect aggregated loading status */}
                         {loadingAggregated ? '...' : `${aggregatedData.length} día(s) con salidas.`}
                    </p>
                    {/* Show total only if not loading and data exists */}
                    {!loadingAggregated && aggregatedData.length > 0 && (
                         <p class="m-0 text-end">
                           <span class="text-muted me-2">Total Periodo:</span>
                           <strong class="text-dark fs-5">{formatCurrency(grandTotal)}</strong>
                        </p>
                    )}
                </div>
            </div> {/* End of main card */}

            {/* --- Modal for Detailed View (No structural change needed) --- */}
            {isModalOpen && (
                // ... Modal JSX ...
                <div class="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }} onClick={closeModal} aria-modal="true" role="dialog">
                     <div class="modal-dialog modal-xl modal-dialog-scrollable modal-dialog-centered" onClick={e => e.stopPropagation()} style={{zIndex: 1060}}>
                        <div class="modal-content shadow-lg">
                             <div class="modal-header bg-primary text-white">
                                 <h5 class="modal-title">Detalle de Salidas - <span class="fw-normal">{selectedDateForModal}</span> - ({branches.find(b => b.value === selectedBranch)?.label ?? selectedBranch})</h5>
                                 <button type="button" class="btn-close btn-close-white" aria-label="Close" onClick={closeModal} disabled={modalLoading}></button>
                            </div>
                             <div class="modal-body p-0">
                                 {modalLoading ? ( /* Modal specific loading */
                                     <div class="text-center p-5"><div class="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}></div><p class="mt-3 text-muted">Cargando detalles...</p></div>
                                 ) : modalData.length > 0 ? (
                                    <div class="table-responsive"> <table class="table table-vcenter text-nowrap table-striped table-sm mb-0"><thead class="thead-light sticky-top" style={{zIndex: 5, top: '-1px'}}><tr> <th class="px-3">Usu</th> <th class="px-3">Fecha</th> <th class="px-3">Hora</th> <th class="text-end px-3">Cant</th> <th class="px-3">Tipo</th> <th class="px-3">Nota</th> <th class="px-3">Motivo</th> <th class="px-3">Turno</th> <th class="px-3">Folio</th> <th class="px-3">Cor</th> <th class="px-3">NomTip</th> </tr></thead> <tbody> {modalData.map((row) => (<tr key={`${row.id}-${row.fec}-${row.hor}`}> <td class="px-3">{row.usu}</td> <td class="px-3">{row.fec}</td> <td class="px-3">{row.hor}</td> <td class="text-end px-3">{formatCurrency(row.cant)}</td> <td class="px-3">{row.tipo}</td> <td class="px-3" title={row.nota} style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.nota}</td> <td class="px-3" title={row.mot} style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.mot}</td> <td class="px-3">{row.tur}</td> <td class="px-3">{row.fol}</td> <td class="px-3">{row.cor}</td> <td class="px-3" title={row.nomtip} style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.nomtip}</td> </tr>))} </tbody> </table> </div>
                                ) : (
                                     <p class="text-center text-secondary p-5 fst-italic">No se encontraron salidas detalladas para esta fecha.</p>
                                )}
                            </div>
                            <div class="modal-footer bg-light"><button type="button" class="btn btn-outline-secondary" onClick={closeModal} disabled={modalLoading}>Cerrar</button></div>
                        </div>
                    </div>
                </div>
            )} {/* End of modal */}

             {/* Minimal Modal CSS */}
             <style jsx>{`
                 .modal.fade.show { display: block !important; }
                 .table-responsive thead.sticky-top th { background-color: #f8f9fa; }
                `}</style>
        </div> // End of component container
    );
};

export default SalidasSucursalesAgrupadoConModal;