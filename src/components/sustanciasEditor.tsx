import { useState, useEffect } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';

// Usaremos la misma estructura de la tabla maestra
interface MaestroSustancia {
  cve_articulo_a: string;
  nombre_comer_a: string;
  cantidadGeneral: number;
  sustancia_activa: string;
}

const EditorSustancias = () => {
  // Estado para la lista de productos por definir
  const [productos, setProductos] = useState<MaestroSustancia[]>([]);
  // Índice para saber en qué producto estamos trabajando
  const [indiceActual, setIndiceActual] = useState(0);
  // Estado para el campo de texto de la sustancia
  const [sustanciaInput, setSustanciaInput] = useState('');
  
  // Estados para la UI
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [loadingSugerencia, setLoadingSugerencia] = useState(false);
  const [error, setError] = useState('');

  // Cargar los productos al iniciar el componente
  useEffect(() => {
    const fetchProductosPorDefinir = async () => {
      setLoading(true);
      setError('');
      try {
        const { data, error } = await supabase
          .from('maestrosustancias')
          .select('cve_articulo_a, nombre_comer_a, cantidadGeneral, sustancia_activa')
          .eq('sustancia_activa', 'POR DEFINIR')
          .order('cantidadGeneral', { ascending: false }) // Prioriza productos con stock
          .limit(100); // Traemos un lote de 100 para trabajar

        if (error) throw error;
        setProductos(data || []);
      } catch (err) {
        setError('Error al cargar los productos. ' + (err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchProductosPorDefinir();
  }, []);

  // Producto actual que se está mostrando
  const productoActual = productos[indiceActual];

  // Función para obtener la sugerencia de la IA
  const obtenerSugerenciaIA = async () => {
    if (!productoActual) return;
    setLoadingSugerencia(true);
    setError('');
    try {
      const { data, error } = await supabase.functions.invoke('sugerir-sustancia', {
        body: { nombre_medicamento: productoActual.nombre_comer_a },
      });

      if (error) throw error;
      
      setSustanciaInput(data.sugerencia || 'No se pudo obtener sugerencia');
    } catch (err) {
      setError('Error al contactar la IA. ' + (err as Error).message);
    } finally {
      setLoadingSugerencia(false);
    }
  };

  // Función para guardar y pasar al siguiente producto
  const handleSiguiente = async () => {
    if (!productoActual || !sustanciaInput.trim()) {
      setError('La sustancia activa no puede estar vacía.');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      const { error } = await supabase
        .from('maestrosustancias')
        .update({ sustancia_activa: sustanciaInput.trim().toUpperCase() })
        .eq('cve_articulo_a', productoActual.cve_articulo_a);

      if (error) throw error;

      // Pasar al siguiente producto
      if (indiceActual < productos.length - 1) {
        setIndiceActual(indiceActual + 1);
        setSustanciaInput(''); // Limpiar el input para el siguiente
      } else {
        // Se terminaron los productos del lote
        alert('¡Felicidades, has completado este lote de productos!');
        setProductos([]); // Limpiar para que muestre el mensaje de completado
      }
    } catch (err) {
      setError('Error al guardar la sustancia. ' + (err as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  // Función para saltar un producto sin guardar
  const handleSaltar = () => {
    if (indiceActual < productos.length - 1) {
      setIndiceActual(indiceActual + 1);
      setSustanciaInput('');
    } else {
      alert('Has llegado al final de este lote.');
    }
  };

  // Renderizado del componente
  if (loading) {
    return <div className="text-center p-5"><div className="spinner-border text-primary"></div><p>Cargando productos...</p></div>;
  }

  if (!productoActual) {
    return <div className="alert alert-success text-center">¡No hay más productos por definir en este lote!</div>;
  }

  return (
    <div className="col-md-8 mx-auto">
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Editor de Sustancias Activas</h3>
          <div className="card-options">
            <span className="badge bg-primary">Progreso: {indiceActual + 1} / {productos.length}</span>
          </div>
        </div>
        <div className="card-body">
          <div className="mb-3">
            <label className="form-label">Código de Artículo (CVE)</label>
            <p className="form-control-plaintext"><strong>{productoActual.cve_articulo_a}</strong></p>
          </div>
          <div className="mb-3">
            <label className="form-label">Nombre Comercial</label>
            <p className="form-control-plaintext fs-4"><strong>{productoActual.nombre_comer_a}</strong></p>
          </div>
          <div className="mb-3">
            <label className="form-label">Cantidad Total en Stock</label>
            <p className="form-control-plaintext"><strong>{productoActual.cantidadGeneral}</strong></p>
          </div>
          
          <hr/>

          <div className="mb-3">
            <label htmlFor="sustancia-activa-input" className="form-label">Sustancia Activa</label>
            <div className="input-group">
              <input
                id="sustancia-activa-input"
                type="text"
                className="form-control form-control-lg"
                placeholder="Ingresa la sustancia activa o pide una sugerencia..."
                value={sustanciaInput}
                onChange={(e) => setSustanciaInput(e.currentTarget.value)}
              />
              <button className="btn btn-info" onClick={obtenerSugerenciaIA} disabled={loadingSugerencia}>
                {loadingSugerencia ? <span className="spinner-border spinner-border-sm"></span> : '🤖 Sugerir IA'}
              </button>
            </div>
          </div>

          {error && <div className="alert alert-danger mt-3">{error}</div>}
        </div>
        <div className="card-footer text-end">
          <button className="btn btn-secondary me-2" onClick={handleSaltar} disabled={guardando}>
            Saltar
          </button>
          <button className="btn btn-success" onClick={handleSiguiente} disabled={guardando || !sustanciaInput.trim()}>
            {guardando ? <span className="spinner-border spinner-border-sm"></span> : 'Guardar y Siguiente'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditorSustancias;
