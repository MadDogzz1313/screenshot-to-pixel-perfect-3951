import ts from "typescript";
import fs from "node:fs";
import path from "node:path";
import { ROOT, files, eligible, looksNatural, templateKey, normJsx, program, jsxSentence } from "./common.mjs";
const prog = program(); const checker = prog.getTypeChecker();
const found = new Map();
const add = (k, f) => { if (!found.has(k)) found.set(k, new Set()); found.get(k).add(path.relative(ROOT, f)); };
for (const f of files()) {
  const sf = prog.getSourceFile(f); if (!sf) { console.error("not in program", f); continue; }
  const visit = (n) => {
    if (ts.isJsxElement(n)) { const s = jsxSentence(n, checker); if (s) { add(s.key, f); n.openingElement.attributes && ts.forEachChild(n.openingElement, visit); s.exprs.forEach((e) => ts.forEachChild(e, visit)); return; } }
    if (ts.isJsxText(n) && !n.containsOnlyTriviaWhiteSpaces && looksNatural(n.text)) add(normJsx(n.text).trim(), f);
    else if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && looksNatural(n.text) && eligible(n)) add(n.text, f);
    else if (ts.isTemplateExpression(n) && eligible(n)) { const { key } = templateKey(n); if (looksNatural(key.replace(/\{\d+\}/g, ""))) add(key, f); }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}
const out = {}; for (const [k, v] of [...found].sort((a, b) => [...a[1]][0].localeCompare([...b[1]][0]))) out[k] = [...v].join(",");
fs.writeFileSync("/tmp/i18n_strings.json", JSON.stringify(out, null, 1));
console.log(found.size, "strings");
