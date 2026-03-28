# Padrone API Reference

## Exports from `'padrone'`

### `createPadrone(name)`

Creates a root program. Returns a `PadroneProgram`.

```ts
const program = createPadrone('mycli');
```

### `createPadroneBuilder(command)`

Creates a builder from an existing `AnyPadroneCommand`. Used for command merging and remounting.

### `asyncSchema(schema)`

Brands a schema as async, causing `parse()` and `cli()` to return Promises.

```ts
import { asyncSchema } from 'padrone';
const schema = asyncSchema(z.object({ name: z.string() }).check(async (v) => { ... }));
```

### Error Classes

#### `PadroneError`

Base error. All Padrone errors extend this.

```ts
new PadroneError(message, {
  exitCode?: number,       // default: 1
  suggestions?: string[],  // actionable hints shown to user
  command?: string,        // command path that produced the error
  phase?: 'parse' | 'validate' | 'execute' | 'config',
  cause?: unknown,
})
```

Properties: `exitCode`, `suggestions`, `command`, `phase`.
Method: `toJSON()` for serialization.

#### `RoutingError extends PadroneError`

Unknown command or routing failure. Phase defaults to `'parse'`.

#### `ValidationError extends PadroneError`

Schema validation failure. Phase defaults to `'validate'`.
Additional property: `issues: readonly { path?: PropertyKey[]; message: string }[]`.

#### `ConfigError extends PadroneError`

Config file loading or validation failure. Phase defaults to `'config'`.

#### `ActionError extends PadroneError`

Throw from action handlers for structured errors. Phase defaults to `'execute'`.

```ts
throw new ActionError('Missing environment', {
  exitCode: 1,
  suggestions: ['Use --env production or --env staging'],
});
```

### Exported Types

```ts
import type {
  PadroneCommand,
  AnyPadroneCommand,
  PadroneProgram,
  AnyPadroneProgram,
  PadroneBuilder,
  PadroneSchema,
  AsyncPadroneSchema,
  PadroneActionContext,
  PadroneInterceptor,
  PadroneExtension,
  PadroneCommandResult,
  PadroneParseResult,
  PadroneErrorOptions,
  PadroneCommandConfig,
  PadroneEvalPreferences,
  PadroneCliPreferences,
  PadroneReplPreferences,
  PadroneRuntime,
  UpdateCheckConfig,
  InferArgsInput,
  InferArgsOutput,
  InferCommand,
} from 'padrone';
```

---

## Builder Methods

All builder methods are immutable — they return a new instance.

### `.arguments(schema?, meta?)`

Defines the arguments schema for a command. Accepts any Standard Schema-compatible schema (Zod, Valibot, ArkType, etc.) directly or a function receiving the parent's schema.

**Schema parameter:**
```ts
// Direct schema
.arguments(z.object({
  name: z.string(),
  count: z.coerce.number().default(1),
}))

// Function-based (extends parent args)
.arguments((parentSchema) => parentSchema.extend({
  verbose: z.boolean().default(false),
}))
```

**Meta parameter:**

```ts
type ArgsMeta = {
  positional?: string[];              // field names; '...name' for variadic
  interactive?: boolean | string[];   // prompt for missing required fields
  optionalInteractive?: boolean | string[]; // prompt for optional fields too
  autoAlias?: boolean;                // auto kebab-case aliases for camelCase (default: true)
  stdin?: string | { field: string; as?: 'text' | 'lines' };
  fields?: Record<string, {
    flags?: string | string[];        // single-char short flags (-n, -v)
    alias?: string | string[];        // multi-char long aliases (--dry-run)
    description?: string;
    deprecated?: boolean | string;
    hidden?: boolean;
    examples?: unknown[];
    group?: string;
  }>;
};
```

### `.context(transform?)`

Sets or transforms the typed context for this command. Context flows through the command tree — subcommands inherit the parent's context type.

```ts
// Type-only — declare context type without runtime transform
.context<{ db: Database }>()

// With transform — modify inherited context at runtime
.context((parentCtx) => ({ ...parentCtx, logger: createLogger() }))

// Chainable — multiple calls compose transforms
.context<{ db: Database }>()
.context((ctx) => ({ ...ctx, logger: createLogger() }))
```

When used without arguments, `.context<T>()` only changes the TypeScript type. When called with a transform function, the function is applied at runtime when resolving context from root to the target command.

### `.action(handler?)`

Defines the command handler. Called with no args to create a passthrough command (useful for commands that only have subcommands).

```ts
.action((args, ctx, base?) => result)
```

- `args`: Validated output from the schema
- `ctx`: `{ runtime, command, program, progress, context }`
- `base`: Previous handler when overriding an existing command

### `.command(name, builderFn?)`

Creates or extends a subcommand.

```ts
// Simple
.command('list', (c) => c.action(() => 'list'))

// With aliases (tuple)
.command(['list', 'ls', 'l'], (c) => c.action(() => 'list'))

// Extending an existing command
.command('list', (c) => c.action((args, ctx, base) => {
  const original = base(args, ctx);
  return `modified: ${original}`;
}))

// Nested subcommands
.command('db', (c) =>
  c.command('migrate', (s) => s.action(() => 'migrated'))
   .command('seed', (s) => s.action(() => 'seeded'))
)
```

### `.mount(name, program, options?)`

Mounts an existing Padrone program as a subcommand tree.

```ts
const admin = createPadrone('admin')
  .command('users', (c) => c.action(() => 'users'))
  .command('roles', (c) => c.action(() => 'roles'));

const app = createPadrone('app')
  .mount('admin', admin)       // app admin users, app admin roles
  .mount(['db', 'd'], dbProgram); // with aliases

// With context transform
const app2 = createPadrone('app')
  .context<{ db: Database }>()
  .mount('admin', admin, {
    context: (appCtx) => ({ db: appCtx.db }),
  });
```

Re-paths all nested commands. Drops the mounted program's version. Preserves interceptors. The optional `{ context }` transform converts the parent's context type into what the mounted program expects.

### `.configure(config)`

```ts
.configure({
  title?: string,
  description?: string,
  version?: string,
  deprecated?: boolean | string,
  hidden?: boolean,
})
```

### `.intercept(interceptor)`

Registers an interceptor. See [Interceptor System](#interceptor-system).

### `.extend(extension)`

Applies a build-time extension. A `PadroneExtension` is a reusable bundle of configuration, commands, and interceptors.

#### `padroneEnv(schema)` extension

Parses environment variables into argument values. Replaces the former `.env()` builder method.

```ts
import { createPadrone, padroneEnv } from 'padrone';

.extend(padroneEnv(z.object({
  MY_APP_PORT: z.coerce.number(),
  MY_APP_HOST: z.string().optional(),
}).transform((e) => ({
  port: e.MY_APP_PORT,
  host: e.MY_APP_HOST,
}))))
```

#### `padroneConfig(options)` extension

Loads arguments from config files. Not included by default — must be explicitly applied via `.extend(padroneConfig(...))`.

```ts
import { createPadrone, padroneConfig } from 'padrone';

.extend(padroneConfig({ files: 'app.config.json' }))
.extend(padroneConfig({ files: ['app.config.json', 'app.config.yaml'], schema: configSchema }))
.extend(padroneConfig({ files: 'app.config.json', disabled: true }))
.extend(padroneConfig({ files: 'app.config.json', flag: false })) // disable --config/-c flag
.extend(padroneConfig({ files: 'app.config.json', inherit: false })) // don't inherit to subcommands
.extend(padroneConfig({ files: 'app.config.json', loadConfig: myLoader })) // custom config loader
```

### `.wrap(config)` *(experimental)*

Wraps an external CLI tool.

```ts
.wrap({
  command: string,          // e.g., 'git', 'docker'
  args?: string[],          // fixed args like ['commit']
  positional?: string[],    // positional arg names for the external tool
  inheritStdio?: boolean,   // default: true
  schema?: Schema | (argsSchema) => Schema,  // transform args to external format
})
```

Returns `Promise<WrapResult>` where `WrapResult = { exitCode, stdout?, stderr?, success }`.

### `.runtime(runtime)`

Custom I/O adapter for non-terminal environments.

```ts
.runtime({
  output?: (...args: unknown[]) => void,
  error?: (text: string) => void,
  argv?: () => string[],
  env?: () => Record<string, string | undefined>,
  format?: 'text' | 'ansi' | 'console' | 'markdown' | 'html' | 'json' | 'auto',
  interactive?: 'supported' | 'unsupported' | 'forced' | 'disabled',
  prompt?: (config) => Promise<unknown>,
  readLine?: (prompt: string) => Promise<string | null>,
})
```

### `.updateCheck(config?)`

Enables background update checking.

```ts
.updateCheck({
  packageName?: string,     // defaults to program name
  registry?: 'npm' | string,
  interval?: string,        // '1d', '12h', '30m' (default: '1d')
  cache?: string,           // cache file path
  disableEnvVar?: string,   // env var to disable (default: <NAME>_NO_UPDATE_CHECK)
})
```

Non-blocking. Respects CI and TTY. Shows notice after command output.

### `.async()`

Explicitly marks the command as async. Alternative to `asyncSchema()`.

---

## Program Methods

### `.cli(prefs?)`

CLI entry point. Parses `process.argv`. Throws on validation errors.

```ts
program.cli();
program.cli({ context: { db } });
program.cli({ context: { db } });  // provide typed context
```

Preferences:
```ts
type PadroneCliPreferences = {
  interactive?: boolean,
  context?: TContext,         // required when context type is not `unknown`
};
```

### `.eval(input, prefs?)`

Parse + validate + execute a command string. Returns issues softly (doesn't throw on validation errors).

```ts
const result = program.eval('greet --name Alice');
const result = program.eval('greet --name Alice', { context: { db } });
if (result.argsResult?.issues) { /* validation failed */ }
```

### `.run(name, args, prefs?)`

Execute a command by name with an args object. Always sync. No schema validation.

```ts
const result = program.run('greet', { name: 'World' });
const result = program.run('db migrate', { name: 'v1' });
const result = program.run('greet', { name: 'World' }, { context: { db } });
```

### `.parse(input?)`

Parse without executing. Returns `{ command, args?, argsResult? }`.

### `.repl(options?)`

Returns `AsyncIterable<PadroneCommandResult>`. Yields results for each executed command.

```ts
for await (const result of program.repl({
  prompt: 'app> ',
  greeting: 'Welcome!',
  hint: 'Type .help for commands',
  scope: 'db',              // start scoped to a subcommand
  spacing: { after: true },
  outputPrefix: '  ',
  completion: true,
})) {
  // handle each result
}
```

REPL built-in commands: `.help`, `.exit`, `.quit`, `.scope <cmd>`, `.scope ..`

### `.help(command?, prefs?)`

```ts
program.help();                              // root help
program.help('deploy');                      // command help
program.help('deploy', { format: 'json' }); // format: text|ansi|console|markdown|html|json|auto
program.help('deploy', { detail: 'full' }); // detail: minimal|standard|full
```

### `.completion(shell?)`

Returns shell completion script. Auto-detects shell if not specified.

```ts
program.completion('bash');
program.completion('zsh');
program.completion('fish');
program.completion('powershell');
```

### `.find(command)`

Returns the command object or `undefined`.

```ts
const cmd = program.find('db migrate');
```

### `.api()`

Type-safe programmatic API. Nested by command tree.

```ts
const api = program.api();
api.greet({ name: 'World' });
api.db.migrate({ name: 'v1' });
```

### `.tool()`

Returns a Vercel AI SDK `Tool` definition.

```ts
import { generateText } from 'ai';
const tool = program.tool();
```

### `.mcp(prefs?)` *(experimental)*

Starts a Model Context Protocol server (2025-11-25 spec). Exposes all non-hidden commands as MCP tools.

```ts
// HTTP (default) — Streamable HTTP with session management and SSE support
await program.mcp({ port: 3000, host: '127.0.0.1' });

// stdio — newline-delimited JSON over stdin/stdout
await program.mcp({ transport: 'stdio' });
```

Options: `transport` (`'http'` | `'stdio'`), `port`, `host`, `basePath`, `name`, `version`, `cors` (`string | false`).

Also available as a built-in CLI command: `myapp mcp [http|stdio] --port 3000`

### `.serve(prefs?)` *(experimental)*

Starts a REST HTTP server. Each command becomes an endpoint (`users list` → `/users/list`). Commands with `mutation: true` accept POST only; others accept GET and POST.

```ts
await program.serve({ port: 3000, basePath: '/api/' });
```

Options: `port`, `host`, `basePath`, `cors` (`string | false`), `builtins` (`{ health, help, schema, docs }`), `onRequest`, `onError`.

Built-in endpoints: `/_health`, `/_help`, `/_schema`, `/_docs` (Scalar OpenAPI viewer), `/_openapi`.

Also available as a built-in CLI command: `myapp serve --port 3000`

### `.stringify(command?, args?)`

Converts command and arguments back to a CLI string.

---

## Interceptor System

### defineInterceptor(meta, factory?)

Creates a reusable interceptor with metadata and a factory function. The factory is called fresh per execution, enabling cross-phase state sharing via closures.

```ts
import { defineInterceptor } from 'padrone';

// Two-arg form: metadata + factory
const timer = defineInterceptor({ name: 'timer', order: 10 }, () => {
  let startTime: number;
  return {
    start: (ctx, next) => { startTime = Date.now(); return next(); },
    shutdown: (ctx, next) => { console.log(`${Date.now() - startTime}ms`); return next(); },
  };
});

// Single-arg form with chaining (for typed context)
const withDb = defineInterceptor({ name: 'with-db' })
  .provides<{ db: Database }>()
  .factory(() => ({
    execute: (ctx, next) => next({ context: { ...ctx.context, db: createDb() } }),
  }));
```

**Metadata:** `name` (string), `order` (number, lower = outermost, default: 0), `id` (string, deduplication key — last wins), `disabled` (boolean).

**Chaining:** `.provides<T>()` and `.requires<T>()` for typed context (type-level only), `.factory(fn)` to set the factory.

### PadroneInterceptor Type

A `PadroneInterceptor` can be created with `defineInterceptor()` or as a plain object:

```ts
type PadroneInterceptor = {
  name: string;
  order?: number;
  id?: string;
  disabled?: boolean;
  start?: (ctx: InterceptorStartContext, next: () => T) => T;
  parse?: (ctx: InterceptorParseContext, next: () => InterceptorParseResult) => InterceptorParseResult;
  validate?: (ctx: InterceptorValidateContext, next: () => InterceptorValidateResult) => InterceptorValidateResult;
  execute?: (ctx: InterceptorExecuteContext, next: () => InterceptorExecuteResult) => InterceptorExecuteResult;
  error?: (ctx: InterceptorErrorContext, next: () => InterceptorErrorResult) => InterceptorErrorResult;
  shutdown?: (ctx: InterceptorShutdownContext, next: () => void) => void;
};
```

All handlers can return Promises for async behavior.

### Phase Contexts

**Shared across all phases:**
- `command`: The resolved command
- `context`: The user-provided context (from `cli()`/`eval()`/`run()` prefs)
- `signal`: `AbortSignal` for cancellation (provided by the signal extension)
- `runtime`: The resolved runtime
- `caller`: Invocation method (`'cli'`, `'eval'`, `'run'`, `'repl'`, `'serve'`, `'mcp'`, `'tool'`)

**Phase-specific fields:**

| Phase | Extra context fields | `next()` returns |
|---|---|---|
| start | `input`, `program` | Pipeline result |
| parse | `input` | `{ command, rawArgs, positionalArgs }` |
| validate | `rawArgs` (mutable), `positionalArgs` | `{ args, argsResult }` |
| execute | `args` (mutable) | `{ result }` |
| error | `error` | `{ error?, result? }` |
| shutdown | `error?`, `result?` | `void` |

`next()` accepts optional overrides: `next({ signal, context, runtime, ... })` to modify values for downstream interceptors.

### Phase Execution Rules

| Entry point | Phases run |
|---|---|
| `eval()` / `cli()` | start, parse, validate, execute, [error], shutdown |
| `parse()` | parse, validate |
| `run()` | execute only |

- Parse, start, error, shutdown use **root interceptors only**
- Validate, execute use **collected parent chain** (root outermost, subcommand innermost)
- Subcommand interceptors registered via `.intercept()` inside `.command()` apply only to that command

### Ordering

- Lower `order` = outermost (runs first before `next()`, last after)
- Same `order` preserves registration order
- First-registered = outermost by default
- Built-in extension orders: signal (-2000), autoOutput (-1100), color/stdin (-1001), help/version/repl (-1000), interactive (-999), suggestions (-500)
- When multiple interceptors share the same `id`, last one wins (deduplication)

---

## Testing Utilities (`'padrone/test'`)

### `testCli(program)`

Returns a fluent test builder.

```ts
import { testCli } from 'padrone/test';

const builder = testCli(program);
```

**Builder methods (all chainable):**

| Method | Purpose |
|---|---|
| `.args(input)` | Set CLI input string |
| `.env(vars)` | Set environment variables |
| `.prompt(answers)` | Mock interactive prompt answers |
| `.run(input?)` | Execute and return `TestCliResult` |
| `.repl(inputs)` | Run REPL session with array of inputs |

**`TestCliResult`:**

```ts
{
  command: AnyPadroneCommand,
  args: unknown,
  result: unknown,
  issues: { message: string; path?: PropertyKey[] }[] | undefined,
  stdout: unknown[],   // captured runtime.output() calls
  stderr: string[],    // captured runtime.error() calls
  error?: unknown,     // thrown error (if any)
}
```

**`TestReplResult`:**

```ts
{
  results: { command, args, result, issues }[],
  stdout: unknown[],
  stderr: string[],
}
```

---

## Type Helpers

```ts
import type {
  InferArgsInput,   // Extract input type of a command's args schema
  InferArgsOutput,  // Extract output type of a command's args schema
  InferCommand,     // Get command type by path: InferCommand<typeof program, 'db migrate'>
  InferContext,     // Extract context type: InferContext<typeof program>
} from 'padrone';
```

---

## Key Types Quick Reference

```ts
type PadroneActionContext<TContext = unknown> = {
  runtime: ResolvedPadroneRuntime;
  command: AnyPadroneCommand;
  program: AnyPadroneProgram;
  progress: PadroneProgressIndicator;
  context: TContext;
};

type PadroneCommandResult<T> = {
  command: T;
  args?: ArgsOutput;
  argsResult?: StandardSchemaV1.Result<ArgsOutput>;
  result: ActionReturnType;
};

type PadroneParseResult<T> = {
  command: T;
  args?: ArgsOutput;
  argsResult?: StandardSchemaV1.Result<ArgsOutput>;
};

type WrapResult = {
  exitCode: number;
  stdout?: string;
  stderr?: string;
  success: boolean;
};
```
