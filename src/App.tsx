import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { SmoothScrollProvider } from './contexts/SmoothScrollContext';
import { AnimatePresence } from 'framer-motion';
import Navigation from './components/Navigation';
import WhatsAppFab from './components/WhatsAppFab';

// Lazy load pages for performance
const Home = lazy(() => import('./pages/Home'));
const Projects = lazy(() => import('./pages/Projects'));
const ProjectDetails = lazy(() => import('./pages/ProjectDetails'));
const About = lazy(() => import('./pages/About'));
const Skills = lazy(() => import('./pages/Skills'));

const App: React.FC = () => {
  return (
    <SmoothScrollProvider>
      <Router>
        <Navigation />
        <Suspense fallback={<div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>Loading...</div>}>
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route path="/skills" element={<Skills />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:id" element={<ProjectDetails />} />
            </Routes>
          </AnimatePresence>
        </Suspense>
        <WhatsAppFab />
      </Router>
    </SmoothScrollProvider>
  );
};

export default App;
