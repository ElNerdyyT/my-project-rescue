// --- START OF FILE VentasCardsReport.tsx ---

import { useState, useEffect } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';

// Interface for raw data fetched from a Kardex table (used by fetchBranchSummary)
interface VentaRowData {
  cantidad: string | number | null;
  costo: string | number | null;
  dscto: string | number | null;
  ppub: string | number | null;
}

// Interface for the aggregated summary from ONE branch (returned by fetchBranchSummary)
interface BranchSummary {
  totalCantidad: number;
  totalCosto: number;
  totalPpub: number;
  totalDscto: number;
}

// Interface for the structure returned by the RPC function
// Names must match the 'RETURNS TABLE' definition in the SQL function (get_general_ventas_summary_union)
interface GeneralSummary {
    total_cantidad: number;
    total_costo: number;
    total_ppub: number;
    total_dscto: number;
}

// Interface for the overall aggregated state for the cards
interface CardsState {
  totalProductosVendidos: number;
  totalCostoGeneral: number;
  totalPrecioPublico: number;
  totalDescuentoGeneral: number;
  utilidadBruta: number;
  isLoading: boolean;
  error: string | null;
  loadingMessage?: string; // Optional message during loading
}

// Interface for the props expected by this component
interface VentasCardsProps {
  startDate: string;        // Received from parent
  endDate: string;          // Received from parent
  selectedBranch: string;   // Received from parent
  operatingExpenses: number; // Received from parent
}


// List of ALL branches (still needed for individual branch logic)

// Helper function to safely parse and round numbers
const safeParseFloatAndRound = (value: any, decimals: number = 2): number => {
    if (value === null || value === undefined) {
        return 0;
    }
    // Ensure value is treated as string before replace
    const stringValue = String(value).replace(/,/g, '.');
    const num = parseFloat(stringValue);
    if (isNaN(num)) {
        return 0;
    }
    const multiplier = Math.pow(10, decimals);
    // Use Number.EPSILON for better rounding precision with floating point numbers
    const roundedNum = Math.round((num * multiplier) + Number.EPSILON) / multiplier;
    // Ensure the final output is fixed to the specified decimals as a string, then convert back to Number
    return Number(roundedNum.toFixed(decimals));
};


// Component now accepts props, including operatingExpenses
const VentasCardsReport = ({ startDate, endDate, selectedBranch, operatingExpenses }: VentasCardsProps) => {
  const [data, setData] = useState<CardsState>({
    totalProductosVendidos: 0,
    totalCostoGeneral: 0,
    totalPrecioPublico: 0,
    totalDescuentoGeneral: 0,
    utilidadBruta: 0,
    isLoading: true, // Start loading initially
    error: null,
  });

  // --- Helper function to fetch and aggregate data for a SINGLE branch ---
  // This remains necessary for when a specific branch is selected
   const fetchBranchSummary = async (branch: string, start: string, end: string): Promise<BranchSummary> => {
     try {
         const { data: result, error } = await supabase
             .from(branch)
             .select('cantidad, costo, ppub, dscto')
             .eq('movto', '1')
             .gte('fecha', `${start} 00:00:00`)
             .lte('fecha', `${end} 23:59:59`)
             .returns<VentaRowData[]>();

         if (error) {
             console.error(`Error fetching data from ${branch}:`, error);
              throw new Error(`Error en ${branch}: ${error.message}`);
         }

         if (!result) {
              console.warn(`No sales data found for ${branch} between ${start} and ${end}`);
              return { totalCantidad: 0, totalCosto: 0, totalPpub: 0, totalDscto: 0 };
         }

         const summary = result.reduce(
             (acc: BranchSummary, item) => {
                 const cantidad = safeParseFloatAndRound(item.cantidad, 0);
                 // Important: Handle potential zero quantity and ensure cost/ppub are parsed correctly
                 const costo = cantidad !== 0 ? safeParseFloatAndRound(item.costo) : 0;
                 const ppub = cantidad !== 0 ? safeParseFloatAndRound(item.ppub) : 0;
                 // Dscto might be per transaction, not tied to quantity? Assuming it's total discount on the line item.
                 const dscto = safeParseFloatAndRound(item.dscto);

                 acc.totalCantidad += cantidad;
                 // Ensure calculations only happen if cantidad is positive
                 if (cantidad > 0) {
                    acc.totalCosto += cantidad * costo;
                    acc.totalPpub += cantidad * ppub;
                 }
                 // Sum discount regardless of quantity - assuming dscto is the total discount for that row entry
                  acc.totalDscto += dscto;

                 return acc;
             },
             // Initial accumulator values
             { totalCantidad: 0, totalCosto: 0, totalPpub: 0, totalDscto: 0 }
         );

         // Final rounding for the summary object before returning
         return {
              totalCantidad: safeParseFloatAndRound(summary.totalCantidad, 0), // Round final quantity
              totalCosto: safeParseFloatAndRound(summary.totalCosto),
              totalPpub: safeParseFloatAndRound(summary.totalPpub),
              totalDscto: safeParseFloatAndRound(summary.totalDscto),
         };

     } catch (branchError) {
         // Log the error encountered during processing for this specific branch
         console.error(`Failed processing branch ${branch}:`, branchError);
         // Re-throw the error so it can be caught by the main effect's catch block
         throw branchError;
     }
   };


  // --- Effect to fetch aggregated data based on props ---
  useEffect(() => {
    // Basic validation: Only run if valid dates from props are set
    if (!startDate || !endDate || !startDate.includes('-') || !endDate.includes('-')) {
        console.log("VentasCardsReport: Waiting for valid dates from props...");
        setData(() => ({
            // Reset all data fields
            totalProductosVendidos: 0, totalCostoGeneral: 0, totalPrecioPublico: 0,
            totalDescuentoGeneral: 0, utilidadBruta: 0, isLoading: false,
            error: "Fechas no válidas o no proporcionadas."
        }));
        return; // Exit effect early
    }

    // Async function to perform the data fetching and aggregation
    const fetchSelectedBranchData = async () => {
      // Reset state and set loading true
      setData({
          totalProductosVendidos: 0, totalCostoGeneral: 0, totalPrecioPublico: 0,
          totalDescuentoGeneral: 0, utilidadBruta: 0, isLoading: true, error: null,
          loadingMessage: `Cargando ${selectedBranch === 'General' ? 'resumen general' : selectedBranch.replace('Kardex', '')}...`
      });

      // Define variables to hold the aggregated results
      let grandTotalProductos = 0;
      let grandTotalCosto = 0;
      let grandTotalPpub = 0;
      let grandTotalDscto = 0;

      try {
        // Use dates directly from props (assuming they are 'YYYY-MM-DD')
        const formattedStartDate = startDate;
        const formattedEndDate = endDate;

        // --- Logic fork: Use RPC for 'General', direct fetch for single branch ---
        if (selectedBranch === 'General') {
            // --- Fetch 'General' summary using the database function ---
            console.log(`VentasCardsReport: Calling DB function get_general_ventas_summary_union (Dates: ${formattedStartDate} - ${formattedEndDate})`);

            // Call the RPC function created with UNION ALL
            const { data: rpcResult, error: rpcError } = await supabase.rpc(
                'get_general_ventas_summary_union', // Use the UNION ALL function name
                { // Arguments for the function
                    start_date_param: formattedStartDate,
                    end_date_param: formattedEndDate
                }
            ).returns<GeneralSummary[]>(); // Specify the expected return type

            if (rpcError) {
                console.error("Error calling RPC function 'get_general_ventas_summary_union':", rpcError);
                // Provide specific error code if available for better debugging
                const errorDetail = rpcError.code ? `(Code: ${rpcError.code})` : '';
                throw new Error(`Error al calcular resumen general: ${rpcError.message} ${errorDetail}`);
            }

            // Check if the result is valid and contains data
            if (!rpcResult || rpcResult.length === 0) {
                 console.warn("RPC function 'get_general_ventas_summary_union' returned no summary data.");
                 // Set totals to 0 if no data is returned
                 grandTotalProductos = 0;
                 grandTotalCosto = 0;
                 grandTotalPpub = 0;
                 grandTotalDscto = 0;
            } else {
                // Extract totals from the first (and only) row returned by the function
                const generalSummary = rpcResult[0];
                // Ensure values are numbers, default to 0 if null/undefined somehow
                grandTotalProductos = generalSummary.total_cantidad ?? 0;
                grandTotalCosto = generalSummary.total_costo ?? 0;
                grandTotalPpub = generalSummary.total_ppub ?? 0;
                grandTotalDscto = generalSummary.total_dscto ?? 0;
            }

        } else {
            // --- Fetch summary for a SINGLE selected branch ---
            console.log(`VentasCardsReport: Fetching summary for single branch ${selectedBranch} (Dates: ${formattedStartDate} - ${formattedEndDate})`);
            // Use the existing helper function for single branches
            const summary = await fetchBranchSummary(selectedBranch, formattedStartDate, formattedEndDate);
            grandTotalProductos = summary.totalCantidad;
            grandTotalCosto = summary.totalCosto;
            grandTotalPpub = summary.totalPpub;
            grandTotalDscto = summary.totalDscto;
        }

        // --- Aggregation complete, calculate derived values and update state ---

        // Calculate Utilidad Bruta based on the fetched/calculated totals
        const utilidadBruta = grandTotalPpub - grandTotalCosto - grandTotalDscto;

        // Update state with the final aggregated data
        setData({
          totalProductosVendidos: safeParseFloatAndRound(grandTotalProductos, 0),
          totalCostoGeneral: safeParseFloatAndRound(grandTotalCosto),
          totalPrecioPublico: safeParseFloatAndRound(grandTotalPpub),
          totalDescuentoGeneral: safeParseFloatAndRound(grandTotalDscto),
          utilidadBruta: safeParseFloatAndRound(utilidadBruta),
          isLoading: false, // Set loading to false
          error: null, // Clear error on success
          loadingMessage: undefined // Clear loading message
        });

      } catch (error: any) {
        // Catch any error that occurred during fetch or aggregation
        console.error(`VentasCardsReport: Error fetching/processing data for ${selectedBranch}:`, error);
        setData((prev) => ({
          ...prev, // Keep existing state structure
          totalProductosVendidos: 0, // Reset values on error
          totalCostoGeneral: 0,
          totalPrecioPublico: 0,
          totalDescuentoGeneral: 0,
          utilidadBruta: 0,
          isLoading: false, // Set loading to false
          // Provide a user-friendly error message
          error: `Error al obtener datos para ${selectedBranch === 'General' ? 'General' : selectedBranch.replace('Kardex', '')}: ${error.message || 'Error desconocido'}`,
          loadingMessage: undefined // Clear loading message
        }));
      }
    };

    // Execute the data fetching function
    fetchSelectedBranchData();

    // Dependency array: Re-run effect if these props change
  }, [startDate, endDate, selectedBranch]);


  // --- Calculate Net Profit ---
  // Calculate Utilidad Neta dynamically based on the current state's Utilidad Bruta and the operatingExpenses prop
  const utilidadNeta = safeParseFloatAndRound(data.utilidadBruta - operatingExpenses);

  // --- Render ---
  // Prepare display names and date strings
  const branchDisplayName = selectedBranch === 'General' ? 'General' : selectedBranch.replace('Kardex', '');
  const dateDisplay = startDate && endDate ? `(${startDate} al ${endDate})` : '(Fechas no válidas)';

  return (
    <div className="container-xl mt-4 mb-4"> {/* Added margin-bottom */}
      {/* Update title dynamically based on selection */}
      <h3 class="mb-3">Resumen Financiero: {branchDisplayName} {dateDisplay}</h3>

      {/* --- Error Display --- */}
      {/* Show error alert if there's an error and not currently loading */}
      {data.error && !data.isLoading && (
        <div className="alert alert-danger">
          <strong>Error en Resumen de Ventas:</strong> {data.error}
        </div>
      )}

      {/* --- Loading Indicator --- */}
      {/* Show spinner and optional message while loading */}
      {data.isLoading && (
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '150px' }}>
          <div className="spinner-border text-primary" role="status">
            {/* Provide more specific loading text */}
            <span className="visually-hidden">{data.loadingMessage || 'Cargando resumen financiero...'}</span>
          </div>
           {/* Display the loading message next to the spinner */}
           {data.loadingMessage && <span class="ms-2 text-muted">{data.loadingMessage}</span>}
        </div>
      )}

      {/* --- Cards Display --- */}
      {/* Show cards only if NOT loading and NO error */}
      {!data.isLoading && !data.error && (
        <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-3"> {/* Adjusted cols for potentially 6 cards */}

          {/* Productos Vendidos Card */}
          <div className="col">
            <div className="card h-100">
              <div className="card-body text-center">
                <div className="subheader text-muted">Productos Vendidos</div>
                <div className="h1 mt-2 mb-0">{data.totalProductosVendidos.toLocaleString('es-MX')}</div>
              </div>
            </div>
          </div>

          {/* Ingreso Bruto Card (Total Public Price) */}
          <div className="col">
            <div className="card h-100">
              <div className="card-body text-center">
                <div className="subheader text-muted">Ingreso Bruto (Ventas)</div>
                <div className="h1 mt-2 mb-0">
                    {data.totalPrecioPublico.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                </div>
              </div>
            </div>
          </div>

          {/* Descuento Total Card */}
          <div className="col">
            <div className="card h-100">
              <div className="card-body text-center">
                <div className="subheader text-muted">Descuento Otorgado</div>
                 <div className="h1 mt-2 mb-0 text-warning"> {/* Use warning color for discounts */}
                     {data.totalDescuentoGeneral.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                 </div>
              </div>
            </div>
          </div>

          {/* Costo Total Card (Cost of Goods Sold) */}
          <div className="col">
            <div className="card h-100">
              <div className="card-body text-center">
                <div className="subheader text-muted">Costo de Mercancía</div>
                <div className="h1 mt-2 mb-0 text-danger"> {/* Use danger color for costs */}
                    {data.totalCostoGeneral.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                </div>
              </div>
            </div>
          </div>


          {/* Utilidad Bruta Card (Gross Profit) */}
           <div className="col">
             {/* Use a distinct background for gross profit */}
            <div className="card h-100 bg-azure-lt"> {/* Example: Light Blue background */}
              <div className="card-body text-center">
                <div className="subheader fw-bold">Utilidad Bruta</div>
                <div className="h1 mt-1 mb-0">
                    {data.utilidadBruta.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                </div>
                 {/* Add explanation for clarity */}
                 <div class="text-muted mt-1" style={{fontSize: '0.75rem'}}>(Ingreso - Dscto - Costo Merc.)</div>
              </div>
            </div>
          </div>

           {/* Utilidad Neta Card (Estimated Net Profit) */}
           <div className="col">
             {/* Change background dynamically based on profit/loss */}
            <div className={`card h-100 ${utilidadNeta >= 0 ? 'bg-success-lt' : 'bg-danger-lt'}`}> {/* Light Green for profit, Light Red for loss */}
              <div className="card-body text-center">
                <div className="subheader fw-bold">Utilidad Neta Estimada</div>
                <div className="h1 mt-1 mb-0">
                    {utilidadNeta.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                </div>
                 {/* Add explanation for clarity */}
                 <div class="text-muted mt-1" style={{fontSize: '0.75rem'}}>(Utilidad Bruta - Gastos Op.)</div>
              </div>
            </div>
          </div>

        </div> // End row
      )}

       {/* Message when no data is available (after loading, without errors, and zero values) */}
       {!data.isLoading && !data.error && data.totalProductosVendidos === 0 && data.totalPrecioPublico === 0 && (
           <div class="alert alert-info mt-3 text-center">No hay datos de resumen para mostrar para la selección actual.</div>
       )}
    </div> // End container
  );
};

export default VentasCardsReport;

// --- END OF FILE VentasCardsReport.tsx ---