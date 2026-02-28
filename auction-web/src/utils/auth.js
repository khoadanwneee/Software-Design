import bcrypt from 'bcryptjs';

const BCRYPT_SALT_ROUNDS = 10;

/**
 * Hash mật khẩu với bcrypt
 * DRY-NEW-8: Thay vì hardcode salt rounds = 10 ở nhiều nơi
 */
export function hashPasswordSync(password) {
  return bcrypt.hashSync(password, BCRYPT_SALT_ROUNDS);
}

export async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}
