export interface KnotdownTheme {
  colors?: Partial<Record<"ink" | "muted" | "line" | "paper" | "panel" | "accent" | "accentSoft" | "warning", string>>;
}

const variables: Record<NonNullable<KnotdownTheme["colors"]> extends Partial<Record<infer Key, string>> ? Key & string : never, string> = {
  ink: "--ink",
  muted: "--muted",
  line: "--line",
  paper: "--paper",
  panel: "--panel",
  accent: "--accent",
  accentSoft: "--accent-soft",
  warning: "--warning",
};

export function renderThemeCss(theme?: KnotdownTheme): string {
  if (!theme?.colors) return "";
  const declarations = Object.entries(theme.colors).map(([key, value]) => {
    if (typeof value !== "string" || !/^#[0-9a-f]{3}(?:[0-9a-f]{3})?(?:[0-9a-f]{2})?$/iu.test(value)) throw new Error(`Theme color '${key}' must be a 3, 6, or 8 digit hex color.`);
    return `${variables[key as keyof typeof variables]}:${value}`;
  });
  return declarations.length === 0 ? "" : `:root{${declarations.join(";")}}`;
}
