/**
 * Secreto de firma JWT. En desarrollo y pruebas se admite un valor por defecto para no
 * bloquear el arranque local; en producción es obligatorio definir JWT_SECRET propio.
 */
export const DEV_FALLBACK_JWT_SECRET = 'super_secret_jwt_key_gestock_2026_change_in_production';

const MIN_PRODUCTION_SECRET_LENGTH = 32;

export function getJwtSecret(): string {
  return process.env.JWT_SECRET || DEV_FALLBACK_JWT_SECRET;
}

/**
 * Valida la configuración de autenticación antes de levantar el servidor.
 * Lanza un error en producción si JWT_SECRET falta, es el valor de ejemplo o es demasiado corto.
 */
export function assertAuthConfig(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const secret = process.env.JWT_SECRET;
  if (!secret || secret === DEV_FALLBACK_JWT_SECRET || secret.length < MIN_PRODUCTION_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET no configurado o inseguro: en produccion debe definirse con al menos ${MIN_PRODUCTION_SECRET_LENGTH} caracteres y distinto al valor de ejemplo`
    );
  }
}
