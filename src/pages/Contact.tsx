import React from 'react';
import { motion } from 'framer-motion';
import ContactForm from '../components/ContactForm';
import styles from './Contact.module.css';

const Contact: React.FC = () => {
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
          <ContactForm />
        </div>
      </div>
    </motion.div>
  );
};

export default Contact;
