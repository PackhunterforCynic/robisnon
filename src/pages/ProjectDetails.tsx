import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import styles from './ProjectDetails.module.css';

gsap.registerPlugin(ScrollTrigger);

interface ProjectData {
  id: string;
  title: string;
  subtitle: string;
  heroImage: string;
  overview: string;
  roles: string[];
  techStack: string[];
  highlights: string[];
  story: Array<{ section: string; content: string; media: string | null }>;
}

const ProjectDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectData | null>(null);
  
  const heroRef = useRef<HTMLDivElement>(null);
  const heroImageRef = useRef<HTMLImageElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const storyRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    // Dynamic import based on project ID
    import(`../content/projects/${id}.json`)
      .then((module) => {
        setProject(module.default);
      })
      .catch((err) => {
        console.error("Project not found:", err);
      });
  }, [id]);

  useEffect(() => {
    if (!project) return;

    // Hero Parallax & Title Reveal
    if (heroRef.current && heroImageRef.current && titleRef.current) {
      gsap.fromTo(titleRef.current,
        { opacity: 0, y: 100 },
        { opacity: 1, y: 0, duration: 1.5, ease: 'power4.out', delay: 0.2 }
      );

      gsap.to(heroImageRef.current, {
        yPercent: 30,
        ease: 'none',
        scrollTrigger: {
          trigger: heroRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: true
        }
      });
    }

    // Story Parallax & Fades
    storyRefs.current.forEach((el) => {
      if (el) {
        gsap.fromTo(el,
          { opacity: 0, y: 100 },
          {
            opacity: 1,
            y: 0,
            duration: 1,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: el,
              start: 'top 85%',
            }
          }
        );
      }
    });
    
    // Refresh scroll trigger after rendering
    setTimeout(() => ScrollTrigger.refresh(), 100);

    return () => {
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, [project]);

  if (!project) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className={styles.container}
    >
      <div className={styles.backNav}>
        <Link to="/projects">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Projects
        </Link>
      </div>

      {/* 100vh Parallax Hero */}
      <section ref={heroRef} className={styles.hero}>
        <div className={styles.heroImageContainer}>
          <img ref={heroImageRef} src={project.heroImage} alt={project.title} className={styles.heroImage} />
          <div className={styles.heroOverlay}></div>
        </div>
        <div className={styles.heroContent}>
          <h1 ref={titleRef} className={styles.title}>{project.title}</h1>
          <p className={styles.subtitle}>{project.subtitle}</p>
        </div>
      </section>

      {/* Main Content */}
      <div ref={contentRef} className={styles.content}>
        
        {/* Editorial Overview Block */}
        <section className={styles.overviewSection}>
          <div className={styles.overviewGrid}>
            <div className={styles.mainOverview}>
              <h2>Overview</h2>
              <p>{project.overview}</p>
            </div>
            <div className={styles.metaData}>
              <div className={styles.metaBlock}>
                <h3>Roles</h3>
                <ul>{project.roles.map((r, i) => <li key={i}>{r}</li>)}</ul>
              </div>
              <div className={styles.metaBlock}>
                <h3>Tech Stack</h3>
                <ul>{project.techStack.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </div>
            </div>
          </div>
        </section>

        {/* Bento Box Highlights */}
        {project.highlights && project.highlights.length > 0 && (
          <section className={styles.highlightsSection}>
            <h2>Key Highlights</h2>
            <div className={styles.bentoGrid}>
              {project.highlights.map((highlight, idx) => (
                <div key={idx} className={styles.bentoItem}>
                  <span>{highlight}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Cinematic Storytelling */}
        {project.story && project.story.length > 0 && (
          <section className={styles.storySection}>
            {project.story.map((block, index) => (
              <div 
                key={index} 
                className={`${styles.storyBlock} ${index % 2 !== 0 ? styles.storyBlockReverse : ''}`}
                ref={el => storyRefs.current[index] = el}
              >
                {block.media ? (
                  <>
                    <div className={styles.storyMedia}>
                      <img src={block.media} alt={block.section} loading="lazy" />
                    </div>
                    <div className={styles.storyText}>
                      <h2>{block.section}</h2>
                      <p>{block.content}</p>
                    </div>
                  </>
                ) : (
                  <div className={styles.storyTextFull}>
                    <h2>{block.section}</h2>
                    <p>{block.content}</p>
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        <section className={styles.nextProject}>
          <Link to="/projects" className={styles.nextLink}>
            <h2>Explore More Projects</h2>
          </Link>
        </section>
      </div>
    </motion.div>
  );
};

export default ProjectDetails;
