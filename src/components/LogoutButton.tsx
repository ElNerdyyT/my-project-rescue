import { FunctionalComponent } from 'preact';
import { supabase } from '../utils/supabaseClient';

const LogoutButton: FunctionalComponent = () => {
  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Disparar evento global de logout
      window.dispatchEvent(new CustomEvent('appLogout'));
      
      // Redirección adicional para limpiar estado
      window.location.href = '/'; 
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      alert('Error al cerrar sesión. Intenta nuevamente.');
    }
  };

  return (
    <button
      onClick={handleLogout}
      class="btn btn-danger"
      style={{
        zIndex: 1000,
        padding: '10px 15px',
        fontSize: '16px',
        borderRadius: '5px',
        top: '20px',
        right: '20px'
      }}
    >
      Cerrar Sesión
    </button>
  );
};

export default LogoutButton;