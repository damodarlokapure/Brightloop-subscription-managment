const { z } = require('zod');
const { asyncHandler } = require('../utils/asyncHandler');
const authService = require('../services/authService');
const { AppError } = require('../middleware/errorHandler');

const signupSchema = z.object({
  name: z.string().min(2, 'Name is required.'),
  email: z.string().email('A valid email is required.'),
  password: z.string().min(1, 'Password is required.')
});

const loginSchema = z.object({
  email: z.string().email('A valid email is required.'),
  password: z.string().min(1, 'Password is required.')
});

const forgotPasswordSchema = z.object({
  email: z.string().email('A valid email is required.')
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required.'),
  password: z.string().min(1, 'Password is required.')
});

async function signup(req, res) {
  const validated = signupSchema.parse(req.body);
  const result = await authService.signup(validated);
  res.status(201).json(result);
}

async function login(req, res) {
  const validated = loginSchema.parse(req.body);
  const result = await authService.login(validated);
  res.json(result);
}

async function me(req, res) {
  const result = await authService.me(req.user);
  res.json(result);
}

async function forgotPassword(req, res) {
  const validated = forgotPasswordSchema.parse(req.body);
  const result = await authService.forgotPassword(validated);
  res.status(200).json(result);
}

async function resetPassword(req, res) {
  const validated = resetPasswordSchema.parse(req.body);
  const result = await authService.resetPassword(validated);
  res.json(result);
}

module.exports = {
  signup: asyncHandler(signup),
  login: asyncHandler(login),
  me: asyncHandler(me),
  forgotPassword: asyncHandler(forgotPassword),
  resetPassword: asyncHandler(resetPassword)
};
