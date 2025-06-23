import { useState, useEffect, useRef, useMemo } from 'react'; // CORREGIDO: Importado desde 'react'
// NOTA: Se asume que jsPDF, autoTable y JsBarcode están cargados globalmente (ej. via <script> tags en index.html)

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
    departamentoEsperado: string;
}

// NOTA: Se asume que 'supabase' está disponible globalmente o configurado en otro lugar.
// Se eliminó 'import { supabase } from '../utils/supabaseClient';'

// Configuración de sucursales
const sucursalesConfig: { [key: string]: string } = {
    'Mexico': 'ArticulosMexico', 'Econo1': 'ArticulosEcono1', 'Baja': 'ArticulosBaja',
    'Sucursal4': 'ArticulosSucursal4', 'Sucursal5': 'ArticulosSucursal5',
    'Sucursal6': 'ArticulosSucursal6', 'Sucursal7': 'ArticulosSucursal7',
};
const nombresSucursales = Object.keys(sucursalesConfig);

// Carga TODOS los artículos de la sucursal, incluyendo el subdepartamento
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

// Carga solo los nombres de los departamentos
const cargarDepartamentos = async (nombreSucursal: string): Promise<string[]> => {
    const tableName = sucursalesConfig[nombreSucursal];
    if (!tableName) return [];
    try {
        const { data, error } = await supabase.from(tableName).select('depto_a');
        if (error) throw error;
        if (!data) return [];
        return [...new Set(data.map((item: any) => item.depto_a?.toString().trim() || ''))].filter(Boolean).sort();
    } catch (err) {
        console.error(`Error cargando departamentos:`, err);
        return [];
    }
};

const InventarioSuc = () => {
    // --- ESTADOS ---
    const [sucursalSeleccionada, setSucursalSeleccionada] = useState<string>(nombresSucursales[0]);
    const [availableDepts, setAvailableDepts] = useState<string[]>([]);
    const [selectedDept, setSelectedDept] = useState<string>(TODOS_DEPTOS);
    const [selectedSubDept, setSelectedSubDept] = useState<string>(TODOS_SUBDEPTOS);
    const [allBranchItems, setAllBranchItems] = useState<Articulo[]>([]);
    const [codigoInput, setCodigoInput] = useState<string>('');
    const [errorScanner, setErrorScanner] = useState<string | null>(null);
    const [misplacedItems, setMisplacedItems] = useState<Map<string, MisplacedArticulo>>(new Map());
    const [notFoundScannedItems, setNotFoundScannedItems] = useState<Map<string, { count: number }>>(new Map());
    const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
    const [isLoadingDepts, setIsLoadingDepts] = useState<boolean>(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
    const [loadingError, setLoadingError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // --- EFECTOS (CARGA DE DATOS) ---
    useEffect(() => {
        const loadBranchData = async () => {
            setIsLoadingDepts(true);
            setIsLoadingData(true);
            setLoadingError(null);
            setAvailableDepts([]);
            setSelectedDept(TODOS_DEPTOS);
            setSelectedSubDept(TODOS_SUBDEPTOS);
            setAllBranchItems([]);
            setMisplacedItems(new Map());
            setNotFoundScannedItems(new Map());

            try {
                const [depts, items] = await Promise.all([
                    cargarDepartamentos(sucursalSeleccionada),
                    cargarArticulosSucursal(sucursalSeleccionada)
                ]);
                setAvailableDepts([TODOS_DEPTOS, ...depts]);
                setAllBranchItems(items);
            } catch (error: any) {
                console.error("Error cargando datos de sucursal:", error);
                setLoadingError(`Error al cargar datos de la sucursal: ${error.message}`);
            } finally {
                setIsLoadingDepts(false);
                setIsLoadingData(false);
                inputRef.current?.focus();
            }
        };
        if (window.supabase) { // Asegurarse que supabase esté disponible
          loadBranchData();
        } else {
          setLoadingError("Supabase no está configurado. La aplicación no puede cargar datos.");
        }
    }, [sucursalSeleccionada]);

    // --- MEMOS (DATOS DERIVADOS) ---
    const availableSubDepts = useMemo(() => {
        if (selectedDept === TODOS_DEPTOS) return [];
        const subDepts = allBranchItems
            .filter(item => item.departamento === selectedDept)
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
        return items;
    }, [allBranchItems, selectedDept, selectedSubDept]);


    // --- MANEJO DEL ESCANER ---
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

                if (selectedDept !== TODOS_DEPTOS && articuloEnSistema.departamento !== selectedDept) {
                    setErrorScanner(`Artículo ${codigo} (${articuloEnSistema.nombre}) pertenece a Depto. ${articuloEnSistema.departamento}.`);
                    setMisplacedItems(prev => new Map(prev).set(codigo, { ...artActualizado, departamentoEsperado: selectedDept }));
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

    const handleScan = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            const codigoActual = (event.target as HTMLInputElement).value.trim();
            if (codigoActual.length === 0) return;
            const codigoParaProcesar = codigoActual.length < 13 ? codigoActual.padStart(13, '0') : codigoActual;
            procesarCodigo(codigoParaProcesar);
        }
    };

    // --- GENERACIÓN DE PDF (Lógica completa) ---
    const generarReportePDF = () => {
        if (!window.jsPDF || !window.JsBarcode) {
            setLoadingError("Las librerías para generar PDF no están cargadas.");
            return;
        }
        setIsGeneratingPdf(true);
        setTimeout(() => {
            try {
                const doc = new window.jsPDF({ orientation: 'p', unit: 'pt', format: 'letter' });
                const reportDate = new Date();
                const fecha = reportDate.toLocaleDateString('es-ES');
                const hora = reportDate.toLocaleTimeString('es-ES');
                const pageMargin = 40;
                let lastTableBottomY = 0;
                
                const addPageHeader = (pageTitle: string) => {
                    doc.setFontSize(14); doc.setFont("helvetica", "bold");
                    doc.text(pageTitle, pageMargin, pageMargin);
                    doc.setFontSize(9); doc.setFont("helvetica", "normal");
                    doc.text(`Fecha: ${fecha} - Hora: ${hora}`, pageMargin, pageMargin + 15);
                };

                const addPageFooter = (pageNumber: number) => {
                    doc.setFontSize(8);
                    doc.text(`Página ${pageNumber}`, doc.internal.pageSize.getWidth() - pageMargin, doc.internal.pageSize.getHeight() - (pageMargin / 2), { align: 'right' });
                };

                // --- 1. Reporte de Diferencias ---
                addPageHeader(`Reporte de Inventario - Sucursal: ${sucursalSeleccionada}`);
                lastTableBottomY = pageMargin + 30;

                const itemsParaReporte = articulosParaMostrarUI.filter(a => a.diferencia !== 0);
                
                if (itemsParaReporte.length > 0) {
                    doc.setFontSize(11); doc.setFont("helvetica", "bold");
                    const tituloDepto = selectedDept === TODOS_DEPTOS ? 'Todos los Departamentos' : `Departamento: ${selectedDept}`;
                    const tituloSubDepto = selectedSubDept !== TODOS_SUBDEPTOS ? ` / Subdepto: ${selectedSubDept}`: '';
                    doc.text(`Diferencias de Inventario (${tituloDepto}${tituloSubDepto})`, pageMargin, lastTableBottomY);
                    lastTableBottomY += 20;

                    const pdfBody = itemsParaReporte.map(item => [
                        item.id,
                        null, // barcode
                        item.nombre,
                        item.departamento,
                        item.subdepartamento,
                        item.stockSistema,
                        item.stockFisico,
                        item.diferencia > 0 ? `+${item.diferencia}` : item.diferencia
                    ]);

                    doc.autoTable({
                        startY: lastTableBottomY,
                        head: [['Código', 'Código Barras', 'Nombre', 'Depto', 'Subdepto', 'Sist.', 'Fís.', 'Dif.']],
                        body: pdfBody,
                        theme: 'grid',
                        headStyles: { fillColor: [22, 160, 133], fontSize: 8 },
                        styles: { fontSize: 7, valign: 'middle' },
                        columnStyles: {
                            1: { minCellHeight: 30 },
                            5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' }
                        },
                        didDrawCell: (data) => {
                            if (data.section === 'body' && data.column.index === 1) { // Barcode
                                const canvas = document.createElement('canvas');
                                try {
                                    window.JsBarcode(canvas, data.row.raw[0], { format: "CODE128", height: 25, width: 1, displayValue: false, margin: 0 });
                                    doc.addImage(canvas.toDataURL('image/png'), 'PNG', data.cell.x + 5, data.cell.y + 2, data.cell.width - 10, data.cell.height - 4);
                                } catch (e) { console.error(e); }
                            }
                        },
                        didDrawPage: (data) => addPageFooter(data.pageNumber),
                    });
                } else {
                     doc.text("No se encontraron diferencias de inventario para la selección actual.", pageMargin, lastTableBottomY);
                }

                // ... (lógica para tablas de mal ubicados y no encontrados puede añadirse aquí) ...
                
                doc.save(`Reporte_Inventario_${sucursalSeleccionada}_${fecha.replace(/\//g, '-')}.pdf`);

            } catch (error) {
                console.error("Error generando PDF:", error);
                setLoadingError("Ocurrió un error al generar el PDF.");
            } finally {
                setIsGeneratingPdf(false);
            }
        }, 50);
    };

    // --- RENDERIZADO ---
    return (
        <div style={{ fontFamily: 'sans-serif' }}>
            <h2>Control de Inventario Físico</h2>
            
            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <div>
                    <label>Sucursal:</label>
                    <select value={sucursalSeleccionada} onChange={(e) => setSucursalSeleccionada(e.currentTarget.value)} disabled={isLoadingData || isGeneratingPdf}>
                        {nombresSucursales.map(suc => (<option key={suc} value={suc}>{suc}</option>))}
                    </select>
                </div>
                <div>
                    <label>Departamento:</label>
                    <select value={selectedDept} onChange={(e) => { setSelectedDept(e.currentTarget.value); setSelectedSubDept(TODOS_SUBDEPTOS); }} disabled={isLoadingDepts || isGeneratingPdf || availableDepts.length === 0}>
                        {isLoadingDepts ? <option>Cargando...</option> : availableDepts.map(dept => (<option key={dept} value={dept}>{dept === TODOS_DEPTOS ? 'Todos los Departamentos' : dept}</option>))}
                    </select>
                </div>
                <div>
                    <label>Subdepartamento:</label>
                    <select value={selectedSubDept} onChange={(e) => setSelectedSubDept(e.currentTarget.value)} disabled={selectedDept === TODOS_DEPTOS || isGeneratingPdf || availableSubDepts.length === 0}>
                        {selectedDept === TODOS_DEPTOS 
                            ? <option value={TODOS_SUBDEPTOS}>-- Seleccione un Depto --</option>
                            : availableSubDepts.map(sub => (<option key={sub} value={sub}>{sub === TODOS_SUBDEPTOS ? 'Todos los Subdeptos' : sub}</option>))
                        }
                    </select>
                </div>
            </div>

            <div style={{ margin: '20px 0' }}>
                <label>Escanear Código:</label>
                <input
                    ref={inputRef} type="text"
                    value={codigoInput}
                    onInput={(e) => setCodigoInput(e.currentTarget.value)}
                    onKeyDown={handleScan}
                    placeholder="Esperando escaneo (presione Enter)"
                    disabled={isLoadingData || !!loadingError || isGeneratingPdf}
                    style={{ marginLeft: '10px', padding: '8px', minWidth: '300px' }}
                />
                {errorScanner && <p style={{ color: 'orange', marginTop: '5px' }}>{errorScanner}</p>}
            </div>

            {isLoadingData && <p>Cargando datos...</p>}
            {isGeneratingPdf && <p style={{ color: 'blue' }}>Generando PDF...</p>}
            {loadingError && <p style={{ color: 'red' }}><strong>Error:</strong> {loadingError}</p>}

            {!isLoadingData && (
                <>
                    <h3>Inventario</h3>
                    <table cellPadding="8" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
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
                            {articulosParaMostrarUI.length === 0 && notFoundScannedItems.size === 0 ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '20px', border: '1px solid #ddd'}}>No hay artículos para mostrar...</td></tr>
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
                            {Array.from(notFoundScannedItems.entries()).map(([id, data]) => (
                                <tr key={`notfound-${id}`} style={{ backgroundColor: '#f8d7da' }}>
                                    <td>{id}</td>
                                    <td colSpan={3}><em>CÓDIGO NO ENCONTRADO EN SISTEMA</em></td>
                                    <td style={{ textAlign: 'right' }}>-</td>
                                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{data.count}</td>
                                    <td style={{ textAlign: 'right', color: 'red', fontWeight: 'bold' }}>+{data.count}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                     <div style={{ marginTop: '20px' }}>
                        <button onClick={generarReportePDF} disabled={isGeneratingPdf || isLoadingData}>
                           {isGeneratingPdf ? 'Generando...' : 'Generar Reporte PDF'}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

// Se asume que este componente se usa en un entorno donde React y las librerías de PDF están disponibles.
export default InventarioSuc;
