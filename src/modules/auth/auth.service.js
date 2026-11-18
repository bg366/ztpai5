const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('node:crypto');
const { ConflictError, UnauthorizedError } = require('../../errors/AppError');
const BCRYPT_ROUNDS = 12;

function createAuthService({ usersRepository, jwtSecret, jwtExpiresIn }) {
  // Nieistniejący email również wymaga porównania bcrypt.
  const dummyHash = bcrypt.hash(randomBytes(32).toString('hex'), BCRYPT_ROUNDS);
  return {
    async register({ email, password }) {
      if (await usersRepository.findByEmail(email)) {
        throw new ConflictError('EMAIL_TAKEN', 'Email already registered');
      }
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      // UNIQUE w bazie zabezpiecza także równoległe rejestracje.
      return usersRepository.create({ email, passwordHash, role: 'USER' });
    },
    async login({ email, password }) {
      const user = await usersRepository.findByEmail(email);
      const matches = await bcrypt.compare(password, user?.passwordHash ?? await dummyHash);
      if (!user || !matches || bcrypt.truncates(password)) {
        throw new UnauthorizedError('Invalid email or password');
      }
      const accessToken = jwt.sign({ role: user.role }, jwtSecret, {
        subject: String(user.id), algorithm: 'HS256', expiresIn: jwtExpiresIn,
      });
      return { accessToken, tokenType: 'Bearer', expiresIn: jwtExpiresIn };
    },
    async me(currentUser) {
      const user = await usersRepository.findById(currentUser.id);
      if (!user) throw new UnauthorizedError('User no longer exists');
      return user;
    },
  };
}
module.exports = { createAuthService };
