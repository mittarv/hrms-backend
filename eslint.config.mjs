import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ...eslint.configs.recommended,
    ...tseslint.configs.recommended,

    rules: {
      // Disable all default recommended rules
      ...Object.fromEntries(
        Object.keys({
          ...eslint.configs.recommended.rules,
          ...tseslint.configs.recommended.rules,
        }).map((rule) => [rule, "off"])
      ),

      // Enable ONLY unused imports check
      "no-unused-vars": "error",               // JS unused vars
      "@typescript-eslint/no-unused-vars": "error", // TS unused vars
    },
  }
);
