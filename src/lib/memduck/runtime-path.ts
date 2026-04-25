import os from "node:os";
import path from "node:path";

export function getMemduckHome(
  env: Record<string, string | undefined> = process.env,
): string {
  return env.MEMDUCK_HOME
    ? path.resolve(env.MEMDUCK_HOME)
    : path.join(os.homedir(), ".memduck");
}

export function getRuntimeDir(
  env: Record<string, string | undefined> = process.env,
): string {
  return env.MEMDUCK_RUNTIME_DIR
    ? path.resolve(env.MEMDUCK_RUNTIME_DIR)
    : path.join(getMemduckHome(env), "runtime");
}
