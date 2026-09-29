/**
 * A stand-in for the supabase-js query builder, so Server Actions can be tested
 * for the decisions they make rather than for the rows a database returns.
 *
 * The real builder is chainable and thenable: `.from(t).select(c).eq(a, b)` is
 * still a builder, and awaiting it runs the query. This records every call in that
 * chain and resolves to whatever the test says that table should return, which is
 * what lets a test assert things like "no visibility row was written" or "the role
 * was checked before the username was looked up".
 *
 * Not a Supabase emulator: it proves the action's logic, not the SQL. The database
 * side of these rules — the constraints, the indexes, the transactional functions —
 * is asserted against supabase/schema.sql in supabase/schema.test.ts.
 */
export interface RecordedCall {
  table: string;
  /** Method name followed by its arguments, in call order. */
  ops: unknown[][];
}

export interface RecordedRpc {
  name: string;
  args: Record<string, unknown>;
}

export interface QueryResult {
  data?: unknown;
  error?: { message: string; code?: string } | null;
}

type Handler = (call: RecordedCall) => QueryResult;

export interface SupabaseMock {
  client: {
    from: (table: string) => unknown;
    rpc: (name: string, args: Record<string, unknown>) => unknown;
  };
  calls: RecordedCall[];
  rpcs: RecordedRpc[];
  /** Every call made against one table, in order. */
  callsTo: (table: string) => RecordedCall[];
  /** Whether any chain on `table` used this method, e.g. 'insert' or 'upsert'. */
  used: (table: string, method: string) => boolean;
  /** The arguments a method was called with, first match only. */
  argsFor: (table: string, method: string) => unknown[] | undefined;
}

export const createSupabaseMock = (
  handlers: Record<string, Handler | QueryResult> = {},
  rpcResults: Record<string, QueryResult> = {}
): SupabaseMock => {
  const calls: RecordedCall[] = [];
  const rpcs: RecordedRpc[] = [];

  const resultFor = (call: RecordedCall): QueryResult => {
    const handler = handlers[call.table];
    if (typeof handler === 'function') {
      return handler(call);
    }
    return handler ?? { data: null, error: null };
  };

  const thenable = (record: RecordedCall, settle: () => QueryResult): unknown => {
    const chain: Record<string, unknown> = {};

    return new Proxy(chain, {
      get(_target, property) {
        if (property === 'then') {
          return (onFulfilled: (value: QueryResult) => unknown) => {
            const result = settle();
            return Promise.resolve({ data: null, error: null, ...result }).then(onFulfilled);
          };
        }

        return (...args: unknown[]) => {
          record.ops.push([property, ...args]);
          return thenable(record, settle);
        };
      },
    });
  };

  return {
    client: {
      from: (table: string) => {
        const record: RecordedCall = { table, ops: [] };
        calls.push(record);
        return thenable(record, () => resultFor(record));
      },
      rpc: (name: string, args: Record<string, unknown>) => {
        rpcs.push({ name, args });
        const record: RecordedCall = { table: `rpc:${name}`, ops: [] };
        calls.push(record);
        return thenable(record, () => rpcResults[name] ?? { data: 'ok', error: null });
      },
    },
    calls,
    rpcs,
    callsTo: (table) => calls.filter((call) => call.table === table),
    used: (table, method) =>
      calls.some((call) => call.table === table && call.ops.some(([name]) => name === method)),
    argsFor: (table, method) => {
      for (const call of calls) {
        if (call.table !== table) continue;
        const op = call.ops.find(([name]) => name === method);
        if (op) return op.slice(1);
      }
      return undefined;
    },
  };
};
