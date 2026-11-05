import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { updateMetaTags } from '../utils/seo';
import styles from './WebStories.module.css';

const storyModules = import.meta.glob('../content/stories/*.json', { eager: true, import: 'default' });

interface StoryMeta {
  slug: string;
  title: string;
  subtitle: string;
  date: string;
  posterImage: string;
  slides: any[];
}

const WebStories: React.FC = () => {
  const stories: StoryMeta[] = Object.values(storyModules) as StoryMeta[];

  useEffect(() => {
    updateMetaTags({
      title: 'Visual Web Stories | Robinson J.',
      description: 'Interactive, full-screen visual Web Stories by Robinson J. Explore creative technology, cinematography principles, and sub-second web engineering in an immersive mobile-first format.',
      canonicalPath: '/stories',
      keywords: 'web stories, google discover, visual storytelling, creative technologist stories, cinematography guide, interactive web',
      schema: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Visual Web Stories by Robinson J.',
        url: 'https://robinsonj.vercel.app/stories',
        description: 'Interactive visual stories covering cinematography and engineering.',
      },
    });
  }, []);

  return (
    <motion.main
      className={styles.container}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <header className={styles.header}>
        <span className={styles.badge}>MOBILE-FIRST VISUAL STORIES</span>
        <h1 className={styles.title}>Visual Stories</h1>
        <p className={styles.subtitle}>
          Tap through immersive, bite-sized visual journeys exploring cinematography, motion design, and high-performance code.
        </p>
      </header>

      <section className={styles.grid}>
        {stories.map((story) => (
          <Link key={story.slug} to={`/stories/${story.slug}`} className={styles.storyCard}>
            <img
              src={story.posterImage}
              alt={story.title}
              className={styles.posterImage}
              loading="lazy"
              decoding="async"
              width="360"
              height="640"
            />
            <div className={styles.overlay} />
            <div className={styles.cardContent}>
              <div className={styles.playPill}>▶ Tap to View ({story.slides.length} slides)</div>
              <h2 className={styles.cardTitle}>{story.title}</h2>
              <p className={styles.cardSubtitle}>{story.subtitle}</p>
            </div>
          </Link>
        ))}
      </section>
    </motion.main>
  );
};

export default WebStories;

