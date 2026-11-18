const toUserResponse = user => ({
  id: user.id, email: user.email, role: user.role,
  createdAt: new Date(user.createdAt).toISOString(),
});
module.exports = { toUserResponse };
