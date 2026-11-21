import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { searchParameters } from "@tavily/core/parameters";
import { describe, expect, it } from "vitest";
import { buildProgram } from "../src/cli.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliDoc = readFileSync(path.join(root, "skills/tavily/references/cli.md"), "utf8");
const projectDoc = readFileSync(path.join(root, "docs/cli.md"), "utf8");
const skillDoc = readFileSync(path.join(root, "skills/tavily/SKILL.md"), "utf8");
const skillDesign = readFileSync(path.join(root, "docs/skill.md"), "utf8");

function flagsIn(text: string): Set<string> {
  return new Set([...text.matchAll(/--[a-z][a-z0-9-]*/g)].map((match) => match[0]));
}

function section(text: string, name: string): string {
  const start = text.indexOf(`## ${name}`);
  if (start === -1) return "";
  const next = text.indexOf("\n## ", start + 1);
  return text.slice(start, next === -1 ? undefined : next);
}

function knownFlags(): Set<string> {
  const program = buildProgram();
  const flags = new Set<string>(["--help"]);
  for (const option of program.options) {
    if (option.long) flags.add(option.long);
  }
  for (const command of program.commands) {
    for (const option of command.options) {
      if (option.long) flags.add(option.long);
    }
  }
  return flags;
}

function searchFlags(): string[] {
  const hidden = new Set(["query", "includeUsage"]);
  return Object.keys(searchParameters)
    .filter((key) => !hidden.has(key))
    .map((key) =>
      key === "searchDepth"
        ? "--depth"
        : `--${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`,
    );
}

describe("文档", () => {
  it("覆盖所有 CLI flag", () => {
    const documented = flagsIn(cliDoc);
    const missing = [...knownFlags()].filter((flag) => !documented.has(flag));
    expect(missing).toEqual([]);
  });

  it("不记录不存在的 flag", () => {
    const known = knownFlags();
    const extra = [...flagsIn(cliDoc)].filter((flag) => !known.has(flag));
    expect(extra).toEqual([]);
  });

  it("覆盖 searchParameters 的所有可见参数", () => {
    const documented = flagsIn(cliDoc);
    const missing = searchFlags().filter((flag) => !documented.has(flag));
    expect(missing).toEqual([]);
  });

  it("每个命令的参数都出现在对应小节", () => {
    const program = buildProgram();
    for (const command of program.commands) {
      const documented = flagsIn(section(cliDoc, command.name()));
      const missing = command.options
        .map((option) => option.long)
        .filter((flag): flag is string => flag !== undefined && !documented.has(flag));
      expect({ command: command.name(), missing }).toEqual({
        command: command.name(),
        missing: [],
      });
    }
  });

  it("项目文档只指向 skill 的命令参考", () => {
    expect(projectDoc).toContain("../skills/tavily/references/cli.md");
    expect(projectDoc).not.toContain("| 选项 |");
  });

  it("SKILL.md 与设计文档都指向 references/cli.md", () => {
    expect(skillDoc).toContain("(references/cli.md)");
    expect(skillDoc).not.toContain("references/flags.md");
    expect(skillDesign).toContain("references/cli.md");
    expect(skillDesign).not.toContain("references/flags.md");
  });

  it("参考文档位于 references", () => {
    expect(existsSync(path.join(root, "skills/tavily/cli.md"))).toBe(false);
    expect(existsSync(path.join(root, "skills/tavily/references/cli.md"))).toBe(true);
  });

  it("旧的参数表已移除", () => {
    expect(existsSync(path.join(root, "skills/tavily/references/flags.md"))).toBe(false);
  });
});
