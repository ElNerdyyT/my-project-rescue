import { useState } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';

const AuthForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: Event) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else if (data?.user) {
      console.log('Usuario autenticado:', data.user);  // Acceder a user dentro de data
      // Redirigir al usuario o hacer otra acción
    }
    setLoading(false);
  };

  const handleRegister = async (e: Event) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else if (data?.user) {
      console.log('Usuario registrado:', data.user);  // Acceder a user dentro de data
      // Redirigir al usuario o hacer otra acción
    }
    setLoading(false);
  };

  return (
    <div class="auth-form">
      <h2>{loading ? 'Cargando...' : 'Iniciar sesión o Registrarse'}</h2>
      <form onSubmit={handleLogin}>
        <div>
          <label for="email">Correo electrónico</label>
          <input
            type="email"
            id="email"
            value={email}
            onInput={(e) => setEmail(e.currentTarget.value)}
            placeholder="Correo electrónico"
            required
          />
        </div>
        <div>
          <label for="password">Contraseña</label>
          <input
            type="password"
            id="password"
            value={password}
            onInput={(e) => setPassword(e.currentTarget.value)}
            placeholder="Contraseña"
            required
          />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <div>
          <button type="submit" disabled={loading}>
            {loading ? 'Cargando...' : 'Iniciar sesión'}
          </button>
        </div>
      </form>
      <div>
        <p>¿No tienes cuenta?</p>
        <button onClick={handleRegister} disabled={loading}>
          {loading ? 'Cargando...' : 'Registrarse'}
        </button>
      </div>
    </div>
  );
};

export default AuthForm;
