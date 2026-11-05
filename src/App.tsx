import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SmoothScrollProvider } from './contexts/SmoothScrollContext';
import { AnimatePresence } from 'framer-motion';
import Navigation from './components/Navigation';
import WhatsAppFab from './components/WhatsAppFab';
import { usePageTracking } from './utils/tracker';

// Route tracking component inside Router
const RouteTracker: React.FC = () => {
  usePageTracking();
  return null;
};

// Lazy load pages for maximum performance and code-splitting
const Home = lazy(() => import('./pages/Home'));
const Projects = lazy(() => import('./pages/Projects'));
const ProjectDetails = lazy(() => import('./pages/ProjectDetails'));
const About = lazy(() => import('./pages/About'));
const Skills = lazy(() => import('./pages/Skills'));
const Contact = lazy(() => import('./pages/Contact'));
const Films = lazy(() => import('./pages/Films'));
const Photography = lazy(() => import('./pages/Photography'));
const Blog = lazy(() => import('./pages/Blog'));
const BlogPost = lazy(() => import('./pages/BlogPost'));
const WebStories = lazy(() => import('./pages/WebStories'));
const WebStoryViewer = lazy(() => import('./pages/WebStoryViewer'));

const App: React.FC = () => {
  return (
    <SmoothScrollProvider>
      <Router>
        <RouteTracker />
        <Navigation />
        <Suspense fallback={<div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>Loading...</div>}>
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route path="/skills" element={<Skills />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:id" element={<ProjectDetails />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/films" element={<Films />} />
              <Route path="/photography" element={<Photography />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="/stories" element={<WebStories />} />
              <Route path="/stories/:slug" element={<WebStoryViewer />} />
              {/* Canonical fallback: redirect unknown paths to home to prevent duplicate 404 crawl waste */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AnimatePresence>
        </Suspense>
        <WhatsAppFab />
      </Router>
    </SmoothScrollProvider>
  );
};

export default App;
