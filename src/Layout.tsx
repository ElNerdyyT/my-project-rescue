import { FunctionalComponent } from 'preact';
import './css/Layout.css';

const Layout: FunctionalComponent = ({ children }) => {
  return (
    <div className="layout-container">
        <div className="content-wrapper container-fluid">
          {children}
        </div>
    </div>
  );
};

export default Layout;
