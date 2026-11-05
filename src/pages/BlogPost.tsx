import React, { useEffect } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { updateMetaTags } from '../utils/seo';
import styles from './BlogPost.module.css';

const blogModules = import.meta.glob('../content/blogs/*.json', { eager: true, import: 'default' });

interface BlogContentBlock {
  type: 'paragraph' | 'heading' | 'code' | 'quote';
  text: string;
  language?: string;
}

interface BlogPostData {
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
  content: BlogContentBlock[];
}

const BlogPost: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  // Find article by matching slug
  const allPosts = Object.values(blogModules) as BlogPostData[];
  const post = allPosts.find((p) => p.slug === slug);

  useEffect(() => {
    if (post) {
      updateMetaTags({
        title: post.title,
        description: post.excerpt,
        canonicalPath: `/blog/${post.slug}`,
        keywords: post.keywords,
        ogImage: post.heroImage,
        ogType: 'article',
        publishedTime: post.date,
        author: post.author,
        schema: {
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          description: post.excerpt,
          image: post.heroImage,
          datePublished: post.date,
          dateModified: post.date,
          author: {
            '@type': 'Person',
            name: post.author,
            url: 'https://robinsonj.vercel.app',
          },
          publisher: {
            '@type': 'Organization',
            name: 'Robinson J. Studio',
            logo: {
              '@type': 'ImageObject',
              url: 'https://robinsonj.vercel.app/logo.jpg',
            },
          },
          mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': `https://robinsonj.vercel.app/blog/${post.slug}`,
          },
        },
      });
    }
  }, [post]);

  if (!post) {
    return <Navigate to="/blog" replace />;
  }

  return (
    <motion.article
      className={styles.articleContainer}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Link to="/blog" className={styles.backLink}>
        ← Back to all articles
      </Link>

      <header className={styles.header}>
        <span className={styles.categoryTag}>{post.category}</span>
        <h1 className={styles.title}>{post.title}</h1>
        <p className={styles.subtitle}>{post.subtitle}</p>

        <div className={styles.authorMeta}>
          <span className={styles.authorName}>{post.author}</span>
          <span className={styles.dot}>•</span>
          <time dateTime={post.date}>{new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</time>
          <span className={styles.dot}>•</span>
          <span>{post.readTime}</span>
        </div>
      </header>

      <div className={styles.heroImageWrapper}>
        <img
          src={post.heroImage}
          alt={post.title}
          className={styles.heroImage}
          loading="eager"
          decoding="async"
          width="1200"
          height="675"
        />
      </div>

      <div className={styles.contentBody}>
        {post.content.map((block, idx) => {
          switch (block.type) {
            case 'heading':
              return <h2 key={idx} className={styles.sectionHeading}>{block.text}</h2>;
            case 'code':
              return (
                <pre key={idx} className={styles.codeBlock}>
                  <code>{block.text}</code>
                </pre>
              );
            case 'quote':
              return <blockquote key={idx} className={styles.quoteBlock}>{block.text}</blockquote>;
            case 'paragraph':
            default:
              return <p key={idx} className={styles.paragraph}>{block.text}</p>;
          }
        })}
      </div>

      <footer className={styles.footerAuthorCard}>
        <img src="/logo.jpg" alt="Robinson J." className={styles.avatar} />
        <div>
          <div className={styles.authorBioTitle}>Written by Robinson J.</div>
          <div className={styles.authorBioText}>
            Creative Technologist, Software Developer, and Cinematographer. Specializing in high-performance web engineering, fluid motion design, and commercial visual storytelling.
          </div>
        </div>
      </footer>
    </motion.article>
  );
};

export default BlogPost;

