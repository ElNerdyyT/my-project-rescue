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

interface ProgresoGuardado {
    conteoFisico: [string, { stockFisico: number }][];
    misplacedItems: [string, MisplacedArticulo][];
    notFoundScannedItems: [string, { count: number }][];
    reportesFinalizados: [string, Articulo[]][];
}

// --- Configuraciones y Funciones de Carga ---
const sucursalesConfig: { [key: string]: string } = {
    'Mexico': 'ArticulosMexico', 'Econo1': 'ArticulosEcono1', 'Lolita': 'ArticulosLolita',
    'LopezM': 'ArticulosLopezM', 'Madero': 'ArticulosMadero',
    'Econo2': 'ArticulosEcono2', 'Sucursal7': 'ArticulosSucursal7',
};

const cargarArticulosSucursal = async (nombreSucursal: string): Promise<Articulo[]> => {
    const tableName = sucursalesConfig[nombreSucursal];
    if (!tableName) throw new Error(`Configuración de tabla faltante para ${nombreSucursal}`);
    try {
        const { data, error } = await supabase.from(tableName).select('cve_articulo_a, nombre_comer_a, cant_piso_a, depto_a, subdepto_a');
        if (error) throw error;
        if (!data) return [];
        return data.map((item: any) => ({
            id: item.cve_articulo_a,
            nombre: item.nombre_comer_a || 'Nombre no disponible',
            stockSistema: Number(item.cant_piso_a) || 0,
            stockFisico: 0,
            diferencia: 0 - (Number(item.cant_piso_a) || 0),
            departamento: item.depto_a?.toString().trim() || 'Sin Depto',
            subdepartamento: item.subdepto_a?.toString().trim() || 'Sin Subdepto',
        }));
    } catch (err) {
        console.error("Error en cargarArticulosSucursal:", err);
        throw err;
    }
};

const cargarDepartamentos = async (nombreSucursal: string): Promise<string[]> => {
    const tableName = sucursalesConfig[nombreSucursal];
    if (!tableName) return [];
    try {
        const { data, error } = await supabase.from(tableName).select('depto_a');
        if (error) throw error;
        if (!data) return [];
        const depts = [...new Set(data.map((item: any) => item.depto_a?.toString().trim() || ''))]
            .filter(Boolean)
            .sort((a, b) => Number(a) - Number(b));
        return depts;
    } catch (err) {
        console.error(`Error cargando departamentos:`, err);
        return [];
    }
};

const cargarNombresSubdeptos = async (): Promise<Map<string, string>> => {
    try {
        const { data, error } = await supabase.from('deptos').select('depto, subdepto, nombre');
        if (error) throw error;
        if (!data) return new Map();

        const nombresMap = new Map<string, string>();
        for (const item of data) {
            if (item.depto && item.subdepto) {
                const key = `${item.depto.toString().trim()}-${item.subdepto.toString().trim()}`;
                nombresMap.set(key, item.nombre || `Subdepto ${item.subdepto}`);
            }
        }
        return nombresMap;
    } catch (err) {
        console.error("Error cargando nombres de subdepartamentos:", err);
        return new Map();
    }
};


// --- Componente Principal ---
const InventarioSuc = () => {
    const [sucursalSeleccionada, setSucursalSeleccionada] = useState<string>(Object.keys(sucursalesConfig)[0]);
    const [allBranchItems, setAllBranchItems] = useState<Articulo[]>([]);
    const [availableDepts, setAvailableDepts] = useState<string[]>([]);
    const [selectedDept, setSelectedDept] = useState<string>(TODOS_DEPTOS);
    const [selectedSubDept, setSelectedSubDept] = useState<string>(TODOS_SUBDEPTOS);
    const [subDeptNombres, setSubDeptNombres] = useState<Map<string, string>>(new Map());
    const [isEditingSubDept, setIsEditingSubDept] = useState<boolean>(false);
    const [misplacedItems, setMisplacedItems] = useState<Map<string, MisplacedArticulo>>(new Map());
    const [notFoundScannedItems, setNotFoundScannedItems] = useState<Map<string, { count: number }>>(new Map());
    const [reportesFinalizados, setReportesFinalizados] = useState<Map<string, Articulo[]>>(new Map());
    const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
    const [loadingError, setLoadingError] = useState<string | null>(null);
    const [codigoInput, setCodigoInput] = useState<string>('');
    const [errorScanner, setErrorScanner] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const loadBranchData = async () => {
            setIsLoadingData(true); setLoadingError(null);
            setAllBranchItems([]); setMisplacedItems(new Map()); setNotFoundScannedItems(new Map()); setReportesFinalizados(new Map());
            setSelectedDept(TODOS_DEPTOS); setSelectedSubDept(TODOS_SUBDEPTOS); setIsEditingSubDept(false);
            try {
                const [depts, itemsFromDB, nombresSubdeptos] = await Promise.all([
                    cargarDepartamentos(sucursalSeleccionada),
                    cargarArticulosSucursal(sucursalSeleccionada),
                    cargarNombresSubdeptos()
                ]);
                
                setAvailableDepts([TODOS_DEPTOS, ...depts]);
                setSubDeptNombres(nombresSubdeptos);

                const key = `progreso_inventario_${sucursalSeleccionada}`;
                const progresoGuardadoJSON = localStorage.getItem(key);
                let itemsParaEstadoFinal = itemsFromDB;
                if (progresoGuardadoJSON) {
                    const progreso: ProgresoGuardado = JSON.parse(progresoGuardadoJSON);
                    const conteoGuardado = new Map(progreso.conteoFisico);
                    itemsParaEstadoFinal = itemsFromDB.map(itemDeDB => {
                        if (conteoGuardado.has(itemDeDB.id)) {
                            const stockFisico = conteoGuardado.get(itemDeDB.id)!.stockFisico;
                            return { ...itemDeDB, stockFisico, diferencia: stockFisico - itemDeDB.stockSistema };
                        }
                        return itemDeDB;
                    });
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

    const availableSubDepts = useMemo(() => {
        if (selectedDept === TODOS_DEPTOS) return [];
        
        const subDeptNumbers = [...new Set(
            allBranchItems
                .filter(item => item.departamento === selectedDept)
                .map(item => item.subdepartamento)
        )];

        const subDeptObjects = subDeptNumbers.map(subDeptNum => {
            const key = `${selectedDept}-${subDeptNum}`;
            const label = subDeptNombres.get(key) || subDeptNum;
            return { value: subDeptNum, label: label };
        });

        subDeptObjects.sort((a, b) => {
            const aIsNumericOnly = a.label === a.value;
            const bIsNumericOnly = b.label === b.value;

            if (!aIsNumericOnly && bIsNumericOnly) return -1;
            if (aIsNumericOnly && !bIsNumericOnly) return 1;

            if (!aIsNumericOnly && !bIsNumericOnly) {
                return a.label.localeCompare(b.label);
            }
            
            return Number(a.value) - Number(b.value); 
        });

        return subDeptObjects;
    }, [allBranchItems, selectedDept, subDeptNombres]);

    const articulosParaMostrarUI = useMemo(() => {
        if (selectedDept === TODOS_DEPTOS || selectedSubDept === TODOS_SUBDEPTOS) return [];
        let items = allBranchItems.filter(item => item.departamento === selectedDept && item.subdepartamento === selectedSubDept);
        return items.filter(item => item.stockSistema !== 0 || item.stockFisico !== 0).sort((a, b) => a.nombre.localeCompare(b.nombre));
    }, [allBranchItems, selectedDept, selectedSubDept]);

    // --- MODIFICADO: Añade ceros a la izquierda si el código es menor a 13 caracteres ---
    const procesarCodigo = (codigo: string) => {
        if (!codigo) return;
        
        // Formatear el código para que tenga 13 caracteres, rellenando con ceros
        const codigoFormateado = codigo.length < 13 ? codigo.padStart(13, '0') : codigo;

        setErrorScanner(null);
        
        const globalArticuloIndex = allBranchItems.findIndex(a => a.id === codigoFormateado);

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
                    setErrorScanner(`Artículo ${codigoFormateado} (${articuloEnSistema.nombre}) pertenece a: ${ubicacionReal}.`);
                    const ubicacionEsperada = `Depto: ${selectedDept}${selectedSubDept !== TODOS_SUBDEPTOS ? ' / Subd: ' + selectedSubDept : ''}`;
                    setMisplacedItems(prev => new Map(prev).set(codigoFormateado, { ...artActualizado, ubicacionEsperada }));
                } else {
                    setMisplacedItems(prev => {
                        if (prev.has(codigoFormateado)) {
                            const nuevos = new Map(prev);
                            nuevos.delete(codigoFormateado);
                            return nuevos;
                        }
                        return prev;
                    });
                }
                return nuevosAllItems;
            });
        } else {
            setErrorScanner(`Código ${codigoFormateado} NO encontrado en esta sucursal.`);
            setNotFoundScannedItems(prev => new Map(prev).set(codigoFormateado, { count: (prev.get(codigoFormateado)?.count || 0) + 1 }));
        }
        
        setCodigoInput('');
        if (inputRef.current) { inputRef.current.value = ''; inputRef.current.focus(); }
    };
    
    const handleModificarSubdepto = (subdepto: string) => {
        setSelectedSubDept(subdepto);
        setIsEditingSubDept(true); 
        alert(`Modo de edición activado para "${subdepto}". Ahora puede escanear nuevos artículos. Cuando termine, presione "Actualizar Reporte".`);
    };

    const finalizarYGenerarPdfSubdepto = () => {
        setIsGeneratingPdf(true);
        const subDeptKey = `${selectedDept}-${selectedSubDept}`;
        const articulosDelSubdepto = allBranchItems.filter(a => a.departamento === selectedDept && a.subdepartamento === selectedSubDept);

        if (isEditingSubDept) {
            setReportesFinalizados(prev => new Map(prev).set(subDeptKey, articulosDelSubdepto));
            setIsGeneratingPdf(false);
            setIsEditingSubDept(false);
            setSelectedSubDept(TODOS_SUBDEPTOS);
            alert(`Reporte para "${selectedSubDept}" ha sido actualizado. Por favor, seleccione otro subdepartamento.`);
            return;
        }

        const doc = new jsPDF();
        const now = new Date();
        const formattedDateTime = now.toLocaleString();
        const fileTimestamp = now.toISOString().replace(/[:.]/g, '-');

        doc.setFontSize(16);
        doc.text(`Reporte de Inventario - Subdepartamento: ${selectedSubDept}`, 14, 22);
        doc.setFontSize(11);
        doc.text(`Sucursal: ${sucursalSeleccionada} / Departamento: ${selectedDept}`, 14, 30);
        doc.text(`Generado: ${formattedDateTime}`, 14, 36);
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
        doc.save(`Reporte_${sucursalSeleccionada}_${selectedDept}_${selectedSubDept}_${fileTimestamp}.pdf`);
        setReportesFinalizados(prev => new Map(prev).set(subDeptKey, articulosDelSubdepto));
        setIsGeneratingPdf(false);
        alert(`Reporte para "${selectedSubDept}" generado y guardado. Por favor, seleccione otro subdepartamento.`);
        setSelectedSubDept(TODOS_SUBDEPTOS);
    };

    const generarPdfFinalConsolidado = () => {
         if (reportesFinalizados.size === 0) {
            alert("No hay subdepartamentos finalizados para generar un reporte consolidado.");
            return;
        }
        setIsGeneratingPdf(true);
        const doc = new jsPDF();
        const now = new Date();
        const formattedDateTime = now.toLocaleString();
        const fileTimestamp = now.toISOString().replace(/[:.]/g, '-');

        doc.setFontSize(18);
        doc.text(`Reporte Final Consolidado - ${sucursalSeleccionada}`, 14, 22);
        doc.setFontSize(11);
        doc.text(`Generado: ${formattedDateTime}`, 14, 30);
        
        let finalY = 35;

        for (const [key, articulos] of reportesFinalizados.entries()) {
            const articulosConDiferencia = articulos.filter(a => a.diferencia !== 0);
            if (articulosConDiferencia.length === 0) continue;
            const [depto, subdepto] = key.split('-');
            doc.setFontSize(14);
            const startY = finalY > 250 ? 20 : finalY + 15;
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

        if (misplacedItems.size > 0) {
            const misplacedOrdenado = Array.from(misplacedItems.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
            const startY = finalY > 250 ? 20 : finalY + 15;
            if (startY === 20) doc.addPage();
            doc.setFontSize(14);
            doc.text("Resumen de Artículos Mal Ubicados (Toda la Sesión)", 14, startY);
            autoTable(doc, {
                startY: startY + 5,
                head: [['Código', 'Nombre', 'Ubicación Esperada', 'Ubicación Real']],
                body: misplacedOrdenado.map(a => [a.id, a.nombre, a.ubicacionEsperada, `Depto: ${a.departamento} / Subd: ${a.subdepartamento}`]),
                headStyles: { fillColor: [243, 156, 18] },
                styles: { fontSize: 8 },
            });
            // @ts-ignore
            finalY = doc.lastAutoTable.finalY;
        }

        if (notFoundScannedItems.size > 0) {
            const notFoundOrdenado = Array.from(notFoundScannedItems.entries()).sort((a, b) => a[0].localeCompare(b[0]));
            const startY = finalY > 250 ? 20 : finalY + 15;
            if (startY === 20) doc.addPage();
            doc.setFontSize(14);
            doc.text("Resumen de Códigos No Encontrados (Toda la Sesión)", 14, startY);
            autoTable(doc, {
                startY: startY + 5,
                head: [['Código No Encontrado', 'Veces Escaneado']],
                body: notFoundOrdenado.map(([id, data]) => [id, data.count]),
                headStyles: { fillColor: [192, 57, 43] },
                styles: { fontSize: 8 },
            });
        }
        
        doc.save(`Reporte_Consolidado_Final_${sucursalSeleccionada}_${fileTimestamp}.pdf`);
        setIsGeneratingPdf(false);
    };

    const limpiarProgreso = () => {
        if (confirm(`¿Está seguro de que desea borrar TODO el progreso de inventario para la sucursal ${sucursalSeleccionada}? Esta acción no se puede deshacer.`)) {
            localStorage.removeItem(`progreso_inventario_${sucursalSeleccionada}`);
            window.location.reload();
        }
    };
    
    const puedeEscanear = !isLoadingData && !isGeneratingPdf && selectedSubDept !== TODOS_SUBDEPTOS && (!reportesFinalizados.has(`${selectedDept}-${selectedSubDept}`) || isEditingSubDept);

    return (
        <div style={{ padding: '20px' }}>
            <h2>Control de Inventario Físico por Etapas</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginBottom: '10px', alignItems: 'center', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>
                <div>
                    <label>Sucursal:</label>
                    <select value={sucursalSeleccionada} onChange={(e) => setSucursalSeleccionada(e.currentTarget.value)} disabled={isLoadingData || isGeneratingPdf || isEditingSubDept}>
                        {Object.keys(sucursalesConfig).map(suc => (<option key={suc} value={suc}>{suc}</option>))}
                    </select>
                </div>
                <div>
                    <label>Departamento:</label>
                    <select value={selectedDept} onChange={(e) => { setSelectedDept(e.currentTarget.value); setSelectedSubDept(TODOS_SUBDEPTOS); setIsEditingSubDept(false); }} disabled={isLoadingData || isGeneratingPdf || isEditingSubDept}>
                         {availableDepts.map(dept => (<option key={dept} value={dept}>{dept === TODOS_DEPTOS ? 'Todos' : dept}</option>))}
                    </select>
                </div>
                <div>
                    <label>Subdepartamento:</label>
                    <select value={selectedSubDept} onChange={(e) => setSelectedSubDept(e.currentTarget.value)} disabled={selectedDept === TODOS_DEPTOS || isLoadingData || isEditingSubDept}>
                        <option value={TODOS_SUBDEPTOS}>-- Seleccione --</option>
                        {availableSubDepts.map(sub => {
                            const subDeptKey = `${selectedDept}-${sub.value}`;
                            const isFinalizado = reportesFinalizados.has(subDeptKey);
                            return (
                                <option 
                                    key={sub.value} 
                                    value={sub.value} 
                                    style={{ backgroundColor: isFinalizado ? '#d4edda' : 'transparent' }}
                                >
                                    {sub.label} {isFinalizado ? '✓ Finalizado' : ''}
                                </option>
                            );
                        })}
                    </select>
                </div>
                <div>
                    {isEditingSubDept ? (
                         <button onClick={finalizarYGenerarPdfSubdepto} disabled={isGeneratingPdf} style={{backgroundColor: '#f39c12', color: 'white'}}>
                            Actualizar Reporte
                        </button>
                    ) : (
                        <button onClick={finalizarYGenerarPdfSubdepto} disabled={selectedSubDept === TODOS_SUBDEPTOS || isGeneratingPdf || reportesFinalizados.has(`${selectedDept}-${selectedSubDept}`)}>
                            Finalizar y Generar PDF
                        </button>
                    )}
                </div>
            </div>

            {selectedDept !== TODOS_DEPTOS && !isEditingSubDept && (
                <div style={{ marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #eee' }}>
                    <p style={{fontWeight: 'bold'}}>Subdepartamentos Finalizados en "{selectedDept}":</p>
                    {availableSubDepts.filter(sub => reportesFinalizados.has(`${selectedDept}-${sub.value}`)).length > 0 ? (
                         availableSubDepts.filter(sub => reportesFinalizados.has(`${selectedDept}-${sub.value}`)).map(sub => (
                            <button key={sub.value} onClick={() => handleModificarSubdepto(sub.value)} style={{marginRight: '10px', backgroundColor: '#3498db', color: 'white'}}>
                                Modificar "{sub.label}"
                            </button>
                        ))
                    ) : <p>Ninguno.</p>}
                </div>
            )}
            
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
                    disabled={!puedeEscanear}
                    style={{ marginLeft: '10px', padding: '8px', minWidth: '300px' }}
                />
                {errorScanner && <p style={{ color: 'orange', marginTop: '5px' }}>{errorScanner}</p>}
                {selectedDept !== TODOS_DEPTOS && selectedSubDept === TODOS_SUBDEPTOS && !isEditingSubDept && <p style={{color: 'blue'}}>Seleccione un subdepartamento o modifique uno finalizado para comenzar.</p>}
                {reportesFinalizados.has(`${selectedDept}-${selectedSubDept}`) && !isEditingSubDept && <p style={{color: 'green'}}>Este subdepartamento ya ha sido finalizado. Puede modificarlo desde la sección de arriba.</p>}
                {isEditingSubDept && <p style={{color: 'orange', fontWeight: 'bold'}}>Editando el subdepartamento "{selectedSubDept}". Los artículos que escanee se agregarán al conteo existente.</p>}
            </div>

            {isLoadingData && <p>Cargando datos y progreso...</p>}
            {isGeneratingPdf && <p style={{ color: 'blue' }}>Generando PDF, por favor espera...</p>}
            {loadingError && <p style={{ color: 'red' }}><strong>Error:</strong> {loadingError}</p>}
            
            {!isLoadingData && selectedSubDept !== TODOS_SUBDEPTOS && (
                 <table cellPadding="8" cellSpacing="0" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
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

            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '2px solid #3498db', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={generarPdfFinalConsolidado} disabled={isGeneratingPdf || reportesFinalizados.size === 0 || isEditingSubDept} style={{backgroundColor: '#2ecc71', color: 'white', padding: '10px 15px', border: 'none', borderRadius: '5px'}}>
                   Generar Reporte Final Consolidado ({reportesFinalizados.size} finalizados)
                </button>
                <button onClick={limpiarProgreso} style={{backgroundColor: '#c0392b', color: 'white'}} disabled={isEditingSubDept}>
                   Limpiar Progreso de Sucursal
                </button>
            </div>
        </div>
    );
};

export default InventarioSuc;
