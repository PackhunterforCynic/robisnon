import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import styles from './Projects.module.css';

interface ProjectPreview {
  id: string;
  title: string;
  subtitle: string;
  heroImage: string;
}

const Projects: React.FC = () => {
  const [projects, setProjects] = useState<ProjectPreview[]>([]);

  useEffect(() => {
    // Vite's import.meta.glob allows us to fetch all JSON files in the folder
    const modules = import.meta.glob('../content/projects/*.json');
    const loadProjects = async () => {
      const loaded: ProjectPreview[] = [];
      for (const path in modules) {
        const mod = await modules[path]() as { default: ProjectPreview };
        const data = mod.default;
        if (!['amazon-affiliate', 'jj-enterprises', 'personal-portfolio', 'hse-digital'].includes(data.id)) {
          loaded.push(data);
        }
      }
      setProjects(loaded);
    };
    
    loadProjects();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className={styles.container}
    >
      <header className={styles.header}>
        <h1 className={styles.title}>All Projects</h1>
        <p className={styles.subtitle}>A complete archive of software engineering and creative technology works.</p>
      </header>

      <div className={styles.grid}>
        {projects.map((project) => (
          <Link key={project.id} to={`/projects/${project.id}`} className={styles.card}>
            <div className={styles.imageWrapper}>
              <img src={project.heroImage} alt={project.title} loading="lazy" />
              <div className={styles.overlay}>
                <span>View Case Study</span>
              </div>
            </div>
            <div className={styles.info}>
              <h2>{project.title}</h2>
              <p>{project.subtitle}</p>
            </div>
          </Link>
        ))}
      </div>
    </motion.div>
  );
};

export default Projects;
