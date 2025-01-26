import { FunctionalComponent } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import Layout from './Layout';
import Menu from './components/Menu';
import AuthForm from './components/AuthForm';
import { supabase } from './utils/supabaseClient';

export const App: FunctionalComponent = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Escuchar evento personalizado de logout
    const handleLogoutEvent = () => {
      setIsAuthenticated(false);
      window.location.reload(); // Opcional pero recomendado
    };
    
    window.addEventListener('appLogout', handleLogoutEvent);

    const checkAuth = async () => {
      const { data } = await supabase.auth.getUser();
      setIsAuthenticated(!!data?.user);
      setLoading(false);
    };

    checkAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session?.user);
      setLoading(false);
    });

    return () => {
      window.removeEventListener('appLogout', handleLogoutEvent);
      authListener?.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return <div>Cargando...</div>;
  }

  return (
    <Layout>
      {isAuthenticated ? (
        <>
          <Menu /> {/* Sin cambios aquí */}
        </>
      ) : (
        <AuthForm />
      )}
    </Layout>
  );
};