import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../utils/supabaseClient';

// Constantes para filtros "Todos"
const TODOS_DEPTOS = "__TODOS_DEPTOS__";
const TODOS_SUBDEPTOS = "__TODOS_SUBDEPTOS__";

// Interfaces para tipado de datos
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
    // Solo guardamos el ID y el conteo físico para fusionar
    conteoFisico: [string, { stockFisico: number }][];
    misplacedItems: [string, MisplacedArticulo][];
    notFoundScannedItems: [string, { count: number }][];
}


// Configuración de sucursales
const sucursalesConfig: { [key: string]: string } = {
    'Mexico': 'ArticulosMexico', 'Econo1': 'ArticulosEcono1', 'Baja': 'ArticulosBaja',
    'Sucursal4': 'ArticulosSucursal4', 'Sucursal5': 'ArticulosSucursal5',
    'Sucursal6': 'ArticulosSucursal6', 'Sucursal7': 'ArticulosSucursal7',
};
const nombresSucursales = Object.keys(sucursalesConfig);

const cargarArticulosSucursal = async (nombreSucursal: string): Promise<Articulo[]> => {
    const tableName = sucursalesConfig[nombreSucursal];
    if (!tableName) throw new Error(`Configuración de tabla faltante para ${nombreSucursal}`);
    try {
        const { data, error } = await supabase.from(tableName)
            .select('cve_articulo_a, nombre_comer_a, cant_piso_a, depto_a, subdepto_a');
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
        const depts = [...new Set(data.map((item: any) => item.depto_a?.toString().trim() || ''))].filter(Boolean).sort();
        return depts;
    } catch (err) {
        console.error(`Error cargando departamentos:`, err);
        return [];
    }
};

const InventarioSuc = () => {
    const [sucursalSeleccionada, setSucursalSeleccionada] = useState<string>(nombresSucursales[0]);
    const [availableDepts, setAvailableDepts] = useState<string[]>([]);
    const [selectedDept, setSelectedDept] = useState<string>(TODOS_DEPTOS);
    const [selectedSubDept, setSelectedSubDept] = useState<string>(TODOS_SUBDEPTOS);
    const [allBranchItems, setAllBranchItems] = useState<Articulo[]>([]);
    const [codigoInput, setCodigoInput] = useState<string>('');
    const [errorScanner, setErrorScanner] = useState<string | null>(null);
    const [misplacedItems, setMisplacedItems] = useState<Map<string, MisplacedArticulo>>(new Map());
    const [notFoundScannedItems, setNotFoundScannedItems] = useState<Map<string, { count: number }>>(new Map());
    const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
    const [isLoadingDepts, setIsLoadingDepts] = useState<boolean>(true);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
    const [loadingError, setLoadingError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // --- MODIFICADO: Efecto para GUARDAR el progreso en localStorage ---
    useEffect(() => {
        if (isLoadingData) return;
        const key = `progreso_inventario_${sucursalSeleccionada}`;
        
        // Guardamos solo el conteo, no toda la estructura del artículo
        const conteoFisico = new Map();
        allBranchItems.forEach(item => {
            if (item.stockFisico > 0) {
                conteoFisico.set(item.id, { stockFisico: item.stockFisico });
            }
        });

        const progreso: ProgresoGuardado = {
            conteoFisico: Array.from(conteoFisico.entries()),
            misplacedItems: Array.from(misplacedItems.entries()),
            notFoundScannedItems: Array.from(notFoundScannedItems.entries()),
        };
        localStorage.setItem(key, JSON.stringify(progreso));

    }, [allBranchItems, misplacedItems, notFoundScannedItems, sucursalSeleccionada, isLoadingData]);

    // --- MODIFICADO: Efecto para CARGAR DATOS y FUSIONAR Progreso Guardado ---
    useEffect(() => {
        const loadBranchData = async () => {
            setIsLoadingDepts(true); setIsLoadingData(true); setLoadingError(null);
            setAvailableDepts([]); setSelectedDept(TODOS_DEPTOS); setSelectedSubDept(TODOS_SUBDEPTOS);
            setAllBranchItems([]); setMisplacedItems(new Map()); setNotFoundScannedItems(new Map());

            try {
                const [depts, itemsFromDB] = await Promise.all([
                    cargarDepartamentos(sucursalSeleccionada),
                    cargarArticulosSucursal(sucursalSeleccionada)
                ]);
                
                setAvailableDepts([TODOS_DEPTOS, ...depts]);
                
                const key = `progreso_inventario_${sucursalSeleccionada}`;
                const progresoGuardadoJSON = localStorage.getItem(key);
                let itemsParaEstadoFinal = itemsFromDB;

                if (progresoGuardadoJSON) {
                    console.log("Progreso guardado encontrado. Fusionando...");
                    const progresoGuardado: ProgresoGuardado = JSON.parse(progresoGuardadoJSON);
                    const conteoGuardado = new Map(progresoGuardado.conteoFisico);

                    // --- LÓGICA DE FUSIÓN DE DATOS (CORRECCIÓN IMPORTANTE) ---
                    itemsParaEstadoFinal = itemsFromDB.map(itemDeDB => {
                        if (conteoGuardado.has(itemDeDB.id)) {
                            const stockFisico = conteoGuardado.get(itemDeDB.id)!.stockFisico;
                            return {
                                ...itemDeDB,
                                stockFisico: stockFisico,
                                diferencia: stockFisico - itemDeDB.stockSistema,
                            };
                        }
                        return itemDeDB;
                    });
                    
                    setMisplacedItems(new Map(progresoGuardado.misplacedItems));
                    setNotFoundScannedItems(new Map(progresoGuardado.notFoundScannedItems));
                }
                
                setAllBranchItems(itemsParaEstadoFinal);

            } catch (error: any) {
                console.error("Error cargando datos de sucursal:", error);
                setLoadingError(`Error al cargar datos: ${error.message}`);
            } finally {
                setIsLoadingDepts(false); setIsLoadingData(false); inputRef.current?.focus();
            }
        };
        loadBranchData();
    }, [sucursalSeleccionada]);

    const availableSubDepts = useMemo(() => {
        if (selectedDept === TODOS_DEPTOS) return [];
        const subDepts = allBranchItems
            .filter(item => item.departamento === selectedDept && item.subdepartamento)
            .map(item => item.subdepartamento);
        return [TODOS_SUBDEPTOS, ...[...new Set(subDepts)].sort()];
    }, [allBranchItems, selectedDept]);

    const articulosParaMostrarUI = useMemo(() => {
        let items = allBranchItems;
        if (selectedDept !== TODOS_DEPTOS) {
            items = items.filter(item => item.departamento === selectedDept);
            if (selectedSubDept !== TODOS_SUBDEPTOS) {
                items = items.filter(item => item.subdepartamento === selectedSubDept);
            }
        }
        items = items.filter(item => item.stockSistema !== 0 || item.stockFisico !== 0);
        items.sort((a, b) => a.nombre.localeCompare(b.nombre));
        return items;
    }, [allBranchItems, selectedDept, selectedSubDept]);

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
        if (inputRef.current) {
            inputRef.current.value = '';
            inputRef.current.focus();
        }
    };

    const handleScanOnEnter = (event: KeyboardEvent) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            const codigoActual = (event.target as HTMLInputElement).value.trim();
            if (codigoActual.length === 0) return;
            const codigoParaProcesar = codigoActual.length < 13
                ? codigoActual.padStart(13, '0')
                : codigoActual;
            procesarCodigo(codigoParaProcesar);
        }
    };
    
    const finalizarSubdepto = () => {
        setSelectedSubDept(TODOS_SUBDEPTOS);
        alert(`Progreso del subdepartamento guardado. Por favor, seleccione otro subdepartamento para continuar.`);
    };

    const limpiarProgreso = () => {
        if (confirm(`¿Está seguro de que desea borrar TODO el progreso de inventario para la sucursal ${sucursalSeleccionada}? Esta acción no se puede deshacer.`)) {
            const key = `progreso_inventario_${sucursalSeleccionada}`;
            localStorage.removeItem(key);
            window.location.reload();
        }
    };

    const generarReportePDF = () => {
        setIsGeneratingPdf(true);
        try {
            const doc = new jsPDF();
            const fecha = new Date().toLocaleString();
            
            doc.setFontSize(18);
            doc.text(`Reporte de Inventario Físico - ${sucursalSeleccionada}`, 14, 22);
            doc.setFontSize(11);
            doc.text(`Reporte final consolidado. Generado: ${fecha}`, 14, 30);

            let itemsFiltradosParaReporte = [...allBranchItems];
            const articulosConDiferencia = itemsFiltradosParaReporte.filter(a => a.diferencia !== 0);
            articulosConDiferencia.sort((a, b) => a.nombre.localeCompare(b.nombre));

            if (articulosConDiferencia.length > 0) {
                autoTable(doc, {
                    startY: 45,
                    head: [['Código', 'Nombre', 'Depto', 'Subdepto', 'Sist.', 'Físico', 'Dif.']],
                    body: articulosConDiferencia.map(a => [a.id, a.nombre, a.departamento, a.subdepartamento, a.stockSistema, a.stockFisico, a.diferencia > 0 ? `+${a.diferencia}` : a.diferencia]),
                    headStyles: { fillColor: [22, 160, 133] },
                    styles: { fontSize: 8 },
                });
            } else {
                 autoTable(doc, { startY: 45, body: [['No se encontraron artículos con diferencias en todo el inventario.']] });
            }

            if (misplacedItems.size > 0) {
                const misplacedOrdenado = Array.from(misplacedItems.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
                autoTable(doc, {
                    // @ts-ignore
                    startY: doc.lastAutoTable.finalY + 10,
                    head: [['Código', 'Nombre', 'Ubicación Esperada', 'Ubicación Real']],
                    body: misplacedOrdenado.map(a => [a.id, a.nombre, a.ubicacionEsperada, `Depto: ${a.departamento} / Subd: ${a.subdepartamento}`]),
                    headStyles: { fillColor: [243, 156, 18] },
                    styles: { fontSize: 8 },
                });
            }

            if (notFoundScannedItems.size > 0) {
                const notFoundOrdenado = Array.from(notFoundScannedItems.entries()).sort((a, b) => a[0].localeCompare(b[0]));
                autoTable(doc, {
                    // @ts-ignore
                    startY: doc.lastAutoTable.finalY + 10,
                    head: [['Códigos No Encontrados', 'Veces Escaneado']],
                    body: notFoundOrdenado.map(([id, data]) => [id, data.count]),
                    headStyles: { fillColor: [192, 57, 43] },
                    styles: { fontSize: 8 },
                });
            }

            const nombreArchivo = `Reporte_Inventario_Final_${sucursalSeleccionada}_${new Date().toISOString().slice(0, 10)}.pdf`;
            doc.save(nombreArchivo);

        } catch (error) {
            console.error("Error generando el PDF:", error);
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    return (
        <div style={{ padding: '20px' }}>
            <h2>Control de Inventario Físico</h2>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginBottom: '10px', alignItems: 'center', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>
                <div>
                    <label htmlFor="sucursal-select" style={{ marginRight: '5px' }}>Sucursal:</label>
                    <select id="sucursal-select" value={sucursalSeleccionada} onChange={(e) => setSucursalSeleccionada(e.currentTarget.value)} disabled={isLoadingData || isGeneratingPdf}>
                        {nombresSucursales.map(suc => (<option key={suc} value={suc}>{suc}</option>))}
                    </select>
                </div>
                <div>
                    <label htmlFor="depto-select" style={{ marginRight: '5px' }}>Departamento:</label>
                    <select id="depto-select" value={selectedDept} onChange={(e) => { setSelectedDept(e.currentTarget.value); setSelectedSubDept(TODOS_SUBDEPTOS); }} disabled={isLoadingDepts || isGeneratingPdf || availableDepts.length === 0}>
                        {isLoadingDepts ? <option>Cargando...</option> : availableDepts.map(dept => (<option key={dept} value={dept}>{dept === TODOS_DEPTOS ? 'Todos los Departamentos' : dept}</option>))}
                    </select>
                </div>
                <div>
                    <label htmlFor="subdepto-select" style={{ marginRight: '5px' }}>Subdepartamento:</label>
                    <select id="subdepto-select" value={selectedSubDept} onChange={(e) => setSelectedSubDept(e.currentTarget.value)} disabled={selectedDept === TODOS_DEPTOS || isGeneratingPdf || availableSubDepts.length <= 1}>
                        {selectedDept === TODOS_DEPTOS 
                            ? <option value={TODOS_SUBDEPTOS}>-- Seleccione un Depto --</option>
                            : availableSubDepts.map(sub => (<option key={sub} value={sub}>{sub === TODOS_SUBDEPTOS ? 'Todos los Subdeptos' : sub}</option>))
                        }
                    </select>
                </div>
                <div>
                    <button onClick={finalizarSubdepto} disabled={selectedDept === TODOS_DEPTOS || selectedSubDept === TODOS_SUBDEPTOS}>
                        Finalizar Subdepto
                    </button>
                </div>
            </div>

            <div style={{ margin: '20px 0' }}>
                <label htmlFor="barcode-input">Escanear Código:</label>
                <input
                    ref={inputRef}
                    type="text"
                    id="barcode-input"
                    value={codigoInput}
                    onInput={(e) => setCodigoInput(e.currentTarget.value)}
                    onKeyDown={handleScanOnEnter}
                    placeholder={isLoadingData ? "Cargando..." : "Esperando escaneo (Enter)"}
                    disabled={isLoadingData || !!loadingError || isGeneratingPdf}
                    style={{ marginLeft: '10px', padding: '8px', minWidth: '300px' }}
                />
                {errorScanner && <p style={{ color: 'orange', marginTop: '5px' }}>{errorScanner}</p>}
            </div>

            {(isLoadingData || isLoadingDepts) && <p>Cargando datos y progreso...</p>}
            {isGeneratingPdf && <p style={{ color: 'blue' }}>Generando PDF consolidado, por favor espera...</p>}
            {loadingError && <p style={{ color: 'red' }}><strong>Error:</strong> {loadingError}</p>}

            {!isLoadingData && (
                <>
                    <h3>Inventario - {selectedDept === TODOS_DEPTOS ? 'Todos' : `Depto: ${selectedDept}`} {selectedDept !== TODOS_DEPTOS && selectedSubDept !== TODOS_SUBDEPTOS ? `/ Subdepto: ${selectedSubDept}`: ''}</h3>
                    <table cellPadding="8" cellSpacing="0" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                        <thead style={{ backgroundColor: '#f2f2f2' }}>
                            <tr>
                                <th style={{border: '1px solid #ddd', textAlign: 'left'}}>Código</th>
                                <th style={{border: '1px solid #ddd', textAlign: 'left'}}>Nombre</th>
                                <th style={{border: '1px solid #ddd', textAlign: 'left'}}>Depto</th>
                                <th style={{border: '1px solid #ddd', textAlign: 'left'}}>Subdepto</th>
                                <th style={{border: '1px solid #ddd', textAlign: 'right'}}>Stock Sistema</th>
                                <th style={{border: '1px solid #ddd', textAlign: 'right'}}>Stock Físico</th>
                                <th style={{border: '1px solid #ddd', textAlign: 'right'}}>Diferencia</th>
                            </tr>
                        </thead>
                        <tbody>
                            {articulosParaMostrarUI.length === 0 ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '20px', border: '1px solid #ddd'}}>No hay artículos para mostrar en esta vista. Verifique los filtros o comience a escanear.</td></tr>
                            ) : (
                                articulosParaMostrarUI.map((articulo) => (
                                    <tr key={articulo.id} style={{ backgroundColor: misplacedItems.has(articulo.id) ? '#ffeeba' : (articulo.stockFisico > 0 ? '#e6ffed' : 'transparent'), borderBottom: '1px solid #ddd' }}>
                                        <td>{articulo.id}</td>
                                        <td>{articulo.nombre}</td>
                                        <td>{articulo.departamento}</td>
                                        <td>{articulo.subdepartamento}</td>
                                        <td style={{ textAlign: 'right' }}>{articulo.stockSistema}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{articulo.stockFisico}</td>
                                        <td style={{ textAlign: 'right', color: articulo.diferencia === 0 ? 'black' : (articulo.diferencia > 0 ? 'green' : 'red'), fontWeight: 'bold' }}>
                                            {articulo.diferencia > 0 ? `+${articulo.diferencia}` : articulo.diferencia}
                                        </td>
                                    </tr>
                                ))
                            )}
                            {/* La lógica para mostrar notFoundScannedItems en la tabla principal ya no es necesaria si se maneja por separado o se decide no mostrarla aquí */}
                        </tbody>
                    </table>
                     <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <button onClick={generarReportePDF} disabled={isGeneratingPdf || isLoadingData}>
                           {isGeneratingPdf ? 'Generando...' : 'Generar Reporte Final PDF'}
                        </button>
                        <button onClick={limpiarProgreso} style={{backgroundColor: '#c0392b', color: 'white'}}>
                           Limpiar Progreso de Sucursal
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default InventarioSuc;
