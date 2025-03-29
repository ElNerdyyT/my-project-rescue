// --- START OF FILE src/components/ChartGastos.tsx ---
import SingleMetricChart from './SingleMetricChart';

const ChartGastos = () => {
    return (
        <SingleMetricChart
            metricKey="gas"
            chartTitle="Evolución de Gastos Diarios"
            yAxisTitle="Total Gastos"
            chartId="chart-gastos"
            metricNamePrefix="Gasto"
            isCurrency={true}
            colors={['#FFC107', '#F39C12', '#D68910', '#CA6F1E', '#B9770E', '#A04000', '#873600']} // Example amber/orange shades
        />
    );
};
export default ChartGastos;
// --- END OF FILE src/components/ChartGastos.tsx ---