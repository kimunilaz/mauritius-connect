import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import AppErrorBoundary from './components/common/AppErrorBoundary.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import './palette.css';
import './styles.css';
import './workspace.css';
import './readiness.css';
import './brand.css';
import './public-navigation.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  </StrictMode>,
);
