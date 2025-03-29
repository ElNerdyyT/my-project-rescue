// --- START OF FILE src/components/ChartCompras.tsx ---
import SingleMetricChart from './SingleMetricChart';

const ChartCompras = () => {
    return (
        <SingleMetricChart
            metricKey="com"
            chartTitle="Evolución de Compras Diarias"
            yAxisTitle="Total Compras"
            chartId="chart-compras"
            metricNamePrefix="Compra"
            isCurrency={true}
             colors={['#6C757D', '#5D6D7E', '#515A5A', '#424949', '#34495E', '#2C3E50', '#212F3D']} // Example gray/slate shades
        />
    );
};
export default ChartCompras;
// --- END OF FILE src/components/ChartCompras.tsx ---