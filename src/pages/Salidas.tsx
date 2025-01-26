import { FunctionalComponent } from 'preact';
import PageLayout from '../components/PageLayout';
import SalidasMexico from '../components/SalidasMexico';
import SalidasMadero from '../components/SalidasMadero';
import SalidasEcono1 from '../components/SalidasEcono1';

const Salidas: FunctionalComponent = () => {
  return (
    <PageLayout
      title="Salidas"
      description="Bienvenido al panel de salidas. Aquí puedes ver un resumen de las salidas."
    >
        <SalidasMexico />
        <SalidasMadero />
        <SalidasEcono1 />
    </PageLayout>
  );
};

export default Salidas;
