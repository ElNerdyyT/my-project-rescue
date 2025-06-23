import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../utils/supabaseClient';

// --- Constantes y Tipos ---
const TODOS_DEPTOS = "__TODOS_DEPTOS__";
const TODOS_SUBDEPTOS = "__TODOS_SUBDEPTOS__";

interface Articulo {
    id: string;
    nombre: string;
    stockSistema: number;
    stockFisico: number;
    diferencia: number;
    departamento: string;
    subdepartamento: string;
}

interface MisplacedArticulo extends Articulo {
    ubicacionEsperada: string;
}

// --- NUEVO: Estructura para guardar el progreso ---
interface ProgresoGuardado {
    conteoFisico: [string, { stockFisico: number }][];
    misplacedItems: [string, MisplacedArticulo][];
    notFoundScannedItems: [string, { count: number }][];
    reportesFinalizados: [string, Articulo[]][]; // Guarda los datos de los reportes ya hechos
}

// --- Componente Principal ---
const InventarioSuc = () => {
    // --- Estados ---
    const [sucursalSeleccionada, setSucursalSeleccionada] = useState<string>(Object.keys(sucursalesConfig)[0]);
    const [allBranchItems, setAllBranchItems] = useState<Articulo[]>([]);
    // Estados de UI y Filtros
    const [availableDepts, setAvailableDepts] = useState<string[]>([]);
    const [selectedDept, setSelectedDept] = useState<string>(TODOS_DEPTOS);
    const [selectedSubDept, setSelectedSubDept] = useState<string>(TODOS_SUBDEPTOS);
    // Estados de Datos de Inventario
    const [misplacedItems, setMisplacedItems] = useState<Map<string, MisplacedArticulo>>(new Map());
    const [notFoundScannedItems, setNotFoundScannedItems] = useState<Map<string, { count: number }>>(new Map());
    // --- NUEVO ESTADO: Almacena los datos de los subdeptos finalizados ---
    const [reportesFinalizados, setReportesFinalizados] = useState<Map<string, Articulo[]>>(new Map());
    // Estados de Carga y Errores
    const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
    const [loadingError, setLoadingError] = useState<string | null>(null);
    const [codigoInput, setCodigoInput] = useState<string>('');
    const inputRef = useRef<HTMLInputElement>(null);

    // --- Carga y Fusión de Datos (al iniciar o cambiar de sucursal) ---
    useEffect(() => {
        const loadBranchData = async () => {
            setIsLoadingData(true); setLoadingError(null);
            // Resetear estados
            setAllBranchItems([]); setMisplacedItems(new Map()); setNotFoundScannedItems(new Map()); setReportesFinalizados(new Map());
            setSelectedDept(TODOS_DEPTOS); setSelectedSubDept(TODOS_SUBDEPTOS);

            try {
                // 1. Cargar datos frescos de la BD
                const [depts, itemsFromDB] = await Promise.all([cargarDepartamentos(sucursalSeleccionada), cargarArticulosSucursal(sucursalSeleccionada)]);
                setAvailableDepts([TODOS_DEPTOS, ...depts]);
                
                // 2. Intentar restaurar progreso desde localStorage
                const key = `progreso_inventario_${sucursalSeleccionada}`;
                const progresoGuardadoJSON = localStorage.getItem(key);
                let itemsParaEstadoFinal = itemsFromDB;

                if (progresoGuardadoJSON) {
                    console.log("Progreso guardado encontrado. Fusionando...");
                    const progreso: ProgresoGuardado = JSON.parse(progresoGuardadoJSON);
                    const conteoGuardado = new Map(progreso.conteoFisico);
                    
                    // Fusionar conteo físico con los datos frescos de la BD
                    itemsParaEstadoFinal = itemsFromDB.map(itemDeDB => {
                        if (conteoGuardado.has(itemDeDB.id)) {
                            const stockFisico = conteoGuardado.get(itemDeDB.id)!.stockFisico;
                            return { ...itemDeDB, stockFisico, diferencia: stockFisico - itemDeDB.stockSistema };
                        }
                        return itemDeDB;
                    });
                    
                    // Restaurar otros datos del progreso
                    setMisplacedItems(new Map(progreso.misplacedItems));
                    setNotFoundScannedItems(new Map(progreso.notFoundScannedItems));
                    setReportesFinalizados(new Map(progreso.reportesFinalizados));
                }
                
                setAllBranchItems(itemsParaEstadoFinal);

            } catch (error: any) {
                setLoadingError(`Error al cargar datos: ${error.message}`);
            } finally {
                setIsLoadingData(false);
            }
        };
        loadBranchData();
    }, [sucursalSeleccionada]);

    // --- Guardado Automático de Progreso en localStorage ---
    useEffect(() => {
        if (isLoadingData) return;
        const key = `progreso_inventario_${sucursalSeleccionada}`;
        const conteoFisico = new Map();
        allBranchItems.forEach(item => {
            if (item.stockFisico > 0) conteoFisico.set(item.id, { stockFisico: item.stockFisico });
        });
        const progreso: ProgresoGuardado = {
            conteoFisico: Array.from(conteoFisico.entries()),
            misplacedItems: Array.from(misplacedItems.entries()),
            notFoundScannedItems: Array.from(notFoundScannedItems.entries()),
            reportesFinalizados: Array.from(reportesFinalizados.entries()),
        };
        localStorage.setItem(key, JSON.stringify(progreso));
    }, [allBranchItems, misplacedItems, notFoundScannedItems, reportesFinalizados, sucursalSeleccionada, isLoadingData]);

    // --- Datos Derivados (Memos) ---
    const availableSubDepts = useMemo(() => {
        if (selectedDept === TODOS_DEPTOS) return [];
        const subDepts = allBranchItems.filter(item => item.departamento === selectedDept).map(item => item.subdepartamento);
        return [TODOS_SUBDEPTOS, ...[...new Set(subDepts)].sort()];
    }, [allBranchItems, selectedDept]);

    const articulosParaMostrarUI = useMemo(() => {
        if (selectedDept === TODOS_DEPTOS || selectedSubDept === TODOS_SUBDEPTOS) return [];
        let items = allBranchItems.filter(item => item.departamento === selectedDept && item.subdepartamento === selectedSubDept);
        return items.filter(item => item.stockSistema !== 0 || item.stockFisico !== 0).sort((a, b) => a.nombre.localeCompare(b.nombre));
    }, [allBranchItems, selectedDept, selectedSubDept]);

    // --- Lógica de Procesamiento de Escaneo ---
    const procesarCodigo = (codigo: string) => {
        // ... (sin cambios en esta función)
        if (!codigo) return;
        setErrorScanner(null);
        const globalArticuloIndex = allBranchItems.findIndex(a => a.id === codigo);
        if (globalArticuloIndex !== -1) {
            const articuloEnSistema = allBranchItems[globalArticuloIndex];
            setAllBranchItems(prevAllItems => {
                const nuevosAllItems = [...prevAllItems];
                const artActualizado = { ...nuevosAllItems[globalArticuloIndex] };
                artActualizado.stockFisico += 1;
                artActualizado.diferencia = artActualizado.stockFisico - artActualizado.stockSistema;
                nuevosAllItems[globalArticuloIndex] = artActualizado;
                const esDeptoIncorrecto = articuloEnSistema.departamento !== selectedDept;
                const esSubdeptoIncorrecto = selectedSubDept !== TODOS_SUBDEPTOS && articuloEnSistema.subdepartamento !== selectedSubDept;
                if (selectedDept !== TODOS_DEPTOS && (esDeptoIncorrecto || esSubdeptoIncorrecto)) {
                    const ubicacionReal = `Depto: ${articuloEnSistema.departamento} / Subd: ${articuloEnSistema.subdepartamento}`;
                    setErrorScanner(`Artículo ${codigo} (${articuloEnSistema.nombre}) pertenece a: ${ubicacionReal}.`);
                    const ubicacionEsperada = `Depto: ${selectedDept}${selectedSubDept !== TODOS_SUBDEPTOS ? ' / Subd: ' + selectedSubDept : ''}`;
                    setMisplacedItems(prev => new Map(prev).set(codigo, { ...artActualizado, ubicacionEsperada }));
                } else {
                    setMisplacedItems(prev => {
                        if (prev.has(codigo)) {
                            const nuevos = new Map(prev);
                            nuevos.delete(codigo);
                            return nuevos;
                        }
                        return prev;
                    });
                }
                return nuevosAllItems;
            });
        } else {
            setErrorScanner(`Código ${codigo} NO encontrado en esta sucursal.`);
            setNotFoundScannedItems(prev => new Map(prev).set(codigo, { count: (prev.get(codigo)?.count || 0) + 1 }));
        }
        setCodigoInput('');
        if (inputRef.current) { inputRef.current.value = ''; inputRef.current.focus(); }
    };
    
    // --- NUEVO: Genera PDF para un subdepartamento y lo finaliza ---
    const finalizarYGenerarPdfSubdepto = () => {
        setIsGeneratingPdf(true);
        const subDeptKey = `${selectedDept}-${selectedSubDept}`;
        const articulosDelSubdepto = allBranchItems.filter(a => a.departamento === selectedDept && a.subdepartamento === selectedSubDept);
        
        // Generar el PDF para este subdepartamento (incluyendo faltantes)
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text(`Reporte de Inventario - Subdepartamento: ${selectedSubDept}`, 14, 22);
        doc.setFontSize(11);
        doc.text(`Sucursal: ${sucursalSeleccionada} / Departamento: ${selectedDept}`, 14, 30);
        doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 36);

        const articulosConDiferencia = articulosDelSubdepto.filter(a => a.diferencia !== 0);
        
        if (articulosConDiferencia.length > 0) {
             autoTable(doc, {
                startY: 45,
                head: [['Código', 'Nombre', 'Sist.', 'Físico', 'Dif.']],
                body: articulosConDiferencia.sort((a,b) => a.nombre.localeCompare(b.nombre)).map(a => [a.id, a.nombre, a.stockSistema, a.stockFisico, a.diferencia > 0 ? `+${a.diferencia}` : a.diferencia]),
                styles: { fontSize: 9 },
            });
        } else {
             autoTable(doc, { startY: 45, body: [['No se encontraron diferencias en este subdepartamento.']] });
        }
        
        doc.save(`Reporte_${sucursalSeleccionada}_${selectedDept}_${selectedSubDept}.pdf`);

        // Guardar el resultado en el estado de finalizados
        setReportesFinalizados(prev => new Map(prev).set(subDeptKey, articulosDelSubdepto));
        
        setIsGeneratingPdf(false);
        alert(`Reporte para "${selectedSubDept}" generado y guardado. Por favor, seleccione otro subdepartamento.`);
        setSelectedSubDept(TODOS_SUBDEPTOS); // Resetear para el siguiente
    };

    // --- NUEVO: Genera el PDF final consolidado ---
    const generarPdfFinalConsolidado = () => {
         if (reportesFinalizados.size === 0) {
            alert("No hay subdepartamentos finalizados para generar un reporte consolidado.");
            return;
        }
        setIsGeneratingPdf(true);
        
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text(`Reporte Final Consolidado - ${sucursalSeleccionada}`, 14, 22);
        doc.setFontSize(11);
        doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 30);
        
        let finalY = 35; // Posición inicial para la primera tabla

        // Por cada reporte finalizado, crear una sección en el PDF
        for (const [key, articulos] of reportesFinalizados.entries()) {
            const articulosConDiferencia = articulos.filter(a => a.diferencia !== 0);
            if (articulosConDiferencia.length === 0) continue; // Omitir si no hubo diferencias

            const [depto, subdepto] = key.split('-');
            doc.setFontSize(14);
            // @ts-ignore
            const startY = finalY > 250 ? 20 : finalY + 15; // Salto de página si es necesario
            if (startY === 20) doc.addPage();
            doc.text(`Resultados para: ${depto} / ${subdepto}`, 14, startY);

            autoTable(doc, {
                startY: startY + 5,
                head: [['Código', 'Nombre', 'Sist.', 'Físico', 'Dif.']],
                body: articulosConDiferencia.sort((a,b) => a.nombre.localeCompare(b.nombre)).map(a => [a.id, a.nombre, a.stockSistema, a.stockFisico, a.diferencia > 0 ? `+${a.diferencia}` : a.diferencia]),
                styles: { fontSize: 9 },
            });
            // @ts-ignore
            finalY = doc.lastAutoTable.finalY;
        }
        
        doc.save(`Reporte_Consolidado_Final_${sucursalSeleccionada}.pdf`);
        setIsGeneratingPdf(false);
    };

    // --- Limpiar Progreso ---
    const limpiarProgreso = () => {
        if (confirm(`¿Está seguro de que desea borrar TODO el progreso de inventario para la sucursal ${sucursalSeleccionada}? Esta acción no se puede deshacer.`)) {
            localStorage.removeItem(`progreso_inventario_${sucursalSeleccionada}`);
            window.location.reload();
        }
    };
    
    // --- Renderizado del Componente ---
    return (
        <div style={{ padding: '20px' }}>
            <h2>Control de Inventario Físico por Etapas</h2>
            
            {/* Sección de Filtros y Acciones */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginBottom: '10px', alignItems: 'center', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>
                {/* Selectores de Sucursal, Depto, Subdepto */}
                <div>
                    <label>Sucursal:</label>
                    <select value={sucursalSeleccionada} onChange={(e) => setSucursalSeleccionada(e.currentTarget.value)} disabled={isLoadingData || isGeneratingPdf}>
                        {Object.keys(sucursalesConfig).map(suc => (<option key={suc} value={suc}>{suc}</option>))}
                    </select>
                </div>
                <div>
                    <label>Departamento:</label>
                    <select value={selectedDept} onChange={(e) => { setSelectedDept(e.currentTarget.value); setSelectedSubDept(TODOS_SUBDEPTOS); }} disabled={isLoadingData || isGeneratingPdf}>
                         {availableDepts.map(dept => (<option key={dept} value={dept}>{dept === TODOS_DEPTOS ? 'Todos' : dept}</option>))}
                    </select>
                </div>
                <div>
                    <label>Subdepartamento:</label>
                    <select value={selectedSubDept} onChange={(e) => setSelectedSubDept(e.currentTarget.value)} disabled={selectedDept === TODOS_DEPTOS || isLoadingData}>
                        <option value={TODOS_SUBDEPTOS}>-- Seleccione --</option>
                        {availableSubDepts.slice(1).map(sub => (
                            <option key={sub} value={sub} style={{ backgroundColor: reportesFinalizados.has(`${selectedDept}-${sub}`) ? '#d4edda' : 'transparent' }}>
                                {sub} {reportesFinalizados.has(`${selectedDept}-${sub}`) ? '✓ Finalizado' : ''}
                            </option>
                        ))}
                    </select>
                </div>
                {/* Botón para finalizar subdepartamento */}
                <div>
                    <button onClick={finalizarYGenerarPdfSubdepto} disabled={selectedSubDept === TODOS_SUBDEPTOS || isGeneratingPdf || reportesFinalizados.has(`${selectedDept}-${selectedSubDept}`)}>
                        Finalizar y Generar PDF de Subdepto
                    </button>
                </div>
            </div>

            {/* Sección de Escaneo */}
            <div style={{ margin: '20px 0' }}>
                <label htmlFor="barcode-input">Escanear Código:</label>
                <input
                    ref={inputRef}
                    type="text"
                    id="barcode-input"
                    value={codigoInput}
                    onInput={(e) => setCodigoInput(e.currentTarget.value)}
                    onKeyDown={(e) => e.key === 'Enter' && procesarCodigo(codigoInput)}
                    placeholder="Esperando escaneo..."
                    disabled={isLoadingData || isGeneratingPdf || selectedSubDept === TODOS_SUBDEPTOS || reportesFinalizados.has(`${selectedDept}-${selectedSubDept}`)}
                    style={{ marginLeft: '10px', padding: '8px', minWidth: '300px' }}
                />
                {errorScanner && <p style={{ color: 'orange', marginTop: '5px' }}>{errorScanner}</p>}
                {selectedDept !== TODOS_DEPTOS && selectedSubDept === TODOS_SUBDEPTOS && <p style={{color: 'blue'}}>Seleccione un subdepartamento para comenzar.</p>}
                {reportesFinalizados.has(`${selectedDept}-${selectedSubDept}`) && <p style={{color: 'green'}}>Este subdepartamento ya ha sido finalizado.</p>}
            </div>

            {/* Indicadores de Carga y Errores */}
            {isLoadingData && <p>Cargando datos y progreso...</p>}
            {isGeneratingPdf && <p style={{ color: 'blue' }}>Generando PDF, por favor espera...</p>}
            {loadingError && <p style={{ color: 'red' }}><strong>Error:</strong> {loadingError}</p>}
            
            {/* Tabla de Inventario en Tiempo Real */}
            {!isLoadingData && selectedSubDept !== TODOS_SUBDEPTOS && (
                 <table cellPadding="8" cellSpacing="0" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                     {/* Encabezados de la tabla */}
                    <thead style={{ backgroundColor: '#f2f2f2' }}><tr><th style={{border: '1px solid #ddd'}}>Código</th><th style={{border: '1px solid #ddd'}}>Nombre</th><th style={{border: '1px solid #ddd', textAlign:'right'}}>Sistema</th><th style={{border: '1px solid #ddd', textAlign:'right'}}>Físico</th><th style={{border: '1px solid #ddd', textAlign:'right'}}>Diferencia</th></tr></thead>
                    <tbody>
                        {articulosParaMostrarUI.length === 0 ? (
                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: '20px'}}>No hay artículos para mostrar en esta vista.</td></tr>
                        ) : (
                            articulosParaMostrarUI.map((articulo) => (
                                <tr key={articulo.id} style={{ backgroundColor: misplacedItems.has(articulo.id) ? '#ffeeba' : (articulo.stockFisico > 0 ? '#e6ffed' : 'transparent')}}>
                                    <td>{articulo.id}</td><td>{articulo.nombre}</td>
                                    <td style={{ textAlign: 'right' }}>{articulo.stockSistema}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{articulo.stockFisico}</td>
                                    <td style={{ textAlign: 'right', color: articulo.diferencia === 0 ? 'black' : (articulo.diferencia > 0 ? 'green' : 'red'), fontWeight: 'bold' }}>{articulo.diferencia > 0 ? `+${articulo.diferencia}` : articulo.diferencia}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            )}

            {/* Sección de Acciones Finales */}
            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '2px solid #3498db', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={generarPdfFinalConsolidado} disabled={isGeneratingPdf || reportesFinalizados.size === 0} style={{backgroundColor: '#2ecc71', color: 'white', padding: '10px 15px', border: 'none', borderRadius: '5px'}}>
                   Generar Reporte Final Consolidado ({reportesFinalizados.size} finalizados)
                </button>
                <button onClick={limpiarProgreso} style={{backgroundColor: '#c0392b', color: 'white'}}>
                   Limpiar Progreso de Sucursal
                </button>
            </div>
        </div>
    );
};


// --- Funciones y Configuraciones Auxiliares (sin cambios) ---
const sucursalesConfig: { [key: string]: string } = {
    'Mexico': 'ArticulosMexico', 'Econo1': 'ArticulosEcono1', 'Baja': 'ArticulosBaja',
    'Sucursal4': 'ArticulosSucursal4', 'Sucursal5': 'ArticulosSucursal5',
    'Sucursal6': 'ArticulosSucursal6', 'Sucursal7': 'ArticulosSucursal7',
};

export default InventarioSuc;
