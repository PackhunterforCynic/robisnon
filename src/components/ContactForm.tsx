import React, { useState, useRef } from 'react';
import { validateEmail, validatePhone, sanitizeInput } from '../utils/validation';
import styles from './ContactForm.module.css';

interface FormState {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}

const initialFormState: FormState = {
  name: '',
  email: '',
  phone: '',
  subject: '',
  message: '',
};

const ContactForm: React.FC = () => {
  const [formData, setFormData] = useState<FormState>(initialFormState);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [validationErrors, setValidationErrors] = useState<Partial<FormState>>({});
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
    // Clear validation error when user types
    if (validationErrors[id as keyof FormState]) {
      setValidationErrors((prev) => ({ ...prev, [id]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const errors: Partial<FormState> = {};
    let isValid = true;

    if (!formData.name.trim()) {
      errors.name = 'Name is required';
      isValid = false;
    }
    if (!formData.subject.trim()) {
      errors.subject = 'Subject is required';
      isValid = false;
    }
    if (!validateEmail(formData.email)) {
      errors.email = 'Please enter a valid email address';
      isValid = false;
    }
    if (!validatePhone(formData.phone)) {
      errors.phone = 'Please enter a valid phone number (10-15 digits)';
      isValid = false;
    }
    if (!formData.message.trim()) {
      errors.message = 'Message cannot be empty';
      isValid = false;
    } else if (formData.message.length > 2000) {
      errors.message = 'Message must be under 2000 characters';
      isValid = false;
    }

    setValidationErrors(errors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setStatus('loading');
    setErrorMessage('');

    // Cancel previous request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();

    try {
      // Determine API URL based on environment (local Vite dev server vs production)
      const apiUrl = import.meta.env.DEV ? 'http://localhost:3000/api/contact' : '/api/contact';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: sanitizeInput(formData.name),
          email: sanitizeInput(formData.email),
          phone: sanitizeInput(formData.phone),
          subject: sanitizeInput(formData.subject),
          message: sanitizeInput(formData.message),
        }),
        signal: abortControllerRef.current.signal,
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStatus('success');
        setFormData(initialFormState); // Clear form
        setTimeout(() => setStatus('idle'), 5000); // Reset success message after 5 seconds
      } else {
        setStatus('error');
        setErrorMessage(data.message || 'Unable to send message. Please try again later.');
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Request aborted');
      } else {
        setStatus('error');
        setErrorMessage('A network error occurred. Please try again later.');
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  if (status === 'success') {
    return (
      <div className={styles.successState} role="alert">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.successIcon}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
        <h3>Message sent successfully.</h3>
        <p>We'll get back to you shortly.</p>
        <button onClick={() => setStatus('idle')} className={styles.resetBtn}>Send another message</button>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {status === 'error' && (
        <div className={styles.globalError} role="alert">
          {errorMessage}
        </div>
      )}

      <div className={styles.inputGroup}>
        <label htmlFor="name">What's your name? *</label>
        <input 
          type="text" 
          id="name" 
          required 
          placeholder="John Doe" 
          value={formData.name}
          onChange={handleInputChange}
          disabled={status === 'loading'}
          aria-invalid={!!validationErrors.name}
          aria-describedby={validationErrors.name ? "name-error" : undefined}
        />
        {validationErrors.name && <span id="name-error" className={styles.errorText}>{validationErrors.name}</span>}
      </div>
      
      <div className={styles.inputGroup}>
        <label htmlFor="email">What's your email? *</label>
        <input 
          type="email" 
          id="email" 
          required 
          placeholder="john@example.com" 
          value={formData.email}
          onChange={handleInputChange}
          disabled={status === 'loading'}
          aria-invalid={!!validationErrors.email}
          aria-describedby={validationErrors.email ? "email-error" : undefined}
        />
        {validationErrors.email && <span id="email-error" className={styles.errorText}>{validationErrors.email}</span>}
      </div>

      <div className={styles.inputGroup}>
        <label htmlFor="phone">What's your phone number? (Optional)</label>
        <input 
          type="tel" 
          id="phone" 
          placeholder="+91 9999999999" 
          value={formData.phone}
          onChange={handleInputChange}
          disabled={status === 'loading'}
          aria-invalid={!!validationErrors.phone}
          aria-describedby={validationErrors.phone ? "phone-error" : undefined}
        />
        {validationErrors.phone && <span id="phone-error" className={styles.errorText}>{validationErrors.phone}</span>}
      </div>

      <div className={styles.inputGroup}>
        <label htmlFor="subject">Subject *</label>
        <input 
          type="text" 
          id="subject" 
          required 
          placeholder="Project Inquiry" 
          value={formData.subject}
          onChange={handleInputChange}
          disabled={status === 'loading'}
          aria-invalid={!!validationErrors.subject}
          aria-describedby={validationErrors.subject ? "subject-error" : undefined}
        />
        {validationErrors.subject && <span id="subject-error" className={styles.errorText}>{validationErrors.subject}</span>}
      </div>
      
      <div className={styles.inputGroup}>
        <label htmlFor="message">Tell me about your project or inquiry. *</label>
        <textarea 
          id="message" 
          required 
          rows={4} 
          placeholder="Hello Robinson, I'd like to discuss..."
          value={formData.message}
          onChange={handleInputChange}
          disabled={status === 'loading'}
          aria-invalid={!!validationErrors.message}
          aria-describedby={validationErrors.message ? "message-error" : undefined}
        ></textarea>
        {validationErrors.message && <span id="message-error" className={styles.errorText}>{validationErrors.message}</span>}
      </div>
      
      <button 
        type="submit" 
        className={styles.submitBtn} 
        disabled={status === 'loading'}
        aria-disabled={status === 'loading'}
      >
        {status === 'loading' ? (
          <>
            <span className={styles.spinner}></span>
            Sending...
          </>
        ) : (
          <>
            Send Message
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </>
        )}
      </button>
    </form>
  );
};

export default ContactForm;
