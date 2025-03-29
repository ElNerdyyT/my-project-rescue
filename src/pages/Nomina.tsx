import { FunctionalComponent } from 'preact';
import PageLayout from '../components/PageLayout';
import NominaManager from '../components/NominaManager';

const Nomina: FunctionalComponent = () => {
  return (
    <PageLayout
      title="Nomina"
      description="Bienvenido al panel de Nomina."
    >
      <NominaManager />
    </PageLayout>
  );
};

export default Nomina;
