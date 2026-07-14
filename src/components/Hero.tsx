import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import styles from './Hero.module.css';
import heroImg from '../assets/image.png'
import mobileImg from '../assets/mobile.png'

gsap.registerPlugin(ScrollTrigger);

const Hero: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const tl = gsap.timeline();

    tl.fromTo(imgRef.current,
      { scale: 1.1, opacity: 0 },
      { scale: 1, opacity: 1, duration: 2, ease: 'power3.out' }
    )
    .fromTo(textRef.current, 
      { opacity: 0, y: 50 }, 
      { opacity: 1, y: 0, duration: 1.5, ease: 'power4.out' },
      "-=1.5"
    )
    .fromTo(subRef.current,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 1, ease: 'power3.out' },
      "-=1"
    );

    // Continuous slow zoom for the image to prevent it from being "still"
    gsap.to(imgRef.current, {
      scale: 1.05,
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
          <img ref={imgRef} src={heroImg} alt="Robinson J" className={styles.media} loading="eager" decoding="sync" />
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
