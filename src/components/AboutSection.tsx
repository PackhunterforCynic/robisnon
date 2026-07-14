import React, { useEffect, useState, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import styles from './AboutSection.module.css';

gsap.registerPlugin(ScrollTrigger);

interface AboutData {
  name: string;
  roles: string[];
  bio: string;
  about: string[];
}

const AboutSection: React.FC = () => {
  const [data, setData] = useState<AboutData | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    import('../content/about.json').then((module) => {
      setData(module.default);
    });
  }, []);

  useEffect(() => {
    if (data && textRef.current) {
      const elements = containerRef.current.querySelectorAll(`.${styles.heading}, .${styles.bio}, .${styles.roles}, .${styles.narrative} p`);
      
      gsap.fromTo(elements, 
        { opacity: 0, y: 30 },
        {
          opacity: 1, 
          y: 0, 
          duration: 1, 
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
    <section ref={containerRef} className={styles.aboutSection}>
      <div className={styles.container}>
        <h2 className={styles.heading}>Who is {data.name.split(' ')[0]}</h2>
        <div ref={textRef} className={styles.content}>
          <h3 className={styles.bio}>{data.bio}</h3>
          <div className={styles.roles}>
            {data.roles.map((role, idx) => (
              <span key={idx} className={styles.roleTag}>{role}</span>
            ))}
          </div>
          <div className={styles.narrative}>
            {data.about.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
