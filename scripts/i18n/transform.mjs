// Umbau: wickelt alle UI-Texte, die in src/lib/i18n-en.ts stehen, in tr(...) ein und ersetzt "de-DE" durch locale().
// Aufruf: node scripts/i18n/transform.mjs [--dry]
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";
import { ROOT, files, eligible, templateKey, normJsx, program, jsxSentence } from "./common.mjs";

const dry = process.argv.includes("--dry");
const enSrc = fs.readFileSync(path.join(ROOT, "src/lib/i18n-en.ts"), "utf8");
const KEYS = new Set();
{ const sf = ts.createSourceFile("en.ts", enSrc, ts.ScriptTarget.Latest, true);
  const v = (n) => { if (ts.isPropertyAssignment(n) && ts.isStringLiteral(n.name)) KEYS.add(n.name.text); ts.forEachChild(n, v); }; v(sf); }

const prog = program(); const checker = prog.getTypeChecker();
const q = (s) => JSON.stringify(s);
let total = 0;
for (const f of files()) {
  const sf = prog.getSourceFile(f); if (!sf) continue;
  const text = sf.getFullText();
  const edits = []; // {start,end,repl}
  const exprText = (e) => text.slice(e.getStart(sf), e.getEnd());
  const call = (key, exprs) => `tr(${q(key)}${exprs.map((e) => ", " + exprText(e)).join("")})`;
  const visit = (n) => {
    if (ts.isJsxElement(n)) {
      const s = jsxSentence(n, checker);
      if (s && KEYS.has(s.key)) {
        const first = n.children[0], last = n.children[n.children.length - 1];
        edits.push({ start: first.getFullStart(), end: last.getEnd(), repl: `{${call(s.key, s.exprs)}}` });
        ts.forEachChild(n.openingElement, visit); return;
      }
    }
    if (ts.isJsxText(n) && !n.containsOnlyTriviaWhiteSpaces) {
      const key = normJsx(n.text).trim();
      if (KEYS.has(key)) {
        const lead = /^[ \t]+\S/.test(n.text) ? '{" "}' : "", trail = /\S[ \t]+$/.test(n.text) ? '{" "}' : "";
        edits.push({ start: n.getStart(sf), end: n.getEnd(), repl: `${lead}{${call(key, [])}}${trail}` });
      }
    } else if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n))) {
      const p = n.parent;
      const isLocaleArg = (n.text === "de-DE") && ((ts.isNewExpression(p) && /Intl\./.test(p.expression.getText(sf))) || (ts.isCallExpression(p) && /^toLocale/.test(p.expression.name?.text ?? ""))) && p.arguments?.[0] === n;
      if (isLocaleArg) edits.push({ start: n.getStart(sf), end: n.getEnd(), repl: "locale()" });
      else if (KEYS.has(n.text) && eligible(n)) {
        const repl = call(n.text, []);
        edits.push({ start: n.getStart(sf), end: n.getEnd(), repl: ts.isJsxAttribute(p) ? `{${repl}}` : repl });
      }
    } else if (ts.isTemplateExpression(n) && eligible(n)) {
      const { key, exprs } = templateKey(n);
      if (KEYS.has(key)) { edits.push({ start: n.getStart(sf), end: n.getEnd(), repl: call(key, exprs) }); return; }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  if (!edits.length) continue;
  edits.sort((a, b) => b.start - a.start);
  let out = text;
  for (const e of edits) out = out.slice(0, e.start) + e.repl + out.slice(e.end);
  const needTr = /\btr\(/.test(out) && !/import \{[^}]*\btr\b[^}]*\} from "@\/lib\/i18n"/.test(out);
  const needLocale = /\blocale\(\)/.test(out) && !/\blocale\b[^;]*from "@\/lib\/i18n"/.test(out);
  if (needTr || needLocale) {
    const names = [needTr && "tr", needLocale && "locale"].filter(Boolean).join(", ");
    const imports = [...out.matchAll(/^import [^;]+;\s*$/gm)];
    const at = imports.length ? imports[imports.length - 1].index + imports[imports.length - 1][0].length : 0;
    out = out.slice(0, at) + `${at ? "\n" : ""}import { ${names} } from "@/lib/i18n";\n` + out.slice(at).replace(/^\n/, "");
  }
  total += edits.length;
  console.log(path.relative(ROOT, f), edits.length);
  if (!dry) fs.writeFileSync(f, out);
}
console.log("edits:", total);
