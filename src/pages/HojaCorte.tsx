import { FunctionalComponent } from 'preact';
import PageLayout from '../components/PageLayout';
import HojaCorte from '../components/HojaCorte';

const Kardex: FunctionalComponent = () => {
  return (
    <PageLayout
      title="Hoja de Corte"
      description="Bienvenido al panel de pediddos. Aquí puedes ver los pedidos de cada sucursal."
    >
        <HojaCorte />
    </PageLayout>
  );
};

export default Kardex;
