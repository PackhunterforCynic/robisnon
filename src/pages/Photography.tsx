import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import styles from './Photography.module.css';

interface Photo {
  id: string;
  url: string;
  category: string;
  caption: string;
  aspectRatio: string;
}

interface PhotographyData {
  categories: string[];
  photos: Photo[];
}

const Photography: React.FC = () => {
  const [data, setData] = useState<PhotographyData | null>(null);
  const [activeFilter, setActiveFilter] = useState('All');

  useEffect(() => {
    import('../content/photography.json').then((module) => {
      setData(module.default);
    });
  }, []);

  if (!data) return null;

  const filteredPhotos = activeFilter === 'All' 
    ? data.photos 
    : data.photos.filter(p => p.category === activeFilter);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className={styles.container}
    >
      <header className={styles.header}>
        <h1 className={styles.title}>Photography</h1>
        <p className={styles.subtitle}>A collection of cinematic moments captured through the lens.</p>
        
        <div className={styles.filters}>
          {data.categories.map(cat => (
            <button 
              key={cat} 
              className={`${styles.filterBtn} ${activeFilter === cat ? styles.active : ''}`}
              onClick={() => setActiveFilter(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      <div className={styles.gallery}>
        {filteredPhotos.map((photo) => (
          <div key={photo.id} className={styles.photoWrapper} style={{ aspectRatio: photo.aspectRatio }}>
            <img src={photo.url} alt={photo.caption} loading="lazy" />
            <div className={styles.overlay}>
              <span>{photo.caption}</span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default Photography;
