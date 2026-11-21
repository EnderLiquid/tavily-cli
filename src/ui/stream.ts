export function out(line = ""): void {
  process.stdout.write(`${line}\n`);
}

export function err(line = ""): void {
  process.stderr.write(`${line}\n`);
}

export function log(line: string): void {
  process.stderr.write(`tavily-cli: ${line}\n`);
}

export function emitJson(data: unknown): void {
  out(JSON.stringify(data));
}
