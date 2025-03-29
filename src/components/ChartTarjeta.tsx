// --- START OF FILE src/components/ChartTarjeta.tsx ---
import SingleMetricChart from './SingleMetricChart';

const ChartTarjeta = () => {
    return (
        <SingleMetricChart
            metricKey="tottarj"
            chartTitle="Evolución de Tarjeta Diario"
            yAxisTitle="Total Tarjeta"
            chartId="chart-tarjeta"
            metricNamePrefix="Tarjeta"
            isCurrency={true}
        />
    );
};
export default ChartTarjeta;
// --- END OF FILE src/components/ChartTarjeta.tsx ---