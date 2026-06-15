import stylistic from "@stylistic/eslint-plugin";
import tseslint from "typescript-eslint";

/** Layout rules formerly expressed in TSLint; enforced via ESLint + @stylistic. */
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
      "@stylistic": stylistic,
    },
    rules: {
      "@stylistic/function-call-argument-newline": ["error", "never"],
      "@stylistic/function-paren-newline": ["error", "never"],
    },
  },
  {
    files: ["packages/server/src/cbserver/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      local: {
        rules: {
          "type-parameters-single-line-unless-colon": {
            meta: {
              type: "layout",
              docs: {
                description:
                  "Keep generic type parameter/argument lists on one line unless they contain ':'",
              },
              schema: [],
              messages: {
                singleLineUnlessColon:
                  "Type parameters must stay on one line unless the generic list contains ':'.",
              },
            },
            create(context) {
              const sourceCode = context.sourceCode;
              const checkNode = (node) => {
                const text = sourceCode.getText(node);
                if (!text.includes("\n")) {
                  return;
                }
                if (text.includes(":")) {
                  return;
                }
                context.report({
                  node,
                  messageId: "singleLineUnlessColon",
                });
              };
              return {
                TSTypeParameterDeclaration: checkNode,
                TSTypeParameterInstantiation: checkNode,
              };
            },
          },
        },
      },
    },
    rules: {
      "local/type-parameters-single-line-unless-colon": "error",
    },
  },
);
