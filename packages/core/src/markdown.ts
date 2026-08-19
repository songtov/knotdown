import type {
  DefinitionNode,
  Frontmatter,
  InlineNode,
  MarkdownAst,
  MarkdownBlock,
  ParsedMarkdown,
  SourceLocation,
} from "./types.ts";
import { parseYaml } from "./yaml.ts";

interface SourceLine {
  raw: string;
  line: number;
  start: number;
}

function sourceLines(source: string): SourceLine[] {
  const normalized = source.replace(/\r\n?/gu, "\n");
  const values = normalized.split("\n");
  const result: SourceLine[] = [];
  let start = 0;
  for (let index = 0; index < values.length; index += 1) {
    const raw = values[index] ?? "";
    result.push({ raw, line: index + 1, start });
    start += raw.length + 1;
  }
  return result;
}

function location(path: string, line: SourceLine, column: number): SourceLocation {
  return { path, line: line.line, column: column + 1, offset: line.start + column };
}

function findUnescaped(value: string, sought: string, start: number): number {
  for (let index = start; index < value.length; index += 1) {
    if (value[index] === "\\") {
      index += 1;
      continue;
    }
    if (value[index] === sought) return index;
  }
  return -1;
}

function parseInlineDestination(value: string, start: number): { destination: string; end: number } | undefined {
  let index = start;
  let depth = 1;
  let destination = "";
  while (index < value.length) {
    const character = value[index]!;
    if (character === "\\" && index + 1 < value.length) {
      destination += value[index + 1];
      index += 2;
      continue;
    }
    if (character === "(") {
      depth += 1;
      destination += character;
    } else if (character === ")") {
      depth -= 1;
      if (depth === 0) return { destination: destination.trim(), end: index + 1 };
      destination += character;
    } else {
      destination += character;
    }
    index += 1;
  }
  return undefined;
}

export function parseInlines(value: string, path: string, line: SourceLine, baseColumn = 0): InlineNode[] {
  const nodes: InlineNode[] = [];
  let cursor = 0;
  let textStart = 0;

  const flushText = (end: number): void => {
    if (end <= textStart) return;
    nodes.push({ type: "text", value: value.slice(textStart, end), location: location(path, line, baseColumn + textStart) });
  };

  while (cursor < value.length) {
    const character = value[cursor]!;
    if (character === "`" && (cursor === 0 || value[cursor - 1] !== "\\")) {
      let runLength = 1;
      while (value[cursor + runLength] === "`") runLength += 1;
      const marker = "`".repeat(runLength);
      const end = value.indexOf(marker, cursor + runLength);
      if (end >= 0) {
        flushText(cursor);
        nodes.push({
          type: "code",
          value: value.slice(cursor + runLength, end),
          location: location(path, line, baseColumn + cursor),
        });
        cursor = end + runLength;
        textStart = cursor;
        continue;
      }
    }
    const wikiStart = character === "[" && value[cursor + 1] === "["
      ? cursor
      : character === "!" && value[cursor + 1] === "[" && value[cursor + 2] === "["
        ? cursor + 1
        : -1;
    if (wikiStart >= 0 && (cursor === 0 || value[cursor - 1] !== "\\")) {
      const end = value.indexOf("]]", wikiStart + 2);
      if (end > wikiStart + 2) {
        const rawTarget = value.slice(wikiStart + 2, end);
        const separator = rawTarget.indexOf("|");
        const target = (separator < 0 ? rawTarget : rawTarget.slice(0, separator)).trim();
        const display = (separator < 0 ? target : rawTarget.slice(separator + 1)).trim() || target;
        if (target) {
          flushText(cursor);
          nodes.push({
            type: "wikilink",
            target,
            display,
            embed: wikiStart !== cursor,
            location: location(path, line, baseColumn + cursor),
          });
          cursor = end + 2;
          textStart = cursor;
          continue;
        }
      }
    }
    if (character === "[" && (cursor === 0 || (value[cursor - 1] !== "\\" && value[cursor - 1] !== "!"))) {
      const displayEnd = findUnescaped(value, "]", cursor + 1);
      if (displayEnd > cursor + 1) {
        const display = value.slice(cursor + 1, displayEnd);
        const next = value[displayEnd + 1];
        if (next === "(") {
          const destination = parseInlineDestination(value, displayEnd + 2);
          if (destination) {
            flushText(cursor);
            nodes.push({ type: "link", display, destination: destination.destination, location: location(path, line, baseColumn + cursor) });
            cursor = destination.end;
            textStart = cursor;
            continue;
          }
        }
        if (next === "[") {
          const labelEnd = findUnescaped(value, "]", displayEnd + 2);
          if (labelEnd >= 0) {
            const explicitLabel = value.slice(displayEnd + 2, labelEnd);
            flushText(cursor);
            nodes.push({
              type: "reference",
              display,
              label: explicitLabel || display,
              location: location(path, line, baseColumn + cursor),
            });
            cursor = labelEnd + 1;
            textStart = cursor;
            continue;
          }
        }
        flushText(cursor);
        nodes.push({ type: "reference", display, label: display, location: location(path, line, baseColumn + cursor) });
        cursor = displayEnd + 1;
        textStart = cursor;
        continue;
      }
    }
    cursor += 1;
  }
  flushText(value.length);
  return nodes;
}

function parseHeading(line: SourceLine, path: string): MarkdownBlock | undefined {
  let cursor = 0;
  while (cursor < 3 && line.raw[cursor] === " ") cursor += 1;
  const markerStart = cursor;
  while (line.raw[cursor] === "#" && cursor - markerStart < 6) cursor += 1;
  const depth = cursor - markerStart;
  if (depth === 0 || (line.raw[cursor] && line.raw[cursor] !== " " && line.raw[cursor] !== "\t")) return undefined;
  while (line.raw[cursor] === " " || line.raw[cursor] === "\t") cursor += 1;
  let end = line.raw.length;
  while (end > cursor && (line.raw[end - 1] === " " || line.raw[end - 1] === "\t")) end -= 1;
  let hashStart = end;
  while (hashStart > cursor && line.raw[hashStart - 1] === "#") hashStart -= 1;
  if (hashStart < end && hashStart > cursor && /\s/u.test(line.raw[hashStart - 1] ?? "")) {
    end = hashStart - 1;
    while (end > cursor && /\s/u.test(line.raw[end - 1] ?? "")) end -= 1;
  }
  const value = line.raw.slice(cursor, end);
  return { type: "heading", depth, value, inlines: parseInlines(value, path, line, cursor), location: location(path, line, markerStart) };
}

function parseDefinition(line: SourceLine, path: string): DefinitionNode | undefined {
  let cursor = 0;
  while (cursor < 4 && line.raw[cursor] === " ") cursor += 1;
  if (cursor > 3 || line.raw[cursor] !== "[") return undefined;
  const close = findUnescaped(line.raw, "]", cursor + 1);
  if (close <= cursor + 1 || line.raw[close + 1] !== ":") return undefined;
  const label = line.raw.slice(cursor + 1, close);
  cursor = close + 2;
  while (line.raw[cursor] === " " || line.raw[cursor] === "\t") cursor += 1;
  if (cursor >= line.raw.length) return undefined;
  let destination = "";
  if (line.raw[cursor] === "<") {
    const destinationEnd = findUnescaped(line.raw, ">", cursor + 1);
    if (destinationEnd < 0) return undefined;
    destination = line.raw.slice(cursor + 1, destinationEnd);
  } else {
    const start = cursor;
    while (cursor < line.raw.length && !/\s/u.test(line.raw[cursor] ?? "")) cursor += 1;
    destination = line.raw.slice(start, cursor);
  }
  if (!destination) return undefined;
  return { type: "definition", label, destination, location: location(path, line, 0) };
}

function fenceMarker(line: string): { character: string; length: number } | undefined {
  let cursor = 0;
  while (cursor < 4 && line[cursor] === " ") cursor += 1;
  if (cursor > 3 || (line[cursor] !== "`" && line[cursor] !== "~")) return undefined;
  const character = line[cursor]!;
  let end = cursor;
  while (line[end] === character) end += 1;
  if (end - cursor < 3) return undefined;
  return { character, length: end - cursor };
}

function isFenceClose(line: string, marker: { character: string; length: number }): boolean {
  let cursor = 0;
  while (cursor < 4 && line[cursor] === " ") cursor += 1;
  if (cursor > 3) return false;
  let count = 0;
  while (line[cursor + count] === marker.character) count += 1;
  return count >= marker.length && line.slice(cursor + count).trim() === "";
}

function inlinePlainText(nodes: InlineNode[]): string {
  return nodes.map((node) => {
    if (node.type === "text" || node.type === "code") return node.value;
    return node.display;
  }).join("");
}

export function blockPlainText(block: MarkdownBlock): string {
  if (block.type === "heading" || block.type === "paragraph") return inlinePlainText(block.inlines);
  return block.type === "code_block" ? block.value : "";
}

export function parseMarkdown(source: string, path: string, options: { frontmatterRequired?: boolean } = {}): ParsedMarkdown {
  const lines = sourceLines(source);
  const hasFrontmatter = lines.length > 0 && lines[0]!.raw.trim() === "---";
  if (!hasFrontmatter && options.frontmatterRequired !== false) throw new Error("frontmatter is required at the start of the document");
  let frontmatterEnd = hasFrontmatter ? -1 : -1;
  let frontmatter: Frontmatter = {};
  if (hasFrontmatter) {
    for (let index = 1; index < lines.length; index += 1) {
      if (lines[index]!.raw.trim() === "---") {
        frontmatterEnd = index;
        break;
      }
    }
    if (frontmatterEnd < 0) throw new Error("frontmatter closing delimiter is missing");
    const yamlSource = lines.slice(1, frontmatterEnd).map((line) => line.raw).join("\n");
    frontmatter = parseYaml(yamlSource) as Frontmatter;
  }
  const blocks: MarkdownBlock[] = [];
  let cursor = frontmatterEnd + 1;
  while (cursor < lines.length) {
    const line = lines[cursor]!;
    if (!line.raw.trim()) {
      cursor += 1;
      continue;
    }
    const marker = fenceMarker(line.raw);
    if (marker) {
      const values: string[] = [];
      const start = line;
      cursor += 1;
      while (cursor < lines.length && !isFenceClose(lines[cursor]!.raw, marker)) {
        values.push(lines[cursor]!.raw);
        cursor += 1;
      }
      if (cursor < lines.length) cursor += 1;
      blocks.push({ type: "code_block", value: values.join("\n"), location: location(path, start, 0) });
      continue;
    }
    const heading = parseHeading(line, path);
    if (heading) {
      blocks.push(heading);
      cursor += 1;
      continue;
    }
    const definition = parseDefinition(line, path);
    if (definition) {
      blocks.push(definition);
      cursor += 1;
      continue;
    }
    const paragraphStart = line;
    const paragraphLines: SourceLine[] = [];
    while (cursor < lines.length) {
      const candidate = lines[cursor]!;
      if (!candidate.raw.trim()) break;
      if (paragraphLines.length > 0 && (fenceMarker(candidate.raw) || parseHeading(candidate, path) || parseDefinition(candidate, path))) break;
      paragraphLines.push(candidate);
      cursor += 1;
    }
    const inlines: InlineNode[] = [];
    for (let index = 0; index < paragraphLines.length; index += 1) {
      const paragraphLine = paragraphLines[index]!;
      if (index > 0) inlines.push({ type: "text", value: "\n", location: location(path, paragraphLine, 0) });
      inlines.push(...parseInlines(paragraphLine.raw, path, paragraphLine));
    }
    blocks.push({
      type: "paragraph",
      value: paragraphLines.map((item) => item.raw).join("\n"),
      inlines,
      location: location(path, paragraphStart, 0),
    });
  }
  const bodyLines = lines.slice(frontmatterEnd + 1).map((line) => line.raw);
  return {
    frontmatter,
    ast: { type: "document", blocks },
    body: bodyLines.join("\n"),
    bodyStartLine: frontmatterEnd + 2,
  };
}
