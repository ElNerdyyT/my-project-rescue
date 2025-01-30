import { FunctionalComponent } from 'preact';
import PageLayout from '../components/PageLayout';
import PedidosInteligentesMexico from '../components/PedidosInteligentesMexico';

const Kardex: FunctionalComponent = () => {
  return (
    <PageLayout
      title="Pedidos Inteligentes"
      description="Bienvenido al panel de pediddos. Aquí puedes ver los pedidos de cada sucursal."
    >
      <PedidosInteligentesMexico />
    </PageLayout>
  );
};

export default Kardex;
