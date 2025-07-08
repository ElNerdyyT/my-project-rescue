import { createPortal } from 'preact/compat';
import { VNode, ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';

interface PortalProps {
  children: ComponentChildren;
}

const Portal = ({ children }: PortalProps): VNode | null => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Devuelve una función de limpieza para cuando el componente se desmonte
    return () => setMounted(false);
  }, []);

  // Si el componente está montado en el cliente (no en el servidor),
  // crea el portal hacia document.body. Si no, no renderices nada.
  return mounted
    ? createPortal(children, document.body)
    : null;
};

export default Portal;
