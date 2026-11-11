// Gemeinsame Logik für Extraktion + Umbau der UI-Texte (i18n). Nur Entwicklungs-Werkzeug.
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(import.meta.dirname, "../..");
const EXCLUDE = [
  /components\/ui\//, /routeTree\.gen\.ts$/, /\.test\.tsx?$/, /src\/test\//, /src\/integrations\//,
  /routes\/admin\.tsx$/, /AdminUserManagement\.tsx$/, /CrewActivityAdmin\.tsx$/, /StripeDonationsAdmin\.tsx$/,
  /routes\/datenschutz\.tsx$/, /routes\/nutzungsbedingungen\.tsx$/, /lib\/i18n/, /lib\/(error-capture|error-page|lovable-error-reporting)\.ts$/,
  /src\/(server|start|router)\.tsx?$/,
];

export function files() {
  const out = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.tsx?$/.test(e.name)) out.push(p); } };
  walk(path.join(ROOT, "src"));
  return out.filter((f) => !EXCLUDE.some((r) => r.test(f.replaceAll("\\", "/"))));
}

const DENY_ATTR = new Set(["className", "data-testid", "to", "href", "src", "id", "key", "type", "name", "value", "variant", "size", "inputMode", "autoComplete", "role", "htmlFor", "target", "rel", "accept", "pattern", "method", "side", "align", "lang", "style", "enterKeyHint", "capture", "dir", "form", "testId", "inputTestId", "tab", "mode", "kind", "status", "icon", "color", "tone"]);
const DENY_PROP = new Set(["id", "k", "f", "key", "kind", "type", "status", "value", "to", "href", "src", "className", "cls", "variant", "mode", "tab", "code", "lang", "icon", "color", "testId", "path", "route", "queryKey", "slug", "tone", "accent", "emoji", "img", "image", "property", "name_key", "content_type", "contentType", "event", "table", "schema", "filter", "channel", "category", "cat", "game", "gameId", "sort"]);
const DENY_CALL = /^(from|rpc|eq|neq|select|order|channel|on|getItem|setItem|removeItem|addEventListener|removeEventListener|querySelector|querySelectorAll|getElementById|createElement|startsWith|endsWith|includes|split|replace|replaceAll|match|test|padStart|join|matchMedia|postMessage|createFileRoute|createRootRoute|log|warn|debug|info|invalidateQueries|removeChannel|storage|upload|createSignedUrl|remove|is|in|or|ilike|like|gte|lte|gt|lt|limit|range|single|maybeSingle|fetch|apiGet|apiPost|useMatch|navigate|nav|get|has|set|delete|toFixed|localeCompare|setAttribute|getAttribute|isMissing|invalidate)$/;

const LETTERS = /[A-Za-zÄÖÜäöüß]/;
export function looksNatural(s) {
  const v = s.trim();
  if (!v || !LETTERS.test(v)) return false;
  if (/^(https?:|\/|#|\.|@|data:|mailto:)/.test(v)) return false;
  if (/^[a-z0-9_.:\-\/\[\]#%()]+$/.test(v) && !/[äöüß]/.test(v)) return false; // identifiers, keys, css tokens
  const toks = v.split(/\s+/);
  const cssLike = toks.filter((x) => /^[!\-]?[a-z0-9]+(?:[-:\/\[][\w\-:\/.\[\]%#()]+)+$/.test(x) || /^(flex|grid|block|hidden|inline|relative|absolute|fixed|sticky|truncate|uppercase|italic|underline|shrink-0|grow|border|rounded|shadow|transition|group|peer|sr-only)$/.test(x)).length;
  if (cssLike && cssLike >= toks.length / 2) return false;
  if (/^[A-Z_0-9]+$/.test(v)) return false; // ERROR_CODES
  if (/^[A-Za-z]+$/.test(v) && v.length < 2) return false;
  return true;
}

function calleeName(call) {
  const e = call.expression;
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e)) return e.name.text;
  return "";
}

/** Liefert ob ein String-Knoten in einem übersetzbaren Kontext steht. */
export function eligible(node) {
  const p = node.parent;
  if (!p) return false;
  if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isExternalModuleReference(p) || ts.isLiteralTypeNode(p) || ts.isImportTypeNode?.(p)) return false;
  if (ts.isPropertyAssignment(p) && p.name === node) return false;
  if (ts.isPropertyAssignment(p) && p.initializer === node) { const n = p.name.getText(); if (DENY_PROP.has(n.replace(/["']/g, ""))) return false; }
  if (ts.isElementAccessExpression(p) || ts.isCaseClause(p) || ts.isEnumMember(p) || ts.isPropertySignature(p) || ts.isComputedPropertyName(p)) return false;
  if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.InKeyword].includes(p.operatorToken.kind)) return false;
  if (ts.isJsxAttribute(p)) { if (DENY_ATTR.has(p.name.getText())) return false; }
  if (ts.isCallExpression(p) && p.arguments.includes(node)) { const n = calleeName(p); if (DENY_CALL.test(n) || n === "tr") return false; }
  if (ts.isNewExpression(p) && ts.isIdentifier(p.expression) && ["URL", "RegExp", "Date", "Intl"].includes(p.expression.text)) return false;
  if (ts.isArrayLiteralExpression(p)) { // queryKey arrays
    const gp = p.parent; if (gp && ts.isPropertyAssignment(gp) && /queryKey|keys?$/i.test(gp.name.getText())) return false;
  }
  if (ts.isTaggedTemplateExpression(p)) return false;
  return true;
}

/** Template `a ${x} b` -> {key:"a {0} b", exprs:[x]} */
export function templateKey(node) {
  if (ts.isNoSubstitutionTemplateLiteral(node)) return { key: node.text, exprs: [] };
  let key = node.head.text; const exprs = [];
  node.templateSpans.forEach((s, i) => { key += `{${i}}` + s.literal.text; exprs.push(s.expression); });
  return { key, exprs };
}

export const normJsx = (s) => s.replace(/\s+/g, " ");

export function parse(file) {
  const src = fs.readFileSync(file, "utf8");
  return ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
}

export function program() {
  const cfg = ts.getParsedCommandLineOfConfigFile(path.join(ROOT, "tsconfig.json"), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} });
  return ts.createProgram(cfg.fileNames, cfg.options);
}

function hasJsx(n) { let f = false; const v = (x) => { if (f) return; if (ts.isJsxElement(x) || ts.isJsxSelfClosingElement(x) || ts.isJsxFragment(x)) { f = true; return; } ts.forEachChild(x, v); }; v(n); return f; }
function primitive(checker, expr) {
  const ty = checker.getTypeAtLocation(expr);
  const ok = (t) => !!(t.flags & (ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike | ts.TypeFlags.BigIntLike));
  return ty.isUnion() ? ty.types.every(ok) : ok(ty);
}

/** Kinder eines JSX-Elements, die nur aus Text + {String/Zahl} bestehen -> ein Satz. */
export function jsxSentence(el, checker) {
  const kids = el.children.filter((c) => !(ts.isJsxText(c) && c.containsOnlyTriviaWhiteSpaces));
  if (kids.length < 2) return null;
  if (!kids.every((c) => ts.isJsxText(c) || (ts.isJsxExpression(c) && c.expression && !hasJsx(c.expression) && primitive(checker, c.expression)))) return null;
  if (!kids.some((c) => ts.isJsxText(c) && looksNatural(c.text))) return null;
  let key = ""; const exprs = [];
  for (const c of el.children) {
    if (ts.isJsxText(c)) key += c.text; else if (c.expression) { key += `{${exprs.length}}`; exprs.push(c.expression); }
  }
  return { key: normJsx(key).trim(), exprs };
}
