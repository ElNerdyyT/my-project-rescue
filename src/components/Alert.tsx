import { FunctionalComponent } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import '../css/Alert.css';

const Alert: FunctionalComponent = () => {
  const [alertVisible, setAlertVisible] = useState<boolean>(false);

  // Leer el estado de la alerta desde localStorage
  useEffect(() => {
    const storedAlertVisible = localStorage.getItem('alertVisible');
    if (storedAlertVisible === 'true') {
      setAlertVisible(true);
      setTimeout(() => {
        setAlertVisible(false);
        localStorage.removeItem('alertVisible');
      }, 5000); // La alerta se ocultará después de 5 segundos
    }
  }, []);

  return (
    alertVisible && (
      <div class="alert alert-success" role="alert">
        <h4 class="alert-title">Fechas actualizadas</h4>
        <p>Las fechas se han actualizado correctamente en el sistema.</p>
      </div>
    )
  );
};

export default Alert;
