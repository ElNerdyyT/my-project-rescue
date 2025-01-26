import { FunctionalComponent } from 'preact';
import PageLayout from '../components/PageLayout';
import ComisionesMexico from '../components/ComisionesMexico';

const Comisiones: FunctionalComponent = () => {
  return (
    <PageLayout
      title="Comisiones"
      description="Bienvenido al panel de comisiones. Aquí puedes ver un resumen de las comisiones."
    >
      <ComisionesMexico />
    </PageLayout>
  );
};

export default Comisiones;
