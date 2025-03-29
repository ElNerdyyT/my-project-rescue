// --- START OF FILE src/components/ChartFaltante.tsx ---
import SingleMetricChart from './SingleMetricChart';

const ChartFaltante = () => {
    return (
        <SingleMetricChart
            metricKey="faltan"
            chartTitle="Evolución de Faltante Diario"
            yAxisTitle="Total Faltante"
            chartId="chart-faltante"
            metricNamePrefix="Faltante"
            isCurrency={true}
            // Example of potentially different colors for emphasis
             colors={['#DC3545', '#E74C3C', '#CB4335', '#B03A2E', '#943126', '#78281F', '#511811']}
        />
    );
};
export default ChartFaltante;
// --- END OF FILE src/components/ChartFaltante.tsx ---