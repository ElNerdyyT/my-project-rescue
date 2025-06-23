import { useState, useEffect, useRef, useMemo } from 'react';
// NOTA: Se asume que jsPDF, autoTable, JsBarcode y la librería de Supabase (@supabase/supabase-js)
// están cargados globalmente (ej. via <script> tags en index.html)

// --- CONFIGURACIÓN DE SUPABASE ---
// **ACCIÓN REQUERIDA:** Reemplaza los valores con tus credenciales de Supabase.
const supabaseUrl = 'https://URL-DE-TU-PROYECTO.supabase.co';
const supabaseKey = 'TU-SUPABASE-ANON-KEY';

let supabase;
let supabaseError = null;

try {
    if (supabaseUrl.includes('URL-DE-TU-PROYECTO') || supabaseKey.includes('TU-SUPABASE-ANON-KEY')) {
        supabaseError = "Error: Reemplaza los valores de 'supabaseUrl' y 'supabaseKey' con tus credenciales reales de Supabase.";
    } else if (window.supabase) {
        supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
    } else {
        supabaseError = "Error: La librería de Supabase (supabase-js) no se ha cargado. Asegúrate de que esté incluida en tu archivo HTML.";
    }
} catch (error) {
    supabaseError = `Error al inicializar Supabase: ${error.message}`;
    console.error(supabaseError);
}


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
};

// Carga solo los nombres de los departamentos
const cargarDepartamentos = async (nombreSucursal: string): Promise<string[]> => {
    const tableName = sucursalesConfig[nombreSucursal];
    if (!tableName) return [];
    const { data, error } = await supabase.from(tableName).select('depto_a');
    if (error) throw error;
    if (!data) return [];
    return [...new Set(data.map((item: any) => item.depto_a?.toString().trim() || ''))].filter(Boolean).sort();
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
    const [isLoadingData, setIsLoadingData] = useState<boolean>(true); // Inicia como true
    const [isLoadingDepts, setIsLoadingDepts] = useState<boolean>(true); // Inicia como true
    const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
    const [loadingError, setLoadingError] = useState<string | null>(supabaseError); // Inicia con el error de Supabase si existe
    const inputRef = useRef<HTMLInputElement>(null);

    // --- EFECTOS (CARGA DE DATOS) ---
    useEffect(() => {
        const loadBranchData = async () => {
            if (loadingError) return; // No intentar cargar si ya hay un error de config

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
        
        loadBranchData();
        
    }, [sucursalSeleccionada, loadingError]); // Se ejecuta si cambia la sucursal o si el error inicial se resuelve

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

    // --- GENERACIÓN DE PDF ---
    const generarReportePDF = () => {
        if (!window.jsPDF || !window.JsBarcode) {
            setLoadingError("Las librerías para generar PDF no están cargadas.");
            return;
        }
        setIsGeneratingPdf(true);
        // ... (resto de la lógica de PDF) ...
        setIsGeneratingPdf(false);
    };

    // --- RENDERIZADO ---
    if (loadingError) {
        return <div style={{ color: 'red', padding: '20px', border: '1px solid red', borderRadius: '8px' }}>
            <h2>Error de Configuración</h2>
            <p>{loadingError}</p>
        </div>;
    }

    return (
        <div style={{ fontFamily: 'sans-serif' }}>
            <h2>Control de Inventario Físico</h2>
            {/* ... (resto del JSX) ... */}
        </div>
    );
};

export default InventarioSuc;
