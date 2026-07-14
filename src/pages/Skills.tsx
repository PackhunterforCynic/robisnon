import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import styles from './Skills.module.css';

gsap.registerPlugin(ScrollTrigger);

interface SkillCategory {
  name: string;
  items: string[];
}

interface SkillsData {
  categories: SkillCategory[];
}

// Helper component for animated SVG icons
const AnimatedSkillIcon: React.FC<{ skillName: string }> = ({ skillName }) => {
  const name = skillName.toLowerCase();
  
  if (name.includes('react')) {
    // Atom icon for React
    return (
      <svg viewBox="0 0 24 24" className={styles.skillIcon}>
        <motion.ellipse cx="12" cy="12" rx="10" ry="4" stroke="currentColor" fill="none" strokeWidth="1.5"
          initial={{ pathLength: 0, rotate: 0 }}
          animate={{ pathLength: 1, rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        />
        <motion.ellipse cx="12" cy="12" rx="10" ry="4" stroke="currentColor" fill="none" strokeWidth="1.5"
          initial={{ pathLength: 0, rotate: 60 }}
          animate={{ pathLength: 1, rotate: 420 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        />
        <motion.ellipse cx="12" cy="12" rx="10" ry="4" stroke="currentColor" fill="none" strokeWidth="1.5"
          initial={{ pathLength: 0, rotate: 120 }}
          animate={{ pathLength: 1, rotate: 480 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
      </svg>
    );
  } else if (name.includes('data structure') || name.includes('algorithm')) {
    // Network/Tree for Data Structures
    return (
      <svg viewBox="0 0 24 24" className={styles.skillIcon}>
        <motion.path d="M12 3v6m0 0l-5 4m5-4l5 4m-5 4v4m-5-8v8m10-8v8" stroke="currentColor" fill="none" strokeWidth="1.5"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          transition={{ duration: 2, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
        />
        <circle cx="12" cy="3" r="2" fill="currentColor" />
        <circle cx="12" cy="9" r="2" fill="currentColor" />
        <circle cx="7" cy="13" r="2" fill="currentColor" />
        <circle cx="17" cy="13" r="2" fill="currentColor" />
        <circle cx="7" cy="21" r="2" fill="currentColor" />
        <circle cx="17" cy="21" r="2" fill="currentColor" />
      </svg>
    );
  } else if (name.includes('python') || name.includes('javascript') || name.includes('php') || name.includes('java')) {
    // Code Brackets for Languages
    return (
      <svg viewBox="0 0 24 24" className={styles.skillIcon}>
        <motion.path d="M8 6L2 12l6 6M16 6l6 6-6 6M14 4l-4 16" stroke="currentColor" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0.5 }}
          whileInView={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.5, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
        />
      </svg>
    );
  } else if (name.includes('database') || name.includes('sql') || name.includes('mongo')) {
    // Stacked Disks for Database
    return (
      <svg viewBox="0 0 24 24" className={styles.skillIcon}>
        <motion.path d="M12 5c-4.418 0-8 1.343-8 3s3.582 3 8 3 8-1.343 8-3-3.582-3-8-3zM4 8v4c0 1.657 3.582 3 8 3s8-1.343 8-3V8M4 12v4c0 1.657 3.582 3 8 3s8-1.343 8-3v-4" stroke="currentColor" fill="none" strokeWidth="1.5"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 1, ease: "easeInOut" }}
        />
      </svg>
    );
  } else if (name.includes('git') || name.includes('ci/cd')) {
    // Git Branch for systems
    return (
      <svg viewBox="0 0 24 24" className={styles.skillIcon}>
        <motion.path d="M6 3v18M18 9v6M6 15c4.418 0 8-3.582 8-8v-2" stroke="currentColor" fill="none" strokeWidth="1.5" strokeLinecap="round"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          transition={{ duration: 1.5, repeat: Infinity, repeatType: "reverse" }}
        />
        <circle cx="6" cy="6" r="2" fill="currentColor" />
        <circle cx="6" cy="18" r="2" fill="currentColor" />
        <circle cx="18" cy="9" r="2" fill="currentColor" />
      </svg>
    );
  } else if (name.includes('testing') || name.includes('postman')) {
    // Shield/Check for Testing
    return (
      <svg viewBox="0 0 24 24" className={styles.skillIcon}>
        <motion.path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />
        <motion.path d="M9 12l2 2 4-4" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          whileInView={{ pathLength: 1, opacity: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
        />
      </svg>
    );
  } else if (name.includes('adobe') || name.includes('design') || name.includes('editing')) {
    // Pen tool / Bezier curve for creative
    return (
      <svg viewBox="0 0 24 24" className={styles.skillIcon}>
        <motion.path d="M12 19l7-7 3 3-7 7-3-3zM18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5zM2 2l7.586 7.586" stroke="currentColor" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          transition={{ duration: 2, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
        />
      </svg>
    );
  }

  // Default tech icon (cube/package)
  return (
    <svg viewBox="0 0 24 24" className={styles.skillIcon}>
      <motion.path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="currentColor" fill="none" strokeWidth="1.5" strokeLinejoin="round"
        initial={{ pathLength: 0, rotate: -30 }}
        whileHover={{ pathLength: 1, rotate: 0 }}
        whileInView={{ pathLength: 1, rotate: 0 }}
        transition={{ duration: 1 }}
      />
      <motion.path d="M3.27 6.96L12 12.01l8.73-5.05M12 12.01v10.95" stroke="currentColor" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        transition={{ duration: 1.5 }}
      />
    </svg>
  );
};

const Skills: React.FC = () => {
  const [data, setData] = useState<SkillsData | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "Skills | Robinson J.";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', "A comprehensive overview of languages, frameworks, and tools used by Robinson J. to build robust software.");
    }

    import('../content/skills.json').then((module) => {
      setData(module.default);
    });
  }, []);

  useEffect(() => {
    if (data && containerRef.current) {
      const categories = containerRef.current.querySelectorAll(`.${styles.category}`);
      
      gsap.fromTo(categories,
        { opacity: 0, y: 50 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          stagger: 0.15,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: containerRef.current,
            start: 'top 80%',
          }
        }
      );
    }
  }, [data]);

  if (!data) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className={styles.container}
      ref={containerRef}
    >
      <header className={styles.header}>
        <h1 className={styles.title}>Technical Arsenal</h1>
        <p className={styles.subtitle}>A comprehensive overview of languages, frameworks, and tools used to build robust software.</p>
      </header>

      <div className={styles.grid}>
        {data.categories.map((cat, idx) => (
          <div key={idx} className={styles.category}>
            <h3>{cat.name}</h3>
            <ul>
              {cat.items.map((item, i) => (
                <li key={i}>
                  <AnimatedSkillIcon skillName={item} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default Skills;
