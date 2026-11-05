import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, Navigate, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { updateMetaTags } from '../utils/seo';
import styles from './WebStoryViewer.module.css';

const storyModules = import.meta.glob('../content/stories/*.json', { eager: true, import: 'default' });

interface StorySlide {
  id: number;
  tag: string;
  heading: string;
  text: string;
  image: string;
  link?: string;
  linkText?: string;
}

interface WebStoryData {
  slug: string;
  title: string;
  subtitle: string;
  date: string;
  posterImage: string;
  slides: StorySlide[];
}

const SLIDE_DURATION_MS = 6000;

const WebStoryViewer: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const allStories = Object.values(storyModules) as WebStoryData[];
  const story = allStories.find((s) => s.slug === slug);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const totalSlides = story ? story.slides.length : 0;

  // SEO setup
  useEffect(() => {
    if (story) {
      updateMetaTags({
        title: `${story.title} - Visual Story | Robinson J.`,
        description: story.subtitle,
        canonicalPath: `/stories/${story.slug}`,
        keywords: 'web story, visual storytelling, google discover, creative technologist, cinematography',
        ogImage: story.posterImage,
        schema: {
          '@context': 'https://schema.org',
          '@type': 'MediaObject',
          name: story.title,
          description: story.subtitle,
          thumbnailUrl: story.posterImage,
          uploadDate: story.date,
          author: {
            '@type': 'Person',
            name: 'Robinson J.',
          },
        },
      });
    }
  }, [story]);

  // Next & Previous Handlers
  const handleNext = useCallback(() => {
    if (currentIndex < totalSlides - 1) {
      setCurrentIndex((prev) => prev + 1);
      setProgress(0);
    } else {
      navigate('/stories');
    }
  }, [currentIndex, totalSlides, navigate]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setProgress(0);
    }
  }, [currentIndex]);

  // Automatic slide progress ticker
  useEffect(() => {
    setProgress(0);
    const interval = 50; // update every 50ms
    const step = 100 / (SLIDE_DURATION_MS / interval);

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          handleNext();
          return 0;
        }
        return prev + step;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [currentIndex, handleNext]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Space') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'Escape') {
        navigate('/stories');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, navigate]);

  if (!story) {
    return <Navigate to="/stories" replace />;
  }

  const currentSlide = story.slides[currentIndex];

  return (
    <div className={styles.storyViewer}>
      <div className={styles.storyFrame}>
        {/* Progress Bar Header */}
        <div className={styles.progressContainer}>
          {story.slides.map((_, idx) => (
            <div key={idx} className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{
                  width:
                    idx < currentIndex
                      ? '100%'
                      : idx === currentIndex
                      ? `${progress}%`
                      : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* Top Header bar with Publisher and Close */}
        <div className={styles.headerBar}>
          <div className={styles.publisherInfo}>
            <img src="/logo.jpg" alt="Robinson J." className={styles.publisherAvatar} />
            <span className={styles.publisherName}>Robinson J.</span>
          </div>
          <Link to="/stories" className={styles.closeButton} aria-label="Close story">
            ×
          </Link>
        </div>

        {/* Background Image with animation */}
        <AnimatePresence mode="wait">
          <motion.img
            key={currentSlide.id}
            src={currentSlide.image}
            alt={currentSlide.heading}
            className={styles.slideBackground}
            initial={{ opacity: 0.4 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0.2 }}
            transition={{ duration: 0.4 }}
          />
        </AnimatePresence>

        <div className={styles.vignette} />

        {/* Tap Zones for Left & Right Navigation */}
        <div className={styles.tapZones}>
          <div className={styles.tapLeft} onClick={handlePrev} title="Previous slide" />
          <div className={styles.tapRight} onClick={handleNext} title="Next slide" />
        </div>

        {/* Slide Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide.id}
            className={styles.slideContent}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <span className={styles.slideTag}>{currentSlide.tag}</span>
            <h1 className={styles.slideHeading}>{currentSlide.heading}</h1>
            <p className={styles.slideText}>{currentSlide.text}</p>
            {currentSlide.link && (
              <Link to={currentSlide.link} className={styles.ctaButton}>
                {currentSlide.linkText || 'Learn More'} →
              </Link>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default WebStoryViewer;

