import { useState, useEffect, useRef, useMemo } from 'preact/hooks'; // Importar useMemo
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JsBarcode from 'jsbarcode'; // Importación necesaria
import { supabase } from '../utils/supabaseClient';

const TODOS_DEPTOS = "__ALL__";

interface Articulo {
    id: string;
    nombre: string;
    stockSistema: number;
    stockFisico: number;
    diferencia: number;
    departamento: string;
}

interface MisplacedArticulo extends Articulo {
    departamentoEsperado: string;
}

const sucursalesConfig: { [key: string]: string } = {
    'Mexico': 'ArticulosMexico','Econo1': 'ArticulosEcono1','Baja': 'ArticulosBaja',
    'Sucursal4': 'ArticulosSucursal4','Sucursal5': 'ArticulosSucursal5',
    'Sucursal6': 'ArticulosSucursal6','Sucursal7': 'ArticulosSucursal7',
};
const nombresSucursales = Object.keys(sucursalesConfig);

// Carga TODOS los artículos de la sucursal
const cargarArticulosSucursal = async (nombreSucursal: string): Promise<Articulo[]> => {
    const tableName = sucursalesConfig[nombreSucursal];
    if (!tableName) throw new Error(`Configuración de tabla faltante para ${nombreSucursal}`);
    console.log(`Cargando TODOS los artículos para: ${nombreSucursal}`);
    try {
        const { data, error } = await supabase.from(tableName)
                                      .select('cve_articulo_a, nombre_comer_a, cant_piso_a, depto_a');
        if (error) throw error;
        if (!data) return [];
        return data.map((item: any) => {
            const stockSistemaNum = Number(item.cant_piso_a) || 0;
            return {
                id: item.cve_articulo_a, nombre: item.nombre_comer_a || 'Nombre no disponible',
                stockSistema: stockSistemaNum, stockFisico: 0, diferencia: 0 - stockSistemaNum,
                departamento: item.depto_a?.toString().trim() || 'Sin Departamento',
            };
        });
    } catch (err) { console.error("Error en cargarArticulosSucursal:", err); throw err; }
};

const cargarDepartamentos = async (nombreSucursal: string): Promise<string[]> => {
     const tableName = sucursalesConfig[nombreSucursal];
    if (!tableName) return [];
    console.log(`Cargando departamentos para: ${nombreSucursal}`);
    try {
        const { data, error } = await supabase.from(tableName).select('depto_a');
        if (error) throw error;
        if (!data) return [];
        const depts = [...new Set(data.map((item: any) => item.depto_a?.toString().trim() || 'Sin Departamento'))].filter(Boolean).sort();
        return depts;
    } catch (err) { console.error(`Error cargando departamentos:`, err); return []; }
};

const InventarioSuc = () => {
    const [sucursalSeleccionada, setSucursalSeleccionada] = useState<string>(nombresSucursales[0]);
    const [availableDepts, setAvailableDepts] = useState<string[]>([]);
    const [selectedDept, setSelectedDept] = useState<string>(TODOS_DEPTOS);
    const [allBranchItems, setAllBranchItems] = useState<Articulo[]>([]);
    const [codigoEscaneado, setCodigoEscaneado] = useState<string>('');
    const [errorScanner, setErrorScanner] = useState<string | null>(null);
    const [misplacedItems, setMisplacedItems] = useState<Map<string, MisplacedArticulo>>(new Map());
    const [notFoundScannedItems, setNotFoundScannedItems] = useState<Map<string, { count: number }>>(new Map());
    const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
    const [isLoadingDepts, setIsLoadingDepts] = useState<boolean>(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
    const [loadingError, setLoadingError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Efecto para cargar Departamentos Y Artículos de la Sucursal
    useEffect(() => {
        const loadBranchData = async () => {
            setIsLoadingDepts(true); setIsLoadingData(true); setLoadingError(null);
            setAvailableDepts([]); setSelectedDept(TODOS_DEPTOS); setAllBranchItems([]);
            setMisplacedItems(new Map()); setNotFoundScannedItems(new Map());

            let depts: string[] = []; let items: Articulo[] = [];

            try {
                [depts, items] = await Promise.all([
                    cargarDepartamentos(sucursalSeleccionada),
                    cargarArticulosSucursal(sucursalSeleccionada)
                ]);
                setAvailableDepts([TODOS_DEPTOS, ...depts]);
                setAllBranchItems(items);
            } catch (error: any) {
                 console.error("Error cargando datos de sucursal:", error);
                 setLoadingError(`Error al cargar datos de la sucursal: ${error.message}`);
            } finally {
                setIsLoadingDepts(false); setIsLoadingData(false); inputRef.current?.focus();
            }
        };
        loadBranchData();
    }, [sucursalSeleccionada]);

    // Derivar la lista para mostrar en la UI usando useMemo
    const articulosParaMostrarUI = useMemo(() => {
        console.log("Calculando articulosParaMostrarUI. Depto:", selectedDept);
        if (selectedDept === TODOS_DEPTOS) { return allBranchItems; }
        return allBranchItems.filter(item => item.departamento === selectedDept);
    }, [allBranchItems, selectedDept]);


    // Función Centralizada para Procesar Código
    const procesarCodigo = (codigo: string) => {
        if (!codigo || codigo.length === 0) return;
        console.log("Procesando código:", codigo);
        setErrorScanner(null);
        const globalArticuloIndex = allBranchItems.findIndex(a => a.id === codigo);

        if (globalArticuloIndex !== -1) {
            const articuloEnSistema = allBranchItems[globalArticuloIndex];
            setAllBranchItems(prevAllItems => {
                const nuevosAllItems = [...prevAllItems]; const artActualizado = { ...nuevosAllItems[globalArticuloIndex] };
                artActualizado.stockFisico += 1; artActualizado.diferencia = artActualizado.stockFisico - artActualizado.stockSistema;
                nuevosAllItems[globalArticuloIndex] = artActualizado;
                console.log(`Artículo ${codigo} (maestro) actualizado. Stock físico: ${artActualizado.stockFisico}, Diferencia: ${artActualizado.diferencia}`);

                 if (selectedDept !== TODOS_DEPTOS && articuloEnSistema.departamento !== selectedDept) {
                    console.log(`Artículo ${codigo} detectado fuera de depto. Esperado: ${selectedDept}, Real: ${articuloEnSistema.departamento}`);
                    setErrorScanner(`Artículo ${codigo} (${articuloEnSistema.nombre}) pertenece a Depto. ${articuloEnSistema.departamento}, no a ${selectedDept}. Registrado como mal ubicado.`);
                    setMisplacedItems(prevMisplaced => {
                        const nuevosMisplaced = new Map(prevMisplaced);
                        nuevosMisplaced.set(codigo, { ...artActualizado, departamentoEsperado: selectedDept });
                        return nuevosMisplaced;
                    });
                 } else {
                     setMisplacedItems(prevMisplaced => {
                         if (prevMisplaced.has(codigo)) {
                             console.log(`Quitando ${codigo} de mal ubicados (escaneado en depto correcto).`);
                             const nuevosMisplaced = new Map(prevMisplaced); nuevosMisplaced.delete(codigo); return nuevosMisplaced;
                         }
                         return prevMisplaced;
                     });
                 }
                return nuevosAllItems;
            });
        } else {
            setErrorScanner(`Código ${codigo} NO encontrado en esta sucursal.`);
            setNotFoundScannedItems(prevNotFound => {
                const nuevosNotFound = new Map(prevNotFound); const existente = nuevosNotFound.get(codigo) || { count: 0 };
                existente.count += 1; nuevosNotFound.set(codigo, existente);
                console.log(`Código ${codigo} NO ENCONTRADO registrado/actualizado. Cantidad escaneada: ${existente.count}`);
                return nuevosNotFound;
            });
        }
        setTimeout(() => {
             setCodigoEscaneado('');
             if(inputRef.current) { inputRef.current.value = ''; inputRef.current.focus(); }
        }, 10);
    };

    // Efecto para procesar automáticamente al llegar a 13 caracteres
    useEffect(() => {
        if (codigoEscaneado.length === 13) {
            procesarCodigo(codigoEscaneado);
        }
    }, [codigoEscaneado]);


    // Manejador de Enter (con Padding)
    const handleScanOnEnter = (event: KeyboardEvent) => {
        if (event.key === 'Enter' && inputRef.current === event.target) {
            event.preventDefault();
            let codigoActual = codigoEscaneado.trim();
            if (codigoActual.length > 0 && codigoActual.length < 13) {
                 const paddedCodigo = codigoActual.padStart(13, '0');
                 console.log(`Código ${codigoActual} paddeado a ${paddedCodigo}`);
                 setCodigoEscaneado(paddedCodigo); // Deja que el useEffect lo procese
            } else if (codigoActual.length >= 13) {
                 console.log("Procesando con Enter (>=13 chars):", codigoActual);
                 procesarCodigo(codigoActual); // Procesar directamente
            } else if (codigoActual.length === 0) {
                 inputRef.current?.focus();
            }
        }
    };

    // Generar Reporte PDF
    const generarReportePDF = () => {
        setIsGeneratingPdf(true);
        setTimeout(() => {
            try {
                 const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'letter' });
                 const reportDate = new Date();
                 const fecha = reportDate.toLocaleDateString('es-ES');
                 const hora = reportDate.toLocaleTimeString('es-ES');
                 const pageMargin = 40; let lastTableBottomY = 0;

                 const addPageHeader = () => {
                     doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.text(`Reporte de Inventario Físico - Sucursal: ${sucursalSeleccionada}`, pageMargin, pageMargin);
                     const tituloDepto = selectedDept === TODOS_DEPTOS ? 'Todos los Departamentos' : `Departamento: ${selectedDept}`;
                     doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.text(tituloDepto, pageMargin, pageMargin + 18);
                     doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.text(`Fecha: ${fecha} - Hora: ${hora}`, pageMargin, pageMargin + 30);
                 };
                 const addPageFooter = (pageNumber: number) => {
                    doc.setFontSize(8);
                    doc.text(`Página ${pageNumber}`, doc.internal.pageSize.getWidth() - pageMargin, doc.internal.pageSize.getHeight() - (pageMargin / 2) , {align: 'right'});
                 };

                 addPageHeader();
                 lastTableBottomY = pageMargin + 45;

                 // --- Tabla 1: Diferencias de Inventario ---
                 const itemsParaReporteDiferencias = (selectedDept === TODOS_DEPTOS
                    ? allBranchItems
                    : allBranchItems.filter(a => a.departamento === selectedDept)
                   ).filter(a => a.diferencia !== 0);

                 let pdfBodyDiferencias: any[] = [];
                 let currentDeptDiff: string | null = null;

                 if (itemsParaReporteDiferencias.length > 0) {
                     doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("1. Diferencias de Inventario Detectadas", pageMargin, lastTableBottomY);
                     lastTableBottomY += 15;

                     const sortFunctionDiff = (a: Articulo, b: Articulo): number => {
                         if (a.departamento < b.departamento) return -1; if (a.departamento > b.departamento) return 1;
                         if (a.id < b.id) return -1; if (a.id > b.id) return 1; return 0;
                     };

                     if (selectedDept === TODOS_DEPTOS) {
                         itemsParaReporteDiferencias.sort(sortFunctionDiff);
                         itemsParaReporteDiferencias.forEach(item => {
                             if (item.departamento !== currentDeptDiff) {
                                 currentDeptDiff = item.departamento;
                                 pdfBodyDiferencias.push([{ content: `Depto: ${currentDeptDiff}`, colSpan: 6, styles: { fontStyle: 'bold', fillColor: [220, 220, 220], textColor: [0, 0, 0], halign: 'left', fontSize: 9, cellPadding: 5 } }]);
                              }
                              pdfBodyDiferencias.push([item.id, null, item.nombre, item.stockSistema, item.stockFisico, item.diferencia]);
                          });
                     } else {
                         itemsParaReporteDiferencias.sort((a,b) => a.id < b.id ? -1 : 1);
                         pdfBodyDiferencias = itemsParaReporteDiferencias.map(item => [item.id, null, item.nombre, item.stockSistema, item.stockFisico, item.diferencia]);
                     }

                     autoTable(doc, {
                         startY: lastTableBottomY, margin: { left: pageMargin, right: pageMargin, bottom: pageMargin + 15 },
                         head: [['Código', 'Código Barras', 'Nombre', 'Stock Sist.', 'Stock Fís.', 'Diferencia']],
                         body: pdfBodyDiferencias, theme: 'grid',
                         headStyles: { fillColor: [22, 160, 133], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
                         columnStyles: {
                             0: { cellWidth: 70, halign: 'left' }, 1: { cellWidth: 80, minCellHeight: 30, halign: 'center' },
                             2: { cellWidth: 'auto', halign: 'left' }, 3: { cellWidth: 45, halign: 'right' },
                             4: { cellWidth: 45, halign: 'right' }, 5: { cellWidth: 45, halign: 'right' }
                         },
                         styles: { fontSize: 7, cellPadding: 3, valign: 'middle' },
                         alternateRowStyles: { fillColor: [245, 245, 245] },
                         didDrawCell: (data: any) => {
                              const isDataRow = Array.isArray(data.row.raw);
                              if (isDataRow) {
                                  if (data.column.index === 1) { // Barcode
                                      const cell = data.cell; const idArticulo = data.row.raw[0];
                                      if (idArticulo) {
                                           const canvas = document.createElement('canvas');
                                           try {
                                               JsBarcode(canvas, idArticulo.toString(), { format: "CODE128", height: 40, width: 1, displayValue: false, margin: 0, background: 'rgba(0,0,0,0)' });
                                               const barcodeDataUrl = canvas.toDataURL('image/png');
                                               const cellPadding = 2; const imgHeight = cell.height - (cellPadding * 2); const aspectRatio = canvas.width / canvas.height; const imgWidth = imgHeight * aspectRatio;
                                               const x = cell.x + (cell.width - imgWidth) / 2; const y = cell.y + cellPadding;
                                               if (imgWidth <= cell.width - cellPadding * 2) { doc.addImage(barcodeDataUrl, 'PNG', x, y, imgWidth, imgHeight); }
                                               else { doc.setFontSize(6); doc.setTextColor(255, 0, 0); doc.text('BC Too Wide', cell.x + cell.width / 2, cell.y + cell.height / 2, { align: 'center', baseline: 'middle' }); doc.setTextColor(0, 0, 0); }
                                           } catch (e) { console.error(`Error barcode ${idArticulo}:`, e); doc.setFontSize(6); doc.setTextColor(255, 0, 0); doc.text('Error BC', cell.x + cell.width / 2, cell.y + cell.height / 2, { align: 'center', baseline: 'middle' }); doc.setTextColor(0, 0, 0); }
                                       }
                                  }
                                  if (data.column.index === 5) { // Diferencia
                                      const diff = Number(data.row.raw[5]); if(!isNaN(diff)){ data.cell.text = diff > 0 ? `+${diff}` : `${diff}`; data.cell.styles.textColor = diff > 0 ? [0,128,0] : [255,0,0]; } else {data.cell.text = '';}
                                  }
                              }
                          },
                          didDrawPage: (data: any) => { addPageFooter(data.pageNumber); addPageHeader(); }
                     });
                     lastTableBottomY = (doc as any).lastAutoTable.finalY + 25;
                 } else {
                     doc.setFontSize(9); doc.setFont("helvetica", "italic");
                     doc.text("No se encontraron diferencias de inventario.", pageMargin, lastTableBottomY);
                     lastTableBottomY += 20;
                 }

                 // --- Tabla 2: Artículos Escaneados Fuera de Departamento ---
                 const misplacedArray = Array.from(misplacedItems.values());
                 if (misplacedArray.length > 0) {
                     if (lastTableBottomY + 60 > doc.internal.pageSize.getHeight()) { doc.addPage(); addPageHeader(); lastTableBottomY = pageMargin + 45; }
                     doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("2. Artículos Escaneados Fuera del Departamento Seleccionado", pageMargin, lastTableBottomY);
                     lastTableBottomY += 15;
                     misplacedArray.sort((a,b) => a.id < b.id ? -1 : 1);
                     const pdfBodyMisplaced = misplacedArray.map(item => [ item.id, null, item.nombre, item.departamento, item.departamentoEsperado, item.stockSistema, item.stockFisico, item.diferencia ]);

                     autoTable(doc, {
                         startY: lastTableBottomY, margin: { left: pageMargin, right: pageMargin, bottom: pageMargin + 15 },
                         head: [['Código', 'Código Barras', 'Nombre', 'Depto. Sistema', 'Depto. Esperado', 'Stock Sist.', 'Stock Fís.', 'Diferencia']],
                         body: pdfBodyMisplaced, theme: 'grid',
                         headStyles: { fillColor: [255, 165, 0], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
                         columnStyles: {
                             0: { cellWidth: 70, halign: 'left' }, 1: { cellWidth: 80, minCellHeight: 30, halign: 'center' },
                             2: { cellWidth: 'auto', halign: 'left' }, 3: { cellWidth: 60, halign: 'left' },
                             4: { cellWidth: 60, halign: 'left' }, 5: { cellWidth: 40, halign: 'right' },
                             6: { cellWidth: 40, halign: 'right' }, 7: { cellWidth: 40, halign: 'right' }
                         },
                         styles: { fontSize: 7, cellPadding: 3, valign: 'middle' },
                         alternateRowStyles: { fillColor: [255, 245, 230] },
                         didDrawCell: (data: any) => {
                            const isDataRow = Array.isArray(data.row.raw);
                              if (isDataRow) {
                                  if (data.column.index === 1) { // Barcode
                                       const cell = data.cell; const idArticulo = data.row.raw[0];
                                       if (idArticulo) {
                                           const canvas = document.createElement('canvas');
                                           try {
                                               JsBarcode(canvas, idArticulo.toString(), { format: "CODE128", height: 40, width: 1, displayValue: false, margin: 0, background: 'rgba(0,0,0,0)' });
                                               const barcodeDataUrl = canvas.toDataURL('image/png');
                                               const cellPadding = 2; const imgHeight = cell.height - (cellPadding * 2); const aspectRatio = canvas.width / canvas.height; const imgWidth = imgHeight * aspectRatio;
                                               const x = cell.x + (cell.width - imgWidth) / 2; const y = cell.y + cellPadding;
                                               if (imgWidth <= cell.width - cellPadding * 2) { doc.addImage(barcodeDataUrl, 'PNG', x, y, imgWidth, imgHeight); }
                                               else { doc.setFontSize(6); doc.setTextColor(255, 0, 0); doc.text('BC Too Wide', cell.x + cell.width / 2, cell.y + cell.height / 2, { align: 'center', baseline: 'middle' }); doc.setTextColor(0, 0, 0); }
                                           } catch (e) { console.error(`Error barcode ${idArticulo}:`, e); doc.setFontSize(6); doc.setTextColor(255, 0, 0); doc.text('Error BC', cell.x + cell.width / 2, cell.y + cell.height / 2, { align: 'center', baseline: 'middle' }); doc.setTextColor(0, 0, 0); }
                                       }
                                  }
                                  if (data.column.index === 7) { // Diferencia
                                      const diff = Number(data.row.raw[7]); if(!isNaN(diff)){ data.cell.text = diff > 0 ? `+${diff}` : `${diff}`; data.cell.styles.textColor = diff > 0 ? [0,128,0] : [255,0,0]; } else {data.cell.text = '';}
                                  }
                              }
                         },
                         didDrawPage: (data: any) => { addPageFooter(data.pageNumber); addPageHeader(); }
                     });
                     lastTableBottomY = (doc as any).lastAutoTable.finalY + 25;
                 }

                 // --- Tabla 3: Códigos Escaneados No Encontrados en Sistema ---
                 const notFoundArray = Array.from(notFoundScannedItems.entries());
                 if (notFoundArray.length > 0) {
                      if (lastTableBottomY + 60 > doc.internal.pageSize.getHeight()) { doc.addPage(); addPageHeader(); lastTableBottomY = pageMargin + 45; }
                      doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("3. Códigos Escaneados No Encontrados en Sistema", pageMargin, lastTableBottomY);
                      lastTableBottomY += 15;
                      notFoundArray.sort((a,b) => a[0] < b[0] ? -1 : 1);
                      const pdfBodyNotFound = notFoundArray.map(([codigo, data]) => [codigo, data.count]);

                     autoTable(doc, {
                         startY: lastTableBottomY, margin: { left: pageMargin, right: pageMargin, bottom: pageMargin + 15 },
                         head: [['Código Escaneado', 'Cantidad Contada']], body: pdfBodyNotFound, theme: 'grid',
                         headStyles: { fillColor: [108, 117, 125], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
                         columnStyles: { 0: { cellWidth: 'auto', halign: 'left' }, 1: { cellWidth: 100, halign: 'right' } },
                         styles: { fontSize: 7, cellPadding: 3, valign: 'middle' },
                         alternateRowStyles: { fillColor: [240, 240, 240] },
                         didDrawPage: (data: any) => { addPageFooter(data.pageNumber); addPageHeader(); }
                     });
                 }

                 // Guardar el PDF
                 const deptoFilename = selectedDept === TODOS_DEPTOS ? 'TodosDeptos' : selectedDept.replace(/[^a-z0-9]/gi, '_');
                 doc.save(`Reporte_Inventario_${sucursalSeleccionada}_${deptoFilename}_${fecha.replace(/\//g, '-')}.pdf`);

            } catch (error) { console.error("Error generando PDF:", error); setLoadingError("Ocurrió un error al generar el PDF."); }
            finally { setIsGeneratingPdf(false); }
        }, 50);
    };

    // --- Renderizado ---
    // La tabla UI usa la lista derivada 'articulosParaMostrarUI'
    return (
        <div>
            <h2>Control de Inventario Físico</h2>
            {/* Selectores */}
            <div>
                <label htmlFor="sucursal-select" style={{marginRight: '5px'}}>Sucursal: </label>
                <select id="sucursal-select" value={sucursalSeleccionada} onChange={(e) => setSucursalSeleccionada((e.currentTarget as HTMLSelectElement).value)} disabled={isLoadingDepts || isLoadingData || isGeneratingPdf}>
                    {nombresSucursales.map(suc => (<option key={suc} value={suc}>{suc}</option>))}
                </select>
            </div>
            <div style={{ marginTop: '10px' }}>
                <label htmlFor="depto-select" style={{marginRight: '5px'}}>Departamento: </label>
                <select id="depto-select" value={selectedDept} onChange={(e) => setSelectedDept((e.currentTarget as HTMLSelectElement).value)} disabled={isLoadingDepts || isLoadingData || isGeneratingPdf || availableDepts.length === 0}>
                    {isLoadingDepts && <option>Cargando deptos...</option>}
                    {availableDepts.map(dept => (<option key={dept} value={dept}>{dept === TODOS_DEPTOS ? 'Todos los Departamentos' : dept}</option>))}
                    {!isLoadingDepts && availableDepts.length === 0 && <option>No hay deptos</option>}
                </select>
            </div>

            {/* Input */}
            <div style={{ margin: '20px 0' }}>
                <label htmlFor="barcode-input">Escanear Código: </label>
                <input ref={inputRef} type="text" id="barcode-input"
                    onInput={(e) => { setCodigoEscaneado((e.currentTarget as HTMLInputElement).value); }}
                    onKeyDown={handleScanOnEnter}
                    placeholder={isLoadingData ? "Cargando artículos..." : "Esperando escaneo..."}
                    disabled={isLoadingDepts || isLoadingData || !!loadingError || isGeneratingPdf}
                    maxLength={50} />
                {errorScanner && <p style={{ color: 'orange', marginTop: '5px' }}>{errorScanner}</p>}
            </div>

            {/* Estados */}
             {(isLoadingData || isLoadingDepts) && <p>Cargando datos...</p>}
            {isGeneratingPdf && <p style={{ color: 'blue' }}>Generando PDF, por favor espera...</p>}
            {loadingError && <p style={{ color: 'red' }}>{loadingError}</p>}

            {/* Tabla HTML */}
             {!isLoadingData && !isLoadingDepts && !isGeneratingPdf && (
                <>
                    <h3>Inventario - {selectedDept === TODOS_DEPTOS ? 'Todos los Departamentos' : `Departamento: ${selectedDept}`}</h3>
                    <table cellPadding="5" cellSpacing="0" style={{ width: '100%', borderCollapse: 'collapse', minHeight: '100px', border: '1px solid #ccc' }}>
                        <thead><tr><th>Código</th><th>Nombre</th><th>Depto</th><th>Stock Sistema</th><th>Stock Físico</th><th>Diferencia</th></tr></thead>
                        <tbody>
                         {articulosParaMostrarUI.length === 0 && notFoundScannedItems.size === 0 && !isLoadingData ? (<tr><td colSpan={6} style={{textAlign: 'center'}}>No hay artículos para mostrar...</td></tr>) : (articulosParaMostrarUI.map((articulo) => (<tr key={articulo.id} style={{ backgroundColor: misplacedItems.has(articulo.id) ? '#ffeeba' : (articulo.stockFisico > 0 ? '#e6ffed' : 'transparent') }}><td>{articulo.id}</td><td>{articulo.nombre}</td><td>{articulo.departamento}</td><td style={{ textAlign: 'right' }}>{articulo.stockSistema}</td><td style={{ textAlign: 'right', fontWeight: 'bold' }}>{articulo.stockFisico}</td><td style={{ textAlign: 'right', color: articulo.diferencia === 0 ? 'black' : (articulo.diferencia > 0 ? 'green' : 'red') }}>{articulo.diferencia > 0 ? `+${articulo.diferencia}` : articulo.diferencia}</td></tr>)))}
                         {Array.from(notFoundScannedItems.entries()).map(([id, data]) => (<tr key={`notfound-${id}`} style={{ backgroundColor: '#f8d7da' }}><td>{id}</td><td colSpan={2}><em>CÓDIGO NO ENCONTRADO</em></td><td style={{ textAlign: 'right' }}>-</td><td style={{ textAlign: 'right', fontWeight: 'bold' }}>{data.count}</td><td style={{ textAlign: 'right' }}>+{data.count}</td></tr>))}
                        </tbody>
                    </table>
                    {/* Botón PDF (Condición disabled completa) */}
                     <div style={{ marginTop: '20px' }}>
                        <button onClick={generarReportePDF}
                                disabled={isLoadingData || isLoadingDepts || isGeneratingPdf ||
                                          (allBranchItems.filter(a=>a.diferencia !== 0).length === 0 &&
                                           misplacedItems.size === 0 &&
                                           notFoundScannedItems.size === 0)}>
                             {isGeneratingPdf ? 'Generando PDF...' : 'Generar Reporte PDF Completo'}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default InventarioSuc;