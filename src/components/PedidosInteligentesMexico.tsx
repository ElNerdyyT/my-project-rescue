import { useState, useEffect } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface Articulo {
  cve_articulo_a: string;
  depto_a: string;
  subdepto_a: string;
  nombre_comer_a: string;
  cant_piso_a: number;
  preciomn_a: number;
  costo_a: number;
}

interface Sugerencia extends Articulo {
  venta_3meses: number;
  movimientos_count: number;
  promedio_semanal: string;
  stock_minimo_calculado: number;
  pedido_sugerido: number;
}

interface MovimientoArticulo {
  articulo: string;
  cantidad: number;
  fecha: string;
}

const SUCURSALES = [
  { value: 'Econo1', label: 'Econo' },
  { value: 'Mexico', label: 'Mexico' },
  { value: 'Madero', label: 'Madero' }
];

const PedidosInteligentes = () => {
  const [selectedBranch, setSelectedBranch] = useState('Mexico');
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoArticulo[]>([]);
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [pedidosEditados, setPedidosEditados] = useState<{[key: string]: number}>({});
  const [loading, setLoading] = useState(true);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>(['1','2','3','4','5','20','21','22']);
  

  const getTableNames = () => ({
    articulos: `Articulos${selectedBranch}`,
    kardex: `Kardex${selectedBranch}`
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setArticulos([]);
      setMovimientos([]);
      setSugerencias([]);
      setPedidosEditados({});

      const { articulos: articulosTable, kardex: kardexTable } = getTableNames();

      try {
        const { data: articulosData, error: articulosError } = await supabase
          .from(articulosTable)
          .select('cve_articulo_a, depto_a, subdepto_a, nombre_comer_a, cant_piso_a, preciomn_a, costo_a')
          .in('depto_a', selectedDepartments); // Cambiar el array fijo por el estado

        if (articulosError) throw articulosError;

        const tresMesesAtras = new Date();
        tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3);
        const fechaFormateada = tresMesesAtras.toISOString().split('T')[0];

        const { data: movimientosData, error: movimientosError } = await supabase
          .from(kardexTable)
          .select('articulo, cantidad, fecha')
          .gte('fecha', fechaFormateada)
          .in('movto', ['1','8']);

        if (movimientosError) throw movimientosError;

        setArticulos(articulosData || []);
        setMovimientos(movimientosData?.map(m => ({
          ...m,
          cantidad: Number(m.cantidad)
        })) || []);
        
      } catch (error) {
        console.error('Error cargando datos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedBranch, selectedDepartments]); // Añadir selectedDepartments a las dependencias

  useEffect(() => {
    if (!articulos.length || !movimientos.length) return;

    const calcularSugerencias = () => {
      const movimientosPorArticulo = movimientos.reduce<Record<string, number>>((acc, curr) => {
        acc[curr.articulo] = (acc[curr.articulo] || 0) + curr.cantidad;
        return acc;
      }, {} as Record<string, number>);

      return articulos.map(articulo => {
        const ventaTotal = movimientosPorArticulo[articulo.cve_articulo_a] || 0;
        const movimientosCount = movimientos.filter(m => m.articulo === articulo.cve_articulo_a).length;

        const semanas = 13;
        const promedioSemanal = ventaTotal / semanas;
        const stockMinimo = Math.ceil(promedioSemanal * 3);
        
        // Modificación clave: manejar stock negativo como 0
        const stockActual = Math.max(articulo.cant_piso_a, 0);
        let pedidoNecesario = Math.max(stockMinimo - stockActual, 0);
        
        if (movimientosCount >= 2 && pedidoNecesario === 0) {
          pedidoNecesario = 1;
        }

        return {
          ...articulo,
          venta_3meses: ventaTotal,
          movimientos_count: movimientosCount,
          promedio_semanal: promedioSemanal.toFixed(2),
          stock_minimo_calculado: stockMinimo,
          pedido_sugerido: pedidoNecesario
        };
      }).sort((a, b) => a.depto_a.localeCompare(b.depto_a) || a.subdepto_a.localeCompare(b.subdepto_a));
    };

    setSugerencias(calcularSugerencias());
  }, [articulos, movimientos]);

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const title = `Pedidos Inteligentes - ${selectedBranch}`;
    const headers = [
      'Código',
      'Dpto',
      'Subdp',
      'Artículo',
      'Stock Actual',
      'Ventas 3m',
      'Prom. Semanal',
      'Stock Mínimo',
      'Pedido'
    ];

    const data = sugerencias
      .filter(s => {
        const pedidoActual = pedidosEditados[s.cve_articulo_a] ?? s.pedido_sugerido;
        return pedidoActual > 0 && s.movimientos_count >= 2 && s.cant_piso_a <= 1;
      })
      .map(s => [
        s.cve_articulo_a,
        s.depto_a,
        s.subdepto_a,
        s.nombre_comer_a,
        s.cant_piso_a.toString(),
        s.venta_3meses.toString(),
        s.promedio_semanal,
        s.stock_minimo_calculado.toString(),
        (pedidosEditados[s.cve_articulo_a] ?? s.pedido_sugerido).toString()
      ]);

    doc.text(title, 14, 15);
    (doc as any).autoTable({
      startY: 20,
      head: [headers],
      body: data,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 }
    });

    doc.save(`pedidos-${selectedBranch}-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="col-12">
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h3 className="card-title">Pedidos Inteligentes - Cálculo cada 3 semanas</h3>
          <div className="d-flex gap-2">
            <button 
              className="btn btn-primary"
              onClick={handleExportPDF}
              disabled={loading}
            >
              Exportar PDF
            </button>
            <div className="dropdown">
              <button 
                className="btn btn-secondary dropdown-toggle" 
                type="button" 
                data-bs-toggle="dropdown"
              >
                Departamentos
              </button>
              <div className="dropdown-menu p-3">
                {['1','2','3','4','5','20','21','22'].map(depto => (
                  <div key={depto} className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id={`depto-${depto}`}
                      checked={selectedDepartments.includes(depto)}
                      onChange={(e) => {
                        const checked = e.currentTarget.checked;
                        setSelectedDepartments(prev => 
                          checked 
                            ? [...prev, depto] 
                            : prev.filter(d => d !== depto)
                        );
                      }}
                    />
                    <label className="form-check-label" htmlFor={`depto-${depto}`}>
                      Depto {depto}
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <select 
              className="form-select w-auto"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.currentTarget.value)}
            >
              {SUCURSALES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
        
        
        <div className="table-wrapper" style={{ overflowX: 'auto' }}>
          {loading ? (
            <div className="text-center p-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Cargando...</span>
              </div>
            </div>
          ) : (
            <table className="table card-table table-vcenter">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Dpto</th>
                  <th>Subd</th>
                  <th>Artículo</th>
                  <th>Stock Actual</th>
                  <th>Ventas 3 meses</th>
                  <th>Prom. Semanal</th>
                  <th>Stock Mínimo</th>
                  <th>Pedido Sugerido</th>
                </tr>
              </thead>
              <tbody>
                {sugerencias
                .filter(s => {
                  const pedidoActual = pedidosEditados[s.cve_articulo_a] ?? s.pedido_sugerido;
                  const cumpleMovimientos = s.movimientos_count >= 2;
                  const necesitaStock = s.cant_piso_a <= 1;
                  
                  return pedidoActual > 0 && 
                         cumpleMovimientos && 
                         necesitaStock
                })
                .map((sugerencia) => (
                  <tr key={`${selectedBranch}-${sugerencia.cve_articulo_a}`}>
                    <td>{sugerencia.cve_articulo_a}</td>
                    <td>{sugerencia.depto_a}</td>
                    <td>{sugerencia.subdepto_a}</td>
                    <td>{sugerencia.nombre_comer_a}</td>
                    <td>{sugerencia.cant_piso_a}</td>
                    <td>{sugerencia.venta_3meses}</td>
                    <td>{sugerencia.promedio_semanal}</td>
                    <td>{sugerencia.stock_minimo_calculado}</td>
                    <td>
                      <div className="btn-group" role="group">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => setPedidosEditados(prev => ({
                            ...prev,
                            [sugerencia.cve_articulo_a]: (prev[sugerencia.cve_articulo_a] ?? sugerencia.pedido_sugerido) + 1
                          }))}
                        >
                          +
                        </button>
                        <span className="btn btn-sm btn-light disabled">
                          {pedidosEditados[sugerencia.cve_articulo_a] ?? sugerencia.pedido_sugerido}
                        </span>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => setPedidosEditados(prev => ({
                            ...prev,
                            [sugerencia.cve_articulo_a]: Math.max((prev[sugerencia.cve_articulo_a] ?? sugerencia.pedido_sugerido) - 1, 0)
                          }))}
                        >
                          -
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger ms-2"
                          onClick={() => {
                            const newPedidos = {...pedidosEditados};
                            delete newPedidos[sugerencia.cve_articulo_a];
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

export default PedidosInteligentes;
