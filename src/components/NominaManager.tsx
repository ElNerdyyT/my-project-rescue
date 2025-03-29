import React, { useState, useEffect, useMemo, useCallback, ChangeEvent } from 'react';
import { supabase } from '../utils/supabaseClient';
import './NominaManager.css';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

// --- Tipos de Datos ---
interface EmployeeDataFromSupabase { id: string; name: string; branch_id: string; base_salary_weekly: number; branches: { name: string } | null; }
interface Employee { id: string; name: string; branch_id: string; base_salary_weekly: number; branch_name: string; }
interface PayrollWeekFromSupabase { id: number; employee_id: string; week_start_date: string; week_end_date: string; days_worked: number; overtime_hours: number; bono_asistencia: number; prima_dominical: number; comision_amount: number; deduccion_inventario: number; imss_deduction: number; infonavit_deduction: number; deduccion_faltantes_sobrantes: number; deduccion_vales: number; calculated_sueldo: number; calculated_septimo_dia: number; calculated_overtime_pay: number; total_percepciones: number; total_deductions: number; neto_pay: number; status: string; processed_at: string | null; created_at: string; }
type PayrollWeekData = Omit<PayrollWeekFromSupabase, 'id'> & { id?: number; employee_name?: string; base_salary_weekly?: number; };
interface SavedWeekInfo { week_start_date: string; week_end_date: string; week_number: number; } // Mantenemos para semanas guardadas
interface GroupedPayroll { branchName: string; items: PayrollWeekData[]; totals: PayrollWeekData | null; }

// --- Tipo para las opciones del Dropdown de Semanas ---
interface AvailableWeekOption {
    weekNumber: number;
    startDate: string; // Jueves
    endDate: string;   // Miércoles
    label: string;     // "Semana X (YYYY-MM-DD - YYYY-MM-DD)"
}

// --- Componente Principal ---
const NominaManager: React.FC = () => {
    // --- Estados ---
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [payrollData, setPayrollData] = useState<PayrollWeekData[]>([]);
    const [savedWeeks, setSavedWeeks] = useState<SavedWeekInfo[]>([]); // Semanas ya procesadas
    const [availableWeeks, setAvailableWeeks] = useState<AvailableWeekOption[]>([]); // Para el dropdown
    // selectedWeekStart siempre será la fecha del JUEVES
    const [selectedWeekStart, setSelectedWeekStart] = useState<string>(getThursdayOfWeek(new Date()));
    const [loadingEmployees, setLoadingEmployees] = useState<boolean>(true);
    const [loadingPayroll, setLoadingPayroll] = useState<boolean>(false);
    const [loadingSavedWeeks, setLoadingSavedWeeks] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const currentYear = new Date().getFullYear(); // Para generar semanas del año actual

    // --- Funciones de Fecha y Semana (Jueves-Miércoles) ---

    // Encuentra el Jueves (día 4) de la semana de la fecha dada
    function getThursdayOfWeek(date: Date): string {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0); // Normalizar hora
        const day = d.getDay(); // 0=Dom, 1=Lun, ..., 4=Jue, ... 6=Sáb
        const diff = 4 - day; // Diferencia para llegar a Jueves
        // Si diff es positivo, estamos antes de Jueves, sumamos diff
        // Si diff es negativo, estamos después de Jueves, sumamos diff (que es restar)
        // Si diff es 0, ya es Jueves
        // Si day es Dom (0), diff es 4. Si day es Sab(6), diff es -2.
        d.setDate(d.getDate() + diff);
        // Caso especial: Si el día original era Dom, Lun, Mar (0, 1, 2), la fórmula anterior nos da el Jueves *anterior*. Queremos el Jueves *de esta semana*.
        if (day < 4) { // Si era Domingo, Lunes, Martes, Miércoles (0,1,2,3) -> la diff da el jueves anterior, hay que sumar 7
             // Corrección: Si day < 4, diff = 4-day (positivo). Sumar diff nos lleva al Jueves correcto. No se necesita ajuste extra.
        } else if (day > 4) { // Si era Viernes, Sábado (5, 6) -> diff = 4-day (negativo). Sumar diff nos lleva al Jueves correcto.
        }
        return d.toISOString().split('T')[0];
    }


    // Obtiene el Miércoles (fin de semana de nómina) 6 días después del Jueves
    function getEndOfPayrollWeek(startDate: string): string { // startDate es Jueves
        try {
            const start = new Date(startDate + 'T00:00:00Z'); // Parsear como UTC
            const end = new Date(start);
            end.setUTCDate(start.getUTCDate() + 6); // Sumar 6 días para llegar al Miércoles
            return end.toISOString().split('T')[0];
        } catch (e) {
            console.error("Error parsing date for getEndOfPayrollWeek:", startDate, e);
            return "Fecha inválida";
        }
    }

    // Calcula el número de semana personalizado (Sem 1 = 2 Ene - 8 Ene)
    function calculateCustomWeekNumber(date: Date, year: number): number {
        try {
            // Referencia: Primer día del ciclo de la semana 1 (Jueves 2 de Enero para 2025, ajustar si el año base cambia)
            // O encontrar el primer JUEVES del año >= 2 de Enero
            const jan2 = new Date(Date.UTC(year, 0, 2, 0, 0, 0)); // Enero es mes 0
            const firstThursdayOfYear = getThursdayOfWeek(jan2); // Jueves de la semana del 2 de Enero

            const targetDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
            const firstThursdayDate = new Date(firstThursdayOfYear+'T00:00:00Z');

            // Si la fecha objetivo es ANTES del primer jueves, pertenece a la última semana del año anterior (o manejar como 0?)
             if (targetDate < firstThursdayDate) {
                 // Podríamos calcular la semana del año anterior o devolver 0/1
                 // Por simplicidad, si cae antes del ciclo inicial, lo asignamos a la semana 1 para este cálculo.
                 // O encontrar el primer jueves del año ANTERIOR
                 return 1; // Ajustar esta lógica si es necesario manejar semanas跨año
             }

            const diffTime = targetDate.getTime() - firstThursdayDate.getTime();
            const diffDays = diffTime / (1000 * 60 * 60 * 24);

            const weekNumber = Math.floor(diffDays / 7) + 1;
            return weekNumber;

        } catch (e) {
            console.error("Error calculating custom week number:", date, year, e);
            return 0;
        }
    }

    // Genera la lista de semanas de nómina (Jue-Mie) para un año
    const generateYearPayrollWeeks = useCallback((year: number): AvailableWeekOption[] => {
        const weeks: AvailableWeekOption[] = [];
        // Encontrar el primer Jueves del año (o el de la semana del 2 de Enero)
        const jan2 = new Date(year, 0, 2);
        let currentStartDate = getThursdayOfWeek(jan2); // Jueves de la semana del 2 de Enero

        let weekCounter = 1; // Iniciar contador

        while (new Date(currentStartDate).getFullYear() === year) {
            const currentEndDate = getEndOfPayrollWeek(currentStartDate);
            // El número de semana se basa en la fecha de INICIO (Jueves)
            const weekNumber = calculateCustomWeekNumber(new Date(currentStartDate+'T00:00:00Z'), year);
             // Corrección: Usar weekCounter para asegurar secuencia 1, 2, 3...
            // const weekNumber = weekCounter;


            weeks.push({
                weekNumber: weekNumber, // Usar el cálculo basado en fecha
                // weekNumber: weekCounter, // O usar contador simple
                startDate: currentStartDate,
                endDate: currentEndDate,
                label: `Semana ${weekNumber} (${currentStartDate} - ${currentEndDate})`
            });

            // Avanzar al siguiente Jueves
            const nextStartDate = new Date(currentStartDate + 'T00:00:00Z');
            nextStartDate.setUTCDate(nextStartDate.getUTCDate() + 7);
            currentStartDate = nextStartDate.toISOString().split('T')[0];
            weekCounter++; // Incrementar contador si se usa
        }
        return weeks;
    }, []); // Depende de las funciones de fecha, que son estables

     // --- Formatear Moneda ---
    const formatCurrency = useCallback((value: number | undefined | null): string => {
        if (value === undefined || value === null || isNaN(Number(value))) return '$0.00';
        return Number(value).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
    }, []);


    // --- Carga de Datos Iniciales ---
    useEffect(() => {
        // Generar semanas disponibles para el año actual
        setAvailableWeeks(generateYearPayrollWeeks(currentYear));

        const fetchInitialData = async () => {
            setLoadingEmployees(true); setLoadingSavedWeeks(true); setError(null);
            try {
                // Cargar Empleados
                const { data: employeesData, error: employeesError } = await supabase
                    .from('employees').select('id, name, branch_id, base_salary_weekly, branches(name)')
                    .eq('is_active', true).order('branch_id').order('name')
                    .returns<EmployeeDataFromSupabase[]>();
                if (employeesError) throw new Error(`Empleados: ${employeesError.message}`);
                const formattedEmployees: Employee[] = (employeesData || []).map(emp => ({ id: emp.id, name: emp.name, branch_id: emp.branch_id, base_salary_weekly: emp.base_salary_weekly, branch_name: emp.branches?.name ?? 'Sin Sucursal' }));
                setEmployees(formattedEmployees);

                // Cargar Semanas Guardadas (Historial)
                const { data: weeksData, error: weeksError } = await supabase.rpc('get_distinct_payroll_weeks');
                if (weeksError) throw new Error(`Semanas Guardadas: ${weeksError.message}`);
                const formattedWeeks: SavedWeekInfo[] = (weeksData || []).map((week: any) => ({
                    week_start_date: week.week_start_date, // Este debería ser el Jueves guardado
                    week_end_date: week.week_end_date,   // Este debería ser el Miércoles guardado
                    week_number: calculateCustomWeekNumber(new Date(week.week_start_date + 'T00:00:00Z'), new Date(week.week_start_date).getFullYear()) // Calcular num basado en el Jueves
                })).sort((a: SavedWeekInfo, b: SavedWeekInfo) => b.week_start_date.localeCompare(a.week_start_date));
                setSavedWeeks(formattedWeeks);

            } catch (err: any) { setError(`Error cargando datos iniciales: ${err.message}`); console.error(err); setEmployees([]); setSavedWeeks([]); }
            finally { setLoadingEmployees(false); setLoadingSavedWeeks(false); }
        };
        fetchInitialData();
    }, [currentYear, generateYearPayrollWeeks]); // Añadir dependencias


    // --- Lógica de Cálculo (Séptimo Día) ---
    const calculatePayrollFields = useCallback((item: PayrollWeekData): PayrollWeekData => {
        const baseSalary = item.base_salary_weekly ?? 0;
        const dailyRate = baseSalary > 0 ? baseSalary / 6 : 0; // Basado en 6 días de pago
        const daysWorked = Number(item.days_worked) || 0;
        const overtimeHours = Number(item.overtime_hours) || 0;
        const calculated_sueldo = dailyRate * daysWorked;
        const calculated_septimo_dia = daysWorked >= 6 ? dailyRate : 0; // Pago si se trabajan 6+ días
        const hourlyRateForOvertime = baseSalary > 0 ? dailyRate / 8 : 0; // Asumiendo jornada de 8 hrs
        const calculated_overtime_pay = overtimeHours > 0 ? (hourlyRateForOvertime * 2 * overtimeHours) : 0; // Doble tiempo
        const total_percepciones = calculated_sueldo + calculated_septimo_dia + calculated_overtime_pay + (Number(item.bono_asistencia) || 0) + (Number(item.prima_dominical) || 0) + (Number(item.comision_amount) || 0);
        const total_deductions = (Number(item.imss_deduction) || 0) + (Number(item.infonavit_deduction) || 0) + (Number(item.deduccion_inventario) || 0) + (Number(item.deduccion_faltantes_sobrantes) || 0) + (Number(item.deduccion_vales) || 0);
        const neto_pay = total_percepciones - total_deductions;
        const round = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;
        return { ...item, calculated_sueldo: round(calculated_sueldo), calculated_septimo_dia: round(calculated_septimo_dia), calculated_overtime_pay: round(calculated_overtime_pay), total_percepciones: round(total_percepciones), total_deductions: round(total_deductions), neto_pay: round(neto_pay) };
    }, []);

    // Recalcula toda la nómina
    const recalculateAll = useCallback((currentData: PayrollWeekData[]): PayrollWeekData[] => {
        return currentData.map(item => calculatePayrollFields(item));
    }, [calculatePayrollFields]);

     // --- Carga de Datos de Nómina para la Semana Seleccionada ---
     useEffect(() => {
        if (!selectedWeekStart || employees.length === 0) { setPayrollData([]); return; }

        const fetchPayrollForWeek = async () => {
            setLoadingPayroll(true); setError(null);
            // week_start_date es JUEVES, week_end_date es MIERCOLES
            const weekEndDate = getEndOfPayrollWeek(selectedWeekStart);

            try {
                const { data: existingPayroll, error: payrollError } = await supabase
                    .from('payroll_weeks').select('*').eq('week_start_date', selectedWeekStart)
                    .in('employee_id', employees.map(e => e.id)).returns<PayrollWeekFromSupabase[]>();
                if (payrollError) throw payrollError;

                const weekPayrollDataPromises = employees.map(async emp => {
                    const existingRecord = existingPayroll?.find(p => p.employee_id === emp.id);
                    if (existingRecord) {
                        return { ...existingRecord, employee_name: emp.name, base_salary_weekly: emp.base_salary_weekly };
                    } else {
                        const baseSalary = emp.base_salary_weekly;
                        // Default a 6 días trabajados si tiene sueldo base
                        const defaultRecord: PayrollWeekData = {
                            employee_id: emp.id, week_start_date: selectedWeekStart, week_end_date: weekEndDate,
                            days_worked: baseSalary > 0 ? 6 : 0, overtime_hours: 0, bono_asistencia: 0, prima_dominical: 0,
                            comision_amount: 0, deduccion_inventario: 0, imss_deduction: 0, infonavit_deduction: 0,
                            deduccion_faltantes_sobrantes: 0, deduccion_vales: 0, calculated_sueldo: 0, calculated_septimo_dia: 0,
                            calculated_overtime_pay: 0, total_percepciones: 0, total_deductions: 0, neto_pay: 0,
                            status: 'draft', processed_at: null, created_at: new Date().toISOString(),
                            employee_name: emp.name, base_salary_weekly: baseSalary
                        };
                        return defaultRecord;
                    }
                });
                const weekPayrollData = await Promise.all(weekPayrollDataPromises);
                setPayrollData(recalculateAll(weekPayrollData));

            } catch (err: any) { setError(`Error cargando nómina para ${selectedWeekStart}: ${err.message}`); console.error(err); setPayrollData([]); }
            finally { setLoadingPayroll(false); }
        };
        fetchPayrollForWeek();
    }, [selectedWeekStart, employees, recalculateAll]); // Dependencias


    // --- Manejador de Cambios en Inputs ---
    const handleInputChange = useCallback((employeeId: string, field: keyof PayrollWeekData, event: ChangeEvent<HTMLInputElement>) => {
        const value = event.currentTarget.value;
        setPayrollData(prevData => {
            const newData = prevData.map(item => {
                if (item.employee_id === employeeId) {
                    let numericValue: number | string = value;
                    const numericFields: (keyof PayrollWeekData)[] = ['days_worked', 'overtime_hours', 'bono_asistencia', 'prima_dominical', 'comision_amount', 'deduccion_inventario', 'imss_deduction', 'infonavit_deduction', 'deduccion_faltantes_sobrantes', 'deduccion_vales'];
                    if (numericFields.includes(field as keyof PayrollWeekData)) {
                        numericValue = value === '' ? 0 : parseFloat(value);
                        if (isNaN(numericValue as number)) numericValue = 0;
                    }
                    const updatedItem = { ...item, [field]: numericValue };
                    return calculatePayrollFields(updatedItem);
                } return item;
            });
            return newData;
        });
    }, [calculatePayrollFields]);

    // --- Guardar Datos de Nómina ---
     const handleSavePayroll = useCallback(async () => {
        setLoadingPayroll(true); setError(null);
        try {
            type PayrollWeekForUpsert = Omit<PayrollWeekFromSupabase, 'id'>;
            const dataToSave: PayrollWeekForUpsert[] = payrollData.map(item => {
                const { employee_name, base_salary_weekly, id, ...dbFields } = item;
                const recordToSave: PayrollWeekForUpsert = { ...dbFields } as any;
                 for (const key in recordToSave) {
                    if (['days_worked', 'overtime_hours', 'bono_asistencia', 'prima_dominical', 'comision_amount','deduccion_inventario', 'imss_deduction', 'infonavit_deduction', 'deduccion_faltantes_sobrantes', 'deduccion_vales', 'calculated_sueldo', 'calculated_septimo_dia', 'calculated_overtime_pay', 'total_percepciones', 'total_deductions', 'neto_pay'].includes(key)) {
                        (recordToSave as any)[key] = Number(recordToSave[key as keyof PayrollWeekForUpsert]) || 0;
                    }
                 }
                 recordToSave.status = dbFields.status || 'draft'; recordToSave.processed_at = dbFields.processed_at || null; recordToSave.created_at = dbFields.created_at || new Date().toISOString();
                 // Asegurarse que las fechas de inicio/fin sean las correctas del periodo seleccionado
                 recordToSave.week_start_date = selectedWeekStart; // Jueves
                 recordToSave.week_end_date = getEndOfPayrollWeek(selectedWeekStart); // Miércoles
                 return recordToSave;
            });

            const { error: saveError } = await supabase.from('payroll_weeks').upsert(dataToSave, { onConflict: 'employee_id, week_start_date' });
            if (saveError) throw saveError;
            alert('Nómina guardada exitosamente!');

             // Refrescar lista de semanas guardadas
             const { data: weeksData, error: weeksError } = await supabase.rpc('get_distinct_payroll_weeks');
             if (weeksError) console.error("Error refrescando semanas guardadas:", weeksError.message);
             else {
                 const formattedWeeks: SavedWeekInfo[] = (weeksData || []).map((week: any) => ({
                    week_start_date: week.week_start_date, week_end_date: week.week_end_date,
                    week_number: calculateCustomWeekNumber(new Date(week.week_start_date + 'T00:00:00Z'), new Date(week.week_start_date).getFullYear())
                 })).sort((a: SavedWeekInfo, b: SavedWeekInfo) => b.week_start_date.localeCompare(a.week_start_date));
                 setSavedWeeks(formattedWeeks);
             }
             // Refrescar datos de nómina actual
             const { data: refreshedPayroll, error: refreshError } = await supabase.from('payroll_weeks').select('*').eq('week_start_date', selectedWeekStart).in('employee_id', employees.map(e => e.id)).returns<PayrollWeekFromSupabase[]>();
             if (refreshError) console.error("Error refetching current payroll:", refreshError);
             else if (refreshedPayroll) {
                 const refreshedWeekPayrollData = employees.map(emp => {
                     const record = refreshedPayroll.find(p => p.employee_id === emp.id);
                     return record ? { ...record, employee_name: emp.name, base_salary_weekly: emp.base_salary_weekly } : payrollData.find(pd => pd.employee_id === emp.id)!;
                 }).filter(Boolean);
                 setPayrollData(recalculateAll(refreshedWeekPayrollData));
             }
        } catch (err: any) { setError(`Error guardando nómina: ${err.message}`); console.error(err); alert(`Error al guardar: ${err.message}`); }
        finally { setLoadingPayroll(false); }
    }, [payrollData, employees, selectedWeekStart, recalculateAll]);

    // --- Agrupar Datos por Sucursal ---
     const groupedData = useMemo(() => {
         const groups: Record<string, GroupedPayroll> = {};
         payrollData.forEach(item => {
            const employee = employees.find(e => e.id === item.employee_id);
            const branchName = employee?.branch_name || 'Sin Sucursal'; const groupKey = employee?.branch_id || branchName;
            if (!groups[groupKey]) groups[groupKey] = { branchName: branchName, items: [], totals: null }; groups[groupKey].items.push(item);
         });
         Object.keys(groups).forEach(groupKey => {
            const items = groups[groupKey].items; if (items.length === 0) return;
            type TotalsAcc = { [K in keyof Omit<PayrollWeekData, 'id'|'employee_id'|'week_start_date'|'week_end_date'|'employee_name'|'status'|'processed_at'|'created_at'|'branch_id'|'branch_name'|'base_salary_weekly'>]: number } & { base_salary_weekly: number };
            const initialTotals: TotalsAcc = { days_worked: 0, calculated_sueldo: 0, calculated_septimo_dia: 0, overtime_hours: 0, calculated_overtime_pay: 0, bono_asistencia: 0, prima_dominical: 0, comision_amount: 0, total_percepciones: 0, deduccion_inventario: 0, imss_deduction: 0, infonavit_deduction: 0, deduccion_faltantes_sobrantes: 0, deduccion_vales: 0, total_deductions: 0, neto_pay: 0, base_salary_weekly: 0 };
            const totalsSum = items.reduce((acc, item) => {
                acc.base_salary_weekly += Number(item.base_salary_weekly)||0; acc.calculated_sueldo += Number(item.calculated_sueldo)||0; acc.calculated_septimo_dia += Number(item.calculated_septimo_dia)||0; acc.overtime_hours += Number(item.overtime_hours)||0; acc.calculated_overtime_pay += Number(item.calculated_overtime_pay)||0; acc.bono_asistencia += Number(item.bono_asistencia)||0; acc.prima_dominical += Number(item.prima_dominical)||0; acc.comision_amount += Number(item.comision_amount)||0; acc.total_percepciones += Number(item.total_percepciones)||0; acc.deduccion_inventario += Number(item.deduccion_inventario)||0; acc.imss_deduction += Number(item.imss_deduction)||0; acc.infonavit_deduction += Number(item.infonavit_deduction)||0; acc.deduccion_faltantes_sobrantes += Number(item.deduccion_faltantes_sobrantes)||0; acc.deduccion_vales += Number(item.deduccion_vales)||0; acc.total_deductions += Number(item.total_deductions)||0; acc.neto_pay += Number(item.neto_pay)||0; return acc;
            }, initialTotals);
            groups[groupKey].totals = { ...totalsSum, id:undefined, employee_id:`total-${groupKey}`, employee_name:`Total ${groups[groupKey].branchName}`, week_start_date:selectedWeekStart, week_end_date:getEndOfPayrollWeek(selectedWeekStart), status:'summary', processed_at:null, created_at:'' } as PayrollWeekData;
         });
         return Object.values(groups).sort((a: GroupedPayroll, b: GroupedPayroll) => a.branchName.localeCompare(b.branchName));
    }, [payrollData, employees, selectedWeekStart]);

    // --- Calcular Gran Total ---
    const grandTotal = useMemo(() => {
        if (payrollData.length === 0) return null;
         type TotalsAcc = { [K in keyof Omit<PayrollWeekData, 'id'|'employee_id'|'week_start_date'|'week_end_date'|'employee_name'|'status'|'processed_at'|'created_at'|'branch_id'|'branch_name'|'base_salary_weekly'>]: number } & { base_salary_weekly: number };
         const initialTotals: TotalsAcc = { days_worked: 0, calculated_sueldo: 0, calculated_septimo_dia: 0, overtime_hours: 0, calculated_overtime_pay: 0, bono_asistencia: 0, prima_dominical: 0, comision_amount: 0, total_percepciones: 0, deduccion_inventario: 0, imss_deduction: 0, infonavit_deduction: 0, deduccion_faltantes_sobrantes: 0, deduccion_vales: 0, total_deductions: 0, neto_pay: 0, base_salary_weekly: 0 };
         const totalsSum = payrollData.reduce((acc, item) => {
             acc.base_salary_weekly += Number(item.base_salary_weekly)||0; acc.calculated_sueldo += Number(item.calculated_sueldo)||0; acc.calculated_septimo_dia += Number(item.calculated_septimo_dia)||0; acc.overtime_hours += Number(item.overtime_hours)||0; acc.calculated_overtime_pay += Number(item.calculated_overtime_pay)||0; acc.bono_asistencia += Number(item.bono_asistencia)||0; acc.prima_dominical += Number(item.prima_dominical)||0; acc.comision_amount += Number(item.comision_amount)||0; acc.total_percepciones += Number(item.total_percepciones)||0; acc.deduccion_inventario += Number(item.deduccion_inventario)||0; acc.imss_deduction += Number(item.imss_deduction)||0; acc.infonavit_deduction += Number(item.infonavit_deduction)||0; acc.deduccion_faltantes_sobrantes += Number(item.deduccion_faltantes_sobrantes)||0; acc.deduccion_vales += Number(item.deduccion_vales)||0; acc.total_deductions += Number(item.total_deductions)||0; acc.neto_pay += Number(item.neto_pay)||0; return acc;
         }, initialTotals);
         return { ...totalsSum, id: undefined, employee_id: 'grand-total', employee_name: 'Total General', week_start_date: selectedWeekStart, week_end_date: getEndOfPayrollWeek(selectedWeekStart), status: 'summary', processed_at: null, created_at: '' } as PayrollWeekData;
    }, [payrollData, selectedWeekStart]);

    // --- Manejadores de Acciones ---
    // --- Manejadores de Acciones ---
    const handleWeekChange = (event: ChangeEvent<HTMLSelectElement>) => { // <-- Añade el tipo ChangeEvent<HTMLSelectElement>
        // Usa currentTarget que es más seguro y tiene el tipo correcto
        setSelectedWeekStart(event.currentTarget.value);
    };

    const handleEditWeek = useCallback((weekStartDate: string) => {
        // Verifica si la semana está en las opciones disponibles del año actual
        const weekExistsInCurrentYear = availableWeeks.some(w => w.startDate === weekStartDate);
        if (weekExistsInCurrentYear) {
            setSelectedWeekStart(weekStartDate);
        } else {
            // Si es de otro año, simplemente carga los datos, el dropdown no cambiará
            // Opcional: podrías generar semanas del año correspondiente si quisieras
            alert("Cargando semana de un año anterior. El selector de semanas no cambiará.");
            setSelectedWeekStart(weekStartDate); // Carga los datos aunque no esté en el select
        }
    }, [availableWeeks]);

    // --- Imprimir PDF ---
    const handlePrintPdf = useCallback(async (weekStartDate: string) => { // startDate es Jueves
        console.log("Generando PDF para la semana que inicia:", weekStartDate);
        setError(null);
        const initialTotalsPDF = () => ({ employee_name:'', base_salary_weekly:0, days_worked:'', calculated_sueldo:0, calculated_septimo_dia:0, overtime_hours:0, calculated_overtime_pay:0, bono_asistencia:0, prima_dominical:0, comision_amount:0, total_percepciones:0, deduccion_inventario:0, imss_deduction:0, infonavit_deduction:0, deduccion_faltantes_sobrantes:0, deduccion_vales:0, total_deductions:0, neto_pay:0, firma:'' });
        const initialGrandTotalsForPDF = initialTotalsPDF();

        try {
            const { data: weekDataToPrint, error: fetchError } = await supabase.from('payroll_weeks').select('*').eq('week_start_date', weekStartDate);
            if (fetchError) throw new Error(`Error fetching data for PDF: ${fetchError.message}`);
            if (!weekDataToPrint || weekDataToPrint.length === 0) { alert("No hay datos de nómina guardados para imprimir esta semana."); return; }

            const enrichedData = weekDataToPrint.map(item => {
                const employee = employees.find(e => e.id === item.employee_id);
                return { ...item, employee_name: employee?.name ?? 'Desconocido', branch_name: employee?.branch_name ?? 'Sin Sucursal', base_salary_weekly: employee?.base_salary_weekly ?? 0 };
            }).sort((a, b) => { const branchCompare = a.branch_name.localeCompare(b.branch_name); if (branchCompare !== 0) return branchCompare; return a.employee_name.localeCompare(b.employee_name); });

            const doc = new jsPDF({
                orientation: 'landscape', // Horizontal
                unit: 'pt',             // Use points
                format: 'ledger'        // Use 'ledger' for 11x17 inches (Doble Carta)
            });
            const weekEndDate = getEndOfPayrollWeek(weekStartDate); // Miércoles
            const weekNum = calculateCustomWeekNumber(new Date(weekStartDate + 'T00:00:00Z'), new Date(weekStartDate).getFullYear());
            const title = `Nómina Farmacia San Ramón - Semana ${weekNum} (${weekStartDate} al ${weekEndDate})`;
            const pageWidth = doc.internal.pageSize.getWidth();
            doc.setFontSize(8); doc.text(title, pageWidth / 2, 40, { align: 'center' });

            const columns = [ /* ... (igual que antes) ... */
                { header: 'Empleado', dataKey: 'employee_name' }, { header: 'Sueldo Base', dataKey: 'base_salary_weekly_f' },
                { header: 'Días Trab.', dataKey: 'days_worked' }, { header: 'Sueldo Calc.', dataKey: 'calculated_sueldo_f' },
                { header: 'Séptimo', dataKey: 'calculated_septimo_dia_f' }, { header: 'H.E. Hrs', dataKey: 'overtime_hours' },
                { header: 'H.E. $', dataKey: 'calculated_overtime_pay_f' }, { header: 'Bono Asist.', dataKey: 'bono_asistencia_f' },
                { header: 'Prima Dom.', dataKey: 'prima_dominical_f' }, { header: 'Comisiones', dataKey: 'comision_amount_f' },
                { header: 'Total Percep.', dataKey: 'total_percepciones_f' }, { header: 'Inventario', dataKey: 'deduccion_inventario_f' },
                { header: 'IMSS', dataKey: 'imss_deduction_f' }, { header: 'Infonavit', dataKey: 'infonavit_deduction_f' },
                { header: 'Falt/Sobr', dataKey: 'deduccion_faltantes_sobrantes_f' }, { header: 'Vales', dataKey: 'deduccion_vales_f' },
                { header: 'Total Deduc.', dataKey: 'total_deductions_f' }, { header: 'Neto', dataKey: 'neto_pay_f' },
                { header: 'Firma', dataKey: 'firma' }
             ];
            let body: any[] = []; let currentBranch = ''; let branchTotals: any = null;
            const grandTotalPDF: any = { ...initialGrandTotalsForPDF };

            for (const item of enrichedData) {
                if (item.branch_name !== currentBranch) {
                    if (branchTotals) addTotalsRowToBody(body, branchTotals, `Total ${currentBranch}`);
                    body.push([{ content: item.branch_name, colSpan: columns.length, styles: { fontStyle: 'bold', fillColor: '#EEEEEE', textColor: '#333333' } }]);
                    currentBranch = item.branch_name; branchTotals = initialTotalsPDF();
                }
                const rowData = { employee_name: item.employee_name, base_salary_weekly_f: formatCurrency(item.base_salary_weekly), days_worked: item.days_worked, calculated_sueldo_f: formatCurrency(item.calculated_sueldo), calculated_septimo_dia_f: formatCurrency(item.calculated_septimo_dia), overtime_hours: item.overtime_hours, calculated_overtime_pay_f: formatCurrency(item.calculated_overtime_pay), bono_asistencia_f: formatCurrency(item.bono_asistencia), prima_dominical_f: formatCurrency(item.prima_dominical), comision_amount_f: formatCurrency(item.comision_amount), total_percepciones_f: formatCurrency(item.total_percepciones), deduccion_inventario_f: formatCurrency(item.deduccion_inventario), imss_deduction_f: formatCurrency(item.imss_deduction), infonavit_deduction_f: formatCurrency(item.infonavit_deduction), deduccion_faltantes_sobrantes_f: formatCurrency(item.deduccion_faltantes_sobrantes), deduccion_vales_f: formatCurrency(item.deduccion_vales), total_deductions_f: formatCurrency(item.total_deductions), neto_pay_f: formatCurrency(item.neto_pay), firma: '' };
                body.push(rowData); accumulateTotals(branchTotals, item); accumulateTotals(grandTotalPDF, item);
            }
             if (branchTotals) addTotalsRowToBody(body, branchTotals, `Total ${currentBranch}`);
             addTotalsRowToBody(body, grandTotalPDF, 'Total General', true);

             doc.autoTable({
                columns: columns,
                body: body,
                startY: 60, // Start table below the title
                theme: 'grid',
                headStyles: {
                    fillColor: [22, 160, 133], // Header background color
                    textColor: [255, 255, 255], // Header text color
                    fontSize: 8, // Slightly larger font for headers on bigger page
                    fontStyle: 'bold',
                    halign: 'center'
                },
                bodyStyles: {
                    fontSize: 7, // Slightly larger font for body on bigger page
                    cellPadding: 2,
                },
                alternateRowStyles: {
                    fillColor: [245, 245, 245] // Zebra striping
                },
                columnStyles: { // Adjust widths as needed for ledger size, provide more space
                    employee_name: { cellWidth: 120, halign: 'left' }, // Wider name column
                    base_salary_weekly_f: { halign: 'right' },
                    days_worked: { halign: 'center', cellWidth: 40 },
                    calculated_sueldo_f: { halign: 'right' },
                    calculated_septimo_dia_f: { halign: 'right' },
                    overtime_hours: { halign: 'center', cellWidth: 40 },
                    calculated_overtime_pay_f: { halign: 'right' },
                    bono_asistencia_f: { halign: 'right' },
                    prima_dominical_f: { halign: 'right' },
                    comision_amount_f: { halign: 'right' },
                    total_percepciones_f: { halign: 'right', fontStyle: 'bold' },
                    deduccion_inventario_f: { halign: 'right' },
                    imss_deduction_f: { halign: 'right' },
                    infonavit_deduction_f: { halign: 'right' },
                    deduccion_faltantes_sobrantes_f: { halign: 'right' },
                    deduccion_vales_f: { halign: 'right' },
                    total_deductions_f: { halign: 'right', fontStyle: 'bold' },
                    neto_pay_f: { halign: 'right', fontStyle: 'bold' },
                    firma: { cellWidth: 80, halign: 'center' } // Wider signature column
                },
                 // Use margins to ensure content doesn't touch edges
                 margin: { top: 60, right: 30, bottom: 40, left: 30 },
                 tableWidth: 'auto', // Let autotable manage width within margins
                 // Ensure the table tries to fit onto one page if possible
                 pageBreak: 'auto', // Default, breaks only if necessary
                 // didDrawPage: (data) => { // Optional: Add page numbers if it spans pages
                 //    doc.setFontSize(10);
                 //    doc.text('Página ' + doc.internal.getNumberOfPages(), data.settings.margin.left, pageHeight - 10);
                 // }
            });
            doc.save(`nomina_semana_${weekNum}_${weekStartDate}.pdf`);
        } catch (err: any) { setError(`Error generando PDF: ${err.message}`); console.error("Error en handlePrintPdf:", err); alert(`Error generando PDF: ${err.message}`); }
    }, [employees, formatCurrency]);

    // Helper para acumular totales PDF
    const accumulateTotals = (totals: any, item: any) => { Object.keys(totals).forEach(key => { if (key !== 'employee_name' && key !== 'days_worked' && key !== 'firma') { const itemValue = (item as any)[key.replace('_f','')]; totals[key] += Number(itemValue) || 0; } }); };
    // Helper para añadir fila de totales PDF
    const addTotalsRowToBody = (body: any[], totals: any, label: string, isGrandTotal = false) => { const row: { [key: string]: any } = { employee_name: { content: label, styles: { fontStyle: 'bold' } }, days_worked: { content: '' }, firma: { content: '' } }; Object.keys(totals).forEach(key => { if (key !== 'employee_name' && key !== 'days_worked' && key !== 'firma') { let content = ''; let align = 'right'; if (key === 'overtime_hours') { content = totals[key]?.toFixed(1) ?? '0.0'; align = 'center'; } else { content = formatCurrency(totals[key]); } row[`${key}_f`]?.content ? (row[`${key}_f`].content = content) : (row[`${key}_f`] = { content: content, styles: { halign: align, fontStyle: 'bold' } }); } }); if (isGrandTotal) Object.values(row).forEach((cell: any) => { if (typeof cell === 'object') cell.styles = { ...cell.styles, fillColor: '#DDDDDD', textColor: '#000000' }; }); body.push(row); };

    // --- Estado General de Carga ---
    const isLoading = loadingEmployees || loadingSavedWeeks || loadingPayroll;

    // --- Renderizado ---
    const selectedWeekDetails = availableWeeks.find(w => w.startDate === selectedWeekStart);
    const currentWeekNumber = selectedWeekDetails?.weekNumber ?? calculateCustomWeekNumber(new Date(selectedWeekStart+'T00:00:00Z'), new Date(selectedWeekStart).getFullYear());


    return (
        <div className="nomina-manager">
            <h1>FARMACIA SAN RAMON</h1>

            {/* --- Sección de Semanas Guardadas --- */}
            <div className="saved-weeks-section card">
                <h2>Historial Semanas Guardadas</h2>
                {loadingSavedWeeks && <p>Cargando historial...</p>}
                {!loadingSavedWeeks && savedWeeks.length === 0 && <p>No se encontraron semanas procesadas.</p>}
                {!loadingSavedWeeks && savedWeeks.length > 0 && (
                    <table className="weeks-table">
                        <thead>
                            <tr><th>Semana #</th><th>Fecha Inicio (Jue)</th><th>Fecha Fin (Mié)</th><th>Acciones</th></tr>
                        </thead>
                        <tbody>
                            {savedWeeks.map(week => (
                                <tr key={week.week_start_date}>
                                    <td>{week.week_number}</td><td>{week.week_start_date}</td><td>{week.week_end_date}</td>
                                    <td>
                                        <button onClick={() => handleEditWeek(week.week_start_date)} title="Cargar esta semana para editar" disabled={isLoading}>{isLoading ? '...' : 'Editar'}</button>
                                        <button onClick={() => handlePrintPdf(week.week_start_date)} title="Generar PDF para esta semana" disabled={isLoading}>{isLoading ? '...' : 'PDF'}</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <hr />

             {/* --- Sección Principal de Nómina --- */}
            <h2>
                {selectedWeekStart
                    ? `Nómina Semana ${currentWeekNumber}: ${selectedWeekStart} al ${getEndOfPayrollWeek(selectedWeekStart)}`
                    : 'Seleccione una semana'
                }
            </h2>

            <div className="controls no-print">
                <label htmlFor="week-select">Seleccionar Semana ({currentYear}):</label>
                {/* --- Dropdown para seleccionar semana --- */}
                <select
                    id="week-select"
                    value={selectedWeekStart}
                    onChange={handleWeekChange}
                    disabled={isLoading}
                >
                    {availableWeeks.map(week => (
                        <option key={week.startDate} value={week.startDate}>
                            {week.label}
                        </option>
                    ))}
                </select>

                <button onClick={handleSavePayroll} disabled={isLoading || payrollData.length === 0}>
                    {loadingPayroll && !loadingEmployees && !loadingSavedWeeks ? 'Guardando...' : 'Guardar Nómina'}
                </button>
                <button onClick={() => window.print()} disabled={isLoading || payrollData.length === 0}>
                    Imprimir Vista (HTML)
                </button>
            </div>

            {error && <p className="error-message no-print">Error: {error}</p>}
            {(loadingEmployees || loadingSavedWeeks) && <p className="loading-message">Cargando datos iniciales...</p>}
            {loadingPayroll && !loadingEmployees && !loadingSavedWeeks && <p className="loading-message">Cargando datos de nómina...</p>}
            {!isLoading && !error && employees.length === 0 && <p>No hay empleados activos cargados.</p>}
            {!isLoading && !error && payrollData.length === 0 && selectedWeekStart && employees.length > 0 && <p>Cargando datos o no se encontraron registros para la semana. Modifique y guarde para crear.</p>}


            {/* --- Tabla Principal de Nómina --- */}
            {!isLoading && payrollData.length > 0 && (
                <div className="payroll-table-container">
                    <table className="payroll-table">
                        {/* THEAD y TBODY (sin cambios estructurales) */}
                         <thead>
                             <tr>
                                <th rowSpan={2}>Empleado</th> <th rowSpan={2}>Sueldo Base Sem.</th> <th rowSpan={2}>Días Trab.</th>
                                <th colSpan={7}>PERCEPCIONES</th> <th colSpan={6}>DEDUCCIONES</th>
                                <th rowSpan={2}>NETO</th> <th rowSpan={2} className="firma-col">FIRMA</th>
                            </tr>
                            <tr>
                                <th>Sueldo Calc.</th> <th>Séptimo día</th> <th>H.E. (Hrs)</th> <th>H.E. ($)</th> <th>Bono Asist.</th>
                                <th>Prima Dom.</th> <th>Comisiones</th> <th className="total-col">TOTAL PERCEP.</th>
                                <th>Inventarios</th> <th>I.M.S.S.</th> <th>Préstamo Infonavit</th> <th>Faltantes o Sobrantes</th>
                                <th>Vales</th> <th className="total-col">TOTAL DEDUCC.</th>
                            </tr>
                        </thead>
                        <tbody>
                            {groupedData.map(group => (
                                <React.Fragment key={group.branchName}>
                                    <tr className="branch-header"><td colSpan={18}>{group.branchName}</td></tr>
                                    {group.items.map(item => (
                                        <tr key={item.employee_id}>
                                            <td>{item.employee_name}</td>
                                            <td className="currency">{formatCurrency(item.base_salary_weekly)}</td>
                                            <td><input type="number" min="0" max="7" step="1" value={item.days_worked ?? ''} onChange={(e) => handleInputChange(item.employee_id, 'days_worked', e)} className="input-narrow"/></td>
                                            <td className="currency">{formatCurrency(item.calculated_sueldo)}</td>
                                            <td className="currency">{formatCurrency(item.calculated_septimo_dia)}</td>
                                            <td><input type="number" min="0" step="0.5" value={item.overtime_hours ?? ''} onChange={(e) => handleInputChange(item.employee_id, 'overtime_hours', e)} className="input-narrow"/></td>
                                            <td className="currency">{formatCurrency(item.calculated_overtime_pay)}</td>
                                            <td><input type="number" min="0" step="any" value={item.bono_asistencia ?? ''} onChange={(e) => handleInputChange(item.employee_id, 'bono_asistencia', e)} className="input-currency"/></td>
                                            <td><input type="number" min="0" step="any" value={item.prima_dominical ?? ''} onChange={(e) => handleInputChange(item.employee_id, 'prima_dominical', e)} className="input-currency"/></td>
                                            <td><input type="number" min="0" step="any" value={item.comision_amount ?? ''} onChange={(e) => handleInputChange(item.employee_id, 'comision_amount', e)} className="input-currency"/></td>
                                            <td className="currency total-col">{formatCurrency(item.total_percepciones)}</td>
                                            <td><input type="number" min="0" step="any" value={item.deduccion_inventario ?? ''} onChange={(e) => handleInputChange(item.employee_id, 'deduccion_inventario', e)} className="input-currency"/></td>
                                            <td><input type="number" min="0" step="any" value={item.imss_deduction ?? ''} onChange={(e) => handleInputChange(item.employee_id, 'imss_deduction', e)} className="input-currency"/></td>
                                            <td><input type="number" min="0" step="any" value={item.infonavit_deduction ?? ''} onChange={(e) => handleInputChange(item.employee_id, 'infonavit_deduction', e)} className="input-currency"/></td>
                                            <td><input type="number" min="0" step="any" value={item.deduccion_faltantes_sobrantes ?? ''} onChange={(e) => handleInputChange(item.employee_id, 'deduccion_faltantes_sobrantes', e)} className="input-currency"/></td>
                                            <td><input type="number" min="0" step="any" value={item.deduccion_vales ?? ''} onChange={(e) => handleInputChange(item.employee_id, 'deduccion_vales', e)} className="input-currency"/></td>
                                            <td className="currency total-col">{formatCurrency(item.total_deductions)}</td>
                                            <td className="currency net-pay-col">{formatCurrency(item.neto_pay)}</td>
                                            <td className="firma-col"></td>
                                        </tr>
                                    ))}
                                     {group.totals && (
                                         <tr className="totals-row branch-total">
                                            <td>{group.totals.employee_name}</td> <td className="currency">{formatCurrency(group.totals.base_salary_weekly)}</td> <td></td>
                                            <td className="currency">{formatCurrency(group.totals.calculated_sueldo)}</td> <td className="currency">{formatCurrency(group.totals.calculated_septimo_dia)}</td>
                                            <td className="currency">{group.totals.overtime_hours?.toFixed(1) ?? 0}</td> <td className="currency">{formatCurrency(group.totals.calculated_overtime_pay)}</td>
                                            <td className="currency">{formatCurrency(group.totals.bono_asistencia)}</td> <td className="currency">{formatCurrency(group.totals.prima_dominical)}</td>
                                            <td className="currency">{formatCurrency(group.totals.comision_amount)}</td> <td className="currency total-col">{formatCurrency(group.totals.total_percepciones)}</td>
                                            <td className="currency">{formatCurrency(group.totals.deduccion_inventario)}</td> <td className="currency">{formatCurrency(group.totals.imss_deduction)}</td>
                                            <td className="currency">{formatCurrency(group.totals.infonavit_deduction)}</td> <td className="currency">{formatCurrency(group.totals.deduccion_faltantes_sobrantes)}</td>
                                            <td className="currency">{formatCurrency(group.totals.deduccion_vales)}</td> <td className="currency total-col">{formatCurrency(group.totals.total_deductions)}</td>
                                            <td className="currency net-pay-col">{formatCurrency(group.totals.neto_pay)}</td> <td className="firma-col"></td>
                                         </tr>
                                     )}
                                </React.Fragment>
                            ))}
                            {grandTotal && (
                                <tr className="totals-row grand-total">
                                    <td>{grandTotal.employee_name}</td> <td className="currency">{formatCurrency(grandTotal.base_salary_weekly)}</td> <td></td>
                                    <td className="currency">{formatCurrency(grandTotal.calculated_sueldo)}</td> <td className="currency">{formatCurrency(grandTotal.calculated_septimo_dia)}</td>
                                    <td className="currency">{grandTotal.overtime_hours?.toFixed(1) ?? 0}</td> <td className="currency">{formatCurrency(grandTotal.calculated_overtime_pay)}</td>
                                    <td className="currency">{formatCurrency(grandTotal.bono_asistencia)}</td> <td className="currency">{formatCurrency(grandTotal.prima_dominical)}</td>
                                    <td className="currency">{formatCurrency(grandTotal.comision_amount)}</td> <td className="currency total-col">{formatCurrency(grandTotal.total_percepciones)}</td>
                                    <td className="currency">{formatCurrency(grandTotal.deduccion_inventario)}</td> <td className="currency">{formatCurrency(grandTotal.imss_deduction)}</td>
                                    <td className="currency">{formatCurrency(grandTotal.infonavit_deduction)}</td> <td className="currency">{formatCurrency(grandTotal.deduccion_faltantes_sobrantes)}</td>
                                    <td className="currency">{formatCurrency(grandTotal.deduccion_vales)}</td> <td className="currency total-col">{formatCurrency(grandTotal.total_deductions)}</td>
                                    <td className="currency net-pay-col">{formatCurrency(grandTotal.neto_pay)}</td> <td className="firma-col"></td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default NominaManager;