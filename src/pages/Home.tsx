import React from 'react';
import { motion } from 'framer-motion';
import Hero from '../components/Hero';
import AboutSection from '../components/AboutSection';
import FeaturedProjects from '../components/FeaturedProjects';
import SkillsSection from '../components/SkillsSection';

const Home: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      <main>
        <Hero />
        <AboutSection />
        <FeaturedProjects />
        <SkillsSection />
        
        {/* Footer / Contact placeholder for future */}
        <section style={{ padding: '4rem 2rem', textAlign: 'center', backgroundColor: 'var(--bg-surface)' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', color: 'var(--accent-gold)', marginBottom: '1rem' }}>Ready to create something amazing?</h2>
          <a href="mailto:robinsonj16506@gmail.com" style={{ textDecoration: 'underline', color: 'var(--text-primary)' }}>Get in touch</a>
        </section>
      </main>
    </motion.div>
  );
};

export default Home;
