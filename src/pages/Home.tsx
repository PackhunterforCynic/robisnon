import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Hero from '../components/Hero';
import AboutSection from '../components/AboutSection';
import FeaturedProjects from '../components/FeaturedProjects';
import SkillsSection from '../components/SkillsSection';

gsap.registerPlugin(ScrollTrigger);

const Home: React.FC = () => {
  const contactRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contactRef.current) {
      const elements = contactRef.current.children;
      gsap.fromTo(elements,
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          stagger: 0.2,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: contactRef.current,
            start: 'top 90%',
          }
        }
      );
    }
  }, []);

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
        <section ref={contactRef} style={{ padding: '6rem 2rem', textAlign: 'center', backgroundColor: 'var(--bg-surface)' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', color: 'var(--accent-gold)', marginBottom: '1.5rem', fontSize: 'clamp(2rem, 4vw, 3rem)' }}>Ready to create something amazing?</h2>
          <a href="mailto:robinsonj16506@gmail.com" style={{ display: 'inline-block', padding: '12px 32px', border: '1px solid var(--accent-gold)', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.1em', borderRadius: '30px', textDecoration: 'none', transition: 'background-color 0.3s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>Get in touch</a>
        </section>
      </main>
    </motion.div>
  );
};

export default Home;
