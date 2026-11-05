import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import styles from './Hero.module.css';
import heroImg from '../assets/image.webp'
import mobileImg from '../assets/mobile.webp'

gsap.registerPlugin(ScrollTrigger);

const Hero: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const tl = gsap.timeline();

    tl.fromTo(imgRef.current,
      { scale: 1.08 },
      { scale: 1, duration: 1.6, ease: 'power2.out' }
    )
    .fromTo(textRef.current, 
      { y: 20, opacity: 0.8 }, 
      { y: 0, opacity: 1, duration: 1.2, ease: 'power3.out' },
      "-=1.2"
    )
    .fromTo(subRef.current,
      { y: 10, opacity: 0.8 },
      { y: 0, opacity: 1, duration: 0.8, ease: 'power2.out' },
      "-=0.8"
    );

    // Continuous slow zoom for the image to prevent it from being "still"
    gsap.to(imgRef.current, {
      scale: 1.04,
      duration: 10,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1
    });

    // Parallax effect on scroll
    gsap.to(containerRef.current, {
      yPercent: 30,
      ease: 'none',
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
      }
    });

    return () => {
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, []);

  return (
    <section ref={containerRef} className={styles.heroContainer}>
      <div className={styles.overlay}></div>
      <div className={styles.videoPlaceholder}>
        <picture>
          <source media="(max-width: 768px)" srcSet={mobileImg} />
          <img 
            ref={imgRef} 
            src={heroImg} 
            alt="Robinson J" 
            className={styles.media} 
            fetchPriority="high" 
            loading="eager" 
            decoding="async" 
            width="1920"
            height="1080"
          />
        </picture>
      </div>
      
      <div className={styles.content}>
        <h1 ref={textRef} className={styles.title}>ROBINSON J.</h1>
        <p ref={subRef} className={styles.subtitle}>Cinematographer • Software Developer • Visual Storyteller</p>
      </div>
    </section>
  );
};

export default Hero;
