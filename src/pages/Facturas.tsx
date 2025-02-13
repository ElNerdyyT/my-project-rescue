import { FunctionalComponent } from 'preact';
import PageLayout from '../components/PageLayout';
import FacturasSuc from '../components/FacturasSuc';

const Comisiones: FunctionalComponent = () => {
  return (
    <PageLayout
      title="Facturas"
      description="Bienvenido al panel de comisiones. Aquí puedes ver un resumen de las comisiones."
    >
      <FacturasSuc />
    </PageLayout>
  );
};

export default Comisiones;
