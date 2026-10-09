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
    files: ["app/**/*", "lib/**/*"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/tools/brief-reference/**", "tools/brief-reference/**"],
              message: "Production code in app/ and lib/ must not import from tools/brief-reference/. This is a reference implementation only."
            }
          ]
        }
      ]
    }
  }
]);

export default eslintConfig;
