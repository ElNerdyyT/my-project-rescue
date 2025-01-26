import { FunctionalComponent } from 'preact';
import PageLayout from '../components/PageLayout';
import CardsCortes from '../components/CardsCortes';
import CortesMexico from '../components/CortesMexico';
import CortesMadero from '../components/CortesMadero';
import CortesEcono1 from '../components/CortesEcono1';

const Cortes: FunctionalComponent = () => {
  return (
    <PageLayout 
      title="Cortes"
      description="Bienvenido al panel de cortes. Aquí puedes ver un resumen de los cortes."
    >
      <CardsCortes />
      <CortesMexico />
      <CortesMadero />
      <CortesEcono1 />
    </PageLayout>
  );
};

export default Cortes;
