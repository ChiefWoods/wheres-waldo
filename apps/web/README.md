# Web

## Setup

### Development

1. Set up env file

```sh
cp .env.example .env.development
```

2. Start development server

```sh
bun run dev
```

### Production

1. Set up env file

```sh
cp .env.example .env.development
```

2. Build app

```sh
bun run build
```

3. Start production server

```sh
bun run start
```

### Testing

1. Install Playwright

```sh
bun run test:e2e:install
```

2. Set up env file

```sh
cp .env.example .env.test
```

3. Run all tests

```sh
bun run test
```
