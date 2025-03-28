import { useState } from 'preact/hooks';
import { JSX } from 'preact';
import { supabase } from '../utils/supabaseClient';

interface TableRow {
  sucursal: string;
  cve_articulo_a: string;
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

  const buscarEnSucursal = async (sucursal: string, searchValue: string) => {
    const { data, error } = await supabase
      .from(sucursal)
      .select('cve_articulo_a, nombre_comer_a, cant_piso_a, preciomn_a, costo_a, fecha_modificacion')
      .or(`cve_articulo_a.ilike.%${searchValue}%,nombre_comer_a.ilike.%${searchValue}%`);
    if (error) {
      console.error(`Error en ${sucursal}:`, error);
      return [];
    }
    return data || [];
  };

  const buscarExistencia = async (searchValue: string) => {
    setLoading(true);
    const resultadosTemp: TableRow[] = [];
    for (const sucursal of sucursales) {
      const datos = await buscarEnSucursal(sucursal, searchValue);
      datos.forEach((dato: any) => {
        resultadosTemp.push({
          sucursal: sucursal,
          cve_articulo_a: dato.cve_articulo_a,
          nombre_comer_a: dato.nombre_comer_a,
          existencia: Number(dato.cant_piso_a) || 0,
          preciomn_a: dato.preciomn_a ? Number(dato.preciomn_a) : 0,
          costo_a: dato.costo_a ? Number(dato.costo_a) : 0,
          fecha_modificacion: dato.fecha_modificacion,
        });
      });
    }
    setResultados(resultadosTemp);
    setLoading(false);
  };

  const handleSearchInput = async (e: any) => {
    const value = e.target.value;
    setArticulo(value);
    if (value.length >= 3) {
      const { data, error } = await supabase
        .from('ArticulosMexico')
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

  const handleSelectItem = (item: AutocompleteItem) => {
    setArticulo(item.cve_articulo_a);
    setAutocompleteResults([]);
    buscarExistencia(item.cve_articulo_a);
  };

  const handleKeyDown = (e: JSX.TargetedKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setAutocompleteResults([]);
      buscarExistencia(articulo);
    }
  };

  const agruparPorArticulo = (resultados: TableRow[]) => {
    const agrupados: { [key: string]: TableRow[] } = {};
    resultados.forEach((item) => {
      if (!agrupados[item.cve_articulo_a]) {
        agrupados[item.cve_articulo_a] = [];
      }
      agrupados[item.cve_articulo_a].push(item);
    });
    return agrupados;
  };

  const calcularExistenciasTotales = (articuloData: TableRow[]) => {
    return articuloData.reduce((total, item) => total + (item.existencia || 0), 0);
  };

  const ordenarGruposPorExistencias = (grupos: [string, TableRow[]][]) => {
    return grupos.sort(([_, dataA], [__, dataB]) => {
      const totalA = calcularExistenciasTotales(dataA);
      const totalB = calcularExistenciasTotales(dataB);

      if (totalA < 0 || totalB < 0) {
        if (totalA < 0 && totalB < 0) return totalA - totalB;
        if (totalA < 0) return -1;
        return 1;
      }
      
      return totalB - totalA;
    });
  };

  return (
    <div class="p-6 relative">
      <h2 class="text-2xl font-semibold mb-6 text-center">Checador de Existencia de Artículos</h2>
      <input
        type="text"
        placeholder="Clave del artículo o Nombre Comercial..."
        value={articulo}
        onInput={handleSearchInput}
        onKeyDown={handleKeyDown}
        class="border border-gray-300 rounded-lg p-3 mb-4 w-full text-lg"
      />

      {autocompleteResults.length > 0 && (
        <div class="absolute mt-1 w-full bg-white border border-gray-300 rounded shadow-lg z-10">
          {autocompleteResults.map((item) => (
            <div
              key={item.cve_articulo_a}
              onClick={() => handleSelectItem(item)}
              class="p-3 cursor-pointer hover:bg-gray-100"
            >
              {item.cve_articulo_a} - {item.nombre_comer_a}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => buscarExistencia(articulo)}
        class="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 mt-4 w-full text-xl"
        disabled={loading}
      >
        {loading ? 'Buscando...' : 'Consultar Existencia'}
      </button>

      {resultados.length > 0 && (
        <div class="mt-6">
          {ordenarGruposPorExistencias(Object.entries(agruparPorArticulo(resultados))).map(
            ([cve_articulo_a, articuloData]) => {
              const totalExistencias = calcularExistenciasTotales(articuloData);
              const totalClass = totalExistencias < 0 
                ? "text-red-600 font-bold" 
                : "text-gray-700";

              return (
                <div key={cve_articulo_a} class="mb-8 border-t-4 border-blue-500 pt-4">
                  <h3 class="text-xl font-semibold mb-2 flex items-center justify-between">
                    <span>{cve_articulo_a}</span>
                    <span class={`text-lg ${totalClass}`}>
                      Existencias Totales: {totalExistencias}
                    </span>
                  </h3>
                  <table class="w-full border bg-white shadow-md rounded-lg overflow-hidden">
                    <thead class="bg-blue-100 text-sm">
                      <tr>
                        <th class="p-3 text-left border-b">Sucursal</th>
                        <th class="p-3 text-left border-b">Nombre Comercial</th>
                        <th class="p-3 text-left border-b">Existencia</th>
                        <th class="p-3 text-left border-b">Precio MN</th>
                        <th class="p-3 text-left border-b">Costo</th>
                        <th class="p-3 text-left border-b">Fecha Modificación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {articuloData.map((resultado, index) => (
                        <tr key={index} class="hover:bg-gray-50">
                          <td class="p-3 text-sm border-b">{resultado.sucursal}</td>
                          <td class="p-3 text-sm border-b">{resultado.nombre_comer_a}</td>
                          <td class={`p-3 text-sm border-b ${
                            resultado.existencia < 0 ? 'text-red-600 font-medium' : ''
                          }`}>
                            {resultado.existencia}
                          </td>
                          <td class="p-3 text-sm border-b">${resultado.preciomn_a.toFixed(2)}</td>
                          <td class="p-3 text-sm border-b">${resultado.costo_a.toFixed(2)}</td>
                          <td class="p-3 text-sm border-b">{new Date(resultado.fecha_modificacion).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            }
          )}
        </div>
      )}
    </div>
  );
};

export default ChecadorExistencia;