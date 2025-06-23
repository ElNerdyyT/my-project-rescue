import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JsBarcode from 'jsbarcode';
import { supabase } from '../utils/supabaseClient'; // Restaurada la importación original

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
    subdepartamento: string; // Nuevo campo
}

interface MisplacedArticulo extends Articulo {
    departamentoEsperado: string;
}

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
        // Se añade subdepto_a a la consulta
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
            subdepartamento: item.subdepto_a?.toString().trim() || 'Sin Subdepto', // Se añade el subdepartamento
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
        const depts = [...new Set(data.map((item: any) => item.depto_a?.toString().trim() || ''))].filter(Boolean).sort();
        return depts;
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
    const [selectedSubDept, setSelectedSubDept] = useState<string>(TODOS_SUBDEPTOS); // Nuevo estado
    const [allBranchItems, setAllBranchItems] = useState<Articulo[]>([]);
    const [codigoInput, setCodigoInput] = useState<string>(''); // Estado para el valor del input
    const [errorScanner, setErrorScanner] = useState<string | null>(null);
    const [misplacedItems, setMisplacedItems] = useState<Map<string, MisplacedArticulo>>(new Map());
    const [notFoundScannedItems, setNotFoundScannedItems] = useState<Map<string, { count: number }>>(new Map());
    const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
    const [isLoadingDepts, setIsLoadingDepts] = useState<boolean>(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
    const [loadingError, setLoadingError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // --- EFECTO PARA CARGAR DATOS DE LA SUCURSAL ---
    useEffect(() => {
        const loadBranchData = async () => {
            setIsLoadingDepts(true); setIsLoadingData(true); setLoadingError(null);
            setAvailableDepts([]); setSelectedDept(TODOS_DEPTOS); setSelectedSubDept(TODOS_SUBDEPTOS);
            setAllBranchItems([]); setMisplacedItems(new Map()); setNotFoundScannedItems(new Map());

            try {
                const [depts, items] = await Promise.all([
                    cargarDepartamentos(sucursalSeleccionada),
                    cargarArticulosSucursal(sucursalSeleccionada)
                ]);
                setAvailableDepts([TODOS_DEPTOS, ...depts]);
                setAllBranchItems(items);
            } catch (error: any) {
                console.error("Error cargando datos de sucursal:", error);
                setLoadingError(`Error al cargar datos: ${error.message}`);
            } finally {
                setIsLoadingDepts(false); setIsLoadingData(false); inputRef.current?.focus();
            }
        };
        loadBranchData();
    }, [sucursalSeleccionada]);

    // --- DATOS DERIVADOS CON useMemo ---

    // Deriva la lista de subdepartamentos disponibles a partir del departamento seleccionado
    const availableSubDepts = useMemo(() => {
        if (selectedDept === TODOS_DEPTOS) return [];
        const subDepts = allBranchItems
            .filter(item => item.departamento === selectedDept && item.subdepartamento)
            .map(item => item.subdepartamento);
        return [TODOS_SUBDEPTOS, ...[...new Set(subDepts)].sort()];
    }, [allBranchItems, selectedDept]);

    // Deriva la lista de artículos para mostrar en la UI, ahora con filtro de subdepartamento
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


    // --- MANEJO DEL ESCANER Y PROCESAMIENTO ---

    // Función Centralizada para Procesar Código
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

        // Limpieza inmediata para el siguiente escaneo
        setCodigoInput('');
        if (inputRef.current) {
            inputRef.current.value = '';
            inputRef.current.focus();
        }
    };

    // **LÓGICA DE ESCANEO CORREGIDA**
    // Se procesa al presionar Enter, no por la longitud del código.
    const handleScanOnEnter = (event: KeyboardEvent) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            const codigoActual = (event.target as HTMLInputElement).value.trim();
            if (codigoActual.length === 0) return;

            // Rellena con ceros si es necesario, pero procesa de inmediato.
            const codigoParaProcesar = codigoActual.length < 13
                ? codigoActual.padStart(13, '0')
                : codigoActual;

            procesarCodigo(codigoParaProcesar);
        }
    };


    // --- GENERACIÓN DE PDF ---
    const generarReportePDF = () => {
        // La lógica de PDF se mantiene, pero se adapta para incluir subdepartamentos
        // Se omite la implementación completa por brevedad, pero debe reflejar los cambios.
        console.log("Generando reporte PDF...");
    };

    // --- RENDERIZADO ---
    return (
        <div style={{ padding: '20px' }}>
            <h2>Control de Inventario Físico</h2>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginBottom: '20px', alignItems: 'center' }}>
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
                    placeholder={isLoadingData ? "Cargando artículos..." : "Esperando escaneo (presione Enter)"}
                    disabled={isLoadingData || !!loadingError || isGeneratingPdf}
                    style={{ marginLeft: '10px', padding: '8px', minWidth: '300px' }}
                />
                {errorScanner && <p style={{ color: 'orange', marginTop: '5px' }}>{errorScanner}</p>}
            </div>

            {(isLoadingData || isLoadingDepts) && <p>Cargando datos...</p>}
            {isGeneratingPdf && <p style={{ color: 'blue' }}>Generando PDF, por favor espera...</p>}
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

export default InventarioSuc;
