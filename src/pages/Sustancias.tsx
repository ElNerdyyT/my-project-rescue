// pages/Sustancias.tsx

import { FunctionalComponent } from 'preact';
import PageLayout from '../components/PageLayout';
// 1. La importación y el nombre del componente deben empezar con mayúscula (PascalCase)
import SustanciasEditor from '../components/sustanciasEditor';
import ExploradorSustancias from '../components/ExploradorSustancias';


// 2. El nombre del componente debe coincidir con lo que se exporta
const Sustancias: FunctionalComponent = () => {
  return (
    <PageLayout
      title="Editor de Sustancias"
      description="Utilice esta herramienta para definir la sustancia activa de los productos."
    >
      {/* 3. Al usar el componente en JSX, también debe empezar con mayúscula */}
      <SustanciasEditor />
      <ExploradorSustancias />
    </PageLayout>
  );
};

// 4. El export default ahora coincide con el nombre del componente definido arriba
export default Sustancias;
