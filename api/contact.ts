import { Resend } from 'resend';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Initialize Resend with environment variable
const resend = new Resend(process.env.RESEND_API_KEY);

// Simple in-memory rate limiter
// Key: IP Address, Value: Array of timestamps
const rateLimitMap = new Map<string, number[]>();

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS = 5;

const rateLimit = (ip: string): boolean => {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];
  
  // Filter out timestamps outside the window
  const recentTimestamps = timestamps.filter(time => now - time < RATE_LIMIT_WINDOW_MS);
  
  if (recentTimestamps.length >= MAX_REQUESTS) {
    return false; // Rate limited
  }
  
  recentTimestamps.push(now);
  rateLimitMap.set(ip, recentTimestamps);
  
  return true; // Allowed
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  // Extract client IP for rate limiting
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';

  if (!rateLimit(ip)) {
    return res.status(429).json({ success: false, message: 'Too many requests. Please try again later.' });
  }

  try {
    const { name, email, phone, subject, message } = req.body;

    // Server-side validation
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format.' });
    }
    
    // Get optional User-Agent
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const timestamp = new Date().toISOString();

    // Plain text version
    const textEmail = `
New Contact Form Submission

Name: ${name}
Email: ${email}
Phone: ${phone || 'Not provided'}
Subject: ${subject}

Message:
${message}

---
Submission Details:
Timestamp: ${timestamp}
Sender IP: ${ip}
User Agent: ${userAgent}
    `;

    // HTML version
    const htmlEmail = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
        <h2 style="color: #1a1a1a; border-bottom: 2px solid #eaeaea; padding-bottom: 10px;">New Contact Submission</h2>
        
        <table style="width: 100%; margin-bottom: 20px;">
          <tr><td style="width: 100px; font-weight: bold; padding: 5px 0;">Name:</td><td>${name}</td></tr>
          <tr><td style="font-weight: bold; padding: 5px 0;">Email:</td><td><a href="mailto:${email}">${email}</a></td></tr>
          <tr><td style="font-weight: bold; padding: 5px 0;">Phone:</td><td>${phone || 'Not provided'}</td></tr>
          <tr><td style="font-weight: bold; padding: 5px 0;">Subject:</td><td>${subject}</td></tr>
        </table>
        
        <h3 style="margin-top: 30px; font-weight: bold;">Message:</h3>
        <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #333; margin-bottom: 30px; white-space: pre-wrap;">
          ${message}
        </div>
        
        <div style="border-top: 1px solid #eaeaea; padding-top: 15px; font-size: 12px; color: #777;">
          <p><strong>Timestamp:</strong> ${timestamp}</p>
          <p><strong>IP Address:</strong> ${ip}</p>
        </div>
      </div>
    `;

    // Ensure environment variables are loaded
    const receiverEmail = process.env.CONTACT_RECEIVER;
    if (!receiverEmail) {
      console.error('CONTACT_RECEIVER environment variable is not set');
      return res.status(500).json({ success: false, message: 'Server configuration error.' });
    }

    // Send email using Resend
    const data = await resend.emails.send({
      from: 'Portfolio Contact <onboarding@resend.dev>', // You should use your verified domain here in production
      to: [receiverEmail],
      replyTo: email,
      subject: `New Contact: ${subject}`,
      text: textEmail,
      html: htmlEmail,
    });

    if (data.error) {
      console.error('Resend API Error:', data.error);
      return res.status(400).json({ success: false, message: 'Unable to send email. Please try again later.' });
    }

    return res.status(200).json({ success: true, message: 'Email sent successfully.' });
    
  } catch (error) {
    console.error('Unexpected Server Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error. Unable to process request.' });
  }
}
