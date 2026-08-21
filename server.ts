import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { app } from './server/app';

const PORT = 3000;

async function startServer() {
  // Vite dev middleware or Static asset serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] LYNXIEE MARKET AI Server Running`);
    console.log(`[SERVER] Port: http://0.0.0.0:${PORT}`);
    console.log(`[SERVER] Chatbot: http://localhost:${PORT}/`);
    console.log(`[SERVER] Admin Panel: http://localhost:${PORT}/openr`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server boot error:', err);
});
