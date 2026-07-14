import React from 'react';
import { motion } from 'framer-motion';
import styles from './Contact.module.css';

const Contact: React.FC = () => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Connect form to a service like Formspree, EmailJS, or backend API here
    alert("This form is currently a template. Connect it to your backend service!");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className={styles.container}
    >
      <div className={styles.wrapper}>
        <div className={styles.infoColumn}>
          <h1 className={styles.title}>Let's create something extraordinary.</h1>
          <p className={styles.subtitle}>Open for collaborations, freelance opportunities, and exciting software engineering roles.</p>
          
          <div className={styles.contactDetails}>
            <a href="mailto:robinson.mca2025@gmail.com" className={styles.contactLink}>
              <span>Email</span>
              robinson.mca2025@gmail.com
            </a>
            <a href="tel:+918861368758" className={styles.contactLink}>
              <span>Phone</span>
              +91 8861368758
            </a>
            <a href="https://linkedin.com/in/robinson-mj" target="_blank" rel="noopener noreferrer" className={styles.contactLink}>
              <span>LinkedIn</span>
              linkedin.com/in/robinson-mj
            </a>
            <p className={styles.contactLink}>
              <span>Location</span>
              Bengaluru, Karnataka
            </p>
          </div>
        </div>

        <div className={styles.formColumn}>
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.inputGroup}>
              <label htmlFor="name">What's your name?</label>
              <input type="text" id="name" required placeholder="John Doe" />
            </div>
            
            <div className={styles.inputGroup}>
              <label htmlFor="email">What's your email?</label>
              <input type="email" id="email" required placeholder="john@example.com" />
            </div>
            
            <div className={styles.inputGroup}>
              <label htmlFor="message">Tell me about your project or inquiry.</label>
              <textarea id="message" required rows={5} placeholder="Hello Robinson, I'd like to discuss..."></textarea>
            </div>
            
            <button type="submit" className={styles.submitBtn}>
              Send Message
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
          </form>
        </div>
      </div>
    </motion.div>
  );
};

export default Contact;
