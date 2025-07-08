import { FunctionalComponent } from 'preact';
import PageLayout from '../components/PageLayout';
import sustanciasEditor from '../components/sustanciasEditor';

const Ajustes: FunctionalComponent = () => {
  return (
    <PageLayout
      title="Sustancias"
      description="Bienvenido al panel sustancias."
    >
        <sustanciasEditor />
    </PageLayout>
  );
};

export default Sustancias;
