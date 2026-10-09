import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "tools/brief-reference/**",
  ]),
  {
    files: ["**/*.{js,jsx,ts,tsx,mjs,cjs}"],
    ignores: ["tools/brief-reference/**"],
    rules: {
      // Block all imports from brief-reference (static imports, require, dynamic imports)
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/tools/brief-reference/**",
                "tools/brief-reference/**",
                "../tools/brief-reference/**",
                "../../tools/brief-reference/**",
                "../../../tools/brief-reference/**"
              ],
              message: "Production code must not import from tools/brief-reference/. This is a reference implementation only."
            }
          ]
        }
      ],
      // Block dynamic imports and require() targeting brief-reference
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportExpression[source.value=/brief-reference/]",
          message: "Dynamic import() from tools/brief-reference/ is forbidden"
        },
        {
          selector: "CallExpression[callee.name='require'][arguments.0.value=/brief-reference/]",
          message: "require() from tools/brief-reference/ is forbidden"
        }
      ]
    }
  }
]);

export default eslintConfig;
