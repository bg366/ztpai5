exports.up = async knex => {
  await knex.schema.createTable('users', table => {
    table.increments('id');
    table.text('email').notNullable().unique();
    table.text('password_hash').notNullable();
    table.text('role').notNullable().defaultTo('USER');
    table.check("role IN ('USER', 'ADMIN')", [], 'users_role_allowed');
    table.check('email = lower(email)', [], 'users_email_lowercase');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};
exports.down = knex => knex.schema.dropTable('users');
