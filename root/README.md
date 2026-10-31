# Brightloop Subscription Management System

A monorepo for the Brightloop subscription platform.

## Structure

- `server/` - Express.js + Prisma backend
- `client/` - React + Vite + Tailwind frontend

## Run locally

### Server

```bash
cd server
npm install
npm run dev
```

### Client

```bash
cd client
npm install
npm run dev
```

## Notes

- Copy `.env.example` to `.env` in the server and client folders before running locally.
- PostgreSQL should be running on `localhost:5432` with the database configured in `DATABASE_URL`.
