import { FunctionalComponent } from 'preact';
import { useState } from 'preact/hooks';
import PageLayout from '../components/PageLayout';
import CardsCortesInd from '../components/CardsCortesInd';
import CortesSuc from '../components/CortesSuc';

const Cortes: FunctionalComponent = () => {
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

  const [selectedSucursal, setSelectedSucursal] = useState(sucursales[0]);
  
  return (
    <PageLayout 
      title="Cortes"
      description="Bienvenido al panel de cortes. Aquí puedes ver un resumen de los cortes."
    >
      <CardsCortesInd 
        selectedSucursal={selectedSucursal}
        sucursales={sucursales}
      />
      <CortesSuc 
        selectedSucursal={selectedSucursal}
        onSucursalChange={setSelectedSucursal}
        sucursales={sucursales}
      />
    </PageLayout>
  );
};

export default Cortes;