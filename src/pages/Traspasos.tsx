import { FunctionalComponent } from 'preact';
import PageLayout from '../components/PageLayout';
import TraspasosSuc from '../components/TraspasosSuc';


const Traspasos: FunctionalComponent = () => {
  return (
    <PageLayout
      title="Salidas"
      description="Bienvenido al panel de salidas. Aquí puedes ver un resumen de las salidas."
    >
        <TraspasosSuc ></TraspasosSuc>
    </PageLayout>
  );
};

export default Traspasos;
