const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const { validatePassword } = require('../validators/password');
const { jwtSecret, jwtExpiresIn, clientUrl, smtp } = require('../config/env');

function buildUserPayload(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    customerId: user.customerId,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, customerId: user.customerId },
    jwtSecret,
    { expiresIn: jwtExpiresIn }
  );
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function sendResetEmail(email, token) {
  const resetLink = `${clientUrl}/reset-password?token=${token}`;
  const smtpEnabled = smtp.host && smtp.user && smtp.pass && smtp.host !== 'smtp.mailtrap.io';

  if (!smtpEnabled) {
    console.log('Password reset link:', resetLink);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: {
      user: smtp.user,
      pass: smtp.pass
    }
  });

  return transporter.sendMail({
    from: smtp.from,
    to: email,
    subject: 'Brightloop password reset',
    text: `Reset your password here: ${resetLink}`
  });
}

async function signup({ name, email, password }) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const passwordCheck = validatePassword(password);

  if (!passwordCheck.isValid) {
    throw new AppError(400, 'WEAK_PASSWORD', 'Password validation failed.', passwordCheck.errors);
  }

  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existingUser) {
    throw new AppError(409, 'EMAIL_IN_USE', 'An account with this email already exists.');
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.create({
      data: {
        name,
        email: normalizedEmail,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    const newUser = await tx.user.create({
      data: {
        name,
        email: normalizedEmail,
        passwordHash: hashedPassword,
        role: 'CUSTOMER',
        isActive: true,
        customerId: customer.id
      }
    });

    await tx.user.update({
      where: { id: newUser.id },
      data: { customerId: customer.id }
    });

    return { ...newUser, customerId: customer.id };
  });

  const token = signToken(user);
  return {
    token,
    user: buildUserPayload(user)
  };
}

async function login({ email, password }) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  if (!user.isActive) {
    throw new AppError(401, 'INACTIVE_USER', 'This account is inactive.');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  const token = signToken(user);
  return {
    token,
    user: buildUserPayload(user)
  };
}

async function me(user) {
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');
  }
  return buildUserPayload(dbUser);
}

async function forgotPassword({ email }) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user) {
    return { message: 'If an account exists for this email, a reset link has been sent.' };
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  const tokenHash = hashToken(token);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
      usedAt: null
    }
  });

  await sendResetEmail(user.email, token);

  return { message: 'If an account exists for this email, a reset link has been sent.' };
}

async function resetPassword({ token, password }) {
  const passwordCheck = validatePassword(password);
  if (!passwordCheck.isValid) {
    throw new AppError(400, 'WEAK_PASSWORD', 'Password validation failed.', passwordCheck.errors);
  }

  const hashedToken = hashToken(token);
  const resetToken = await prisma.passwordResetToken.findFirst({
    where: {
      OR: [
        { tokenHash: hashedToken },
        { tokenHash: token }
      ],
      usedAt: null,
      expiresAt: { gt: new Date() }
    },
    include: { user: true }
  });

  if (!resetToken) {
    throw new AppError(400, 'INVALID_TOKEN', 'Password reset token is invalid or expired.');
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash: hashedPassword }
    });

    await tx.passwordResetToken.updateMany({
      where: { userId: resetToken.userId, NOT: { id: resetToken.id } },
      data: { usedAt: new Date() }
    });

    await tx.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() }
    });
  });

  return { message: 'Password reset successfully.' };
}

module.exports = {
  signup,
  login,
  me,
  forgotPassword,
  resetPassword
};
