import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { resolveImage } from '../utils/imageResolver';
import styles from './FeaturedProjects.module.css';

gsap.registerPlugin(ScrollTrigger);

interface ProjectCard {
  id: string;
  title: string;
  subtitle: string;
  heroImage: string;
}

const FeaturedProjects: React.FC = () => {
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Dynamic import for a few featured projects
    const featuredIds = ['havilah-studio', 'flash-bites', 'musica'];
    
    Promise.all(
      featuredIds.map(id => import(`../content/projects/${id}.json`).then(m => m.default))
    ).then((loadedProjects) => {
      setProjects(loadedProjects);
    });
  }, []);

  useEffect(() => {
    if (projects.length > 0 && containerRef.current) {
      const cards = containerRef.current.querySelectorAll(`.${styles.card}`);
      const headerElements = containerRef.current.querySelectorAll(`.${styles.header} > *`);
      
      gsap.fromTo(headerElements,
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          stagger: 0.2,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: containerRef.current,
            start: 'top 85%',
          }
        }
      );

      cards.forEach((card) => {
        gsap.fromTo(card,
          { opacity: 0, y: 50 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: card,
              start: 'top 85%',
            }
          }
        );
      });
    }
  }, [projects]);

  return (
    <section ref={containerRef} className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.heading}>Selected Work</h2>
        <Link to="/projects" className={styles.viewAll}>View All</Link>
      </div>

      <div className={styles.grid}>
        {projects.map((project, index) => (
          <Link key={project.id} to={`/projects/${project.id}`} className={`${styles.card} ${index % 2 !== 0 ? styles.reversed : ''}`}>
            <div className={styles.imageContent}>
              <div className={styles.imageWrapper}>
                <img src={resolveImage(project.heroImage)} alt={project.title} className={styles.image} loading="lazy" />
                <div className={styles.overlay}>
                  <span className={styles.exploreText}>View Case Study</span>
                </div>
              </div>
            </div>
            <div className={styles.textContent}>
              <div className={styles.projectNumber}>{(index + 1).toString().padStart(2, '0')}</div>
              <h3 className={styles.projectTitle}>{project.title}</h3>
              <p className={styles.projectSubtitle}>{project.subtitle}</p>
              <div className={styles.discoverBtn}>
                Explore Project <span className={styles.arrow}>→</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default FeaturedProjects;
