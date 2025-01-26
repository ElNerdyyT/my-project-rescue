import { FunctionalComponent } from 'preact';
import '../css/global.css';

interface PageLayoutProps {
  title: string;
  description?: string;
}

const PageLayout: FunctionalComponent<PageLayoutProps> = ({ title, description, children }) => {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      
      <div className="page-content">
        {children}
      </div>
    </div>
  );
};

export default PageLayout;
