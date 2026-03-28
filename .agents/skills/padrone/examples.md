# Padrone Examples

> These examples use Zod for schemas, but any Standard Schema-compatible library (Valibot, ArkType, etc.) works.

## Basic CLI App

```ts
import { createPadrone } from 'padrone';
import * as z from 'zod/v4';

const program = createPadrone('todo')
  .configure({ version: '1.0.0', description: 'A todo list manager' })
  .command('add', (c) =>
    c
      .arguments(
        z.object({
          title: z.string().describe('Task title'),
          priority: z.enum(['low', 'medium', 'high']).default('medium'),
          tags: z.string().array().optional(),
        }),
        {
          positional: ['title'],
          fields: {
            priority: { flags: 'p', description: 'Priority level' },
            tags: { flags: 't', description: 'Tags for the task' },
          },
        },
      )
      .action((args, { runtime }) => {
        runtime.output(`Added: ${args.title} [${args.priority}]`);
        return { id: crypto.randomUUID(), ...args };
      }),
  )
  .command(['list', 'ls'], (c) =>
    c
      .arguments(z.object({
        status: z.enum(['all', 'pending', 'done']).default('all'),
        limit: z.coerce.number().min(1).max(100).default(10),
      }))
      .action((args) => {
        // fetch and return tasks...
        return [];
      }),
  );

program.cli();
```

Usage:
```sh
todo add "Buy groceries" --priority high --tags food,shopping
todo list --status pending --limit 5
todo ls  # alias for list
```

## Nested Subcommands

```ts
const program = createPadrone('myapp')
  .command('db', (c) =>
    c
      .configure({ description: 'Database operations' })
      .command('migrate', (sub) =>
        sub
          .arguments(z.object({ name: z.string() }), { positional: ['name'] })
          .action((args) => `Migrated: ${args.name}`),
      )
      .command('seed', (sub) =>
        sub.action(() => 'Database seeded')),
  );

program.eval('db migrate v1');  // => { result: 'Migrated: v1' }
program.eval('db seed');        // => { result: 'Database seeded' }
```

## Positional and Variadic Arguments

```ts
// Single positional
.arguments(z.object({
  file: z.string(),
  verbose: z.boolean().default(false),
}), {
  positional: ['file'],
})
// Usage: mycli process myfile.txt --verbose

// Multiple positional (order matters)
.arguments(z.object({
  source: z.string(),
  dest: z.string(),
}), {
  positional: ['source', 'dest'],
})
// Usage: mycli copy src/ dist/

// Variadic ('...' prefix collects remaining positional args into array)
.arguments(z.object({
  files: z.string().array().min(1),
  output: z.string().default('./out'),
}), {
  positional: ['...files'],
})
// Usage: mycli bundle a.ts b.ts c.ts --output dist/
```

## Interactive Prompts

```ts
.command('init', (c) =>
  c
    .arguments(
      z.object({
        name: z.string(),
        template: z.enum(['react', 'vue', 'svelte']),
        typescript: z.boolean().default(true),
      }),
      {
        interactive: true,  // prompt for all missing required fields
        // or: interactive: ['name', 'template']  — specific fields only
      },
    )
    .action((args) => {
      // args are guaranteed valid, prompted if missing
      return `Created ${args.name} with ${args.template}`;
    }),
)
```

When run without flags: prompts for `name` and `template`.
When run with flags: skips prompts for provided values.

## Environment Variables

```ts
import { createPadrone, padroneEnv } from 'padrone';

.command('serve', (c) =>
  c
    .arguments(z.object({
      port: z.coerce.number().default(3000),
      host: z.string().default('localhost'),
    }))
    .extend(padroneEnv(z.object({
      PORT: z.coerce.number().optional(),
      HOST: z.string().optional(),
    }).transform((e) => ({
      port: e.PORT,
      host: e.HOST,
    }))))
    .action((args) => `Serving on ${args.host}:${args.port}`),
)
// CLI flags > env vars > defaults
// PORT=8080 mycli serve  => "Serving on localhost:8080"
```

## Config Files

```ts
import { createPadrone, padroneConfig } from 'padrone';

.command('build', (c) =>
  c
    .arguments(z.object({
      outDir: z.string().default('./dist'),
      minify: z.boolean().default(false),
      target: z.enum(['es2020', 'es2022', 'esnext']).default('es2022'),
    }))
    .extend(padroneConfig({ files: 'build.config.json' }))
    .action((args) => `Building to ${args.outDir}`),
)
// Priority: CLI flags > config file > defaults
```

## Mounting Programs

```ts
// Build modular CLI tools by composing independent programs
const auth = createPadrone('auth')
  .command('login', (c) =>
    c
      .arguments(z.object({ username: z.string(), password: z.string() }))
      .action((args) => `Logged in as ${args.username}`),
  )
  .command('logout', (c) => c.action(() => 'Logged out'));

const admin = createPadrone('admin')
  .command('users', (c) => c.action(() => 'User list'))
  .command('roles', (c) => c.action(() => 'Role list'));

const app = createPadrone('myapp')
  .mount('auth', auth)
  .mount(['admin', 'adm'], admin);  // with alias

// myapp auth login --username=alice --password=secret
// myapp admin users
// myapp adm roles  (alias)

// With context transform
const appWithCtx = createPadrone('myapp')
  .context<{ db: Database }>()
  .mount('auth', auth, {
    context: (appCtx) => ({ db: appCtx.db }),
  });
```

## Interceptors

### Logging Interceptor

```ts
import { defineInterceptor } from 'padrone';

const logger = defineInterceptor({ name: 'logger' }, () => ({
  execute: (ctx, next) => {
    console.log(`[${new Date().toISOString()}] Running: ${ctx.command.path}`);
    const result = next();
    console.log(`[${new Date().toISOString()}] Done: ${ctx.command.path}`);
    return result;
  },
}));

program.intercept(logger);
```

### Auth Interceptor (Short-Circuit)

```ts
const auth = defineInterceptor({ name: 'auth' }, () => ({
  execute: (ctx, next) => {
    if (!process.env.API_TOKEN) {
      return { result: 'Error: Not authenticated' };  // short-circuit, skip handler
    }
    return next();
  },
}));
```

### Error Recovery Interceptor

```ts
const errorRecovery = defineInterceptor({ name: 'error-recovery' }, () => ({
  error: (ctx, next) => {
    console.error(`Error in ${ctx.command.path}: ${(ctx.error as Error).message}`);
    // Suppress the error and return a fallback result
    return { error: undefined, result: 'recovered' };
    // Or transform: return { error: new Error('wrapped') };
    // Or pass through: return next();
  },
}));
```

### Shutdown Cleanup Interceptor

```ts
const cleanup = defineInterceptor({ name: 'cleanup' }, () => ({
  shutdown: (ctx, next) => {
    if (ctx.error) {
      console.error('Pipeline failed:', (ctx.error as Error).message);
    }
    // Close connections, flush logs, etc.
    next();
  },
}));
```

### Full Lifecycle Interceptor (Cross-Phase State)

```ts
const telemetry = defineInterceptor({ name: 'telemetry' }, () => {
  // Closure state — fresh per execution, shared across phases
  let startTime: number;
  return {
    start: (_ctx, next) => {
      startTime = Date.now();
      return next();
    },
    shutdown: (ctx, next) => {
      const duration = Date.now() - startTime;
      console.log(`Command ${ctx.command.path} completed in ${duration}ms`);
      next();
    },
  };
});
```

### Context-Providing Interceptor

```ts
// Declare what the interceptor adds to context (type-level only)
const withDb = defineInterceptor({ name: 'with-db' })
  .provides<{ db: Database }>()
  .factory(() => ({
    execute: (ctx, next) => {
      const db = createDatabase();
      return next({ context: { ...ctx.context, db } });
    },
  }));

// ctx.context.db is now typed when this interceptor is registered
```

### Subcommand-Scoped Interceptor

```ts
const deployGuard = defineInterceptor({ name: 'deploy-guard' }, () => ({
  execute: (ctx, next) => {
    console.log('Deploy-specific middleware');
    return next();
  },
}));

const globalLogger = defineInterceptor({ name: 'global-logger' }, () => ({
  execute: (ctx, next) => {
    console.log(`Global: ${ctx.command.path}`);
    return next();
  },
}));

// Interceptors on subcommands only run for that command
const program = createPadrone('app')
  .command('deploy', (c) =>
    c
      .action((args) => 'deployed')
      .intercept(deployGuard),  // Only for 'deploy'
  )
  .intercept(globalLogger);  // For all commands

// Running 'deploy': globalLogger (outermost) -> deployGuard (innermost) -> handler
```

## Context

Pass a user-defined, strongly-typed context through the command tree:

```ts
type AppContext = { db: Database; logger: Logger };

const program = createPadrone('myapp')
  .context<AppContext>()
  .command('users', (c) =>
    c
      .command('list', (sub) =>
        sub.action((args, { context }) => {
          // context is typed as AppContext
          return context.db.query('SELECT * FROM users');
        }),
      )
      // Transform context for a subcommand
      .command('admin', (sub) =>
        sub
          .context((ctx) => ({ ...ctx, isAdmin: true }))
          .action((args, { context }) => {
            // context is { db, logger, isAdmin: boolean }
          }),
      ),
  );

// Provide context at invocation
const db = createDatabase();
const logger = createLogger();
program.cli({ context: { db, logger } });
program.eval('users list', { context: { db, logger } });
program.run('users list', {}, { context: { db, logger } });
```

## Wrapping External Tools *(experimental)*

```ts
.command('commit', (c) =>
  c
    .arguments(
      z.object({
        message: z.string(),
        all: z.boolean().default(false),
      }),
      { positional: ['message'] },
    )
    .wrap({
      command: 'git',
      args: ['commit'],
      positional: ['m'],
      schema: z.object({
        message: z.string(),
        all: z.boolean().optional(),
      }).transform((args) => ({
        m: args.message,
        a: args.all,
      })),
    }),
)
// mycli commit "fix bug" --all
// Runs: git commit -m "fix bug" -a
```

## Testing

### Basic Command Testing

```ts
import { testCli } from 'padrone/test';
import { describe, expect, it } from 'bun:test';

describe('todo CLI', () => {
  it('should add a task', async () => {
    const result = await testCli(program).run('add "Buy milk" --priority high');

    expect(result.result.title).toBe('Buy milk');
    expect(result.result.priority).toBe('high');
    expect(result.issues).toBeUndefined();
  });

  it('should report validation errors', async () => {
    const result = await testCli(program).run('add');

    expect(result.issues).toBeDefined();
    expect(result.issues!.length).toBeGreaterThan(0);
  });

  it('should capture stdout', async () => {
    const result = await testCli(program).run('add "Test" --priority low');

    expect(result.stdout).toContain('Added: Test [low]');
  });
});
```

### Testing with Mocks

```ts
it('should use env vars', async () => {
  const result = await testCli(program)
    .env({ PORT: '8080' })
    .run('serve');

  expect(result.result).toBe('Serving on localhost:8080');
});

it('should mock interactive prompts', async () => {
  const result = await testCli(program)
    .prompt({ name: 'myapp', template: 'react' })
    .run('init');

  expect(result.args).toEqual({ name: 'myapp', template: 'react', typescript: true });
});

it('should mock config files', async () => {
  // Use padroneConfig with a custom loadConfig for testing
  const programWithConfig = createPadrone('myapp')
    .extend(padroneConfig({
      files: 'build.config.json',
      loadConfig: () => ({ outDir: './build', minify: true }),
    }))
    .command('build', (c) =>
      c
        .arguments(z.object({ outDir: z.string(), minify: z.boolean() }))
        .action((args) => `Building to ${args.outDir}`)
    );

  const result = await testCli(programWithConfig).run('build');

  expect(result.result).toBe('Building to ./build');
});
```

### REPL Testing

```ts
it('should run a REPL session', async () => {
  const { results, stderr } = await testCli(program).repl([
    'add "Task 1"',
    'add "Task 2" --priority high',
    'list --status all',
  ]);

  expect(results).toHaveLength(3);
  expect(results[0]!.result.title).toBe('Task 1');
  expect(results[1]!.result.priority).toBe('high');
});
```

## REPL Mode

```ts
// Start REPL from code
for await (const result of program.repl({
  prompt: 'todo> ',
  greeting: 'Todo Manager v1.0.0',
  hint: 'Type .help for commands',
  spacing: { after: '─' },
  outputPrefix: '  ',
  scope: 'db',  // start scoped to subcommand
})) {
  // each result is a PadroneCommandResult
}

// Or via CLI flag
// $ todo --repl
```

## AI Integration

### Model Context Protocol (MCP) *(experimental)*

```ts
// Start MCP server from CLI
// $ myapp mcp
// $ myapp mcp stdio
// $ myapp mcp --port 8080 --host 0.0.0.0

// Or programmatically
await program.mcp({ port: 3000 });
await program.mcp({ transport: 'stdio' });
```

### Vercel AI SDK

```ts
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

const tool = program.tool();

const { text } = await generateText({
  model: anthropic('claude-sonnet-4-20250514'),
  tools: { todo: tool },
  prompt: 'Add a high-priority task to buy groceries',
});
```

## Update Checking

```ts
createPadrone('myapp')
  .configure({ version: '1.2.3' })
  .updateCheck()  // uses defaults: npm registry, 1 day interval
  .command('run', (c) => c.action(() => 'running'))
  .cli();

// After command output, shows:
// Update available: 1.2.3 → 1.3.0. Run `npm i -g myapp` to update.
```

## Command Overriding

```ts
// Extend an existing command's behavior
const base = createPadrone('app')
  .command('deploy', (c) =>
    c.arguments(z.object({ env: z.string() })).action((args) => `deployed to ${args.env}`),
  );

const extended = base.command('deploy', (c) =>
  c.action((args, ctx, base) => {
    console.log('Pre-deploy hook');
    const result = base(args, ctx);
    console.log('Post-deploy hook');
    return result;
  }),
);
```

## Custom Runtime (Non-Terminal)

```ts
const outputs: string[] = [];

const program = createPadrone('app')
  .runtime({
    output: (...args) => outputs.push(args.join(' ')),
    error: (msg) => outputs.push(`ERROR: ${msg}`),
    format: 'html',
    interactive: 'disabled',
  })
  .command('greet', (c) =>
    c.arguments(z.object({ name: z.string() })).action((args) => `Hello, ${args.name}!`),
  );
```
