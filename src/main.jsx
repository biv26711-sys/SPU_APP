import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './components/ThemeProvider'

const hideLoading = () => {
  const loadingElement = document.getElementById('loading');
  if (loadingElement) {
    loadingElement.style.display = 'none';
  }
};

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>
);

hideLoading();
