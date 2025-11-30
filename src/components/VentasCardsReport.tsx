import { useState, useEffect } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';

// Interface for raw data fetched from a Kardex table (used by fetchBranchSummary)
interface VentaRowData {
  cantidad: string | number | null;
  costo: string | number | null;
  dscto: string | number | null;
  ppub: string | number | null;
  turno?: string | null;
}

// Interface for the aggregated summary from ONE branch (returned by fetchBranchSummary)
interface BranchSummary {
  totalCantidad: number;
  totalCosto: number;
  totalPpub: number;
  totalDscto: number;
}

// Interface for the structure returned by the RPC function
// Names must match the 'RETURNS TABLE' definition in the SQL function (get_ventas_stats_v2)
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
  startDate: string;         // Received from parent
  endDate: string;           // Received from parent
  selectedBranch: string;    // Received from parent
  operatingExpenses: number; // Received from parent
  selectedTurno: string;     // "Todos", "TURNO PRIMERO", etc.
}

// Lista de TODAS las sucursales que suman el "General"
const ALL_BRANCHES = [
  'KardexEcono1',
  'KardexMexico',
  'KardexMadero',
  'KardexLopezM',
  'KardexBaja',
  'KardexEcono2',
  'KardexLolita'
];

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
  const roundedNum =
    Math.round(num * multiplier + Number.EPSILON) / multiplier;
  // Ensure the final output is fixed to the specified decimals as a string, then convert back to Number
  return Number(roundedNum.toFixed(decimals));
};

// Componente
const VentasCardsReport = ({
  startDate,
  endDate,
  selectedBranch,
  operatingExpenses,
  selectedTurno
}: VentasCardsProps) => {
  const [data, setData] = useState<CardsState>({
    totalProductosVendidos: 0,
    totalCostoGeneral: 0,
    totalPrecioPublico: 0,
    totalDescuentoGeneral: 0,
    utilidadBruta: 0,
    isLoading: true, // Start loading initially
    error: null
  });

  // --- Helper: resumen por sucursal con filtro de turno ---
  const fetchBranchSummary = async (
    branch: string,
    start: string,
    end: string
  ): Promise<BranchSummary> => {
    try {
      // armamos la query base
      let query = supabase
        .from(branch)
        .select('cantidad, costo, ppub, dscto, turno')
        .eq('movto', '1')
        .gte('fecha', `${start} 00:00:00`)
        .lte('fecha', `${end} 23:59:59`);

      // si el turno está especificado, filtramos
      if (selectedTurno !== 'Todos') {
        query = query.eq('turno', selectedTurno);
      }

      const { data: result, error } = await query.returns<VentaRowData[]>();

      if (error) {
        console.error(`Error fetching data from ${branch}:`, error);
        throw new Error(`Error en ${branch}: ${error.message}`);
      }

      if (!result) {
        console.warn(
          `No sales data found for ${branch} between ${start} and ${end}`
        );
        return {
          totalCantidad: 0,
          totalCosto: 0,
          totalPpub: 0,
          totalDscto: 0
        };
      }

      const summary = result.reduce(
        (acc: BranchSummary, item) => {
          const cantidad = safeParseFloatAndRound(item.cantidad, 0);
          // cost/ppub por unidad
          const costo =
            cantidad !== 0 ? safeParseFloatAndRound(item.costo) : 0;
          const ppub =
            cantidad !== 0 ? safeParseFloatAndRound(item.ppub) : 0;
          const dscto = safeParseFloatAndRound(item.dscto);

          acc.totalCantidad += cantidad;
          if (cantidad > 0) {
            acc.totalCosto += cantidad * costo;
            acc.totalPpub += cantidad * ppub;
          }
          acc.totalDscto += dscto;
          return acc;
        },
        {
          totalCantidad: 0,
          totalCosto: 0,
          totalPpub: 0,
          totalDscto: 0
        }
      );

      return {
        totalCantidad: safeParseFloatAndRound(summary.totalCantidad, 0),
        totalCosto: safeParseFloatAndRound(summary.totalCosto),
        totalPpub: safeParseFloatAndRound(summary.totalPpub),
        totalDscto: safeParseFloatAndRound(summary.totalDscto)
      };
    } catch (branchError: any) {
      console.error(`Failed processing branch ${branch}:`, branchError);
      throw branchError;
    }
  };

  // --- Effect: calcula las cards cuando cambian fechas/sucursal/turno ---
  useEffect(() => {
    // Validar fechas
    if (
      !startDate ||
      !endDate ||
      !startDate.includes('-') ||
      !endDate.includes('-')
    ) {
      console.log(
        'VentasCardsReport: Waiting for valid dates from props...'
      );
      setData(() => ({
        totalProductosVendidos: 0,
        totalCostoGeneral: 0,
        totalPrecioPublico: 0,
        totalDescuentoGeneral: 0,
        utilidadBruta: 0,
        isLoading: false,
        error: 'Fechas no válidas o no proporcionadas.',
        loadingMessage: undefined
      }));
      return;
    }

    const fetchSelectedBranchData = async () => {
      // loading state inicial
      setData({
        totalProductosVendidos: 0,
        totalCostoGeneral: 0,
        totalPrecioPublico: 0,
        totalDescuentoGeneral: 0,
        utilidadBruta: 0,
        isLoading: true,
        error: null,
        loadingMessage: `Cargando ${selectedBranch === 'General'
          ? 'resumen general'
          : selectedBranch.replace('Kardex', '')
          }...`
      });

      let grandTotalProductos = 0;
      let grandTotalCosto = 0;
      let grandTotalPpub = 0;
      let grandTotalDscto = 0;

      try {
        const formattedStartDate = startDate;
        const formattedEndDate = endDate;

        if (selectedBranch === 'General') {
          if (selectedTurno === 'Todos') {
            // ✅ Caso General SIN filtro de turno:
            // Usamos el NUEVO RPC optimizado
            console.log(
              `VentasCardsReport: Calling DB function get_ventas_stats_v2 (Dates: ${formattedStartDate} - ${formattedEndDate})`
            );

            const { data: rpcResult, error: rpcError } =
              await supabase
                .rpc('get_ventas_stats_v2', {
                  start_date: formattedStartDate,
                  end_date: formattedEndDate
                })
                .single(); // Use .single() as the new RPC returns one row

            if (rpcError) {
              console.error(
                "Error calling RPC function 'get_ventas_stats_v2':",
                rpcError
              );
              const errorDetail = rpcError.code
                ? `(Code: ${rpcError.code})`
                : '';
              throw new Error(
                `Error al calcular resumen general: ${rpcError.message} ${errorDetail}`
              );
            }

            if (rpcResult) {
              grandTotalProductos = Number(rpcResult.total_cantidad) || 0;
              grandTotalCosto = Number(rpcResult.total_costo) || 0;
              grandTotalPpub = Number(rpcResult.total_ppub) || 0;
              grandTotalDscto = Number(rpcResult.total_dscto) || 0;
            }
          } else {
            // ✅ Caso General CON filtro de turno:
            // sumamos manualmente las sucursales porque el RPC no filtra turno
            let sumCantidad = 0;
            let sumCosto = 0;
            let sumPpub = 0;
            let sumDscto = 0;

            for (const br of ALL_BRANCHES) {
              const summary = await fetchBranchSummary(
                br,
                formattedStartDate,
                formattedEndDate
              );
              sumCantidad += summary.totalCantidad;
              sumCosto += summary.totalCosto;
              sumPpub += summary.totalPpub;
              sumDscto += summary.totalDscto;
            }

            grandTotalProductos = sumCantidad;
            grandTotalCosto = sumCosto;
            grandTotalPpub = sumPpub;
            grandTotalDscto = sumDscto;
          }
        } else {
          // Sucursal individual siempre usa fetchBranchSummary (ya respeta turno)
          console.log(
            `VentasCardsReport: Fetching summary for single branch ${selectedBranch} (Dates: ${formattedStartDate} - ${formattedEndDate})`
          );
          const summary = await fetchBranchSummary(
            selectedBranch,
            formattedStartDate,
            formattedEndDate
          );
          grandTotalProductos = summary.totalCantidad;
          grandTotalCosto = summary.totalCosto;
          grandTotalPpub = summary.totalPpub;
          grandTotalDscto = summary.totalDscto;
        }

        // calcular utilidad bruta
        const utilidadBruta =
          grandTotalPpub - grandTotalCosto - grandTotalDscto;

        // actualizar estado final
        setData({
          totalProductosVendidos: safeParseFloatAndRound(
            grandTotalProductos,
            0
          ),
          totalCostoGeneral: safeParseFloatAndRound(
            grandTotalCosto
          ),
          totalPrecioPublico: safeParseFloatAndRound(
            grandTotalPpub
          ),
          totalDescuentoGeneral: safeParseFloatAndRound(
            grandTotalDscto
          ),
          utilidadBruta: safeParseFloatAndRound(
            utilidadBruta
          ),
          isLoading: false,
          error: null,
          loadingMessage: undefined
        });
      } catch (error: any) {
        console.error(
          `VentasCardsReport: Error fetching/processing data for ${selectedBranch}:`,
          error
        );
        setData((prev) => ({
          ...prev,
          totalProductosVendidos: 0,
          totalCostoGeneral: 0,
          totalPrecioPublico: 0,
          totalDescuentoGeneral: 0,
          utilidadBruta: 0,
          isLoading: false,
          error: `Error al obtener datos para ${selectedBranch === 'General'
            ? 'General'
            : selectedBranch.replace('Kardex', '')
            }: ${error.message || 'Error desconocido'}`,
          loadingMessage: undefined
        }));
      }
    };

    fetchSelectedBranchData();
  }, [startDate, endDate, selectedBranch, selectedTurno]);

  // --- Calculate Net Profit ---
  const utilidadNeta = safeParseFloatAndRound(
    data.utilidadBruta - operatingExpenses
  );

  // --- Render ---
  const branchDisplayName =
    selectedBranch === 'General'
      ? 'General'
      : selectedBranch.replace('Kardex', '');
  const dateDisplay =
    startDate && endDate
      ? `(${startDate} al ${endDate})`
      : '(Fechas no válidas)';

  const turnoDisplay =
    selectedTurno === 'Todos'
      ? ''
      : ` • ${selectedTurno}`;

  return (
    <div className="container-xl mt-4 mb-4">
      <h3 class="mb-3">
        Resumen Financiero: {branchDisplayName}{' '}
        {dateDisplay}
        {turnoDisplay}
      </h3>

      {/* Error */}
      {data.error && !data.isLoading && (
        <div className="alert alert-danger">
          <strong>Error en Resumen de Ventas:</strong>{' '}
          {data.error}
        </div>
      )}

      {/* Loading */}
      {data.isLoading && (
        <div
          className="d-flex justify-content-center align-items-center"
          style={{ minHeight: '150px' }}
        >
          <div
            className="spinner-border text-primary"
            role="status"
          >
            <span className="visually-hidden">
              {data.loadingMessage ||
                'Cargando resumen financiero...'}
            </span>
          </div>
          {data.loadingMessage && (
            <span class="ms-2 text-muted">
              {data.loadingMessage}
            </span>
          )}
        </div>
      )}

      {/* Cards */}
      {!data.isLoading && !data.error && (
        <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-3">
          {/* Productos Vendidos */}
          <div className="col">
            <div className="card h-100">
              <div className="card-body text-center">
                <div className="subheader text-muted">
                  Productos Vendidos
                </div>
                <div className="h1 mt-2 mb-0">
                  {data.totalProductosVendidos.toLocaleString(
                    'es-MX'
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Ingreso Bruto */}
          <div className="col">
            <div className="card h-100">
              <div className="card-body text-center">
                <div className="subheader text-muted">
                  Ingreso Bruto (Ventas)
                </div>
                <div className="h1 mt-2 mb-0">
                  {data.totalPrecioPublico.toLocaleString(
                    'es-MX',
                    {
                      style: 'currency',
                      currency: 'MXN'
                    }
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Descuento Total */}
          <div className="col">
            <div className="card h-100">
              <div className="card-body text-center">
                <div className="subheader text-muted">
                  Descuento Otorgado
                </div>
                <div className="h1 mt-2 mb-0 text-warning">
                  {data.totalDescuentoGeneral.toLocaleString(
                    'es-MX',
                    {
                      style: 'currency',
                      currency: 'MXN'
                    }
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Costo Total */}
          <div className="col">
            <div className="card h-100">
              <div className="card-body text-center">
                <div className="subheader text-muted">
                  Costo de Mercancía
                </div>
                <div className="h1 mt-2 mb-0 text-danger">
                  {data.totalCostoGeneral.toLocaleString(
                    'es-MX',
                    {
                      style: 'currency',
                      currency: 'MXN'
                    }
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Utilidad Bruta */}
          <div className="col">
            <div className="card h-100 bg-azure-lt">
              <div className="card-body text-center">
                <div className="subheader fw-bold">
                  Utilidad Bruta
                </div>
                <div className="h1 mt-1 mb-0">
                  {data.utilidadBruta.toLocaleString(
                    'es-MX',
                    {
                      style: 'currency',
                      currency: 'MXN'
                    }
                  )}
                </div>
                <div
                  class="text-muted mt-1"
                  style={{ fontSize: '0.75rem' }}
                >
                  (Ingreso - Dscto - Costo
                  Merc.)
                </div>
              </div>
            </div>
          </div>

          {/* Utilidad Neta */}
          <div className="col">
            <div
              className={`card h-100 ${utilidadNeta >= 0
                ? 'bg-success-lt'
                : 'bg-danger-lt'
                }`}
            >
              <div className="card-body text-center">
                <div className="subheader fw-bold">
                  Utilidad Neta Estimada
                </div>
                <div className="h1 mt-1 mb-0">
                  {utilidadNeta.toLocaleString(
                    'es-MX',
                    {
                      style: 'currency',
                      currency: 'MXN'
                    }
                  )}
                </div>
                <div
                  class="text-muted mt-1"
                  style={{ fontSize: '0.75rem' }}
                >
                  (Utilidad Bruta -
                  Gastos Op.)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mensaje cuando hay 0 datos */}
      {!data.isLoading &&
        !data.error &&
        data.totalProductosVendidos === 0 &&
        data.totalPrecioPublico === 0 && (
          <div class="alert alert-info mt-3 text-center">
            No hay datos de resumen para mostrar para la
            selección actual.
          </div>
        )}
    </div>
  );
};

export default VentasCardsReport;
