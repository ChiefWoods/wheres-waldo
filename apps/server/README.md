# Server

## Setup

### Development

1. Set up env file

```sh
cp .env.example .env.development
```

2. Perform Prisma migration

```sh
bun run db:deploy
```

3. Seed database

```sh
bun run db:seed
```

4. Generate Prisma client

```sh
bun run db:generate
```

5. Start dev server

```sh
bun run dev
```

### Testing

1. Set up env file

```sh
cp .env.example .env.test
```

2. Perform Prisma migration

```sh
NODE_ENV=test bun run db:deploy
```

3. Run all tests

```sh
bun run test
```
