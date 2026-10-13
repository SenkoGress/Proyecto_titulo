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

  async function postJson(endpoint: string, body: any, headers: Record<string, string> = {}, method = 'POST') {
    return new Promise<{ status: number; data: any }>((resolve, reject) => {
      const payload = JSON.stringify(body);
      const url = new URL(endpoint, baseUrl);
      const req = http.request(
        url,
        {
          method,
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
    let adminToken: string;
    let cajeroToken: string;

    beforeAll(async () => {
      const adminLogin = await postJson('/api/v1/auth/login', {
        tenant_id: tenantId,
        email: 'admin@gestock.cl',
        password: 'admin123'
      });
      adminToken = adminLogin.data.token;

      const cajeroLogin = await postJson('/api/v1/auth/login', {
        tenant_id: tenantId,
        email: 'cajero@gestock.cl',
        password: 'cajero123'
      });
      cajeroToken = cajeroLogin.data.token;
    });

    it('rechaza registro con 401 si no se envía token de autenticación', async () => {
      const res = await postJson('/api/v1/auth/register', {
        tenant_id: tenantId,
        nombre: 'Cajero Sin Auth',
        email: 'sinauth@gestock.cl',
        password: 'PasswordSegura2026',
        rol: 'cajero'
      });

      expect(res.status).toBe(401);
      expect(res.data.success).toBe(false);
    });

    it('rechaza registro con 403 si el token pertenece a un rol cajero', async () => {
      const res = await postJson(
        '/api/v1/auth/register',
        {
          tenant_id: tenantId,
          nombre: 'Cajero No Autorizado',
          email: 'noauth@gestock.cl',
          password: 'PasswordSegura2026',
          rol: 'cajero'
        },
        { Authorization: `Bearer ${cajeroToken}` }
      );

      expect(res.status).toBe(403);
      expect(res.data.success).toBe(false);
      expect(res.data.message).toContain('solo administradores');
    });

    it('registra un nuevo cajero con token de admin y retorna usuario sin token', async () => {
      const res = await postJson(
        '/api/v1/auth/register',
        {
          tenant_id: tenantId,
          nombre: 'Cajero de Turno',
          email: testEmail,
          password: 'PasswordSegura2026',
          rol: 'cajero'
        },
        { Authorization: `Bearer ${adminToken}` }
      );

      expect(res.status).toBe(201);
      expect(res.data.success).toBe(true);
      expect(res.data.usuario.rol).toBe('cajero');
      expect(res.data.usuario.email).toBe(testEmail);
      expect(res.data.token).toBeUndefined(); // David's contract: no token on register
    });

    it('rechaza registro duplicado con error 409', async () => {
      const res = await postJson(
        '/api/v1/auth/register',
        {
          tenant_id: tenantId,
          nombre: 'Cajero Duplicado',
          email: testEmail,
          password: 'PasswordSegura2026',
          rol: 'cajero'
        },
        { Authorization: `Bearer ${adminToken}` }
      );

      expect(res.status).toBe(409);
      expect(res.data.success).toBe(false);
    });

    it('rechaza con 403 el registro de usuarios en un comercio distinto al del token', async () => {
      const res = await postJson(
        '/api/v1/auth/register',
        {
          tenant_id: '99999999-0000-0000-0000-000000000099',
          nombre: 'Intruso Otro Comercio',
          email: `intruso_${Date.now()}@gestock.cl`,
          password: 'PasswordSegura2026',
          rol: 'admin'
        },
        { Authorization: `Bearer ${adminToken}` }
      );

      expect(res.status).toBe(403);
      expect(res.data.success).toBe(false);
    });

    it('rechaza registro con contraseña menor a 8 caracteres con error 400', async () => {
      const res = await postJson(
        '/api/v1/auth/register',
        {
          tenant_id: tenantId,
          nombre: 'Usuario Corto',
          email: 'corto@gestock.cl',
          password: '123'
        },
        { Authorization: `Bearer ${adminToken}` }
      );

      expect(res.status).toBe(400);
      expect(res.data.success).toBe(false);
    });
  });

  describe('GET /api/v1/auth/users (Gestión de Personal)', () => {
    let adminToken: string;
    let cajeroToken: string;

    beforeAll(async () => {
      const adminLogin = await postJson('/api/v1/auth/login', {
        tenant_id: tenantId,
        email: 'admin@gestock.cl',
        password: 'admin123'
      });
      adminToken = adminLogin.data.token;

      const cajeroLogin = await postJson('/api/v1/auth/login', {
        tenant_id: tenantId,
        email: 'cajero@gestock.cl',
        password: 'cajero123'
      });
      cajeroToken = cajeroLogin.data.token;
    });

    it('rechaza consulta de usuarios con 401 si no hay token', async () => {
      const res = await getJson('/api/v1/auth/users');
      expect(res.status).toBe(401);
      expect(res.data.success).toBe(false);
    });

    it('rechaza consulta de usuarios con 403 si el rol es cajero', async () => {
      const res = await getJson('/api/v1/auth/users', {
        Authorization: `Bearer ${cajeroToken}`
      });
      expect(res.status).toBe(403);
      expect(res.data.success).toBe(false);
    });

    it('retorna la lista de usuarios del comercio para el administrador sin filtrar contraseñas', async () => {
      const res = await getJson('/api/v1/auth/users', {
        Authorization: `Bearer ${adminToken}`
      });

      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(Array.isArray(res.data.data)).toBe(true);
      expect(res.data.data.length).toBeGreaterThanOrEqual(2);

      // Verificar que ningún usuario exponga su hash
      for (const u of res.data.data) {
        expect(u.password_hash).toBeUndefined();
        expect(u.email).toBeDefined();
        expect(u.rol).toBeDefined();
      }
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

  describe('RBAC Middleware (Control de Acceso Basado en Roles)', () => {
    let adminToken: string;
    let cajeroToken: string;

    beforeAll(async () => {
      const adminLogin = await postJson('/api/v1/auth/login', {
        tenant_id: tenantId,
        email: 'admin@gestock.cl',
        password: 'admin123'
      });
      adminToken = adminLogin.data.token;

      const cajeroLogin = await postJson('/api/v1/auth/login', {
        tenant_id: tenantId,
        email: 'cajero@gestock.cl',
        password: 'cajero123'
      });
      cajeroToken = cajeroLogin.data.token;
    });

    it('bloquea con 403 a un cajero intentando acceder a rutas exclusivas de administración (/dashboard)', async () => {
      const res = await getJson('/api/v1/dashboard/overview', {
        Authorization: `Bearer ${cajeroToken}`
      });

      expect(res.status).toBe(403);
      expect(res.data.success).toBe(false);
      expect(res.data.message).toContain('administrador');
    });

    it('permite acceso al administrador a rutas exclusivas de administración (/dashboard)', async () => {
      const res = await getJson('/api/v1/dashboard/overview', {
        Authorization: `Bearer ${adminToken}`
      });

      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
    });

    it('permite acceso al cajero a rutas operativas del punto de venta (/pos/products)', async () => {
      const res = await getJson('/api/v1/pos/products', {
        Authorization: `Bearer ${cajeroToken}`
      });

      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
    });
  });

  describe('PUT /api/v1/auth/password (cambio de contraseña)', () => {
    const email = `clave_test_${Date.now()}@gestock.cl`;
    const claveInicial = 'ClaveInicial2026';
    const claveNueva = 'ClaveNueva2026!';
    let userToken: string;

    beforeAll(async () => {
      const adminLogin = await postJson('/api/v1/auth/login', {
        tenant_id: tenantId,
        email: 'admin@gestock.cl',
        password: 'admin123'
      });
      await postJson(
        '/api/v1/auth/register',
        { tenant_id: tenantId, nombre: 'Usuario Cambio Clave', email, password: claveInicial, rol: 'cajero' },
        { Authorization: `Bearer ${adminLogin.data.token}` }
      );
      const login = await postJson('/api/v1/auth/login', { tenant_id: tenantId, email, password: claveInicial });
      userToken = login.data.token;
    });

    it('rechaza con 401 si no hay token', async () => {
      const res = await postJson('/api/v1/auth/password', { password_actual: claveInicial, password_nueva: claveNueva }, {}, 'PUT');
      expect(res.status).toBe(401);
    });

    it('rechaza con 401 si la contraseña actual es incorrecta', async () => {
      const res = await postJson(
        '/api/v1/auth/password',
        { password_actual: 'otra_clave_123', password_nueva: claveNueva },
        { Authorization: `Bearer ${userToken}` },
        'PUT'
      );
      expect(res.status).toBe(401);
      expect(res.data.success).toBe(false);
    });

    it('rechaza con 400 una contraseña nueva menor a 8 caracteres', async () => {
      const res = await postJson(
        '/api/v1/auth/password',
        { password_actual: claveInicial, password_nueva: '123' },
        { Authorization: `Bearer ${userToken}` },
        'PUT'
      );
      expect(res.status).toBe(400);
    });

    it('cambia la contraseña: la nueva permite entrar y la anterior deja de servir', async () => {
      const res = await postJson(
        '/api/v1/auth/password',
        { password_actual: claveInicial, password_nueva: claveNueva },
        { Authorization: `Bearer ${userToken}` },
        'PUT'
      );
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);

      const loginNueva = await postJson('/api/v1/auth/login', { tenant_id: tenantId, email, password: claveNueva });
      expect(loginNueva.status).toBe(200);

      const loginAnterior = await postJson('/api/v1/auth/login', { tenant_id: tenantId, email, password: claveInicial });
      expect(loginAnterior.status).toBe(401);
    });
  });
});
