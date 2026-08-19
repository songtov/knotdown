interface YamlToken {
  indent: number;
  content: string;
  line: number;
}

export class YamlParseError extends Error {
  readonly line: number;

  constructor(message: string, line: number) {
    super(message);
    this.name = "YamlParseError";
    this.line = line;
  }
}

function stripComment(value: string): string {
  let quote = "";
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quote) {
      if (character === "\\" && quote === '"') index += 1;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === "#" && (index === 0 || /\s/u.test(value[index - 1] ?? ""))) return value.slice(0, index).trimEnd();
  }
  return value.trimEnd();
}

function findColon(value: string): number {
  let quote = "";
  let squareDepth = 0;
  let curlyDepth = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quote) {
      if (character === "\\" && quote === '"') index += 1;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === "[") squareDepth += 1;
    else if (character === "]") squareDepth -= 1;
    else if (character === "{") curlyDepth += 1;
    else if (character === "}") curlyDepth -= 1;
    else if (character === ":" && squareDepth === 0 && curlyDepth === 0) return index;
  }
  return -1;
}

function splitInline(value: string): string[] {
  const items: string[] = [];
  let start = 0;
  let quote = "";
  let depth = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quote) {
      if (character === "\\" && quote === '"') index += 1;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === "[" || character === "{") depth += 1;
    else if (character === "]" || character === "}") depth -= 1;
    else if (character === "," && depth === 0) {
      items.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  if (quote || depth !== 0) throw new Error("unterminated inline value");
  items.push(value.slice(start).trim());
  return items;
}

function parseScalar(value: string, line: number): unknown {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (/^[!&*]/u.test(trimmed) || trimmed.startsWith("<<:")) throw new YamlParseError("YAML tags, anchors, aliases, and merge keys are not supported", line);
  if (trimmed.startsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (typeof parsed !== "string") throw new Error("not a string");
      return parsed;
    } catch {
      throw new YamlParseError("invalid double-quoted scalar", line);
    }
  }
  if (trimmed.startsWith("'")) {
    if (!trimmed.endsWith("'") || trimmed.length < 2) throw new YamlParseError("invalid single-quoted scalar", line);
    return trimmed.slice(1, -1).replace(/''/gu, "'");
  }
  if (trimmed.startsWith("[")) {
    if (!trimmed.endsWith("]")) throw new YamlParseError("unterminated inline sequence", line);
    const body = trimmed.slice(1, -1).trim();
    if (!body) return [];
    try {
      return splitInline(body).map((item) => parseScalar(item, line));
    } catch (error) {
      if (error instanceof YamlParseError) throw error;
      throw new YamlParseError("invalid inline sequence", line);
    }
  }
  if (trimmed.startsWith("{") || trimmed.endsWith("}")) throw new YamlParseError("inline mappings are not supported", line);
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null" || trimmed === "~") return null;
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(trimmed)) return Number(trimmed);
  if (/^[\[\]{},]/u.test(trimmed)) throw new YamlParseError("malformed scalar", line);
  return trimmed;
}

function tokenize(source: string): YamlToken[] {
  const tokens: YamlToken[] = [];
  const lines = source.replace(/\r\n?/gu, "\n").split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index] ?? "";
    if (raw.includes("\t")) throw new YamlParseError("tabs are not allowed for indentation", index + 1);
    let indent = 0;
    while (raw[indent] === " ") indent += 1;
    const content = stripComment(raw.slice(indent));
    if (!content.trim()) continue;
    tokens.push({ indent, content, line: index + 1 });
  }
  return tokens;
}

function parseTokens(tokens: YamlToken[], start: number, indent: number): [unknown, number] {
  if (start >= tokens.length) return [{}, start];
  if (tokens[start]!.indent !== indent) throw new YamlParseError("unexpected indentation", tokens[start]!.line);
  return tokens[start]!.content === "-" || tokens[start]!.content.startsWith("- ")
    ? parseSequence(tokens, start, indent)
    : parseMapping(tokens, start, indent);
}

function assignMappingEntry(target: Record<string, unknown>, token: YamlToken, tokens: YamlToken[], cursor: number): number {
  const separator = findColon(token.content);
  if (separator <= 0) throw new YamlParseError("expected a mapping key followed by ':'", token.line);
  const key = token.content.slice(0, separator).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_-]*$/u.test(key)) throw new YamlParseError(`unsupported mapping key '${key}'`, token.line);
  if (Object.hasOwn(target, key)) throw new YamlParseError(`duplicate mapping key '${key}'`, token.line);
  const remainder = token.content.slice(separator + 1).trim();
  if (remainder) {
    target[key] = parseScalar(remainder, token.line);
    return cursor + 1;
  }
  const next = tokens[cursor + 1];
  if (!next || next.indent <= token.indent) {
    target[key] = null;
    return cursor + 1;
  }
  const [nested, nextCursor] = parseTokens(tokens, cursor + 1, next.indent);
  target[key] = nested;
  return nextCursor;
}

function parseMapping(tokens: YamlToken[], start: number, indent: number): [Record<string, unknown>, number] {
  const result: Record<string, unknown> = {};
  let cursor = start;
  while (cursor < tokens.length) {
    const token = tokens[cursor]!;
    if (token.indent < indent) break;
    if (token.indent > indent) throw new YamlParseError("unexpected indentation", token.line);
    if (token.content === "-" || token.content.startsWith("- ")) break;
    cursor = assignMappingEntry(result, token, tokens, cursor);
  }
  return [result, cursor];
}

function parseSequence(tokens: YamlToken[], start: number, indent: number): [unknown[], number] {
  const result: unknown[] = [];
  let cursor = start;
  while (cursor < tokens.length) {
    const token = tokens[cursor]!;
    if (token.indent < indent) break;
    if (token.indent !== indent || !(token.content === "-" || token.content.startsWith("- "))) break;
    const remainder = token.content.slice(1).trim();
    if (!remainder) {
      const next = tokens[cursor + 1];
      if (!next || next.indent <= indent) {
        result.push(null);
        cursor += 1;
      } else {
        const [nested, nextCursor] = parseTokens(tokens, cursor + 1, next.indent);
        result.push(nested);
        cursor = nextCursor;
      }
      continue;
    }
    if (findColon(remainder) > 0) {
      const item: Record<string, unknown> = {};
      const synthetic: YamlToken = { ...token, indent: indent + 2, content: remainder };
      cursor = assignMappingEntry(item, synthetic, tokens, cursor);
      while (cursor < tokens.length && tokens[cursor]!.indent > indent) {
        const continuation = tokens[cursor]!;
        if (continuation.indent !== indent + 2 || continuation.content.startsWith("- ")) break;
        cursor = assignMappingEntry(item, continuation, tokens, cursor);
      }
      result.push(item);
    } else {
      result.push(parseScalar(remainder, token.line));
      cursor += 1;
    }
  }
  return [result, cursor];
}

export function parseYaml(source: string): Record<string, unknown> {
  const tokens = tokenize(source);
  if (tokens.length === 0) return {};
  if (tokens[0]!.indent !== 0) throw new YamlParseError("root mapping must start at column 1", tokens[0]!.line);
  const [value, cursor] = parseTokens(tokens, 0, 0);
  if (cursor !== tokens.length) throw new YamlParseError("could not parse the complete YAML document", tokens[cursor]!.line);
  if (value === null || Array.isArray(value) || typeof value !== "object") throw new YamlParseError("root YAML value must be a mapping", 1);
  return value as Record<string, unknown>;
}
