import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

// General API rate limiter (120 requests per minute per IP)
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Please slow down and try again in a minute.',
    status: 429,
  },
});

// Stricter rate limiter for chat requests (60 per minute)
export const chatRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Chat rate limit reached. Please wait a few seconds before sending another message.',
    status: 429,
  },
});

// Strict rate limiter for Admin Login attempts (15 attempts per 15 mins)
export const adminLoginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many admin login attempts from this IP. Please try again after 15 minutes.',
    status: 429,
  },
});

// Sanitizes text strings to prevent simple XSS / injection issues
export function sanitizeInput(input: any): string {
  if (typeof input !== 'string') return '';
  return input.trim();
}

// Request validation middleware for chat messages
export function validateChatPayload(req: Request, res: Response, next: NextFunction): void {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'Invalid request: "messages" array is required and must not be empty.' });
    return;
  }

  // Ensure each message item has role and content
  for (const msg of messages) {
    if (!msg || typeof msg !== 'object' || typeof msg.role !== 'string' || typeof msg.content !== 'string') {
      res.status(400).json({ error: 'Invalid message structure: each message must have "role" and "content" strings.' });
      return;
    }
  }

  next();
}
