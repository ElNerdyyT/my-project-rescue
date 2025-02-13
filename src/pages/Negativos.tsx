import { FunctionalComponent } from 'preact';
import PageLayout from '../components/PageLayout';
import NegativosSuc from '../components/NegativosSuc';

const Negativos: FunctionalComponent = () => {
  return (
    <PageLayout
      title="Negativos"
      description="Bienvenido al panel de pediddos. Aquí puedes ver los pedidos de cada sucursal."
    >
        <NegativosSuc />
    </PageLayout>
  );
};

export default Negativos;
