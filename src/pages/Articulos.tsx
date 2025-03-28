import { FunctionalComponent } from 'preact';
import PageLayout from '../components/PageLayout';
import ArticulosSucursales from '../components/ArticulosSucursales';

const Articulos: FunctionalComponent = () => {
  return (
    <PageLayout
      title="Artículos"
      description="Bienvenido al panel de artículos. Aquí puedes ver un resumen del kardex."
    >
      <ArticulosSucursales />
    </PageLayout>
  );
};

export default Articulos;
