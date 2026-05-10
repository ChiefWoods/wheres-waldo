# Server

## Setup

1. Set up env file

```sh
cp .env.example .env.development
```

3. Perform Prisma migration

```sh
bun run db:migrate
```

4. Seed database

```sh
bun run db:seed
```

5. Generate Prisma client

```sh
bun run db:generate
```

6. Start dev server

```sh
bun run dev
```

### Testing

1. Set up env file

```sh
cp .env.example .env.test
```

2. Run all tests.

```sh
bun run test
```
