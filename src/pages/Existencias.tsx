import { FunctionalComponent } from 'preact';
import PageLayout from '../components/PageLayout';
import ChecadorExistencias from '../components/ChecadorExistencias';


const Existencias: FunctionalComponent = () => {
  return (
    <PageLayout
      title="Existencias"
      description="Bienvenido al panel Existencias"
    >
      <ChecadorExistencias />
    </PageLayout>
  );
};

export default Existencias;
