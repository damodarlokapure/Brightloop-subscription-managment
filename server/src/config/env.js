const dotenv = require('dotenv');

dotenv.config();

module.exports = {
  port: Number(process.env.PORT || 4000),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'development-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/brightloop?schema=public',
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
    port: Number(process.env.SMTP_PORT || 2525),
    user: process.env.SMTP_USER || 'user',
    pass: process.env.SMTP_PASS || 'pass',
    from: process.env.MAIL_FROM || 'no-reply@brightloop.local'
  }
};
