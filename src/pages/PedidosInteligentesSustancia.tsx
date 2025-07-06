import { FunctionalComponent } from 'preact';
import PageLayout from '../components/PageLayout';
import PedidosInteligentesSustancia from '../components/PedidosInteligentesSustancia';

const Kardex: FunctionalComponent = () => {
  return (
    <PageLayout
      title="PedidosInteligentesSustancia"
      description="Bienvenido al panel de pediddos. Aquí puedes ver los pedidos de cada sucursal."
    >
      <PedidosInteligentesSustancia />
    </PageLayout>
  );
};

export default Kardex;
