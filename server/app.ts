import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import dotenv from 'dotenv';

import { db } from '../database/database';
import {
  apiRateLimiter,
  chatRateLimiter,
  adminLoginRateLimiter,
  validateChatPayload,
} from './security';
import {
  requireAdmin,
  handleAdminLogin,
  handleAdminLogout,
  handleAdminStatus,
  handleAdminChangePassword,
  handleDevAutoAuth,
} from './auth';
import {
  executeChat,
  callMayzaaApi,
  callOpenRouterDirect,
  callXkiroDirect,
  fetchOpenRouterModels,
  testOpenRouterConnection,
  testXkiroConnection,
  testMayzaaConnection,
  POPULAR_MODELS,
} from './aiService';

dotenv.config();

const SESSION_SECRET = process.env.SESSION_SECRET || 'lynxiee_market_ai_super_secret_session_key_2026';

export function createApp() {
  const app = express();

  // Trust proxy for rate limiting and IP behind container or serverless proxy (Vercel, Cloud Run)
  app.set('trust proxy', 1);

  // Security Headers
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );

  // CORS
  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );

  // JSON & URL-encoded body parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // Session middleware
  app.use(
    session({
      name: 'lynxiee.sid',
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production' && !process.env.APP_URL?.startsWith('http://'),
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax',
      },
    })
  );

  // Apply general rate limiter to API routes
  app.use('/api', apiRateLimiter);

  // ------------------------------------------
  // SERVE /openr CONTROL PANEL (REDIRECT .html)
  // ------------------------------------------
  app.get('/openr.html', (req: Request, res: Response) => {
    res.redirect(301, '/openr');
  });

  const serveOpenRPage = (req: Request, res: Response) => {
    const candidates = [
      path.join(process.cwd(), 'public', 'openr.html'),
      path.join(process.cwd(), 'dist', 'openr.html'),
      path.join(process.cwd(), 'openr.html'),
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        return res.sendFile(p);
      }
    }
    return res.status(404).send('openr page not found');
  };

  app.get('/openr', serveOpenRPage);

  // ------------------------------------------
  // SYSTEM 1: OPENROUTER API ENGINE (GET & POST)
  // ------------------------------------------
  const handleOpenRGet = async (req: Request, res: Response) => {
    try {
      const text = (req.query.text as string) || (req.query.q as string) || (req.query.prompt as string) || '';
      const model = (req.query.model as string) || undefined;
      const system = (req.query.system as string) || undefined;
      const isJson = req.query.json === 'true' || req.query.json === '1';

      if (!text || !text.trim()) {
        if (isJson) {
          return res.status(400).json({
            status: false,
            provider: 'openrouter',
            error: 'Query parameter "text" is required. Example: /api/openr?text=Halo&model=openai/gpt-4o-mini',
          });
        }
        return res.status(400).type('text/plain; charset=utf-8').send('Error: Parameter "text" dibutuhkan. Contoh: /api/openr?text=Halo&model=openai/gpt-4o-mini');
      }

      const config = db.getConfig();
      if (!config.openRouterApiKey) {
        const errorMsg = 'OpenRouter API Key belum dikonfigurasi. Silakan tambahkan OPENROUTER_API_KEY di environment variables atau simpan di panel admin /openr.';
        if (isJson) {
          return res.status(400).json({
            status: false,
            provider: 'openrouter',
            error: errorMsg,
          });
        }
        return res.status(400).type('text/plain; charset=utf-8').send(`Error: ${errorMsg}`);
      }

      const result = await callOpenRouterDirect(text.trim(), model, system);

      if (isJson) {
        return res.json({
          status: true,
          provider: 'openrouter',
          model: result.model,
          result: result.text,
          response: result.text,
          latencyMs: result.latencyMs,
          timestamp: Date.now(),
        });
      }
      return res.type('text/plain; charset=utf-8').send(result.text);
    } catch (err: any) {
      console.error('GET /api/openr error:', err);
      const errMsg = err?.message || 'Gagal memproses permintaan ke OpenRouter.';
      if (req.query.json === 'true' || req.query.json === '1') {
        return res.status(500).json({
          status: false,
          provider: 'openrouter',
          error: errMsg,
        });
      }
      return res.status(500).type('text/plain; charset=utf-8').send(`Error: ${errMsg}`);
    }
  };

  app.get('/api/openr', chatRateLimiter, handleOpenRGet);
  app.get('/api/openrouter', chatRateLimiter, handleOpenRGet);

  // POST /api/openr for JSON body requests
  app.post('/api/openr', chatRateLimiter, async (req: Request, res: Response) => {
    try {
      const { text, prompt, model, system } = req.body;
      const userText = text || prompt || '';
      if (!userText.trim()) {
        return res.status(400).json({ status: false, provider: 'openrouter', error: 'Field "text" is required.' });
      }
      const result = await callOpenRouterDirect(userText.trim(), model, system);
      res.json({
        status: true,
        provider: 'openrouter',
        model: result.model,
        result: result.text,
        response: result.text,
        latencyMs: result.latencyMs,
      });
    } catch (err: any) {
      res.status(500).json({ status: false, provider: 'openrouter', error: err?.message || 'Error processing request.' });
    }
  });

  // ------------------------------------------
  // SYSTEM 2: MAYZAA AI CHATGPT ENDPOINT (GET)
  // ------------------------------------------
  const handleMayzaaGet = async (req: Request, res: Response) => {
    try {
      const text = (req.query.text as string) || (req.query.q as string) || (req.query.prompt as string) || '';
      if (!text || !text.trim()) {
        if (req.query.json === 'true' || req.query.json === '1') {
          return res.status(400).json({
            status: false,
            provider: 'mayzaa',
            error: 'Query parameter "text" is required. Example: /api/ai/chat-gpt?text=Halo',
          });
        }
        return res.status(400).type('text/plain; charset=utf-8').send('Error: Parameter "text" dibutuhkan. Contoh: /api/ai/chat-gpt?text=Halo');
      }
      const responseText = await callMayzaaApi([{ role: 'user', content: text.trim() }]);
      
      if (req.query.json === 'true' || req.query.json === '1') {
        return res.json({
          status: true,
          provider: 'mayzaa',
          result: responseText,
          response: responseText,
          source: 'https://api.mayzaa.my.id/api/ai/chat-gpt?text=',
          timestamp: Date.now(),
        });
      }
      return res.type('text/plain; charset=utf-8').send(responseText);
    } catch (err: any) {
      console.error('GET Mayzaa ChatGPT API error:', err);
      const errMsg = err?.message || 'Failed to fetch AI response from Mayzaa ChatGPT endpoint.';
      if (req.query.json === 'true' || req.query.json === '1') {
        return res.status(500).json({
          status: false,
          provider: 'mayzaa',
          error: errMsg,
        });
      }
      return res.status(500).type('text/plain; charset=utf-8').send(`Error: ${errMsg}`);
    }
  };

  app.get('/api/ai/chat-gpt', chatRateLimiter, handleMayzaaGet);
  app.get('/api/mayzaa', chatRateLimiter, handleMayzaaGet);

  // ------------------------------------------
  // SYSTEM 3: XKIRO.COM AI ENDPOINT (GET & POST)
  // ------------------------------------------
  const handleXkiroGet = async (req: Request, res: Response) => {
    try {
      const text = (req.query.text as string) || (req.query.q as string) || (req.query.prompt as string) || '';
      const model = (req.query.model as string) || undefined;
      const system = (req.query.system as string) || undefined;
      const isJson = req.query.json === 'true' || req.query.json === '1';

      if (!text || !text.trim()) {
        if (isJson) {
          return res.status(400).json({
            status: false,
            provider: 'xkiro',
            error: 'Query parameter "text" is required. Example: /api/xkiro?text=Halo',
          });
        }
        return res.status(400).type('text/plain; charset=utf-8').send('Error: Parameter "text" dibutuhkan. Contoh: /api/xkiro?text=Halo');
      }

      const result = await callXkiroDirect(text.trim(), model, system);
      if (isJson) {
        return res.json({
          status: true,
          provider: 'xkiro',
          model: result.model,
          result: result.text,
          response: result.text,
          latencyMs: result.latencyMs,
          timestamp: Date.now(),
        });
      }
      return res.type('text/plain; charset=utf-8').send(result.text);
    } catch (err: any) {
      console.error('GET /api/xkiro error:', err);
      const errMsg = err?.message || 'Gagal memproses permintaan ke Xkiro.com API.';
      if (req.query.json === 'true' || req.query.json === '1') {
        return res.status(500).json({
          status: false,
          provider: 'xkiro',
          error: errMsg,
        });
      }
      return res.status(500).type('text/plain; charset=utf-8').send(`Error: ${errMsg}`);
    }
  };

  app.get('/api/xkiro', chatRateLimiter, handleXkiroGet);
  app.get('/api/ai/xkiro', chatRateLimiter, handleXkiroGet);

  app.post('/api/xkiro', chatRateLimiter, async (req: Request, res: Response) => {
    try {
      const { text, prompt, model, system } = req.body;
      const userText = text || prompt || '';
      if (!userText.trim()) {
        return res.status(400).json({ status: false, provider: 'xkiro', error: 'Field "text" is required.' });
      }
      const result = await callXkiroDirect(userText.trim(), model, system);
      res.json({
        status: true,
        provider: 'xkiro',
        model: result.model,
        result: result.text,
        response: result.text,
        latencyMs: result.latencyMs,
      });
    } catch (err: any) {
      res.status(500).json({ status: false, provider: 'xkiro', error: err?.message || 'Error processing request.' });
    }
  });

  // ------------------------------------------
  // MASTER CHATBOT DISPATCHER (GET & POST)
  // ------------------------------------------
  app.get('/api/chat', chatRateLimiter, async (req: Request, res: Response) => {
    try {
      const text = (req.query.text as string) || (req.query.q as string) || (req.query.prompt as string) || '';
      if (!text || !text.trim()) {
        if (req.query.json === 'true' || req.query.json === '1') {
          return res.status(400).json({
            status: false,
            error: 'Query parameter "text" is required. Example: /api/chat?text=Apa itu AI?',
          });
        }
        return res.status(400).type('text/plain; charset=utf-8').send('Error: Parameter "text" dibutuhkan. Contoh: /api/chat?text=Apa itu AI?');
      }

      const config = db.getConfig();
      let responseText = '';
      let usedProvider = config.activeProvider;

      if (config.activeProvider === 'openrouter' && config.openRouterApiKey) {
        const result = await callOpenRouterDirect(text.trim());
        responseText = result.text;
      } else if (config.activeProvider === 'xkiro') {
        const result = await callXkiroDirect(text.trim());
        responseText = result.text;
      } else {
        usedProvider = 'mayzaa';
        responseText = await callMayzaaApi([{ role: 'user', content: text.trim() }]);
      }
      
      if (req.query.json === 'true' || req.query.json === '1') {
        return res.json({
          status: true,
          provider: usedProvider,
          result: responseText,
          response: responseText,
          timestamp: Date.now(),
        });
      }
      return res.type('text/plain; charset=utf-8').send(responseText);
    } catch (err: any) {
      console.error('GET /api/chat error:', err);
      const errMsg = err?.message || 'Failed to fetch AI response.';
      if (req.query.json === 'true' || req.query.json === '1') {
        return res.status(500).json({
          status: false,
          error: errMsg,
        });
      }
      return res.status(500).type('text/plain; charset=utf-8').send(`Error: ${errMsg}`);
    }
  });

  // Standard POST /api/chat for UI conversation stream & full history
  app.post('/api/chat', chatRateLimiter, validateChatPayload, async (req: Request, res: Response) => {
    try {
      const { messages, stream } = req.body;
      const isStream = stream === true || req.headers.accept === 'text/event-stream';
      await executeChat(messages, res, isStream);
    } catch (err: any) {
      console.error('Chat endpoint error:', err);
      if (!res.headersSent) {
        res.status(500).json({
          error: err?.message || 'AI service encountered an error. Please try again.',
        });
      }
    }
  });

  // ------------------------------------------
  // ADMIN AUTHENTICATION & DEV AUTO-AUTH
  // ------------------------------------------
  app.post('/api/admin/login', adminLoginRateLimiter, handleAdminLogin);
  app.post('/api/admin/logout', handleAdminLogout);
  app.get('/api/admin/status', handleAdminStatus);
  app.post('/api/admin/change-password', requireAdmin, handleAdminChangePassword);
  app.all('/api/admin/auto-auth', handleDevAutoAuth);
  app.get('/api/admin/dev-login', handleDevAutoAuth);

  // ------------------------------------------
  // UNIFIED 3-PROVIDER CONFIGURATION APIS
  // ------------------------------------------
  app.get('/api/admin/providers', (req: Request, res: Response) => {
    const config = db.getConfig();
    res.json({
      activeProvider: config.activeProvider,
      activeModel: config.activeModel,
      providers: {
        openrouter: {
          name: 'OpenRouter API',
          keyPresent: Boolean(config.openRouterApiKey && config.openRouterApiKey.length > 5),
          keyMasked: db.maskApiKey(config.openRouterApiKey),
          endpoint: '/api/openr?text=',
          model: config.activeModel || 'openai/gpt-4o-mini',
        },
        mayzaa: {
          name: 'Mayzaa API (ChatGPT Free)',
          apiUrl: config.mayzaaApiUrl || 'https://api.mayzaa.my.id/api/ai/chat-gpt?text=',
          endpoint: '/api/ai/chat-gpt?text=',
          isFree: true,
        },
        xkiro: {
          name: 'Xkiro.com AI Gateway',
          keyPresent: Boolean(config.xkiroApiKey && config.xkiroApiKey.length > 0),
          keyMasked: db.maskApiKey(config.xkiroApiKey),
          baseUrl: config.xkiroBaseUrl || 'https://api.xkiro.com/v1',
          model: config.xkiroModel || 'openai/gpt-4o-mini',
          endpoint: '/api/xkiro?text=',
        },
      },
      aiSettings: config.aiSettings,
      systemPrompt: config.systemPrompt,
    });
  });

  app.post('/api/admin/providers/save', requireAdmin, (req: Request, res: Response) => {
    try {
      const {
        activeProvider,
        openRouterKey,
        xkiroKey,
        xkiroBaseUrl,
        xkiroModel,
        mayzaaUrl,
        activeModel,
        systemPrompt,
        temperature,
        maxTokens,
        topP,
      } = req.body;

      if (openRouterKey && typeof openRouterKey === 'string' && openRouterKey.trim().length > 5 && !openRouterKey.includes('••••')) {
        db.setOpenRouterKey(openRouterKey.trim());
      }
      if (xkiroKey && typeof xkiroKey === 'string' && !xkiroKey.includes('••••')) {
        db.setXkiroKey(xkiroKey.trim());
      }
      if (xkiroBaseUrl && typeof xkiroBaseUrl === 'string') {
        db.setXkiroBaseUrl(xkiroBaseUrl.trim());
      }
      if (xkiroModel && typeof xkiroModel === 'string') {
        db.setXkiroModel(xkiroModel.trim());
      }
      if (mayzaaUrl && typeof mayzaaUrl === 'string') {
        db.setMayzaaApiUrl(mayzaaUrl.trim());
      }
      if (activeProvider && ['openrouter', 'mayzaa', 'xkiro', 'gemini'].includes(activeProvider)) {
        db.setActiveProvider(activeProvider);
      }

      db.updateSettings({
        selectedModel: activeModel,
        systemPrompt,
        temperature: typeof temperature === 'number' ? temperature : undefined,
        maxTokens: typeof maxTokens === 'number' ? maxTokens : undefined,
        topP: typeof topP === 'number' ? topP : undefined,
      });

      res.json({
        success: true,
        message: 'Konfigurasi 3 Sistem AI Provider berhasil disimpan.',
        config: db.getPublicSettings(),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Gagal menyimpan konfigurasi provider.' });
    }
  });

  app.post('/api/admin/providers/test-xkiro', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { apiKey, baseUrl } = req.body;
      const keyToUse = apiKey && !apiKey.includes('••••') ? apiKey : undefined;
      const result = await testXkiroConnection(keyToUse, baseUrl);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message || 'Error testing Xkiro connection.' });
    }
  });

  app.post('/api/admin/providers/test-mayzaa', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { apiUrl } = req.body;
      const result = await testMayzaaConnection(apiUrl);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message || 'Error testing Mayzaa connection.' });
    }
  });

  app.post('/api/admin/providers/test-openrouter', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { apiKey } = req.body;
      const keyToTest = apiKey && !apiKey.includes('••••') ? apiKey : db.getConfig().openRouterApiKey;
      if (!keyToTest) {
        return res.status(400).json({ success: false, message: 'Belum ada OpenRouter API Key untuk diuji.' });
      }
      const result = await testOpenRouterConnection(keyToTest);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message || 'Error testing OpenRouter key.' });
    }
  });

  app.post('/api/admin/providers/set-active', requireAdmin, (req: Request, res: Response) => {
    try {
      const { provider } = req.body;
      if (!['openrouter', 'mayzaa', 'xkiro', 'gemini'].includes(provider)) {
        return res.status(400).json({ success: false, error: 'Invalid provider name.' });
      }
      db.setActiveProvider(provider);
      res.json({ success: true, message: `Active provider diubah ke ${provider.toUpperCase()}`, activeProvider: provider });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message || 'Gagal mengubah provider aktif.' });
    }
  });

  // ------------------------------------------
  // OPENROUTER & PROVIDER CONFIGURATION
  // ------------------------------------------
  app.get('/api/openrouter/config', (req: Request, res: Response) => {
    const config = db.getConfig();
    res.json({
      openRouterKeyPresent: Boolean(config.openRouterApiKey && config.openRouterApiKey.length > 5),
      openRouterKeyMasked: db.maskApiKey(config.openRouterApiKey),
      activeModel: config.activeModel,
      activeProvider: config.activeProvider,
      aiSettings: config.aiSettings,
      systemPrompt: config.systemPrompt,
    });
  });

  app.post('/api/openrouter/config', requireAdmin, (req: Request, res: Response) => {
    try {
      const { apiKey, activeModel, temperature, maxTokens, topP, systemPrompt } = req.body;
      if (apiKey && typeof apiKey === 'string' && apiKey.trim().length > 5 && !apiKey.includes('••••')) {
        db.setOpenRouterKey(apiKey.trim());
      }
      db.updateSettings({
        selectedModel: activeModel,
        systemPrompt,
        temperature: typeof temperature === 'number' ? temperature : undefined,
        maxTokens: typeof maxTokens === 'number' ? maxTokens : undefined,
        topP: typeof topP === 'number' ? topP : undefined,
      });
      res.json({
        success: true,
        message: 'Konfigurasi OpenRouter berhasil disimpan.',
        config: db.getPublicSettings(),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Gagal menyimpan konfigurasi.' });
    }
  });

  app.post('/api/openrouter/test-key', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { apiKey } = req.body;
      const keyToTest = apiKey && !apiKey.includes('••••') ? apiKey : db.getConfig().openRouterApiKey;
      if (!keyToTest) {
        return res.status(400).json({ success: false, message: 'Belum ada API Key untuk diuji.' });
      }
      const result = await testOpenRouterConnection(keyToTest);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message || 'Error testing key.' });
    }
  });

  // OpenRouter Model Management (CRUD)
  app.get('/api/openrouter/models', (req: Request, res: Response) => {
    res.json({ models: db.getOpenRouterModels() });
  });

  app.post('/api/openrouter/models', requireAdmin, (req: Request, res: Response) => {
    try {
      const { id, name, provider, description, context_length, pricing } = req.body;
      if (!id || typeof id !== 'string' || !id.trim()) {
        return res.status(400).json({ success: false, error: 'Model ID is required.' });
      }
      const newModel = db.addOpenRouterModel({
        id: id.trim(),
        name: name?.trim() || id.trim(),
        provider: provider?.trim() || 'Custom',
        description: description?.trim() || '',
        context_length: Number(context_length) || 128000,
        pricing: pricing || 'Standard',
        enabled: true,
      });
      res.json({ success: true, message: `Model "${newModel.id}" berhasil ditambahkan.`, model: newModel });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message || 'Gagal menambahkan model.' });
    }
  });

  app.put('/api/openrouter/models/:id', requireAdmin, (req: Request, res: Response) => {
    try {
      const modelId = decodeURIComponent(req.params.id);
      const updated = db.updateOpenRouterModel(modelId, req.body);
      res.json({ success: true, message: `Model "${modelId}" berhasil diperbarui.`, model: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message || 'Gagal memperbarui model.' });
    }
  });

  app.delete('/api/openrouter/models/:id', requireAdmin, (req: Request, res: Response) => {
    try {
      const modelId = decodeURIComponent(req.params.id);
      const deleted = db.deleteOpenRouterModel(modelId);
      if (deleted) {
        res.json({ success: true, message: `Model "${modelId}" berhasil dihapus.` });
      } else {
        res.status(404).json({ success: false, error: `Model "${modelId}" tidak ditemukan.` });
      }
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message || 'Gagal menghapus model.' });
    }
  });

  app.post('/api/openrouter/models/:id/active', requireAdmin, (req: Request, res: Response) => {
    try {
      const modelId = decodeURIComponent(req.params.id);
      db.setActiveModel(modelId);
      res.json({ success: true, message: `Model aktif diubah ke "${modelId}".`, activeModel: modelId });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message || 'Gagal mengubah model aktif.' });
    }
  });

  app.post('/api/openrouter/models/:id/toggle', requireAdmin, (req: Request, res: Response) => {
    try {
      const modelId = decodeURIComponent(req.params.id);
      const { enabled } = req.body;
      const updated = db.toggleOpenRouterModel(modelId, enabled);
      res.json({ success: true, message: `Status model diperbarui.`, model: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message || 'Gagal toggle model.' });
    }
  });

  app.post('/api/openrouter/models/sync-live', requireAdmin, async (req: Request, res: Response) => {
    try {
      const models = await fetchOpenRouterModels();
      res.json({ success: true, models });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Gagal mengambil katalog OpenRouter.' });
    }
  });

  app.post('/api/openrouter/models/reset', requireAdmin, (req: Request, res: Response) => {
    try {
      const models = db.resetOpenRouterModels();
      res.json({ success: true, message: 'Daftar model dikembalikan ke rekomendasi bawaan.', models });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Gagal mereset model.' });
    }
  });

  app.post('/api/openrouter/save-key', requireAdmin, (req: Request, res: Response) => {
    const { apiKey } = req.body;
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 8) {
      res.status(400).json({ error: 'Valid OpenRouter API key is required (starts with sk-or-v1-...)' });
      return;
    }
    db.setOpenRouterKey(apiKey.trim());
    res.json({
      success: true,
      message: 'OpenRouter API Key saved successfully and set as active provider.',
      maskedKey: db.maskApiKey(apiKey.trim()),
    });
  });

  app.post('/api/openrouter/test', async (req: Request, res: Response) => {
    const { apiKey } = req.body;
    const keyToTest = apiKey || db.getConfig().openRouterApiKey;
    if (!keyToTest) {
      res.status(400).json({ success: false, message: 'No API Key provided to test.' });
      return;
    }
    const result = await testOpenRouterConnection(keyToTest);
    res.json(result);
  });

  app.delete('/api/openrouter/key', requireAdmin, (req: Request, res: Response) => {
    db.deleteOpenRouterKey();
    res.json({
      success: true,
      message: 'OpenRouter API Key removed. Active provider switched to default (Mayzaa AI).',
    });
  });

  // ------------------------------------------
  // MODEL MANAGEMENT ROUTES
  // ------------------------------------------
  app.get('/api/models', async (req: Request, res: Response) => {
    try {
      const models = await fetchOpenRouterModels();
      res.json({ models });
    } catch (err: any) {
      res.json({ models: POPULAR_MODELS });
    }
  });

  app.post('/api/models/select', requireAdmin, (req: Request, res: Response) => {
    const { model, provider } = req.body;
    if (!model || typeof model !== 'string') {
      res.status(400).json({ error: 'Model ID is required.' });
      return;
    }
    db.updateSettings({
      selectedModel: model.trim(),
      provider: provider || (model.includes('mayzaa') ? 'mayzaa' : 'openrouter'),
    });
    res.json({
      success: true,
      message: `Active model updated to "${model}".`,
      selectedModel: model,
    });
  });

  app.get('/api/models/current', (req: Request, res: Response) => {
    const config = db.getConfig();
    res.json({
      activeModel: config.activeModel,
      activeProvider: config.activeProvider,
      openRouterConnected: Boolean(config.openRouterApiKey && config.openRouterApiKey.length > 5),
    });
  });

  // ------------------------------------------
  // SETTINGS & SYSTEM PROMPT
  // ------------------------------------------
  app.get('/api/settings', (req: Request, res: Response) => {
    res.json(db.getPublicSettings());
  });

  app.post('/api/settings', requireAdmin, (req: Request, res: Response) => {
    const { provider, selectedModel, customApiUrl, systemPrompt, temperature, maxTokens, topP } = req.body;
    db.updateSettings({
      provider,
      selectedModel,
      customApiUrl,
      systemPrompt,
      temperature: typeof temperature === 'number' ? temperature : undefined,
      maxTokens: typeof maxTokens === 'number' ? maxTokens : undefined,
      topP: typeof topP === 'number' ? topP : undefined,
    });
    res.json({
      success: true,
      message: 'AI settings and system prompt saved successfully.',
      settings: db.getPublicSettings(),
    });
  });

  app.post('/api/settings/reset-prompt', requireAdmin, (req: Request, res: Response) => {
    const reset = db.resetSystemPrompt();
    res.json({
      success: true,
      message: 'System prompt restored to LYNXIEE MARKET default.',
      systemPrompt: reset,
    });
  });

  // ------------------------------------------
  // ADMIN LOGS & TELEMETRY
  // ------------------------------------------
  app.get('/api/admin/telemetry', requireAdmin, (req: Request, res: Response) => {
    if (req.sessionID) {
      db.registerSession(req.sessionID);
    }
    res.json({
      telemetry: db.getTelemetry(),
      config: db.getPublicSettings(),
      stats: db.getStats(),
    });
  });

  app.get('/api/admin/logs', requireAdmin, (req: Request, res: Response) => {
    res.json({ logs: db.getLogs() });
  });

  app.delete('/api/admin/logs', requireAdmin, (req: Request, res: Response) => {
    db.clearLogs();
    res.json({ success: true, message: 'Logs cleared.' });
  });

  app.get('/api/admin/stats', requireAdmin, (req: Request, res: Response) => {
    res.json({ stats: db.getStats(), telemetry: db.getTelemetry() });
  });

  // Health check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'online',
      app: 'LYNXIEE MARKET AI',
      timestamp: Date.now(),
      uptimeSeconds: Math.floor(process.uptime()),
    });
  });

  return app;
}

export const app = createApp();
export default app;
