import { FunctionalComponent } from 'preact';
import PageLayout from '../components/PageLayout';
import ReportesFarmacia from '../components/ReportesFarmacia';

const Reportes: FunctionalComponent = () => {
  return (
    <PageLayout
      title="Reportes"
      description="Bienvenido al panel de reportes. Aquí puedes ver los reportes de la farmacia."
    >
      <ReportesFarmacia />
    </PageLayout>
  );
};

export default Reportes;
