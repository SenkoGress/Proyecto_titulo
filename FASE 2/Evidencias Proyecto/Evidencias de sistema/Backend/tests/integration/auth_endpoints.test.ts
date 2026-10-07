import http from 'http';
import app from '../../src/index';
import { initializeDatabase } from '../../src/database/init-db';

describe('Auth Endpoints & RBAC (RF-01, RF-02, RF-03, RNF-SEG-01, RNF-SEG-02)', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  let testServer: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    await initializeDatabase();
    await new Promise<void>((resolve) => {
      testServer = app.listen(0, () => {
        const addr = testServer.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll((done) => {
    testServer.close(done);
  });

  async function postJson(endpoint: string, body: any, headers: Record<string, string> = {}) {
    return new Promise<{ status: number; data: any }>((resolve, reject) => {
      const payload = JSON.stringify(body);
      const url = new URL(endpoint, baseUrl);
      const req = http.request(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            ...headers
          }
        },
        (res) => {
          let raw = '';
          res.on('data', (c) => (raw += c));
          res.on('end', () => {
            try {
              resolve({ status: res.statusCode || 500, data: JSON.parse(raw) });
            } catch {
              resolve({ status: res.statusCode || 500, data: raw });
            }
          });
        }
      );
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  async function getJson(endpoint: string, headers: Record<string, string> = {}) {
    return new Promise<{ status: number; data: any }>((resolve, reject) => {
      const url = new URL(endpoint, baseUrl);
      const req = http.request(url, { method: 'GET', headers }, (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 500, data: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode || 500, data: raw });
          }
        });
      });
      req.on('error', reject);
      req.end();
    });
  }

  describe('POST /api/v1/auth/login (RF-01)', () => {
    it('inicia sesión exitosamente con credenciales sembradas válidas y retorna JWT', async () => {
      const res = await postJson('/api/v1/auth/login', {
        tenant_id: tenantId,
        email: 'admin@gestock.cl',
        password: 'admin123'
      });

      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(typeof res.data.token).toBe('string');
      expect(res.data.token.split('.')).toHaveLength(3);
      expect(res.data.usuario.email).toBe('admin@gestock.cl');
      expect(res.data.usuario.rol).toBe('admin');
      expect(res.data.usuario.password_hash).toBeUndefined();
    });

    it('rechaza login con clave incorrecta retornando error 401 unificado anti-enumeración', async () => {
      const res = await postJson('/api/v1/auth/login', {
        tenant_id: tenantId,
        email: 'admin@gestock.cl',
        password: 'clave_invalida'
      });

      expect(res.status).toBe(401);
      expect(res.data.success).toBe(false);
      expect(res.data.message).toBe('El correo o la clave no son correctos');
    });

    it('rechaza login con correo inexistente con el mismo error 401 para evitar enumeración', async () => {
      const res = await postJson('/api/v1/auth/login', {
        tenant_id: tenantId,
        email: 'noexiste@gestock.cl',
        password: 'password123'
      });

      expect(res.status).toBe(401);
      expect(res.data.success).toBe(false);
      expect(res.data.message).toBe('El correo o la clave no son correctos');
    });
  });

  describe('POST /api/v1/auth/register (RF-02)', () => {
    const testEmail = `cajero_test_${Date.now()}@gestock.cl`;

    it('registra un nuevo cajero con clave Bcrypt y retorna sesión activa con JWT', async () => {
      const res = await postJson('/api/v1/auth/register', {
        tenant_id: tenantId,
        nombre: 'Cajero de Turno',
        email: testEmail,
        password: 'PasswordSegura2026',
        rol: 'cajero'
      });

      expect(res.status).toBe(201);
      expect(res.data.success).toBe(true);
      expect(typeof res.data.token).toBe('string');
      expect(res.data.usuario.rol).toBe('cajero');
      expect(res.data.usuario.email).toBe(testEmail);
    });

    it('rechaza registro duplicado con error 409', async () => {
      const res = await postJson('/api/v1/auth/register', {
        tenant_id: tenantId,
        nombre: 'Cajero Duplicado',
        email: testEmail,
        password: 'PasswordSegura2026',
        rol: 'cajero'
      });

      expect(res.status).toBe(409);
      expect(res.data.success).toBe(false);
    });

    it('rechaza registro con contraseña menor a 8 caracteres con error 400', async () => {
      const res = await postJson('/api/v1/auth/register', {
        tenant_id: tenantId,
        nombre: 'Usuario Corto',
        email: 'corto@gestock.cl',
        password: '123'
      });

      expect(res.status).toBe(400);
      expect(res.data.success).toBe(false);
    });
  });

  describe('GET /api/v1/auth/me (RF-03)', () => {
    it('retorna el perfil de usuario decodificado cuando se provee un token válido', async () => {
      const loginRes = await postJson('/api/v1/auth/login', {
        tenant_id: tenantId,
        email: 'admin@gestock.cl',
        password: 'admin123'
      });
      const token = loginRes.data.token;

      const meRes = await getJson('/api/v1/auth/me', {
        Authorization: `Bearer ${token}`
      });

      expect(meRes.status).toBe(200);
      expect(meRes.data.success).toBe(true);
      expect(meRes.data.usuario.email).toBe('admin@gestock.cl');
      expect(meRes.data.usuario.rol).toBe('admin');
    });

    it('rechaza con 401 si no se provee cabecera Authorization', async () => {
      const meRes = await getJson('/api/v1/auth/me');
      expect(meRes.status).toBe(401);
      expect(meRes.data.success).toBe(false);
    });
  });
});
