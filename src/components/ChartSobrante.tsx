// --- START OF FILE src/components/ChartSobrante.tsx ---
import SingleMetricChart from './SingleMetricChart';

const ChartSobrante = () => {
    return (
        <SingleMetricChart
            metricKey="sobran"
            chartTitle="Evolución de Sobrante Diario"
            yAxisTitle="Total Sobrante"
            chartId="chart-sobrante"
            metricNamePrefix="Sobrante"
            isCurrency={true}
            colors={['#28A745', '#2ECC71', '#27AE60', '#1E8449', '#196F3D', '#145A32', '#0B5345']} // Example green shades
        />
    );
};
export default ChartSobrante;
// --- END OF FILE src/components/ChartSobrante.tsx ---