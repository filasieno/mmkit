import tseslint from "typescript-eslint";

/** @param {import('eslint').SourceCode} sourceCode @param {import('estree').Node[]} listNodes */
function getParenPair(sourceCode, listNodes) {
  if (listNodes.length === 0) {
    return null;
  }
  const open = sourceCode.getTokenBefore(listNodes[0], (token) => token.value === "(");
  const close = sourceCode.getTokenAfter(listNodes[listNodes.length - 1], (token) => token.value === ")");
  if (!open || !close) {
    return null;
  }
  return { open, close };
}

/** @param {import('eslint').Rule.RuleContext} context */
function createParenListRule(context) {
  const sourceCode = context.sourceCode;

  /** @param {{ open: import('eslint').AST.Token, close: import('eslint').AST.Token }} parens @param {import('estree').Node[]} listNodes @param {import('estree').Node} reportNode */
  const checkParenList = (parens, listNodes, reportNode) => {
    const inner = sourceCode.text.slice(parens.open.range[1], parens.close.range[0]);
    if (!inner.includes("\n")) {
      return;
    }
    context.report({
      node: reportNode,
      messageId: "singleLine",
      fix(fixer) {
        const parts = [];
        const nodeFixes = [];
        for (const node of listNodes) {
          const text = sourceCode.getText(node);
          if (!text.includes("\n")) {
            parts.push(text.trim());
            continue;
          }
          if (text.includes("//")) {
            return null;
          }
          const collapsed = text.replace(/\s+/g, " ").trim();
          nodeFixes.push(fixer.replaceText(node, collapsed));
          parts.push(collapsed);
        }
        if (nodeFixes.length > 0) {
          return nodeFixes;
        }
        const formatted = parts.join(", ");
        return fixer.replaceTextRange(
          [parens.open.range[1], parens.close.range[0]],
          formatted.length > 0 ? ` ${formatted} ` : "",
        );
      },
    });
  };

  /** @param {import('estree').Node[]} listNodes @param {import('estree').Node} reportNode */
  const checkList = (listNodes, reportNode) => {
    const parens = getParenPair(sourceCode, listNodes);
    if (parens) {
      checkParenList(parens, listNodes, reportNode);
    }
  };

  return {
    CallExpression(node) {
      checkList(node.arguments, node);
    },
    NewExpression(node) {
      checkList(node.arguments, node);
    },
    FunctionDeclaration(node) {
      checkList(node.params, node);
    },
    TSDeclareFunction(node) {
      checkList(node.params, node);
    },
    TSMethodSignature(node) {
      checkList(node.params, node);
    },
    TSCallSignatureDeclaration(node) {
      checkList(node.params, node);
    },
    TSConstructSignatureDeclaration(node) {
      checkList(node.params, node);
    },
    MethodDefinition(node) {
      if (node.value.type === "FunctionExpression" || node.value.type === "ArrowFunctionExpression") {
        checkList(node.value.params, node);
      }
    },
    FunctionExpression(node) {
      if (node.parent?.type === "MethodDefinition") {
        return;
      }
      checkList(node.params, node);
    },
    ArrowFunctionExpression(node) {
      if (node.parent?.type === "MethodDefinition") {
        return;
      }
      if (node.params.length === 1 && node.params[0].type === "Identifier") {
        const first = sourceCode.getFirstToken(node);
        if (first && first.value !== "(") {
          return;
        }
      }
      checkList(node.params, node);
    },
  };
}

/** @param {import('estree').ImportSpecifier} specifier */
function formatImportSpecifier(specifier) {
  const imported = specifier.imported.type === "Identifier" ? specifier.imported.name : specifier.imported.value;
  const local = specifier.local.name;
  return imported === local ? local : `${imported} as ${local}`;
}

/** @param {import('eslint').Rule.RuleContext} context */
function createNoInlineTypeImportSpecifierRule(context) {
  const sourceCode = context.sourceCode;

  return {
    ImportDeclaration(node) {
      if (node.importKind === "type") {
        return;
      }
      const typeSpecifiers = node.specifiers.filter(
        (specifier) => specifier.type === "ImportSpecifier" && specifier.importKind === "type",
      );
      if (typeSpecifiers.length === 0) {
        return;
      }
      context.report({
        node,
        messageId: "noInline",
        fix(fixer) {
          const valueSpecifiers = node.specifiers.filter(
            (specifier) => specifier.type !== "ImportSpecifier" || specifier.importKind !== "type",
          );
          const moduleSource = sourceCode.getText(node.source);
          const typeNames = typeSpecifiers.map(formatImportSpecifier).join(", ");
          const typeImport = `import type { ${typeNames} } from ${moduleSource};`;
          if (valueSpecifiers.length === 0) {
            return fixer.replaceText(node, typeImport);
          }
          const valueNames = valueSpecifiers.map((specifier) => sourceCode.getText(specifier)).join(", ");
          const valueImport = `import { ${valueNames} } from ${moduleSource};`;
          return [fixer.replaceText(node, valueImport), fixer.insertTextAfter(node, `\n${typeImport}`)];
        },
      });
    },
  };
}

const localPlugin = {
  rules: {
    "no-inline-type-import-specifier": {
      meta: {
        type: "problem",
        docs: {
          description: "Forbid inline type modifiers inside value import declarations",
        },
        fixable: "code",
        schema: [],
        messages: {
          noInline: "Use a separate import type statement instead of an inline type import specifier.",
        },
      },
      create: createNoInlineTypeImportSpecifierRule,
    },
    "no-inline-import-type": {
      meta: {
        type: "problem",
        docs: {
          description: "Forbid import(\"module\").Type and typeof import(\"module\") inline type references",
        },
        schema: [],
        messages: {
          noInline: "Use a top-level import type instead of an inline import type expression.",
        },
      },
      create(context) {
        return {
          TSImportType(node) {
            context.report({ node, messageId: "noInline" });
          },
          TSTypeQuery(node) {
            if (node.exprName.type === "TSImportType") {
              context.report({ node, messageId: "noInline" });
            }
          },
        };
      },
    },
    "import-single-line": {
      meta: {
        type: "layout",
        docs: {
          description: "Keep import declarations on one line",
        },
        fixable: "whitespace",
        schema: [],
        messages: {
          singleLine: "Import declarations must not contain line breaks.",
        },
      },
      create(context) {
        const sourceCode = context.sourceCode;
        return {
          ImportDeclaration(node) {
            const text = sourceCode.getText(node);
            if (!text.includes("\n")) {
              return;
            }
            context.report({
              node,
              messageId: "singleLine",
              fix(fixer) {
                return fixer.replaceText(node, text.replace(/\s+/g, " ").trim());
              },
            });
          },
        };
      },
    },
    "paren-list-single-line": {
      meta: {
        type: "layout",
        docs: {
          description: "Never break parameter or argument lists across lines",
        },
        fixable: "whitespace",
        schema: [],
        messages: {
          singleLine: "Parameter and argument lists must not contain line breaks.",
        },
      },
      create: createParenListRule,
    },
    "angle-list-single-line": {
      meta: {
        type: "layout",
        docs: {
          description: "Never break generic type parameter lists across lines",
        },
        fixable: "whitespace",
        schema: [],
        messages: {
          singleLine: "Generic type lists must not contain line breaks.",
        },
      },
      create(context) {
        const sourceCode = context.sourceCode;
        const checkNode = (node) => {
          const text = sourceCode.getText(node);
          if (!text.includes("\n")) {
            return;
          }
          context.report({
            node,
            messageId: "singleLine",
          fix(fixer) {
            if (text.includes("//")) {
              return null;
            }
            const collapsed = text.replace(/\s+/g, " ").trim();
            return fixer.replaceText(node, collapsed);
          },
          });
        };
        return {
          TSTypeParameterDeclaration: checkNode,
          TSTypeParameterInstantiation: checkNode,
        };
      },
    },
  },
};

/** Layout rules formerly expressed in TSLint; enforced via ESLint + local fixers. */
export default tseslint.config(
  {
    ignores: [
      "**/archive/**",
      "**/coverage/**",
      "**/dist/**",
      "**/out/**",
      "**/out-test/**",
      "**/out-test-integration/**",
      "**/.vscode-test/**",
      "**/node_modules/**",
    ],
  },
  {
    files: ["packages/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      local: localPlugin,
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "separate-type-imports",
        },
      ],
      "local/no-inline-type-import-specifier": "error",
      "local/no-inline-import-type": "error",
      "local/import-single-line": "error",
      "local/paren-list-single-line": "error",
    },
  },
  {
    files: ["packages/server/src/cbserver/**/*.ts"],
    rules: {
      "local/angle-list-single-line": "error",
    },
  },
);
