import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './index.css';
import { ModelProvider } from '@/state/ModelContext';
import AppShell from '@/components/AppShell';
import Plan from '@/pages/Plan';
import Home from '@/pages/Home';

const Placeholder = ({ title }: { title: string }) => (
  <div><div className="eyebrow">{title}</div><h1 className="text-xl font-semibold mt-1">{title}</h1></div>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ModelProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<Home />} />
            <Route path="/plan" element={<Plan />} />
            <Route path="/reports" element={<Placeholder title="Reports" />} />
            <Route path="/admin" element={<Placeholder title="Admin" />} />
            <Route path="/ask" element={<Placeholder title="Ask" />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ModelProvider>
  </React.StrictMode>,
);
