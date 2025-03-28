import { FunctionalComponent } from 'preact';
import PageLayout from '../components/PageLayout';
import SalidasSucursales from '../components/SalidasSucursales';

const Salidas: FunctionalComponent = () => {
  return (
    <PageLayout
      title="Salidas"
      description="Bienvenido al panel de salidas. Aquí puedes ver un resumen de las salidas."
    >
        <SalidasSucursales />
    </PageLayout>
  );
};

export default Salidas;
