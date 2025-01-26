import { FunctionalComponent} from 'preact';
import { useEffect, useState } from 'preact/hooks';
import Layout from './Layout';
import DateRangeSelector from './components/DateRangeSelector';
import Menu from './components/Menu';
import AuthForm from './components/AuthForm'; // Asegúrate de tener este componente


import { supabase } from './utils/supabaseClient';

export const App: FunctionalComponent = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
        const [loading, setLoading] = useState(true); // Estado para controlar la carga


  useEffect(() => {
    // Verificar el estado de autenticación al cargar la app
    const checkAuth = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setIsAuthenticated(true); // Si hay usuario autenticado, actualiza el estado
      } else {
        setIsAuthenticated(false); // Si no hay usuario, marca como no autenticado
      }
    };

    checkAuth();

    // Suscribirse a cambios de sesión
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setIsAuthenticated(true);
        setLoading(false); // Cuando se carga el estado de autenticación, deja de cargar
      } else {
        setIsAuthenticated(false);
        setLoading(false); // Cuando se carga el estado de autenticación, deja de cargar

      }
    });

    // Limpiar el listener al desmontar el componente
    return () => {
      authListener?.subscription.unsubscribe(); // Eliminar la suscripción correctamente
    };
  }, []);

  // Mientras se esté cargando el estado de autenticación, no renderizamos nada
  if (loading) {
    return <div>Cargando...</div>; // Puedes mostrar un spinner o algo mientras se verifica el estado de autenticación
  }

  return (
    <Layout>
      {isAuthenticated ? (
        <>
          {/* Solo se renderizan los componentes si el usuario está autenticado */}
          <Menu />
          <DateRangeSelector />
        </>
      ) : (
        // Mostrar el formulario de autenticación si el usuario no está autenticado
        <AuthForm />
      )}
    </Layout>
    
  );
};
