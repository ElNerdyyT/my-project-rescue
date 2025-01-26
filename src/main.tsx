import { render } from 'preact';
import './index.css'; // Tu archivo de estilos personalizado
import './css/global.css'; // Estilos globales personalizados
import 'bootstrap/dist/css/bootstrap.css'; // Estilos de Bootstrap
import { App } from './app';

render(<App />, document.getElementById('app')!);
