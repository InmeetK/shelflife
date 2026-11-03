// Generated types mark every RPC argument as non-null because Postgres has no
// per-argument nullability. Our RPCs accept null (no brand, no expiry date…),
// so widen Args to `T | null`. Import `Database` from here, not database.types.
import type { Database as Generated } from "./database.types";

type Fns = Generated["public"]["Functions"];
type NullableArgs<F> = F extends { Args: infer A } ? Omit<F, "Args"> & { Args: { [K in keyof A]: A[K] | null } } : F;

export type Database = Omit<Generated, "public"> & {
  public: Omit<Generated["public"], "Functions"> & { Functions: { [F in keyof Fns]: NullableArgs<Fns[F]> } };
};
export type Tables<T extends keyof Generated["public"]["Tables"]> = Generated["public"]["Tables"][T]["Row"];
