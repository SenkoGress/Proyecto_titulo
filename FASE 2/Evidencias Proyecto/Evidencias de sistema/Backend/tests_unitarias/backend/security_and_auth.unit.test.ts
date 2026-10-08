import { Request, Response } from 'express';
import {
  validateTenantAndAuth,
  rbacAuthMiddleware,
  globalErrorHandler
} from '../../src/middleware/security.middleware';

describe('Pruebas Unitarias: Seguridad, Validacion de Tenant y Error Handling', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: jest.Mock;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      query: {},
      body: {},
      path: '/api/v1/pos/products'
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    nextFunction = jest.fn();
    delete process.env.API_KEY;
  });

  describe('Validacion de Tenant ID', () => {
    test('permite el paso cuando el tenant_id tiene formato UUID valido', () => {
      mockRequest.query = { tenant_id: '00000000-0000-0000-0000-000000000001' };
      validateTenantAndAuth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledTimes(1);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    test('permite el paso cuando el tenant_id es alfanumerico seguro', () => {
      mockRequest.headers = { 'x-tenant-id': 'tenant_pos_local_01' };
      validateTenantAndAuth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledTimes(1);
    });

    test('rechaza con HTTP 400 cuando el tenant_id contiene caracteres peligrosos de inyeccion', () => {
      mockRequest.query = { tenant_id: "tenant-1'; DROP TABLE usuarios; --" };
      validateTenantAndAuth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Formato de Tenant ID invalido'
        })
      );
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('Autenticacion por API Key para Clientes Externos', () => {
    beforeEach(() => {
      process.env.API_KEY = 'secret-gestock-api-key-2026';
    });

    test('permite peticion externa cuando la cabecera X-API-Key es correcta', () => {
      mockRequest.headers = {
        'x-api-key': 'secret-gestock-api-key-2026',
        'x-tenant-id': 'tenant-test-01'
      };
      validateTenantAndAuth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledTimes(1);
    });

    test('rechaza con HTTP 401 cuando la cabecera X-API-Key es incorrecta', () => {
      mockRequest.headers = {
        'x-api-key': 'llave-invalida-atacante',
        'x-tenant-id': 'tenant-test-01'
      };
      validateTenantAndAuth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'API Key no autorizada o invalida'
        })
      );
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('Manejador Centralizado de Errores (Error Sanitizer)', () => {
    test('sanitiza el mensaje de error y no filtra stack trace en produccion', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const internalError = new Error('Database connection credentials failed at 192.168.1.50');
      globalErrorHandler(internalError, mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Ocurrio un error interno en el servidor'
      });

      process.env.NODE_ENV = originalEnv;
    });

    test('respeta codigos de estado HTTP personalizados si estan definidos en el error', () => {
      const customError: any = new Error('Recurso no encontrado');
      customError.status = 404;

      globalErrorHandler(customError, mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  describe('Criptografia Bcrypt & Tokens JWT (RNF-SEG-01, RNF-SEG-02)', () => {
    const bcrypt = require('bcryptjs');
    const jwt = require('jsonwebtoken');
    const SECRET = 'test-jwt-secret-gestock';

    test('genera hashes Bcrypt reales de exactamente 60 caracteres con work factor 10', () => {
      const password = 'PasswordSegura2026!';
      const hash = bcrypt.hashSync(password, 10);

      expect(hash).toHaveLength(60);
      expect(hash.startsWith('$2b$10$') || hash.startsWith('$2a$10$')).toBe(true);
      expect(bcrypt.compareSync(password, hash)).toBe(true);
      expect(bcrypt.compareSync('clave-incorrecta', hash)).toBe(false);
    });

    test('firma y valida tokens JWT con expiracion y exclusion de credenciales sensibles', () => {
      const payload = {
        id: 'user-uuid-1234',
        tenant_id: 'tenant-uuid-5678',
        email: 'cajero@gestock.cl',
        rol: 'cajero',
        nombre: 'Juan Perez'
      };

      const token = jwt.sign(payload, SECRET, { expiresIn: '24h' });
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);

      const decoded: any = jwt.verify(token, SECRET);
      expect(decoded.id).toBe('user-uuid-1234');
      expect(decoded.rol).toBe('cajero');
      expect(decoded.password_hash).toBeUndefined();
    });

    test('rechaza verificacion de token JWT alterado o con firma invalida', () => {
      const token = jwt.sign({ id: 'user-1' }, SECRET);
      const tokenManipulado = token.slice(0, -5) + 'xxxxx';

      expect(() => {
        jwt.verify(tokenManipulado, SECRET);
      }).toThrow();
    });
  });

  describe('Control de Acceso Basado en Roles (RBAC Middleware)', () => {
    const jwt = require('jsonwebtoken');
    const SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_gestock_2026_change_in_production';

    const adminToken = jwt.sign(
      { id: 'admin-id', tenant_id: 't-1', email: 'admin@gestock.cl', rol: 'admin', nombre: 'Admin' },
      SECRET,
      { expiresIn: '1h' }
    );

    const cajeroToken = jwt.sign(
      { id: 'cajero-id', tenant_id: 't-1', email: 'cajero@gestock.cl', rol: 'cajero', nombre: 'Cajero' },
      SECRET,
      { expiresIn: '1h' }
    );

    test('permite acceso al cajero a rutas del POS (/pos/products)', () => {
      mockRequest.originalUrl = '/api/v1/pos/products';
      mockRequest.headers = { authorization: `Bearer ${cajeroToken}` };

      rbacAuthMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledTimes(1);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    test('bloquea con HTTP 403 al cajero intentando acceder a ruta de administración (/dashboard)', () => {
      mockRequest.originalUrl = '/api/v1/dashboard/overview';
      mockRequest.headers = { authorization: `Bearer ${cajeroToken}` };

      rbacAuthMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('administrador')
        })
      );
      expect(nextFunction).not.toHaveBeenCalled();
    });

    test('permite acceso al administrador a rutas de administración (/dashboard)', () => {
      mockRequest.originalUrl = '/api/v1/dashboard/overview';
      mockRequest.headers = { authorization: `Bearer ${adminToken}` };

      rbacAuthMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledTimes(1);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    test('rechaza con HTTP 401 si el token JWT es inválido o adulterado', () => {
      mockRequest.originalUrl = '/api/v1/pos/products';
      mockRequest.headers = { authorization: 'Bearer token-invalido-o-expirado' };

      rbacAuthMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(nextFunction).not.toHaveBeenCalled();
    });

    test('rechaza con HTTP 401 si no hay token y ENFORCE_AUTH está activado', () => {
      const origEnforce = process.env.ENFORCE_AUTH;
      process.env.ENFORCE_AUTH = 'true';

      mockRequest.originalUrl = '/api/v1/pos/products';
      mockRequest.headers = {};

      rbacAuthMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(nextFunction).not.toHaveBeenCalled();

      process.env.ENFORCE_AUTH = origEnforce;
    });

    test('omite verificación y permite paso libre en rutas públicas (/health, /api)', () => {
      mockRequest.originalUrl = '/health';
      mockRequest.headers = {};

      rbacAuthMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledTimes(1);
    });
  });
});
