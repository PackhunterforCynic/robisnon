import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { updateMetaTags } from '../utils/seo';
import styles from './Blog.module.css';

// Import all blog files using Vite's glob import
const blogModules = import.meta.glob('../content/blogs/*.json', { eager: true, import: 'default' });

interface BlogPostMeta {
  slug: string;
  title: string;
  subtitle: string;
  date: string;
  readTime: string;
  category: string;
  author: string;
  heroImage: string;
  excerpt: string;
  keywords: string;
}

const Blog: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const posts: BlogPostMeta[] = Object.values(blogModules) as BlogPostMeta[];

  // SEO setup
  useEffect(() => {
    updateMetaTags({
      title: 'Blog & Technical Articles | Robinson J.',
      description: 'In-depth articles on Creative Technology, React performance, GSAP motion design, sub-second web architectures, and brand cinematography by Robinson J.',
      canonicalPath: '/blog',
      keywords: 'Robinson J blog, creative technologist articles, react performance, web development blog, cinematography storytelling, technical seo',
      schema: {
        '@context': 'https://schema.org',
        '@type': 'Blog',
        name: 'Robinson J. Engineering & Cinematography Blog',
        url: 'https://robinsonj.vercel.app/blog',
        description: 'Deep dives on creative technology, frontend engineering, and cinematography by Robinson J.',
        publisher: {
          '@type': 'Person',
          name: 'Robinson J.',
        },
      },
    });
  }, []);

  const categories = ['All', ...Array.from(new Set(posts.map((p) => p.category)))];

  const filteredPosts =
    selectedCategory === 'All'
      ? posts
      : posts.filter((p) => p.category === selectedCategory);

  return (
    <motion.main
      className={styles.container}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <header className={styles.header}>
        <span className={styles.tag}>THOUGHTS & DEEP DIVES</span>
        <h1 className={styles.title}>Articles & Insights</h1>
        <p className={styles.subtitle}>
          Exploring the intersection of high-performance software engineering, modern visual design, and cinematic storytelling.
        </p>
      </header>

      {/* Category Filter Pills */}
      <nav className={styles.filterBar} aria-label="Blog categories">
        {categories.map((cat) => (
          <button
            key={cat}
            className={`${styles.filterBtn} ${selectedCategory === cat ? styles.filterBtnActive : ''}`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </nav>

      {/* Blog Grid */}
      <section className={styles.grid}>
        {filteredPosts.map((post) => (
          <Link key={post.slug} to={`/blog/${post.slug}`} className={styles.card}>
            <div className={styles.imageWrapper}>
              <img
                src={post.heroImage}
                alt={post.title}
                className={styles.image}
                loading="lazy"
                decoding="async"
                width="640"
                height="360"
              />
            </div>
            <div className={styles.cardContent}>
              <div className={styles.metaRow}>
                <span className={styles.category}>{post.category}</span>
                <span>{post.readTime}</span>
              </div>
              <h2 className={styles.cardTitle}>{post.title}</h2>
              <p className={styles.excerpt}>{post.excerpt}</p>
              <div className={styles.readMore}>
                Read Article <span>→</span>
              </div>
            </div>
          </Link>
        ))}
      </section>
    </motion.main>
  );
};

export default Blog;

