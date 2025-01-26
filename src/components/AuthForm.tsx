import { useState } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';
import '../css/AuthForm.css';

const AuthForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLogin, setIsLogin] = useState(true);

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
    <div class="auth-container">
      <div class="auth-form">
        <div class="auth-form-header">
          <h2>{isLogin ? 'Iniciar sesión' : 'Registrarse'}</h2>
          <p>{isLogin ? 'Ingresa tus credenciales' : 'Crea una nueva cuenta'}</p>
        </div>
        
        <form onSubmit={isLogin ? handleLogin : handleRegister}>
          <div class="form-group">
            <label for="email">Correo electrónico</label>
            <div class="input-wrapper">
              <span class="material-icons form-icon">email</span>
              <input
                type="email"
                id="email"
                value={email}
                onInput={(e) => setEmail(e.currentTarget.value)}
                placeholder="Correo electrónico"
                required
              />
            </div>
          </div>

          <div class="form-group">
            <label for="password">Contraseña</label>
            <div class="input-wrapper">
              <span class="material-icons form-icon">lock</span>
              <input
                type="password"
                id="password"
                value={password}
                onInput={(e) => setPassword(e.currentTarget.value)}
                placeholder="Contraseña"
                required
              />
            </div>
          </div>

          {error && <p class="error-message">{error}</p>}

          <button type="submit" class="btn-primary" disabled={loading}>
            {loading ? 'Cargando...' : (isLogin ? 'Iniciar sesión' : 'Registrarse')}
          </button>
        </form>

        <div class="auth-form-footer">
          <p>
            {isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
            <a href="#" onClick={() => setIsLogin(!isLogin)}>
              {isLogin ? ' Regístrate aquí' : ' Inicia sesión aquí'}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthForm;
