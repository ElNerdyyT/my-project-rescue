import { FunctionalComponent } from 'preact';
import PageLayout from '../components/PageLayout';
import KardexSucursales from '../components/KardexSucursales';

const Kardex: FunctionalComponent = () => {
  return (
    <PageLayout
      title="Kardex"
      description="Bienvenido al panel de kardex. Aquí puedes ver un resumen del kardex."
    >
      <KardexSucursales />
    </PageLayout>
  );
};

export default Kardex;
