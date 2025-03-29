// --- START OF FILE GastosAdmin.tsx ---

import { useState, useEffect } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient'; // Adjust path if needed
import './GastosAdmin.css'; // We'll create this CSS file

// Use the same branch identifiers as your other components
const branchesForAdmin = [
    { key: 'Econo1', name: 'Econo 1' },
    { key: 'Mexico', name: 'Mexico' },
    { key: 'Madero', name: 'Madero' },
    { key: 'LopezM', name: 'Lopez M' },
    { key: 'Baja', name: 'Baja' },
    { key: 'Econo2', name: 'Econo 2' },
    { key: 'Lolita', name: 'Lolita' },
    // Add more if needed
];

// Interface matching the Supabase table structure (including id)
interface GastoMensualData {
    id?: number; // Added optional id
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

// Interface for form state (allows string inputs before conversion)
interface GastosFormState {
    renta: string;
    sueldos: string;
    luz: string;
    agua: string;
    internet: string;
    otros: string;
}

const currentYear = new Date().getFullYear();
const yearsForAdmin = Array.from({ length: 10 }, (_, i) => String(currentYear - i)); // Last 10 years
const monthsForAdmin = [
    { value: '1', name: 'Enero' }, { value: '2', name: 'Febrero' }, { value: '3', name: 'Marzo' },
    { value: '4', name: 'Abril' }, { value: '5', name: 'Mayo' }, { value: '6', name: 'Junio' },
    { value: '7', name: 'Julio' }, { value: '8', name: 'Agosto' }, { value: '9', name: 'Septiembre' },
    { value: '10', name: 'Octubre' }, { value: '11', name: 'Noviembre' }, { value: '12', name: 'Diciembre' }
];

const GastosAdmin = () => {
    // --- State ---
    const [selectedBranch, setSelectedBranch] = useState<string>(branchesForAdmin[0]?.key || '');
    const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));
    const [selectedMonth, setSelectedMonth] = useState<string>(String(new Date().getMonth() + 1)); // Default to current month

    // State for the top form
    const [formState, setFormState] = useState<GastosFormState>({
        renta: '0', sueldos: '0', luz: '0', agua: '0', internet: '0', otros: '0'
    });
    const [isLoading, setIsLoading] = useState<boolean>(false); // Loading for top form fetch
    const [isSaving, setIsSaving] = useState<boolean>(false); // Saving top form data
    const [loadedDataId, setLoadedDataId] = useState<number | null>(null); // ID for upsert logic

    // State for the bottom table
    const [expenseRecords, setExpenseRecords] = useState<GastoMensualData[]>([]);
    const [isTableLoading, setIsTableLoading] = useState<boolean>(false);

    // State for Edit Modal
    const [editingRecord, setEditingRecord] = useState<GastoMensualData | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
    const [isSubmittingEdit, setIsSubmittingEdit] = useState<boolean>(false);

    // State for Delete operation
    const [recordToDelete, setRecordToDelete] = useState<number | null>(null); // ID of record being deleted

    // General message state
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // --- Fetch Data for Top Form ---
    const fetchExpenses = async () => {
        if (!selectedBranch || !selectedYear || !selectedMonth) {
            // Reset form if selection is incomplete, don't show error unless attempted load
            setFormState({ renta: '0', sueldos: '0', luz: '0', agua: '0', internet: '0', otros: '0' });
            setLoadedDataId(null);
            setMessage(null); // Clear message
            return;
        }
        setIsLoading(true);
        setMessage(null);
        setLoadedDataId(null);
        setFormState({ renta: '0', sueldos: '0', luz: '0', agua: '0', internet: '0', otros: '0' }); // Reset form

        try {
            const yearNum = parseInt(selectedYear, 10);
            const monthNum = parseInt(selectedMonth, 10);

            const { data, error } = await supabase
                .from('gastos_mensuales')
                .select('*')
                .eq('branch_key', selectedBranch)
                .eq('year', yearNum)
                .eq('month', monthNum)
                .maybeSingle();

            if (error) throw error;

            if (data) {
                setFormState({
                    renta: String(data.renta ?? 0),
                    sueldos: String(data.sueldos ?? 0),
                    luz: String(data.luz ?? 0),
                    agua: String(data.agua ?? 0),
                    internet: String(data.internet ?? 0),
                    otros: String(data.otros ?? 0),
                });
                setLoadedDataId(data.id);
                // Optionally set a success message, or let the button text indicate loaded state
                // setMessage({ type: 'success', text: 'Datos cargados para este mes.' });
            } else {
                 // setMessage({ type: 'info', text: 'No hay datos previos para esta selección. Puede ingresar nuevos.' }); // Use info type
            }
        } catch (error: any) {
            console.error('Error fetching expenses for form:', error);
            setMessage({ type: 'error', text: `Error al cargar datos del formulario: ${error.message}` });
             setFormState({ renta: '0', sueldos: '0', luz: '0', agua: '0', internet: '0', otros: '0' });
        } finally {
            setIsLoading(false);
        }
    };

    // --- Fetch Data for Bottom Table ---
    const fetchBranchRecords = async () => {
        if (!selectedBranch) {
            setExpenseRecords([]); // Clear table if no branch selected
            return;
        };

        setIsTableLoading(true);
        setExpenseRecords([]);

        try {
            const { data, error } = await supabase
                .from('gastos_mensuales')
                .select('*')
                .eq('branch_key', selectedBranch)
                .order('year', { ascending: false })
                .order('month', { ascending: false });

            if (error) throw error;

            if (data) {
                // Ensure data matches the expected interface (with id)
                const records: GastoMensualData[] = data.map(item => ({
                    id: item.id,
                    branch_key: item.branch_key,
                    year: item.year,
                    month: item.month,
                    renta: item.renta ?? 0,
                    sueldos: item.sueldos ?? 0,
                    luz: item.luz ?? 0,
                    agua: item.agua ?? 0,
                    internet: item.internet ?? 0,
                    otros: item.otros ?? 0,
                }));
                 setExpenseRecords(records);
            }

        } catch (error: any) {
            console.error("Error fetching branch records:", error);
            setMessage({ type: 'error', text: `Error al cargar tabla de registros: ${error.message}` });
        } finally {
            setIsTableLoading(false);
        }
    };

    // --- Handle Input Changes ---
    const handleInputChange = (e: Event) => {
        const { name, value } = e.target as HTMLInputElement;
        const sanitizedValue = value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
        setFormState(prev => ({ ...prev, [name]: sanitizedValue }));
        setMessage(null);
    };

    // --- Handle Save/Upsert for Top Form ---
    const handleSave = async (e: Event) => {
        e.preventDefault();
        if (!selectedBranch || !selectedYear || !selectedMonth) {
            setMessage({ type: 'error', text: 'Seleccione sucursal, año y mes antes de guardar.' });
            return;
        }
        setIsSaving(true);
        setMessage(null);

        try {
            const expenseData = {
                branch_key: selectedBranch,
                year: parseInt(selectedYear, 10),
                month: parseInt(selectedMonth, 10),
                renta: parseFloat(formState.renta) || 0,
                sueldos: parseFloat(formState.sueldos) || 0,
                luz: parseFloat(formState.luz) || 0,
                agua: parseFloat(formState.agua) || 0,
                internet: parseFloat(formState.internet) || 0,
                otros: parseFloat(formState.otros) || 0,
            };

            const { error } = await supabase
                .from('gastos_mensuales')
                .upsert(expenseData, { onConflict: 'branch_key,year,month' });

            if (error) throw error;

            setMessage({ type: 'success', text: 'Datos guardados/actualizados exitosamente!' });
            await fetchExpenses(); // Re-fetch form data to confirm/get ID
            await fetchBranchRecords(); // Refresh table as this month might be new/updated

        } catch (error: any) {
            console.error('Error saving expenses:', error);
            setMessage({ type: 'error', text: `Error al guardar: ${error.message}` });
        } finally {
            setIsSaving(false);
        }
    };

    // --- Edit Handlers ---
    const handleEditClick = (record: GastoMensualData) => {
        setEditingRecord({ ...record });
        setIsEditModalOpen(true);
        setMessage(null);
    };

    const handleEditModalClose = () => {
        setIsEditModalOpen(false);
        setEditingRecord(null);
        // Clear message only if it wasn't a success message from edit save
         setMessage(prev => prev?.type === 'success' ? prev : null);
    };

    const handleEditInputChange = (e: Event) => {
        if (!editingRecord) return;
        const { name, value } = e.target as HTMLInputElement;
        const sanitizedValue = value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
        setEditingRecord(prev => prev ? { ...prev, [name]: sanitizedValue } : null);
    };

    const handleEditSave = async (e: Event) => {
        e.preventDefault();
        if (!editingRecord || editingRecord.id == null) {
            setMessage({ type: 'error', text: 'Error: No se encontró el registro para editar.' });
            return;
        }
        setIsSubmittingEdit(true);
        setMessage(null); // Clear message inside modal before attempt

        try {
            const updateData = {
                renta: parseFloat(String(editingRecord.renta)) || 0,
                sueldos: parseFloat(String(editingRecord.sueldos)) || 0,
                luz: parseFloat(String(editingRecord.luz)) || 0,
                agua: parseFloat(String(editingRecord.agua)) || 0,
                internet: parseFloat(String(editingRecord.internet)) || 0,
                otros: parseFloat(String(editingRecord.otros)) || 0,
            };

            const { error } = await supabase
                .from('gastos_mensuales')
                .update(updateData)
                .eq('id', editingRecord.id);

            if (error) throw error;

            // Set success message *before* closing modal or refreshing table
            setMessage({ type: 'success', text: 'Registro actualizado exitosamente!' });
            handleEditModalClose(); // Close modal
            await fetchBranchRecords(); // Refresh the table data
             // If the edited record was the one displayed in the top form, refresh it too
            if (editingRecord.year === parseInt(selectedYear) && editingRecord.month === parseInt(selectedMonth)) {
                 await fetchExpenses();
            }


        } catch (error: any) {
            console.error("Error updating record:", error);
             // Set error message to display inside the modal
             setMessage({ type: 'error', text: `Error al actualizar: ${error.message}` });
        } finally {
            setIsSubmittingEdit(false);
        }
    };

    // --- Delete Handler ---
    const handleDeleteClick = async (recordId: number | undefined) => {
        if (recordId === undefined) return;

        const confirmed = window.confirm("¿Está seguro de que desea eliminar este registro?\nEsta acción no se puede deshacer.");
        if (!confirmed) return;

        setRecordToDelete(recordId);
        setMessage(null);

        try {
            const { error } = await supabase
                .from('gastos_mensuales')
                .delete()
                .eq('id', recordId);

            if (error) throw error;

            setMessage({ type: 'success', text: 'Registro eliminado exitosamente.' });
            await fetchBranchRecords(); // Refresh the table
             // If the deleted record was the one displayed in the top form, clear the form
             const deletedRecord = expenseRecords.find(r => r.id === recordId);
             if (deletedRecord && deletedRecord.year === parseInt(selectedYear) && deletedRecord.month === parseInt(selectedMonth)) {
                  fetchExpenses(); // This will effectively reset the form as the data is gone
             }

        } catch (error: any) {
            console.error("Error deleting record:", error);
            setMessage({ type: 'error', text: `Error al eliminar: ${error.message}` });
        } finally {
             setRecordToDelete(null);
        }
    };

    // --- Effects ---
    // Effect 1: Fetch data for the FORM when specific selection changes
    useEffect(() => {
        fetchExpenses();
    }, [selectedBranch, selectedYear, selectedMonth]);

    // Effect 2: Fetch data for the TABLE when the branch selection changes
    useEffect(() => {
        fetchBranchRecords();
    }, [selectedBranch]);

    // --- Render ---
    return (
        <div class="gastos-admin-container">
            {/* --- Top Form Card --- */}
            <div class="card mb-4">
                <h2 class="card-header">Administrar Gastos Mensuales (Formulario)</h2>
                <form class="card-body" onSubmit={handleSave}>
                    {/* Selection Row */}
                    <div class="row g-3 mb-4 align-items-end">
                        <div class="col-md-4">
                            <label for="admin-branch" class="form-label">Sucursal</label>
                            <select id="admin-branch" class="form-select" value={selectedBranch} onChange={e => setSelectedBranch((e.target as HTMLSelectElement).value)} disabled={isLoading || isSaving || isTableLoading}>
                                <option value="" disabled>Seleccione...</option>
                                {branchesForAdmin.map(b => <option key={b.key} value={b.key}>{b.name}</option>)}
                            </select>
                        </div>
                        <div class="col-md-3">
                            <label for="admin-year" class="form-label">Año</label>
                            <select id="admin-year" class="form-select" value={selectedYear} onChange={e => setSelectedYear((e.target as HTMLSelectElement).value)} disabled={isLoading || isSaving || isTableLoading}>
                                {yearsForAdmin.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        <div class="col-md-3">
                            <label for="admin-month" class="form-label">Mes</label>
                            <select id="admin-month" class="form-select" value={selectedMonth} onChange={e => setSelectedMonth((e.target as HTMLSelectElement).value)} disabled={isLoading || isSaving || isTableLoading}>
                                {monthsForAdmin.map(m => <option key={m.value} value={m.value}>{m.name}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Message Display for Form Card (only when modal is closed) */}
                     {message && !isEditModalOpen && (
                        <div class={`alert alert-${message.type} alert-dismissible fade show small`} role="alert">
                            {message.text}
                            <button type="button" class="btn-close" onClick={() => setMessage(null)} aria-label="Close"></button>
                        </div>
                     )}
                     {isLoading && <div class="text-center my-3"><div class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">Cargando...</span></div> Cargando datos del formulario...</div>}

                    {/* Expense Inputs */}
                    <fieldset disabled={isLoading || isSaving || !selectedBranch || !selectedYear || !selectedMonth || isTableLoading}>
                        <legend class="h6 mb-3">Montos de Gastos (Nuevo o Cargar para mes/año)</legend>
                         <div class="row g-3">
                            <div class="col-md-4 col-sm-6">
                                <label for="renta" class="form-label">Renta</label>
                                <input type="text" inputmode="decimal" class="form-control" id="renta" name="renta" value={formState.renta} onInput={handleInputChange} />
                            </div>
                            <div class="col-md-4 col-sm-6">
                                <label for="sueldos" class="form-label">Sueldos</label>
                                <input type="text" inputmode="decimal" class="form-control" id="sueldos" name="sueldos" value={formState.sueldos} onInput={handleInputChange} />
                            </div>
                            <div class="col-md-4 col-sm-6">
                                <label for="luz" class="form-label">Luz</label>
                                <input type="text" inputmode="decimal" class="form-control" id="luz" name="luz" value={formState.luz} onInput={handleInputChange} />
                            </div>
                            <div class="col-md-4 col-sm-6">
                                <label for="agua" class="form-label">Agua</label>
                                <input type="text" inputmode="decimal" class="form-control" id="agua" name="agua" value={formState.agua} onInput={handleInputChange} />
                            </div>
                            <div class="col-md-4 col-sm-6">
                                <label for="internet" class="form-label">Internet</label>
                                <input type="text" inputmode="decimal" class="form-control" id="internet" name="internet" value={formState.internet} onInput={handleInputChange} />
                            </div>
                            <div class="col-md-4 col-sm-6">
                                <label for="otros" class="form-label">Otros Gastos</label>
                                <input type="text" inputmode="decimal" class="form-control" id="otros" name="otros" value={formState.otros} onInput={handleInputChange} />
                            </div>
                        </div>
                    </fieldset>

                    {/* Save Button */}
                    <div class="d-grid gap-2 mt-4">
                         <button
                            type="submit"
                            class="btn btn-primary"
                            disabled={isLoading || isSaving || !selectedBranch || !selectedYear || !selectedMonth || isTableLoading}
                            >
                            {isSaving ? (
                                <><span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Guardando...</>
                            ) : (
                                 loadedDataId ? 'Actualizar Mes Seleccionado' : 'Guardar Nuevo Mes'
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {/* --- Records Table Card --- */}
            <div class="card">
                <h3 class="card-header">Registros Existentes para: {branchesForAdmin.find(b => b.key === selectedBranch)?.name || 'Seleccione Sucursal'}</h3>
                <div class="card-body">
                    {/* Table Loading Indicator */}
                    {isTableLoading && (
                         <div class="text-center my-5">
                            <div class="spinner-border text-primary" role="status">
                                 <span class="visually-hidden">Cargando tabla...</span>
                            </div>
                            <p class="mt-2">Cargando registros...</p>
                        </div>
                    )}

                    {/* No Records Message */}
                    {!isTableLoading && expenseRecords.length === 0 && selectedBranch && (
                        <div class="alert alert-info text-center">No se encontraron registros para esta sucursal.</div>
                    )}
                     {!isTableLoading && !selectedBranch && (
                        <div class="alert alert-secondary text-center">Seleccione una sucursal para ver los registros.</div>
                    )}


                    {/* Table Display */}
                    {!isTableLoading && expenseRecords.length > 0 && (
                        <div class="table-responsive">
                            <table class="table table-striped table-hover table-sm records-table">
                                <thead>
                                    <tr>
                                        <th>Año</th>
                                        <th>Mes</th>
                                        <th class="text-end">Renta</th>
                                        <th class="text-end">Sueldos</th>
                                        <th class="text-end">Luz</th>
                                        <th class="text-end">Agua</th>
                                        <th class="text-end">Internet</th>
                                        <th class="text-end">Otros</th>
                                        <th class="text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {expenseRecords.map((record) => (
                                        <tr key={record.id}>
                                            <td>{record.year}</td>
                                            <td>{monthsForAdmin.find(m => m.value === String(record.month))?.name || record.month}</td>
                                            <td class="text-end">{record.renta.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</td>
                                            <td class="text-end">{record.sueldos.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</td>
                                            <td class="text-end">{record.luz.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</td>
                                            <td class="text-end">{record.agua.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</td>
                                            <td class="text-end">{record.internet.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</td>
                                            <td class="text-end">{record.otros.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</td>
                                            <td class="text-center actions-cell">
                                                {/* Edit Button */}
                                                <button
                                                    class="btn btn-outline-primary btn-sm me-1"
                                                    onClick={() => handleEditClick(record)}
                                                    title="Editar"
                                                    disabled={isEditModalOpen || recordToDelete === record.id}
                                                    >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pencil-square" viewBox="0 0 16 16"> <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/> <path fill-rule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5v11z"/> </svg>
                                                </button>
                                                {/* Delete Button */}
                                                <button
                                                    class="btn btn-outline-danger btn-sm"
                                                    onClick={() => handleDeleteClick(record.id)}
                                                    title="Eliminar"
                                                    disabled={isEditModalOpen || recordToDelete === record.id}
                                                    >
                                                    {recordToDelete === record.id ? (
                                                        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                                    ) : (
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash3" viewBox="0 0 16 16"> <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5ZM11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H2.506a.58.58 0 0 0-.01 0H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1h-.995a.59.59 0 0 0-.01 0H11Zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5h9.916Zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47ZM8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5Z"/> </svg>
                                                    )}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                     )}
                </div>
            </div>

            {/* --- Edit Modal --- */}
            {isEditModalOpen && editingRecord && (
                <div class="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
                    <div class="modal-dialog modal-lg modal-dialog-centered">
                        <div class="modal-content">
                            <form onSubmit={handleEditSave}>
                                <div class="modal-header">
                                    <h5 class="modal-title">Editar Registro - {editingRecord.branch_key} ({monthsForAdmin.find(m=>m.value === String(editingRecord.month))?.name} {editingRecord.year})</h5>
                                    <button type="button" class="btn-close" onClick={handleEditModalClose} aria-label="Close" disabled={isSubmittingEdit}></button>
                                </div>
                                <div class="modal-body">
                                    {/* Message Display inside Modal */}
                                    {message && isEditModalOpen && (
                                         <div class={`alert alert-${message.type} small`} role="alert"> {message.text} </div>
                                     )}
                                    <fieldset disabled={isSubmittingEdit}>
                                         <div class="row g-3">
                                            <div class="col-md-4 col-sm-6">
                                                <label for="edit-renta" class="form-label">Renta</label>
                                                <input type="text" inputmode="decimal" class="form-control form-control-sm" id="edit-renta" name="renta" value={String(editingRecord.renta)} onInput={handleEditInputChange} />
                                            </div>
                                            <div class="col-md-4 col-sm-6">
                                                <label for="edit-sueldos" class="form-label">Sueldos</label>
                                                <input type="text" inputmode="decimal" class="form-control form-control-sm" id="edit-sueldos" name="sueldos" value={String(editingRecord.sueldos)} onInput={handleEditInputChange} />
                                            </div>
                                            <div class="col-md-4 col-sm-6">
                                                <label for="edit-luz" class="form-label">Luz</label>
                                                <input type="text" inputmode="decimal" class="form-control form-control-sm" id="edit-luz" name="luz" value={String(editingRecord.luz)} onInput={handleEditInputChange} />
                                            </div>
                                            <div class="col-md-4 col-sm-6">
                                                <label for="edit-agua" class="form-label">Agua</label>
                                                <input type="text" inputmode="decimal" class="form-control form-control-sm" id="edit-agua" name="agua" value={String(editingRecord.agua)} onInput={handleEditInputChange} />
                                            </div>
                                            <div class="col-md-4 col-sm-6">
                                                <label for="edit-internet" class="form-label">Internet</label>
                                                <input type="text" inputmode="decimal" class="form-control form-control-sm" id="edit-internet" name="internet" value={String(editingRecord.internet)} onInput={handleEditInputChange} />
                                            </div>
                                            <div class="col-md-4 col-sm-6">
                                                <label for="edit-otros" class="form-label">Otros Gastos</label>
                                                <input type="text" inputmode="decimal" class="form-control form-control-sm" id="edit-otros" name="otros" value={String(editingRecord.otros)} onInput={handleEditInputChange} />
                                            </div>
                                         </div>
                                    </fieldset>
                                </div>
                                <div class="modal-footer">
                                    <button type="button" class="btn btn-secondary" onClick={handleEditModalClose} disabled={isSubmittingEdit}>Cancelar</button>
                                    <button type="submit" class="btn btn-primary" disabled={isSubmittingEdit}>
                                        {isSubmittingEdit ? (
                                            <><span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Actualizando...</>
                                        ) : (
                                            'Guardar Cambios'
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                 </div>
            )}
            {/* Modal Backdrop */}
             {isEditModalOpen && <div class="modal-backdrop fade show"></div>}

        </div> // End Container
    );
};

export default GastosAdmin;

// --- END OF FILE GastosAdmin.tsx ---