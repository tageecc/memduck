export function getRuntimeDir(): string {
  return process.env.MEMDUCK_RUNTIME_DIR ?? `${process.cwd()}/.memduck/runtime`;
}
