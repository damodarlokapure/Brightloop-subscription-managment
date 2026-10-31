const bcrypt = require('bcrypt');
const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const { validatePassword } = require('../validators/password');

async function createStaffUser({ name, email, password }) {
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

  const user = await prisma.user.create({
    data: {
      name,
      email: normalizedEmail,
      passwordHash: hashedPassword,
      role: 'STAFF',
      isActive: true
    }
  });

  return user;
}

async function listStaffUsers() {
  return prisma.user.findMany({
    where: { role: 'STAFF' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: { createdAt: 'desc' }
  });
}

async function updateStaffUser(id, { isActive }) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.role !== 'STAFF') {
    throw new AppError(404, 'STAFF_NOT_FOUND', 'Staff user not found.');
  }

  return prisma.user.update({
    where: { id },
    data: { isActive },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    }
  });
}

module.exports = {
  createStaffUser,
  listStaffUsers,
  updateStaffUser
};
