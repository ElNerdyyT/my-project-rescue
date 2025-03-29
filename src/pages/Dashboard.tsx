import { FunctionalComponent } from 'preact';
import PageLayout from '../components/PageLayout';
import CardsCortes from '../components/CardsCortes';
import ChartCortes from '../components/ChartCortes';
import ChartEfectivo from '../components/ChartEfectivo';
import ChartTarjeta from '../components/ChartTarjeta';
import ChartFaltante from '../components/ChartFaltante';
import ChartSobrante from '../components/ChartSobrante';
import ChartGastos from '../components/ChartGastos';
import ChartCompras from '../components/ChartCompras';
import ChartEfectivoVsTarjetaSucursal from '../components/ChartEfectivoVsTarjetaSucursal';


const Dashboard: FunctionalComponent = () => {
  return (
    <PageLayout
      title="Analisis"
      description="Bienvenido al panel principal. Aquí puedes ver un resumen de los cortes."
    >
      <ChartCortes />
      <ChartEfectivoVsTarjetaSucursal />
      <ChartEfectivo /> {/* Cash only */}
      <ChartTarjeta />  {/* Card only */}
      <ChartFaltante /> {/* Shortages */}
      <ChartSobrante /> {/* Overages */}
      <ChartGastos />   {/* Expenses */}
      <ChartCompras />  {/* Purchases */}
      <CardsCortes />
    </PageLayout>
  );
};

export default Dashboard;
