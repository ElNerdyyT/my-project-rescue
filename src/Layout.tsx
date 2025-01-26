import { FunctionalComponent } from 'preact';
import Menu from './components/Menu';
import './css/Layout.css';

const Layout: FunctionalComponent = ({ children }) => {
  return (
    <div className="layout-container">
      <Menu>
        <div className="content-wrapper container-fluid">
          {children}
        </div>
      </Menu>
    </div>
  );
};

export default Layout;
