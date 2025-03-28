import { useState } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';

interface TableRow {
  sucursal: string;
  nombre_comer_a: string;
  existencia: number;
  preciomn_a: number;
  costo_a: number;
  fecha_modificacion: string;
}

interface AutocompleteItem {
  cve_articulo_a: string;
  nombre_comer_a: string;
}

const sucursales = [
  'ArticulosEcono1',
  'ArticulosMexico',
  'ArticulosMadero',
  'ArticulosLopezM',
  'ArticulosBaja',
  'ArticulosEcono2',
  'ArticulosLolita'
];

const ChecadorExistencia = () => {
  const [articulo, setArticulo] = useState('');
  const [resultados, setResultados] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [autocompleteResults, setAutocompleteResults] = useState<AutocompleteItem[]>([]);
  
  // Función que busca en una sucursal usando ambos campos
  const buscarEnSucursal = async (sucursal: string, searchValue: string) => {
    const { data, error } = await supabase
      .from(sucursal)
      .select('cve_articulo_a, nombre_comer_a, cant_piso_a, preciomn_a, costo_a, fecha_modificacion')
      .or(`cve_articulo_a.ilike.%${searchValue}%,nombre_comer_a.ilike.%${searchValue}%`);
    if (error) {
      console.error(`Error en ${sucursal}:`, error);
      return null;
    }
    return data && data.length > 0 ? data[0] : null;
  };

  // Búsqueda de existencias en todas las sucursales
  const buscarExistencia = async () => {
    setLoading(true);
    const resultadosTemp: TableRow[] = [];
    for (const sucursal of sucursales) {
      const dato = await buscarEnSucursal(sucursal, articulo);
      if (dato) {
        resultadosTemp.push({
          sucursal: sucursal,
          nombre_comer_a: dato.nombre_comer_a,
          existencia: dato.cant_piso_a || 0,
          preciomn_a: dato.preciomn_a ? Number(dato.preciomn_a) : 0,
          costo_a: dato.costo_a ? Number(dato.costo_a) : 0,
          fecha_modificacion: dato.fecha_modificacion,
        });
      } else {
        // Si no se encontró el artículo en la sucursal, se puede mostrar 0 o dejarlo vacío
        resultadosTemp.push({
          sucursal: sucursal,
          nombre_comer_a: '',
          existencia: 0,
          preciomn_a: 0,
          costo_a: 0,
          fecha_modificacion: '',
        });
      }
    }
    setResultados(resultadosTemp);
    setLoading(false);
  };

  // Función para el autocompletado
  const handleSearchInput = async (e: any) => {
    const value = e.target.value;
    setArticulo(value);
    if (value.length >= 3) {
      const { data, error } = await supabase
        .from('ArticulosMexico') // Usamos una sucursal de referencia para el autocompletado
        .select('cve_articulo_a, nombre_comer_a')
        .or(`cve_articulo_a.ilike.%${value}%,nombre_comer_a.ilike.%${value}%`);
      if (error) {
        console.error('Error en autocompletado:', error);
        return;
      }
      setAutocompleteResults(data || []);
    } else {
      setAutocompleteResults([]);
    }
  };

  // Cuando se selecciona un artículo del autocompletado, se actualiza el campo de búsqueda con el código (cve_articulo_a)
  const handleSelectItem = (item: AutocompleteItem) => {
    setArticulo(item.cve_articulo_a);
    setAutocompleteResults([]);
    buscarExistencia();
  };

  return (
    <div class="p-4 relative">
      <h2 class="text-xl font-semibold mb-4">Checador de Existencia de Artículos</h2>
      <input
        type="text"
        placeholder="Clave del artículo o Nombre Comercial..."
        value={articulo}
        onInput={handleSearchInput}
        class="border border-gray-300 rounded p-2 mb-4 w-full"
      />

      {/* Autocompletado */}
      {autocompleteResults.length > 0 && (
        <div class="absolute mt-1 w-full bg-white border border-gray-300 rounded shadow-lg z-10">
          {autocompleteResults.map((item) => (
            <div
              key={item.cve_articulo_a}
              onClick={() => handleSelectItem(item)}
              class="p-2 cursor-pointer hover:bg-gray-100"
            >
              {item.cve_articulo_a} - {item.nombre_comer_a}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={buscarExistencia}
        class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        disabled={loading}
      >
        {loading ? 'Buscando...' : 'Consultar Existencia'}
      </button>

      {/* Mostrar resultados */}
      {resultados.length > 0 && (
        <table class="w-full mt-4 border">
          <thead>
            <tr>
              <th class="p-2 border">Sucursal</th>
              <th class="p-2 border">Nombre Comercial</th>
              <th class="p-2 border">Existencia</th>
              <th class="p-2 border">Precio MN</th>
              <th class="p-2 border">Costo</th>
              <th class="p-2 border">Fecha Modificación</th>
            </tr>
          </thead>
          <tbody>
            {resultados.map((resultado, index) => (
              <tr key={index} class="border-t">
                <td class="p-2 border">{resultado.sucursal}</td>
                <td class="p-2 border">{resultado.nombre_comer_a}</td>
                <td class="p-2 border">{resultado.existencia}</td>
                <td class="p-2 border">${Number(resultado.preciomn_a).toFixed(2)}</td>
                <td class="p-2 border">${Number(resultado.costo_a).toFixed(2)}</td>
                <td class="p-2 border">
                  {resultado.fecha_modificacion ? new Date(resultado.fecha_modificacion).toLocaleDateString() : '' }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ChecadorExistencia;
