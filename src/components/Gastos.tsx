// --- START OF FILE Gastos.tsx ---

import { useState, useEffect } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient'; // Adjust path if needed
import './Gastos.css'; // Keep existing CSS

// Interface matching Supabase structure (can omit id, created_at if not needed)
interface GastoMensualRecord {
  branch_key: string;
  year: number;
  month: number;
  renta: number;
  sueldos: number;
  luz: number;
  agua: number;
  internet: number;
  otros: number;
}

// Props for the Gastos component (no change needed)
interface GastosProps {
  startDate: string;        // YYYY-MM-DD
  endDate: string;          // YYYY-MM-DD
  selectedBranch: string;   // 'General' or 'KardexBranchName'
  onExpensesCalculated: (totalExpenses: number) => void; // Callback to parent
}

// Helper to safely parse dates and handle invalid ones
const parseDate = (dateString: string): Date | null => {
    if (!dateString || !dateString.includes('-')) return null;
    // Attempt to create date, adding time to avoid timezone interpretation issues if just date is given
    const date = new Date(dateString + 'T00:00:00');
    return isNaN(date.getTime()) ? null : date;
}

// Helper to get total expenses from a single fetched record
const getTotalFromRecord = (record: GastoMensualRecord): number => {
    return (record.renta || 0) + (record.sueldos || 0) + (record.luz || 0) +
           (record.agua || 0) + (record.internet || 0) + (record.otros || 0);
}

// Helper function to safely parse and round numbers
const safeRound = (value: number, decimals: number = 2): number => {
    if (isNaN(value)) return 0;
    const multiplier = Math.pow(10, decimals);
    const roundedNum = Math.round((value * multiplier) + Number.EPSILON) / multiplier;
    return Number(roundedNum.toFixed(decimals));
};


const Gastos = ({ startDate, endDate, selectedBranch, onExpensesCalculated }: GastosProps) => {
  const [totalExpenses, setTotalExpenses] = useState<number>(0);
  const [numberOfMonths, setNumberOfMonths] = useState<number>(0); // Still useful for display
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reset state before starting
    setIsLoading(true);
    setError(null);
    setTotalExpenses(0);
    setNumberOfMonths(0);
    onExpensesCalculated(0); // Notify parent of reset

    // --- Date Validation ---
    const start = parseDate(startDate);
    const end = parseDate(endDate);

    if (!start || !end) {
      setError("Fechas inválidas proporcionadas.");
      setIsLoading(false);
      return;
    }
    if (start > end) {
        setError("La fecha de inicio no puede ser posterior a la fecha de fin.");
        setIsLoading(false);
        return;
    }

    // --- Calculate Date Range for Query ---
    const startYear = start.getFullYear();
    const startMonth = start.getMonth() + 1; // 1-12
    const endYear = end.getFullYear();
    const endMonth = end.getMonth() + 1;   // 1-12

    // Calculate rough number of months for display (same logic as before)
      let monthsCount = 0;
      const uniqueMonths = new Set<string>();
      let current = new Date(start);
      while (current <= end) {
          const yearMonth = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
          uniqueMonths.add(yearMonth);
          current.setMonth(current.getMonth() + 1);
          current.setDate(1);
      }
      monthsCount = uniqueMonths.size;
      setNumberOfMonths(monthsCount);


    // --- Fetch Data from Supabase ---
    const fetchAndCalculateExpenses = async () => {
      try {
        let query = supabase
          .from('gastos_mensuales')
          .select('branch_key, year, month, renta, sueldos, luz, agua, internet, otros')
          // Filter records within the date range (inclusive)
           // Condition: (Year > StartYear OR (Year == StartYear AND Month >= StartMonth))
           //           AND (Year < EndYear OR (Year == EndYear AND Month <= EndMonth))
          .or(`year.gt.${startYear},and(year.eq.${startYear},month.gte.${startMonth})`) // Records from start date onwards
          .or(`year.lt.${endYear},and(year.eq.${endYear},month.lte.${endMonth})`);      // Records up to end date

        // Filter by branch if not 'General'
        const branchKey = selectedBranch.replace('Kardex', '');
        if (selectedBranch !== 'General') {
          query = query.eq('branch_key', branchKey);
        }

        const { data, error: dbError } = await query.returns<GastoMensualRecord[]>();

        if (dbError) {
          throw dbError;
        }

        // --- Calculate Total Expenses from Fetched Data ---
        let calculatedTotal = 0;
        if (data && data.length > 0) {
            data.forEach(record => {
                calculatedTotal += getTotalFromRecord(record);
            });
        } else {
            // No records found for the period/branch
            console.log(`Gastos: No expense records found for ${selectedBranch} between ${startDate} and ${endDate}`);
        }

        const roundedTotal = safeRound(calculatedTotal);
        setTotalExpenses(roundedTotal);
        onExpensesCalculated(roundedTotal); // Send final calculated value to parent

      } catch (e: any) {
        console.error("Error fetching or calculating expenses:", e);
        setError(`Error al obtener/calcular gastos: ${e.message}`);
        setTotalExpenses(0); // Ensure reset on error
        onExpensesCalculated(0); // Notify parent on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchAndCalculateExpenses();

  }, [startDate, endDate, selectedBranch, onExpensesCalculated]); // Dependency array remains the same

  // --- Render Logic (No changes needed from previous version) ---
  const displayBranchName = selectedBranch === 'General' ? 'Todas las Sucursales' : selectedBranch.replace('Kardex', '');

  return (
    <div className="gastos-container">
      {isLoading && <div class="gastos-loading">Consultando gastos...</div>}
      {error && <div class="gastos-error">{error}</div>}

      {!isLoading && !error && (
        <div className="gastos-card">
          <div className="subheader">Gastos Operativos Calculados ({displayBranchName})</div>
          <div className="amount">
            {totalExpenses.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
          </div>
           <div className="calculation-info">
                Basado en {numberOfMonths} mes(es) dentro del periodo seleccionado.
           </div>
           <div className="calculation-info" style={{ fontSize: '0.7rem', marginTop: '2px' }}>
                (Datos desde Base de Datos)
           </div>
        </div>
      )}
       {/* Optional: Message if dates invalid and not loading/error */}
       {!isLoading && !error && (!startDate || !endDate || startDate > endDate) && (
           <div class="alert alert-warning mt-3 text-center small">
               Seleccione un rango de fechas válido para calcular los gastos.
           </div>
       )}
        {!isLoading && !error && totalExpenses === 0 && numberOfMonths > 0 && (
              <div class="alert alert-light mt-2 text-center small py-1">
                   Nota: No se encontraron registros de gastos para el periodo/sucursal seleccionados en la base de datos. El total es $0.00.
              </div>
         )}
    </div>
  );
};

export default Gastos;

// --- END OF FILE Gastos.tsx ---