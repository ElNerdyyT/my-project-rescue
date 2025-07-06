import { useState, useEffect } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Definimos la estructura de un artículo individual con su sustancia
interface Articulo {
  cve_articulo_a: string;
  depto_a: string;
  subdepto_a: string;
  nombre_comer_a: string;
  cant_piso_a: number;
  preciomn_a: number;
  costo_a: number;
  sustancia_activa: string; // Ya no es opcional
}

// Definimos la estructura de una sugerencia, que ahora es por SUSTANCIA
interface SugerenciaAgrupada {
  id: string; // Será la sustancia o el código del artículo
  nombre: string; // El nombre de la sustancia
  depto: string; // Departamento del primer artículo encontrado
  subdepto: string;
  stock_total: number;
  venta_periodo: number;
  movimientos_count: number;
  promedio_semanal: string;
  stock_minimo_calculado: number;
  pedido_sugerido: number;
  costo_promedio: number;
  articulos_individuales: Articulo[];
}

const SUCURSALES = [
  { value: 'Econo1', label: 'Econo' },
  { value: 'Mexico', label: 'Mexico' },
  { value: 'Madero', label: 'Madero' },
  { value: 'Econo2', label: 'Econo2' },
  { value: 'Lolita', label: 'Lolita' },
  { value: 'LopezM', label: 'Lopez M' }
];

const PedidosInteligentesSustancia = () => {
  const [selectedBranch, setSelectedBranch] = useState('Mexico');
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [sugerencias, setSugerencias] = useState<SugerenciaAgrupada[]>([]);
  const [pedidosEditados, setPedidosEditados] = useState<{ [key: string]: number }>({});
  const [loading, setLoading] = useState(true);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>(['1', '2', '3', '4', '5', '20', '21', '22']);
  const [selectedAnalysisPeriod, setSelectedAnalysisPeriod] = useState(3);

  const getTableNames = () => ({
    articulos: `Articulos${selectedBranch}`,
    kardex: `Kardex${selectedBranch}`
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setArticulos([]);
      setSugerencias([]);
      setPedidosEditados({});

      const { articulos: articulosTable, kardex: kardexTable } = getTableNames();

      try {
        // 1. OBTENER DATOS CON JOIN A LA TABLA MAESTRA (CORREGIDO A MINÚSCULAS)
        const { data: articulosData, error: articulosError } = await supabase
          .from(articulosTable)
          .select(`
            cve_articulo_a, depto_a, subdepto_a, nombre_comer_a,
            cant_piso_a, preciomn_a, costo_a,
            maestrosustancias ( sustancia_activa )
          `)
          .in('depto_a', selectedDepartments);

        if (articulosError) throw articulosError;
        
        // Aplanamos el resultado para un uso más fácil (CORREGIDO A MINÚSCULAS)
        const articulosAplanados: Articulo[] = articulosData?.map(a => ({
            ...a,
            // Si la sustancia es 'POR DEFINIR', usamos el nombre comercial como fallback
            sustancia_activa: a.maestrosustancias?.sustancia_activa === 'POR DEFINIR' || !a.maestrosustancias?.sustancia_activa
              ? a.nombre_comer_a 
              : a.maestrosustancias.sustancia_activa,
        })) || [];
        
        setArticulos(articulosAplanados);
        
        // 2. OBTENER MOVIMIENTOS (KARDEX)
        const analysisStartDate = new Date();
        analysisStartDate.setMonth(analysisStartDate.getMonth() - selectedAnalysisPeriod);
        const fechaFormateada = analysisStartDate.toISOString().split('T')[0];

        const { data: movimientosData, error: movimientosError } = await supabase
          .from(kardexTable)
          .select('articulo, cantidad, fecha')
          .gte('fecha', fechaFormateada)
          .in('movto', ['1', '8']);

        if (movimientosError) throw movimientosError;

        // 3. AGRUPAR VENTAS Y CALCULAR SUGERENCIAS
        const mapaArticuloSustancia = Object.fromEntries(
            articulosAplanados.map(a => [a.cve_articulo_a, a.sustancia_activa])
        );

        const datosAgrupados: { [key: string]: { venta: number, movs: number } } = {};

        // Agrupar ventas y movimientos
        for (const mov of (movimientosData || [])) {
            const grupo = mapaArticuloSustancia[mov.articulo];
            if (!grupo) continue;
            if (!datosAgrupados[grupo]) datosAgrupados[grupo] = { venta: 0, movs: 0 };
            datosAgrupados[grupo].venta += Number(mov.cantidad);
            datosAgrupados[grupo].movs++;
        }

        // Calcular sugerencias
        const sugerenciasCalculadas: SugerenciaAgrupada[] = Object.entries(datosAgrupados).map(([grupo, data]) => {
            const articulosDelGrupo = articulosAplanados.filter(a => a.sustancia_activa === grupo);
            if (articulosDelGrupo.length === 0) return null;

            const stockTotal = articulosDelGrupo.reduce((sum, art) => sum + art.cant_piso_a, 0);
            const primerArticulo = articulosDelGrupo[0];
            const { venta, movs } = data;
            
            const semanas = Math.max(1, Math.floor((selectedAnalysisPeriod * 52) / 12));
            const promedioSemanal = venta / semanas;
            const stockMinimo = Math.ceil(promedioSemanal * 3);
            let pedidoNecesario = Math.max(stockMinimo - stockTotal, 0);

            if (movs >= 2 && pedidoNecesario === 0 && stockTotal <= 1) {
                pedidoNecesario = 1;
            }
            
            return {
                id: grupo,
                nombre: grupo,
                depto: primerArticulo.depto_a,
                subdepto: primerArticulo.subdepto_a,
                stock_total: stockTotal,
                venta_periodo: venta,
                movimientos_count: movs,
                promedio_semanal: promedioSemanal.toFixed(2),
                stock_minimo_calculado: stockMinimo,
                pedido_sugerido: Math.ceil(pedidoNecesario), // Redondear hacia arriba
                costo_promedio: primerArticulo.costo_a,
                articulos_individuales: articulosDelGrupo
            };
        }).filter((s): s is SugerenciaAgrupada => s !== null).sort((a,b) => b.venta_periodo - a.venta_periodo);
        
        setSugerencias(sugerenciasCalculadas);

      } catch (error) {
        console.error('Error cargando datos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedBranch, selectedDepartments, selectedAnalysisPeriod]);

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const title = `Pedidos Inteligentes por Sustancia - ${selectedBranch}`;
    const headers = [
      'Sustancia / Artículo', 'Dpto', 'Stock Total', 
      `Ventas ${selectedAnalysisPeriod} mes(es)`, 'Prom. Semanal', 'Pedido'
    ];
    
    const data = sugerencias
      .filter(s => (pedidosEditados[s.id] ?? s.pedido_sugerido) > 0 && s.movimientos_count >= 2)
      .map(s => [
        s.nombre,
        s.depto,
        s.stock_total.toString(),
        s.venta_periodo.toString(),
        s.promedio_semanal,
        (pedidosEditados[s.id] ?? s.pedido_sugerido).toString()
      ]);

    doc.text(title, 14, 15);
    (doc as any).autoTable({
      startY: 20,
      head: [headers],
      body: data,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [22, 160, 133], textColor: 255 }
    });
    doc.save(`pedidos-sustancia-${selectedBranch}-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="col-12">
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h3 className="card-title">
            Pedidos por Sustancia - Análisis de {selectedAnalysisPeriod} mes{selectedAnalysisPeriod > 1 ? 'es' : ''}
          </h3>
          <div className="d-flex gap-2">
            <button className="btn btn-primary" onClick={handleExportPDF} disabled={loading || sugerencias.length === 0}>
              Exportar PDF
            </button>
            <div className="dropdown">
              <button className="btn btn-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                Departamentos
              </button>
              <div className="dropdown-menu p-3">
                {['1', '2', '3', '4', '5', '20', '21', '22'].map(depto => (
                  <div key={depto} className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id={`depto-${depto}`}
                      checked={selectedDepartments.includes(depto)}
                      onChange={e => {
                        const checked = e.currentTarget.checked;
                        setSelectedDepartments(prev =>
                          checked ? [...prev, depto] : prev.filter(d => d !== depto)
                        );
                      }}
                    />
                    <label className="form-check-label" htmlFor={`depto-${depto}`}>Depto {depto}</label>
                  </div>
                ))}
              </div>
            </div>
            <select
              className="form-select w-auto"
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.currentTarget.value)}
            >
              {SUCURSALES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select
              className="form-select w-auto"
              value={selectedAnalysisPeriod}
              onChange={e => setSelectedAnalysisPeriod(parseInt(e.currentTarget.value))}
            >
              <option value={1}>1 mes</option>
              <option value={2}>2 meses</option>
              <option value={3}>3 meses</option>
              <option value={4}>4 meses</option>
              <option value={6}>6 meses</option>
            </select>
          </div>
        </div>
        <div className="table-wrapper" style={{ overflowX: 'auto' }}>
          {loading ? (
            <div className="text-center p-5"><div className="spinner-border text-primary" role="status"><span className="visually-hidden">Cargando...</span></div></div>
          ) : (
            <table className="table card-table table-vcenter">
              <thead>
                <tr>
                  <th>Sustancia / Artículo</th>
                  <th>Dpto</th>
                  <th>Stock Total</th>
                  <th>Ventas {selectedAnalysisPeriod} mes(es)</th>
                  <th>Prom. Semanal</th>
                  <th>Stock Mínimo</th>
                  <th>Pedido Sugerido</th>
                </tr>
              </thead>
              <tbody>
                {sugerencias
                  .filter(s => {
                    const pedidoActual = pedidosEditados[s.id] ?? s.pedido_sugerido;
                    return pedidoActual > 0 && s.movimientos_count >= 2;
                  })
                  .map(sugerencia => (
                    <tr key={`${selectedBranch}-${sugerencia.id}`}>
                      <td>{sugerencia.nombre}</td>
                      <td>{sugerencia.depto}</td>
                      <td>{sugerencia.stock_total}</td>
                      <td>{sugerencia.venta_periodo}</td>
                      <td>{sugerencia.promedio_semanal}</td>
                      <td>{sugerencia.stock_minimo_calculado}</td>
                      <td>
                        <div className="btn-group" role="group">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => setPedidosEditados(prev => ({ ...prev, [sugerencia.id]: (pedidosEditados[sugerencia.id] ?? sugerencia.pedido_sugerido) + 1 }))}
                          >
                            +
                          </button>
                          <span className="btn btn-sm btn-light disabled">
                            {pedidosEditados[sugerencia.id] ?? sugerencia.pedido_sugerido}
                          </span>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => setPedidosEditados(prev => ({ ...prev, [sugerencia.id]: Math.max((pedidosEditados[sugerencia.id] ?? sugerencia.pedido_sugerido) - 1, 0) }))}
                          >
                            -
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary ms-2"
                            title="Resetear pedido"
                            onClick={() => {
                              const newPedidos = { ...pedidosEditados };
                              delete newPedidos[sugerencia.id];
                              setPedidosEditados(newPedidos);
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default PedidosInteligentesSustancia;
