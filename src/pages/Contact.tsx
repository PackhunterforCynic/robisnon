import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { updateMetaTags } from '../utils/seo';
import styles from './Contact.module.css';

const Contact: React.FC = () => {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    updateMetaTags({
      title: 'Contact Robinson J. | Hire Creative Technologist & Developer',
      description: 'Get in touch with Robinson J. for full-stack software development projects, creative technology consultations, commercial filmmaking, or freelance opportunities.',
      canonicalPath: '/contact',
      keywords: 'Contact Robinson J, hire software engineer, freelance creative technologist, cinematographer contact Bengaluru, hire React developer',
    });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      return;
    }

    setStatus('submitting');
    setErrorMessage('');

    try {
      const res = await fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'contact',
          isContactForm: true,
          name: formData.name.trim(),
          email: formData.email.trim(),
          message: formData.message.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setStatus('success');
        setFormData({ name: '', email: '', message: '' });
      } else {
        setStatus('error');
        setErrorMessage(data.error || 'Failed to dispatch message. Please email directly.');
      }
    } catch {
      setStatus('error');
      setErrorMessage('Network connection error. Please try again or reach out via email directly.');
    }
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
          {status === 'success' ? (
            <div className={styles.successState}>
              <div className={styles.successIcon}>✓</div>
              <h3>Message Dispatched!</h3>
              <p>Thank you for reaching out. Robinson has received your dispatch directly on Telegram and will reply within 24 hours.</p>
              <button type="button" onClick={() => setStatus('idle')} className={styles.resetBtn}>
                Send Another Message
              </button>
            </div>
          ) : (
            <form className={styles.form} onSubmit={handleSubmit}>
              {status === 'error' && (
                <div className={styles.errorBanner}>{errorMessage}</div>
              )}

              <div className={styles.inputGroup}>
                <label htmlFor="name">What's your name?</label>
                <input
                  type="text"
                  id="name"
                  required
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={handleChange}
                  disabled={status === 'submitting'}
                />
              </div>
              
              <div className={styles.inputGroup}>
                <label htmlFor="email">What's your email?</label>
                <input
                  type="email"
                  id="email"
                  required
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={status === 'submitting'}
                />
              </div>
              
              <div className={styles.inputGroup}>
                <label htmlFor="message">Tell me about your project or inquiry.</label>
                <textarea
                  id="message"
                  required
                  rows={5}
                  placeholder="Hello Robinson, I'd like to discuss..."
                  value={formData.message}
                  onChange={handleChange}
                  disabled={status === 'submitting'}
                ></textarea>
              </div>
              
              <button type="submit" disabled={status === 'submitting'} className={styles.submitBtn}>
                {status === 'submitting' ? 'Sending Dispatch...' : 'Send Message'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </button>
            </form>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default Contact;
