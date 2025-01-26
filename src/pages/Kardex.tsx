import { FunctionalComponent } from 'preact';
import PageLayout from '../components/PageLayout';
import KardexMexico from '../components/KardexMexico';

const Kardex: FunctionalComponent = () => {
  return (
    <PageLayout
      title="Kardex"
      description="Bienvenido al panel de kardex. Aquí puedes ver un resumen del kardex."
    >
      <KardexMexico />
    </PageLayout>
  );
};

export default Kardex;
