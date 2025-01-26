import { FunctionalComponent } from 'preact';
import PageLayout from '../components/PageLayout';
import ArticulosMexico from '../components/ArticulosMexico';

const Articulos: FunctionalComponent = () => {
  return (
    <PageLayout
      title="Artículos"
      description="Bienvenido al panel de artículos. Aquí puedes ver un resumen del kardex."
    >
      <ArticulosMexico />
    </PageLayout>
  );
};

export default Articulos;
