// --- START OF FILE src/components/ChartEfectivo.tsx ---
import SingleMetricChart from './SingleMetricChart';

const ChartEfectivo = () => {
    return (
        <SingleMetricChart
            metricKey="totentreg"
            chartTitle="Evolución de Efectivo Diario"
            yAxisTitle="Total Efectivo"
            chartId="chart-efectivo"
            metricNamePrefix="Efectivo"
            isCurrency={true}
            // colors prop is optional, uses defaults if omitted
        />
    );
};
export default ChartEfectivo;
// --- END OF FILE src/components/ChartEfectivo.tsx ---