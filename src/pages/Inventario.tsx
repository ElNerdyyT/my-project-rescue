import { FunctionalComponent } from 'preact';
import PageLayout from '../components/PageLayout';
import InventarioSuc from '../components/InventarioSuc';

const Inventario: FunctionalComponent = () => {
  return (
    <PageLayout
      title="Inventarios"
      description="Bienvenido al panel de Inventarios."
    >
      <InventarioSuc />
    </PageLayout>
  );
};

export default Inventario;
