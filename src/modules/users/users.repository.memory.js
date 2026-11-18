const { ConflictError } = require('../../errors/AppError');
function createUsersRepository(state) {
  return {
    async findById(id) { return state.users.find(user => user.id === id); },
    async findByEmail(email) { return state.users.find(user => user.email === email); },
    async create(data) {
      if (state.users.some(user => user.email === data.email)) throw new ConflictError('EMAIL_TAKEN', 'Email already registered');
      const user = { ...data, id: state.nextUserId++, createdAt: new Date() };
      state.users.push(user);
      return user;
    },
  };
}
module.exports = { createUsersRepository };
