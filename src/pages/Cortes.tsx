import { FunctionalComponent } from 'preact';
import PageLayout from '../components/PageLayout';
import CardsCortes from '../components/CardsCortes';
import CortesEcono1 from '../components/CortesEcono1';

const Cortes: FunctionalComponent = () => {
  return (
    <PageLayout 
      title="Cortes"
      description="Bienvenido al panel de cortes. Aquí puedes ver un resumen de los cortes."
    >
      <CardsCortes />
      <CortesEcono1 />
    </PageLayout>
  );
};

export default Cortes;
