import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './index.css';
import { ModelProvider } from '@/state/ModelContext';
import AppShell from '@/components/AppShell';
import Plan from '@/pages/Plan';
import Home from '@/pages/Home';
import Ask from '@/pages/Ask';
import Reports from '@/pages/Reports';
import Admin from '@/pages/Admin';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ModelProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<Home />} />
            <Route path="/plan" element={<Plan />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/ask" element={<Ask />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ModelProvider>
  </React.StrictMode>,
);
