// Admin login only — an affiliate site has no shopper accounts to manage.
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { get } = require('../config/db');
const { signToken } = require('../utils/jwt');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const login = asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);
  const { email, password } = parsed.data;

  const user = await get(
    'SELECT id, name, email, password_hash, role FROM users WHERE email = ?',
    email.toLowerCase()
  );
  if (!user) throw new ApiError(401, 'Invalid email or password');

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new ApiError(401, 'Invalid email or password');

  delete user.password_hash;
  res.json({ user, token: signToken({ id: user.id, role: user.role, email: user.email }) });
});

const me = asyncHandler(async (req, res) => {
  const user = await get(
    'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
    req.user.id
  );
  if (!user) throw new ApiError(404, 'User not found');
  res.json({ user });
});

module.exports = { login, me };
