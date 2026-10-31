const { z } = require('zod');
const { asyncHandler } = require('../utils/asyncHandler');
const userService = require('../services/userService');

const staffSchema = z.object({
  name: z.string().min(2, 'Name is required.'),
  email: z.string().email('A valid email is required.'),
  password: z.string().optional()
});

const staffPatchSchema = z.object({
  isActive: z.boolean()
});

async function createStaff(req, res) {
  const validated = staffSchema.parse(req.body);
  const generatedPassword = validated.password || 'Temp@12345';
  const result = await userService.createStaffUser({
    name: validated.name,
    email: validated.email,
    password: generatedPassword
  });

  res.status(201).json({
    message: 'Staff user created.',
    user: result
  });
}

async function listStaff(req, res) {
  const users = await userService.listStaffUsers();
  res.json(users);
}

async function updateStaff(req, res) {
  const validated = staffPatchSchema.parse(req.body);
  const user = await userService.updateStaffUser(req.params.id, validated);
  res.json(user);
}

module.exports = {
  createStaff: asyncHandler(createStaff),
  listStaff: asyncHandler(listStaff),
  updateStaff: asyncHandler(updateStaff)
};
