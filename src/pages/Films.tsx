import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import styles from './Films.module.css';

interface Film {
  id: string;
  title: string;
  category: string;
  heroImage: string;
  description: string;
  role: string;
  equipment: string[];
}

interface FilmsData {
  films: Film[];
}

const Films: React.FC = () => {
  const [data, setData] = useState<FilmsData | null>(null);

  useEffect(() => {
    import('../content/films.json').then((module) => {
      setData(module.default);
    });
  }, []);

  if (!data) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className={styles.container}
    >
      <header className={styles.header}>
        <h1 className={styles.title}>Films</h1>
        <p className={styles.subtitle}>Cinematic storytelling and motion pictures.</p>
      </header>

      <div className={styles.filmList}>
        {data.films.map((film) => (
          <div key={film.id} className={styles.filmCard}>
            <div className={styles.imageWrapper}>
              <img src={film.heroImage} alt={film.title} loading="lazy" />
              <button className={styles.playBtn}>
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 5v14l11-7z" fill="currentColor"/>
                </svg>
              </button>
            </div>
            
            <div className={styles.info}>
              <span className={styles.category}>{film.category}</span>
              <h2>{film.title}</h2>
              <p className={styles.description}>{film.description}</p>
              
              <div className={styles.meta}>
                <div>
                  <strong>Role</strong>
                  <span>{film.role}</span>
                </div>
                <div>
                  <strong>Equipment</strong>
                  <span>{film.equipment.join(', ')}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default Films;
