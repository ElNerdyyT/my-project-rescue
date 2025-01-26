import { FunctionalComponent } from 'preact';
import PageLayout from '../components/PageLayout';
import DateRangeSelector from '../components/DateRangeSelector';

const Ajustes: FunctionalComponent = () => {
  return (
    <PageLayout
      title="Ajustes"
      description="Bienvenido al panel ajustes. Aquí podras ajustar las fechas."
    >
        <DateRangeSelector />
    </PageLayout>
  );
};

export default Ajustes;
