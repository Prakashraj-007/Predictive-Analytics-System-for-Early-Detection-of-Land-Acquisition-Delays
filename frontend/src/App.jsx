import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import AppRoutes from './routes';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1E1611',
              color: '#F4D9A0',
              border: '1px solid rgba(244, 217, 160, 0.28)',
              borderRadius: '8px',
              fontSize: '12px',
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.6)',
            },
            success: {
              iconTheme: {
                primary: '#86EFAC',
                secondary: '#152B1E',
              },
            },
            error: {
              iconTheme: {
                primary: '#F87171',
                secondary: '#331411',
              },
            },
          }}
        />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

