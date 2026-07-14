import React, { useState } from 'react';
import { motion } from 'framer-motion';
import styles from './Contact.module.css';

const Contact: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [phoneError, setPhoneError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate phone number: allows optional + and digits/spaces/hyphens
    const cleanedPhone = phone.replace(/[\s-]/g, '');
    const phoneRegex = /^[\+]?[0-9]{10,15}$/;
    
    if (!phoneRegex.test(cleanedPhone)) {
      setPhoneError("Please enter a valid phone number (10-15 digits)");
      return;
    }
    
    setPhoneError('');
    
    // Connect form to a service like Formspree, EmailJS, or backend API here
    alert("Form validated successfully! Connect it to your backend service.");
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
              <input 
                type="text" 
                id="name" 
                required 
                placeholder="John Doe" 
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            
            <div className={styles.inputGroup}>
              <label htmlFor="email">What's your email?</label>
              <input 
                type="email" 
                id="email" 
                required 
                placeholder="john@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="phone">What's your phone number?</label>
              <input 
                type="tel" 
                id="phone" 
                required 
                placeholder="+91 9999999999" 
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              {phoneError && <span className={styles.errorText}>{phoneError}</span>}
            </div>
            
            <div className={styles.inputGroup}>
              <label htmlFor="message">Tell me about your project or inquiry.</label>
              <textarea 
                id="message" 
                required 
                rows={4} 
                placeholder="Hello Robinson, I'd like to discuss..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              ></textarea>
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
