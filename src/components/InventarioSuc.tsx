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
    subdeptosRevisados: string[];
}

const sucursalesConfig: { [key: string]: string } = {
    'Mexico': 'ArticulosMexico', 'Econo1': 'ArticulosEcono1', 'Baja': 'ArticulosBaja',
    'Sucursal4': 'ArticulosSucursal4', 'Sucursal5': 'ArticulosSucursal5',
    'Sucursal6': 'ArticulosSucursal6', 'Sucursal7': 'ArticulosSucursal7',
};

const cargarArticulosSucursal = async (nombreSucursal: string): Promise<Articulo[]> => {
    // ... (código sin cambios)
};
const cargarDepartamentos = async (nombreSucursal: string): Promise<string[]> => {
    // ... (código sin cambios)
};


// --- Componente Principal ---
const InventarioSuc = () => {
    const [sucursalSeleccionada, setSucursalSeleccionada] = useState<string>(Object.keys(sucursalesConfig)[0]);
    const [allBranchItems, setAllBranchItems] = useState<Articulo[]>([]);
    const [availableDepts, setAvailableDepts] = useState<string[]>([]);
    const [selectedDept, setSelectedDept] = useState<string>(TODOS_DEPTOS);
    const [selectedSubDept, setSelectedSubDept] = useState<string>(TODOS_SUBDEPTOS);
    const [misplacedItems, setMisplacedItems] = useState<Map<string, MisplacedArticulo>>(new Map());
    const [notFoundScannedItems, setNotFoundScannedItems] = useState<Map<string, { count: number }>>(new Map());
    const [subdeptosRevisados, setSubdeptosRevisados] = useState<Set<string>>(new Set());
    const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
    const [loadingError, setLoadingError] = useState<string | null>(null);
    const [codigoInput, setCodigoInput] = useState<string>('');
    const [errorScanner, setErrorScanner] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // --- Efecto de Carga con Depuración ---
    useEffect(() => {
        const loadBranchData = async () => {
            console.log("[LOAD] 1. Iniciando carga de datos para sucursal:", sucursalSeleccionada);
            setIsLoadingData(true); setLoadingError(null);
            setSelectedDept(TODOS_DEPTOS); setSelectedSubDept(TODOS_SUBDEPTOS);
            try {
                const [depts, itemsFromDB] = await Promise.all([cargarDepartamentos(sucursalSeleccionada), cargarArticulosSucursal(sucursalSeleccionada)]);
                setAvailableDepts([TODOS_DEPTOS, ...depts]);
                const key = `progreso_inventario_${sucursalSeleccionada}`;
                console.log(`[LOAD] 2. Buscando progreso guardado con la llave: ${key}`);
                const progresoGuardadoJSON = localStorage.getItem(key);
                console.log(`[LOAD] 3. Datos crudos encontrados:`, progresoGuardadoJSON ? progresoGuardadoJSON.substring(0, 100) + '...' : null);
                
                let itemsParaEstadoFinal = itemsFromDB;
                if (progresoGuardadoJSON) {
                    console.log("[LOAD] 4. Se encontró progreso. Fusionando...");
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
                    setSubdeptosRevisados(new Set(progreso.subdeptosRevisados));
                } else {
                    console.log("[LOAD] 4. NO se encontró progreso. Usando datos limpios de la BD.");
                    setAllBranchItems(itemsFromDB);
                    setMisplacedItems(new Map());
                    setNotFoundScannedItems(new Map());
                    setSubdeptosRevisados(new Set());
                }
                setAllBranchItems(itemsParaEstadoFinal);
            } catch (error: any) {
                setLoadingError(`Error al cargar datos: ${error.message}`);
            } finally {
                setIsLoadingData(false);
                console.log("[LOAD] 5. Carga finalizada.");
            }
        };
        loadBranchData();
    }, [sucursalSeleccionada]);

    // --- Efecto de Auto-Guardado con Depuración ---
    useEffect(() => {
        console.log(`[AUTOSAVE] Verificando si guardar. isLoadingData: ${isLoadingData}`);
        if (isLoadingData) {
            console.log("[AUTOSAVE] Bloqueado. No se guardará.");
            return;
        }
        const key = `progreso_inventario_${sucursalSeleccionada}`;
        console.log(`[AUTOSAVE] Preparando para guardar en la llave: ${key}`);
        const conteoFisico = new Map();
        allBranchItems.forEach(item => {
            if (item.stockFisico > 0) conteoFisico.set(item.id, { stockFisico: item.stockFisico });
        });
        const progreso: ProgresoGuardado = {
            conteoFisico: Array.from(conteoFisico.entries()),
            misplacedItems: Array.from(misplacedItems.entries()),
            notFoundScannedItems: Array.from(notFoundScannedItems.entries()),
            subdeptosRevisados: Array.from(subdeptosRevisados),
        };
        localStorage.setItem(key, JSON.stringify(progreso));
        console.log("[AUTOSAVE] ¡Progreso guardado!");
    }, [allBranchItems, misplacedItems, notFoundScannedItems, subdeptosRevisados, sucursalSeleccionada, isLoadingData]);

    // --- Lógica de "Limpiar Progreso" con Depuración ---
    const limpiarProgreso = async () => {
        if (confirm(`¿Está seguro de que desea borrar TODO el progreso de inventario para la sucursal ${sucursalSeleccionada}? Esta acción no se puede deshacer.`)) {
            console.clear(); // Limpia la consola para ver solo los mensajes de esta acción
            console.log("------------------------------------------");
            console.log("[LIMPIAR] 1. Iniciando proceso de limpieza.");
            
            // Poner la UI en estado de carga para bloquear el auto-guardado
            setIsLoadingData(true);
            setLoadingError(null);
            
            // Borrar del localStorage
            const key = `progreso_inventario_${sucursalSeleccionada}`;
            console.log(`[LIMPIAR] 2. La llave a borrar es: ${key}`);
            localStorage.removeItem(key);
            console.log("[LIMPIAR] 3. localStorage.removeItem() ha sido llamado.");
            
            // Verificación inmediata
            const valorDespuesDeBorrar = localStorage.getItem(key);
            console.log(`[LIMPIAR] 4. Verificación: Valor en localStorage AHORA MISMO es: ${valorDespuesDeBorrar === null ? 'null (¡Borrado exitoso!)' : '¡ERROR! AÚN EXISTE VALOR'}`);

            // Resetear todos los estados relacionados al progreso
            console.log("[LIMPIAR] 5. Reseteando estados internos (listas, mapas, etc.).");
            setMisplacedItems(new Map());
            setNotFoundScannedItems(new Map());
            setSubdeptosRevisados(new Set());
            setSelectedDept(TODOS_DEPTOS);
            setSelectedSubDept(TODOS_SUBDEPTOS);

            try {
                console.log("[LIMPIAR] 6. Recargando lista limpia de artículos desde la base de datos...");
                const itemsFromDB = await cargarArticulosSucursal(sucursalSeleccionada);
                setAllBranchItems(itemsFromDB);
                console.log("[LIMPIAR] 7. Lista limpia cargada en el estado.");
                alert("El progreso ha sido limpiado. La aplicación se ha reseteado.");
            } catch (error: any) {
                setLoadingError(`Error recargando la lista de artículos: ${error.message}`);
            } finally {
                setIsLoadingData(false);
                console.log("[LIMPIAR] 8. Proceso de limpieza finalizado.");
                console.log("------------------------------------------");
            }
        }
    };
    
    // El resto del código (procesarCodigo, generar PDFs, y el return con el JSX) no tiene cambios.
    // ... (pegar el resto de las funciones y el return JSX de la versión anterior aquí)
    const procesarCodigo = (codigo: string) => {
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
                if (selectedDept !== TODOS_DEPTOS && selectedSubDept !== TODOS_SUBDEPTOS) {
                    const esDeptoIncorrecto = articuloEnSistema.departamento !== selectedDept;
                    const esSubdeptoIncorrecto = articuloEnSistema.subdepartamento !== selectedSubDept;
                    if (esDeptoIncorrecto || esSubdeptoIncorrecto) {
                        const ubicacionReal = `Depto: ${articuloEnSistema.departamento} / Subd: ${articuloEnSistema.subdepartamento}`;
                        setErrorScanner(`Artículo ${codigo} (${articuloEnSistema.nombre}) pertenece a: ${ubicacionReal}.`);
                        const ubicacionEsperada = `Depto: ${selectedDept} / Subd: ${selectedSubDept}`;
                        setMisplacedItems(prev => new Map(prev).set(codigo, { ...artActualizado, ubicacionEsperada }));
                    } else {
                        setMisplacedItems(prev => {
                            if (prev.has(codigo)) { const nuevos = new Map(prev); nuevos.delete(codigo); return nuevos; }
                            return prev;
                        });
                    }
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
    const generarPdfSubdepto = () => {
        setIsGeneratingPdf(true);
        const subDeptKey = `${selectedDept}-${selectedSubDept}`;
        const articulosDelSubdepto = allBranchItems.filter(a => a.departamento === selectedDept && a.subdepartamento === selectedSubDept);
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text(`Reporte Provisional - Subdepto: ${selectedSubDept}`, 14, 22);
        doc.setFontSize(11);
        doc.text(`Sucursal: ${sucursalSeleccionada} / Departamento: ${selectedDept}`, 14, 30);
        const timestamp = new Date().toLocaleString('sv').replace(/ /g, '_').replace(/:/g, '-');
        doc.text(`Generado: ${timestamp}`, 14, 36);
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
        doc.save(`Reporte_Prov_${sucursalSeleccionada}_${selectedDept}_${selectedSubDept}_${timestamp}.pdf`);
        setSubdeptosRevisados(prev => new Set(prev).add(subDeptKey));
        setIsGeneratingPdf(false);
        alert(`Reporte provisional para "${selectedSubDept}" generado. Puede continuar haciendo ajustes o seleccionar otro subdepartamento.`);
    };
    const generarPdfFinalConsolidado = () => {
         if (subdeptosRevisados.size === 0) {
            alert("No ha marcado ningún subdepartamento como 'revisado' para generar un reporte consolidado.");
            return;
        }
        setIsGeneratingPdf(true);
        const doc = new jsPDF();
        const timestamp = new Date().toLocaleString('sv').replace(/ /g, '_').replace(/:/g, '-');
        doc.setFontSize(18);
        doc.text(`Reporte Final Consolidado - ${sucursalSeleccionada}`, 14, 22);
        doc.setFontSize(11);
        doc.text(`Generado: ${timestamp}`, 14, 30);
        let finalY = 35;
        for (const key of subdeptosRevisados) {
            const [depto, subdepto] = key.split('-');
            const articulos = allBranchItems.filter(a => a.departamento === depto && a.subdepartamento === subdepto);
            const articulosConDiferencia = articulos.filter(a => a.diferencia !== 0);
            if (articulosConDiferencia.length === 0) continue;
            
            doc.setFontSize(14);
            const startY = finalY > 250 ? 20 : finalY + 15;
            if (startY === 20) doc.addPage();
            doc.text(`Resultados Finales para: ${depto} / ${subdepto}`, 14, startY);
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
            doc.text("Resumen de Artículos Mal Ubicados", 14, startY);
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
            doc.text("Resumen de Códigos No Encontrados", 14, startY);
            autoTable(doc, {
                startY: startY + 5,
                head: [['Código No Encontrado', 'Veces Escaneado']],
                body: notFoundOrdenado.map(([id, data]) => [id, data.count]),
                headStyles: { fillColor: [192, 57, 43] },
                styles: { fontSize: 8 },
            });
        }
        doc.save(`Reporte_Consolidado_Final_${sucursalSeleccionada}_${timestamp}.pdf`);
        setIsGeneratingPdf(false);
    };
    return (
        <div style={{ padding: '20px' }}>
            <h2>Control de Inventario Físico (Flexible)</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginBottom: '10px', alignItems: 'center', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>
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
                        {availableDepts.slice(1).map(sub => (
                            <option key={sub} value={sub} style={{ backgroundColor: subdeptosRevisados.has(`${selectedDept}-${sub}`) ? '#d4edda' : 'transparent' }}>
                                {sub} {subdeptosRevisados.has(`${selectedDept}-${sub}`) ? '✓ Revisado' : ''}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <button onClick={generarPdfSubdepto} disabled={selectedSubDept === TODOS_SUBDEPTOS || isGeneratingPdf}>
                        Generar PDF de Subdepto
                    </button>
                </div>
            </div>

            <div style={{ margin: '20px 0' }}>
                <label>Escanear Código:</label>
                <input ref={inputRef} type="text" value={codigoInput} onInput={(e) => setCodigoInput(e.currentTarget.value)}
                    onKeyDown={(e) => {if (e.key === 'Enter') { e.preventDefault(); procesarCodigo(codigoInput);}}}
                    placeholder="Esperando escaneo..."
                    disabled={isLoadingData || isGeneratingPdf || selectedSubDept === TODOS_SUBDEPTOS}
                    style={{ marginLeft: '10px', padding: '8px', minWidth: '300px' }}/>
                {errorScanner && <p style={{ color: 'orange', marginTop: '5px' }}>{errorScanner}</p>}
                {selectedDept !== TODOS_DEPTOS && selectedSubDept === TODOS_SUBDEPTOS && <p style={{color: 'blue'}}>Seleccione un subdepartamento para comenzar a inventariar.</p>}
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
                <button onClick={generarPdfFinalConsolidado} disabled={isGeneratingPdf || subdeptosRevisados.size === 0} style={{backgroundColor: '#27ae60', color: 'white', padding: '10px 15px', border: 'none', borderRadius: '5px', cursor: 'pointer'}}>
                   Generar Reporte Final Consolidado ({subdeptosRevisados.size} revisados)
                </button>
                <button onClick={limpiarProgreso} style={{backgroundColor: '#c0392b', color: 'white'}}>
                   Limpiar Progreso de Sucursal
                </button>
            </div>
        </div>
    );
};

// Se han eliminado las funciones duplicadas de aquí para mayor claridad.
export default InventarioSuc;

// Funciones auxiliares que deben estar fuera del componente
async function _cargarArticulosSucursal(nombreSucursal: string): Promise<Articulo[]> {
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

async function _cargarDepartamentos(nombreSucursal: string): Promise<string[]> {
    const tableName = sucursalesConfig[nombreSucursal];
    if (!tableName) return [];
    try {
        const { data, error } = await supabase.from(tableName).select('depto_a');
        if (error) throw error;
        if (!data) return [];
        const depts = [...new Set(data.map((item: any) => item.depto_a?.toString().trim() || ''))].filter(Boolean).sort();
        return depts;
    } catch (err) {
        console.error(`Error cargando departamentos:`, err);
        return [];
    }
};
