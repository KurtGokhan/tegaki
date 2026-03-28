---
name: padrone
description: Build CLI applications with the Padrone framework. Use when writing code that imports from 'padrone', creating CLI tools, defining commands with Zod schemas, or working with Padrone's builder API, interceptors, extensions, testing, REPL, or AI tool integration.
user-invocable: true
license: MIT
metadata:
  - type: npm-package
    name: padrone
    url: https://www.npmjs.com/package/padrone
---

# Padrone CLI Framework

Padrone is a type-safe CLI framework for Node.js/Bun. It uses any schema library that implements the [Standard Schema](https://github.com/standard-schema/standard-schema) spec (Zod, Valibot, ArkType, etc.) for argument validation and provides an immutable builder API for defining programs, commands, interceptors, and extensions.

## Installation

```bash
npm install padrone zod    # or any Standard Schema-compatible library instead of zod
```

## Quick Start

```ts
import { createPadrone } from 'padrone';
import * as z from 'zod/v4';

const program = createPadrone('mycli')
  .configure({ version: '1.0.0', description: 'My CLI app' })
  .command('greet', (c) =>
    c
      .arguments(z.object({ name: z.string() }), { positional: ['name'] })
      .action((args) => `Hello, ${args.name}!`),
  )
  .command(['deploy', 'dp'], (c) =>
    c
      .arguments(z.object({
        env: z.enum(['staging', 'production']),
        dry: z.boolean().default(false),
      }))
      .action((args, { runtime }) => {
        runtime.output(`Deploying to ${args.env}...`);
        return { deployed: true };
      }),
  );

program.cli();
```

## Core Concepts

- **Immutable builder**: Every method returns a new builder/program instance
- **Standard Schema validation**: Any schema library supporting `standard-schema` (Zod, Valibot, ArkType, etc.) defines positional args, named flags, defaults, coercion, and validation
- **Two entry points**: `'padrone'` (core) and `'padrone/test'` (testing utilities)
- **Sync by default**: Returns become async only when async schemas or interceptors are used

## Builder API Summary

| Method | Purpose |
|---|---|
| `.arguments(schema, meta?)` | Define options/args with a Standard Schema |
| `.action(handler?)` | Set the command handler `(args, ctx, base?) => result` |
| `.command(name, builderFn?)` | Add or extend a subcommand |
| `.context(transform?)` | Define typed context or transform inherited context |
| `.mount(name, program, options?)` | Mount another Padrone program as a subcommand (with optional `{ context }`) |
| `.configure(config)` | Set title, description, version, deprecated, hidden, group, mutation |
| `.intercept(interceptor)` | Register a middleware interceptor |
| `.extend(extension)` | Apply a build-time extension (bundle of config, commands, interceptors) |
| `.extend(padroneEnv(schema))` | Parse environment variables into args (import `padroneEnv` from `'padrone'`) |
| `.extend(padroneConfig({ files, schema? }))` | Load args from config files (import `padroneConfig` from `'padrone'`) |
| `.wrap(config)` | Wrap an external CLI tool *(experimental)* |
| `.extend(padroneProgress(config?))` | Auto-managed progress indicator (import `padroneProgress` from `'padrone'`) |
| `.runtime(runtime)` | Custom I/O adapter (output, error, env, prompt) |
| `.updateCheck(config?)` | Enable background update notifications |
| `.async()` | Mark command as using async validation |

## Program API Summary (after builder methods)

| Method | Purpose |
|---|---|
| `.cli(prefs?)` | Entry point from `process.argv` — throws on validation errors. Pass `context` in prefs. |
| `.eval(input, prefs?)` | Parse + validate + execute a string — returns issues softly. Pass `context` in prefs. |
| `.run(name, args, prefs?)` | Execute by name with args object (sync, no validation). Pass `context` in prefs. |
| `.parse(input?)` | Parse without executing |
| `.repl(options?)` | Start interactive REPL session |
| `.help(command?, prefs?)` | Generate help text |
| `.completion(shell?)` | Generate shell completion script |
| `.find(command)` | Look up a command by path |
| `.api()` | Type-safe programmatic API |
| `.tool()` | Vercel AI SDK tool definition |
| `.mcp(prefs?)` | Start MCP server (HTTP or stdio) *(experimental)* |
| `.serve(prefs?)` | Start REST server with OpenAPI docs *(experimental)* |
| `.stringify(command?, args?)` | Convert back to CLI string |

## Arguments Meta

The second parameter to `.arguments()` configures positional args, interactive prompts, and field metadata:

```ts
.arguments(schema, {
  positional: ['source', '...files'],     // '...' prefix = variadic
  interactive: true,                       // or ['fieldName'] for specific fields
  autoAlias: true,                         // auto kebab-case aliases for camelCase (default: true)
  stdin: 'data',                           // infers text/lines from schema type; use zodAsyncStream() for streaming
  fields: {
    output: { flags: 'o', description: 'Output path', examples: ['./dist'] },
    verbose: { flags: 'v', hidden: true },
    dryRun: { alias: 'dry' },             // multi-char long alias (--dry)
    old: { deprecated: 'Use --new instead', group: 'Legacy' },
  },
})
```

## Interceptor System

Six phases in onion/middleware pattern with `next()`:

1. **start** — before pipeline (root only, not called by `parse()`/`run()`)
2. **parse** — command routing (root only)
3. **validate** — schema validation (parent chain)
4. **execute** — handler execution (parent chain)
5. **error** — error handling (return `{ error: undefined, result }` to suppress)
6. **shutdown** — cleanup, always runs

All phase contexts include `context` (user-provided context), `signal` (AbortSignal for cancellation), `caller` (invocation method: `'cli'`, `'eval'`, `'run'`, etc.), and `runtime`.

```ts
import { defineInterceptor } from 'padrone';

const timer = defineInterceptor({ name: 'timer', order: -10 }, () => {
  let startTime: number;
  return {
    start: (ctx, next) => {
      startTime = Date.now();
      return next();
    },
    execute: (ctx, next) => {
      const result = next();
      console.log(`${ctx.command.path} took ${Date.now() - startTime}ms`);
      return result;
    },
  };
});
program.intercept(timer);
```

`defineInterceptor()` returns a factory — each execution gets fresh closure state. Supports `.provides<T>()` and `.requires<T>()` for typed context (type-level only).

## Extension-First Architecture

Padrone's core is minimal — most features are implemented as extensions composed via `.extend()`. When you call `createPadrone()`, built-in extensions are automatically applied:

| Extension | Order | What it does |
|-----------|-------|-------------|
| `signal` | -2000 | SIGINT/SIGTERM handling, AbortSignal propagation |
| `autoOutput` | -1100 | Auto-print results (strings, promises, iterators) |
| `color` | -1001 | `--color`/`--no-color` flag support |
| `stdin` | -1001 | Pipe stdin into argument fields |
| `help` | -1000 | `--help` flag, `help` command, error-phase help display |
| `version` | -1000 | `--version` flag |
| `repl` | -1000 | `--repl` flag, `repl` command |
| `interactive` | -999 | `--interactive` flag, auto-prompting |
| `suggestions` | -500 | "Did you mean?" for unknown commands/options |

Each can be disabled: `createPadrone('myapp', { builtins: { help: false } })`.

Advanced opt-in extensions: `padroneCompletion()`, `padroneLogger()`, `padroneTiming()`, `padroneProgress()`, `padroneMan()`, `padroneUpdateCheck()`, `padroneMcp()`, `padroneServe()`, `padroneTracing()`, `padroneInk()`, `padroneConfig()`.

## Testing

```ts
import { testCli } from 'padrone/test';

const result = await testCli(program).run('greet World');
// result: { command, args, result, issues, stdout, stderr, error }

// With mocks
await testCli(program)
  .env({ API_KEY: 'xxx' })
  .prompt({ name: 'myapp' })
  .run('deploy --env staging');

// REPL testing
const { results } = await testCli(program).repl(['greet Alice', 'greet Bob']);
```

## Progress Indicators

Auto-managed spinners for long-running commands via `padroneProgress()` context-providing interceptor:

```ts
.command('deploy', (c) =>
  c
    .async()
    .extend(padroneProgress({
      message: {
        progress: 'Deploying...',
        success: (result) => `Deployed v${result.version}`,
        error: 'Deploy failed',
      },
      bar: true,
      time: true,
      eta: true,
    }))
    .action(async (_args, ctx) => {
      await deploy();
      ctx.context.progress.update(0.5);
      ctx.context.progress.update('Finalizing...');
      return { version: '2.0' };
    }),
)
```

- **Auto-managed**: `padroneProgress()` starts before execution, calls `succeed`/`fail` automatically
- **Messages**: `message` accepts a string (progress message) or `{ validation?, progress?, success?, error? }`. Can also be provided from context via `progressConfig.message` — command-level fields take precedence
- **Manual control**: Use `ctx.context.progress` in action handlers — `update(string | number | { message?, progress?, indeterminate?, time? })`, `succeed`, `fail`, `stop`, `pause`, `resume`
- **Typed context**: `padroneProgress()` uses `.provides<{ progress: PadroneProgressIndicator }>()` — `ctx.context.progress` is fully typed
- **Dynamic messages**: `success`/`error` can be callbacks returning `string | null | { message, indicator }`
- **Spinner config**: `spinner` accepts preset name (`'dots'`, `'line'`, etc.), `true` (always show), `false` (disable), or `{ frames, interval, show }` object
- **Progress bar**: `bar: true` or `bar: { width, filled, empty, animation, show }` — renders percentage + bar. Indeterminate animations: `'bounce'`, `'slide'`, `'pulse'`
- **Elapsed time**: `time: true` shows `⏱ M:SS` counter. Can be toggled via `update({ time: true/false })`
- **ETA**: `eta: true` shows `ETA M:SS` based on progress rate. Requires numeric `update()` calls. Counts down between updates
- **Custom renderer**: `renderer: (message, options?) => PadroneProgressIndicator` to replace the built-in terminal renderer

## Error Classes

- `PadroneError` — base (exitCode, suggestions, command, phase)
- `RoutingError` — unknown command
- `ValidationError` — schema failures (has `.issues`)
- `ConfigError` — config file problems
- `ActionError` — throw from action handlers with structured metadata

## Additional Resources

- For the complete API reference with all type signatures, see [api-reference.md](api-reference.md)
- For full working examples covering common patterns, see [examples.md](examples.md)
