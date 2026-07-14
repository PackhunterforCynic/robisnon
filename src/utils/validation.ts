// src/utils/validation.ts

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

export const validatePhone = (phone: string): boolean => {
  if (!phone || phone.trim() === '') return true; // Phone is optional in this form
  
  // Clean phone number (remove spaces, hyphens, brackets)
  const cleanedPhone = phone.replace(/[\s\-\(\)]/g, '');
  const phoneRegex = /^[\+]?[0-9]{10,15}$/;
  return phoneRegex.test(cleanedPhone);
};

export const sanitizeInput = (input: string): string => {
  if (!input) return '';
  return input
    .trim()
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
};
