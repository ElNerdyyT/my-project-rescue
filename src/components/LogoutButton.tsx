import { FunctionalComponent } from 'preact';
import { supabase } from '../utils/supabaseClient'; // Importa el cliente Supabase

const LogoutButton: FunctionalComponent = () => {
  // Función para cerrar sesión
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <button
      onClick={handleLogout}
      class="btn btn-danger"
      style={{
        position: 'fixed',
        zIndex: 1000,
        padding: '10px 15px',
        fontSize: '16px',
        borderRadius: '5px',
      }}
    >
      Logout
    </button>
  );
};

export default LogoutButton;
