import { useState, useEffect } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';

interface TableRow {
  id: number;
  corte: string;
  turno: string;
  fecha: string;
  hora: string;
  folini: string;
  folfin: string;
  totentreg: string;
  tottarj: string;
  faltan: string;
  sobran: string;
  encar: string;
  cajer: string;
  gas: string;
  com: string;
  val: string;
  totret: string;
}

const sucursales = [
  'CortesEcono1',
  'CortesMadero',
  'CortesMexico',
  'CortesLolita',
  'CortesLopezM',
  'CortesBaja',
  'CortesEcono2',
  'General'
];

const DataTable = () => {
  const [data, setData] = useState<TableRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSucursal, setSelectedSucursal] = useState('CortesEcono1');
  const [loading, setLoading] = useState<boolean>(true);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  useEffect(() => {
    const fetchDateRange = async () => {
      const { data, error } = await supabase
        .from('date_range')
        .select('start_date, end_date')
        .single();  // Asumimos que solo hay un registro

      if (error) {
        console.error('Error al obtener el rango de fechas:', error.message);
        return;
      }

      if (data) {
        setStartDate(data.start_date);
        setEndDate(data.end_date);
      }
    };

    fetchDateRange();
  }, []);

  useEffect(() => {
    if (!startDate || !endDate) {
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      let supabaseData: TableRow[] = [];
      
      const formattedStartDate = new Date(startDate).toISOString().split('T').join(' ').split('.')[0];
      const formattedEndDate = new Date(endDate).toISOString().split('T').join(' ').split('.')[0];

      if (selectedSucursal === 'General') {
        for (const sucursal of sucursales.slice(0, -1)) {
          const { data, error } = await supabase
            .from(sucursal)
            .select('*')
            .gte('fecha', formattedStartDate)
            .lte('fecha', formattedEndDate);

          if (!error && data) {
            supabaseData = [...supabaseData, ...data];
          }
        }
        supabaseData.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
      } else {
        const { data, error } = await supabase
          .from(selectedSucursal)
          .select('*')
          .gte('fecha', formattedStartDate)
          .lte('fecha', formattedEndDate)
          .order('corte', { ascending: false });

        if (!error && data) {
          supabaseData = data;
        }
      }
      
      setData(supabaseData);
      setLoading(false);
    };

    fetchData();
  }, [selectedSucursal, startDate, endDate]);

  const filteredData = searchQuery
    ? data.filter((row) =>
        Object.values(row).some((value) =>
          value.toString().toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    : data;

  if (loading) {
    return <p>Cargando datos...</p>;
  }

  return (
    <>
      <div class="col-12">
        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h3 class="card-title">Datos de Cortes</h3>
            <select
              class="form-select custom-dropdown"
              value={selectedSucursal}
              onChange={(e) => setSelectedSucursal(e.currentTarget.value)}
            >
              {sucursales.map((sucursal) => (
                <option key={sucursal} value={sucursal}>{sucursal}</option>
              ))}
            </select>
          </div>
          <div class="card-body border-bottom py-3">
            <div class="d-flex">
              <div class="ms-auto text-secondary">
                Buscar:
                <div class="ms-2 d-inline-block">
                  <input
                    type="text"
                    class="form-control form-control-sm"
                    value={searchQuery}
                    onInput={(e) => setSearchQuery(e.currentTarget.value)}
                    aria-label="Buscar"
                  />
                </div>
              </div>
            </div>
          </div>
          <div class="table-wrapper" style={{ overflowX: 'auto', width: '100%' }}>
            <table class="table table-striped table-hover card-table table-vcenter text-nowrap">
              <thead class="table-dark">
                <tr>
                  <th>Corte</th>
                  <th>Turno</th>
                  <th>Fecha</th>
                  <th>Hora</th>
                  <th>Folio I</th>
                  <th>Folio F</th>
                  <th>Total Ef</th>
                  <th>Total Tar</th>
                  <th>Faltante</th>
                  <th>Sobrante</th>
                  <th>Encar</th>
                  <th>Cajero</th>
                  <th>Gastos</th>
                  <th>Compras</th>
                  <th>Vales</th>
                  <th>TotRet</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row) => (
                  <tr key={row.id}>
                    <td>{row.corte}</td>
                    <td>{row.turno}</td>
                    <td>{row.fecha}</td>
                    <td>{row.hora}</td>
                    <td>{row.folini}</td>
                    <td>{row.folfin}</td>
                    <td>{row.totentreg}</td>
                    <td>{row.tottarj}</td>
                    <td>{row.faltan}</td>
                    <td>{row.sobran}</td>
                    <td>{row.encar}</td>
                    <td>{row.cajer}</td>
                    <td>{row.gas}</td>
                    <td>{row.com}</td>
                    <td>{row.val}</td>
                    <td>{row.totret}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <style>
        {`
          .custom-dropdown {
            padding: 8px;
            border-radius: 8px;
            border: 1px solid #ccc;
            background-color: white;
            font-size: 16px;
            cursor: pointer;
          }

          .custom-dropdown:hover {
            border-color: #888;
          }
        `}
      </style>
    </>
  );
};

export default DataTable;