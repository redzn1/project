import { Request, Response, NextFunction } from 'express';
import { db } from '../database/database';

declare module 'express-session' {
  interface SessionData {
    isAdmin?: boolean;
    isDev?: boolean;
    devEmail?: string;
    adminLoginTime?: number;
  }
}

export const DEV_EMAIL = 'dev@lynxie.ai';
export const DEV_PASSWORD = 'DevLAI';

/**
 * Returns the effective administrator / developer password.
 */
export function getAdminPassword(): string {
  const envPassword = process.env.DEV_PASSWORD || process.env.ADMIN_PASSWORD || process.env.OPENR_PASSWORD;
  if (envPassword && envPassword.trim().length > 0) {
    return envPassword.trim();
  }
  const dbPassword = db.getConfig().adminPassword;
  if (dbPassword && dbPassword.trim().length > 0) {
    return dbPassword.trim();
  }
  return DEV_PASSWORD;
}

// Middleware to protect developer / admin endpoints
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  // 1. Check session
  if (req.session && (req.session.isAdmin || req.session.isDev)) {
    next();
    return;
  }

  // 2. Check header-based dev bypass or dev email
  const headerEmail = (req.headers['x-dev-email'] as string) || '';
  const devBypass = (req.headers['x-dev-bypass'] as string) || (req.headers['x-dev-auth'] as string);
  const isDevUser = headerEmail.toLowerCase() === DEV_EMAIL || devBypass === 'true' || devBypass === '1';

  if (isDevUser) {
    if (req.session) {
      req.session.isAdmin = true;
      req.session.isDev = true;
      req.session.devEmail = DEV_EMAIL;
      req.session.adminLoginTime = Date.now();
    }
    next();
    return;
  }

  // 3. Check header-based authentication
  const headerPassword = (req.headers['x-admin-password'] as string) || (req.headers['x-openr-password'] as string) || (req.headers['x-dev-password'] as string);
  const authHeader = req.headers['authorization'];
  let bearerToken = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    bearerToken = authHeader.substring(7).trim();
  }

  const validPassword = getAdminPassword();
  const isPasswordMatch =
    (headerPassword && (headerPassword.trim() === validPassword || headerPassword.trim() === DEV_PASSWORD)) ||
    (bearerToken && (bearerToken.trim() === validPassword || bearerToken.trim() === DEV_PASSWORD));

  if (isPasswordMatch) {
    if (req.session) {
      req.session.isAdmin = true;
      req.session.isDev = true;
      req.session.devEmail = headerEmail || DEV_EMAIL;
    }
    next();
    return;
  }

  res.status(401).json({
    error: 'Unauthorized: Developer access required.',
    requiresLogin: true,
  });
}

// Developer Auto-Auth (no password needed for dev account)
export function handleDevAutoAuth(req: Request, res: Response): void {
  const { email } = req.body;
  const userEmail = (email || '').trim().toLowerCase();

  // If user is dev@lynxie.ai or requested dev bypass
  if (userEmail === DEV_EMAIL || !userEmail || req.headers['x-dev-bypass'] === 'true') {
    if (req.session) {
      req.session.isAdmin = true;
      req.session.isDev = true;
      req.session.devEmail = DEV_EMAIL;
      req.session.adminLoginTime = Date.now();
    }
    res.json({
      success: true,
      authenticated: true,
      isDev: true,
      email: DEV_EMAIL,
      message: 'Developer account auto-authenticated successfully (Password bypassed for Dev account).',
    });
    return;
  }

  res.status(400).json({
    success: false,
    error: 'Auto-auth is only available for the developer account (dev@lynxie.ai).',
  });
}

// Developer & Admin login controller
export function handleAdminLogin(req: Request, res: Response): void {
  const { email, password } = req.body;
  const userPassword = (password || '').trim();
  const userEmail = (email || '').trim().toLowerCase();

  // Dev account bypasses password requirement!
  if (userEmail === DEV_EMAIL || req.headers['x-dev-bypass'] === 'true') {
    if (req.session) {
      req.session.isAdmin = true;
      req.session.isDev = true;
      req.session.devEmail = DEV_EMAIL;
      req.session.adminLoginTime = Date.now();
    }
    res.json({
      success: true,
      message: 'Developer account verified without password prompt.',
      authenticated: true,
      email: DEV_EMAIL,
      isDev: true,
    });
    return;
  }

  if (!userPassword) {
    res.status(400).json({ error: 'Password is required' });
    return;
  }

  const validPassword = getAdminPassword();

  const isDevLogin = (userEmail === DEV_EMAIL || !userEmail) && (userPassword === DEV_PASSWORD || userPassword === validPassword);

  if (isDevLogin || userPassword === validPassword || userPassword === DEV_PASSWORD) {
    if (req.session) {
      req.session.isAdmin = true;
      req.session.isDev = true;
      req.session.devEmail = userEmail || DEV_EMAIL;
      req.session.adminLoginTime = Date.now();
    }
    res.json({
      success: true,
      message: 'Developer authorization successful',
      authenticated: true,
      email: userEmail || DEV_EMAIL,
    });
  } else {
    res.status(401).json({
      success: false,
      error: 'Invalid developer credentials. Please verify your Email and Password.',
      authenticated: false,
    });
  }
}

// Admin logout controller
export function handleAdminLogout(req: Request, res: Response): void {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destroy error:', err);
      }
      res.clearCookie('lynxiee.sid');
      res.json({ success: true, message: 'Logged out successfully' });
    });
  } else {
    res.json({ success: true, message: 'Logged out' });
  }
}

// Developer/Admin status check
export function handleAdminStatus(req: Request, res: Response): void {
  const isAuthenticated = Boolean(req.session && (req.session.isAdmin || req.session.isDev));
  res.json({
    authenticated: isAuthenticated,
    isDev: Boolean(req.session?.isDev),
    email: req.session?.devEmail || (isAuthenticated ? DEV_EMAIL : null),
    loginTime: req.session?.adminLoginTime || null,
  });
}

// Admin change password
export function handleAdminChangePassword(req: Request, res: Response): void {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 4) {
    res.status(400).json({ error: 'New password must be at least 4 characters long.' });
    return;
  }

  const validPassword = getAdminPassword();

  if (currentPassword !== validPassword && currentPassword !== DEV_PASSWORD) {
    res.status(400).json({ error: 'Current password does not match.' });
    return;
  }

  db.setAdminPassword(newPassword.trim());
  res.json({
    success: true,
    message: 'Developer password updated successfully.',
  });
}
