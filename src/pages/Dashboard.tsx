import { FunctionalComponent } from 'preact';
import PageLayout from '../components/PageLayout';
import CardsCortes from '../components/CardsCortes';
import ChartCortes from '../components/ChartCortes';

const Dashboard: FunctionalComponent = () => {
  return (
    <PageLayout
      title="Analisis"
      description="Bienvenido al panel principal. Aquí puedes ver un resumen de los cortes."
    >
      <ChartCortes />
      <CardsCortes />
    </PageLayout>
  );
};

export default Dashboard;
