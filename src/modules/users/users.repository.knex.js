const map = row => row && ({ id: row.id, email: row.email,
  passwordHash: row.password_hash, role: row.role, createdAt: row.created_at });
function createUsersRepository(db) {
  return {
    async findById(id) { return map(await db('users').where({ id }).first()); },
    async findByEmail(email) { return map(await db('users').where({ email }).first()); },
    async create({ email, passwordHash, role }) {
      return map((await db('users').insert({ email, password_hash: passwordHash, role }).returning('*'))[0]);
    },
  };
}
module.exports = { createUsersRepository };
