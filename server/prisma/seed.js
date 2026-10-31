const bcrypt = require('bcrypt');
const prisma = require('../src/config/prisma');

async function main() {
  const adminPassword = 'Admin@12345';
  const staffPassword = 'Staff@12345';
  const customerPassword = 'Customer@12345';

  const adminHash = await bcrypt.hash(adminPassword, 10);
  const staffHash = await bcrypt.hash(staffPassword, 10);
  const customerHash = await bcrypt.hash(customerPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@brightloop.com' },
    update: {},
    create: {
      name: 'Brightloop Admin',
      email: 'admin@brightloop.com',
      passwordHash: adminHash,
      role: 'ADMIN',
      isActive: true
    }
  });

  const staff = await prisma.user.upsert({
    where: { email: 'staff@brightloop.com' },
    update: {},
    create: {
      name: 'Brightloop Staff',
      email: 'staff@brightloop.com',
      passwordHash: staffHash,
      role: 'STAFF',
      isActive: true
    }
  });

  const customer = await prisma.customer.upsert({
    where: { email: 'customer@brightloop.com' },
    update: {},
    create: {
      name: 'Brightloop Customer',
      email: 'customer@brightloop.com',
      company: 'Brightloop',
      phone: '+1234567890'
    }
  });

  await prisma.user.upsert({
    where: { email: 'customer@brightloop.com' },
    update: {},
    create: {
      name: 'Brightloop Customer',
      email: 'customer@brightloop.com',
      passwordHash: customerHash,
      role: 'CUSTOMER',
      isActive: true,
      customerId: customer.id
    }
  });

  console.log({ admin: admin.email, staff: staff.email, customer: customer.email });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
