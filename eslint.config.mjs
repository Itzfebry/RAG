import coreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...coreWebVitals,
  {
    // Samakan cakupan file dengan config `next` supaya plugin `react-hooks`
    // (didaftarkan di sana) ter-resolve saat aturan di bawah dievaluasi.
    files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    rules: {
      // Leftover debugging / noise in production code.
      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "smart"],
      "prefer-const": "error",
      "no-var": "error",
      // TODO (Phase 3): fix the ~12 UI refactor targets then promote
      // back to "error". Both are React Compiler-era new rules; the fixes
      // touch component render logic (out of Foundation scope).
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  },
  {
    ignores: ["node_modules/**", ".next/**", ".claude/**", ".ua/**", "out/**", "public/**"],
  },
];

// TODO (Phase 3): once typescript-eslint supports TypeScript >= 6.1 / 7.x,
// extend "eslint-config-next/typescript" and enable
// `@typescript-eslint/no-explicit-any`. See
// https://github.com/typescript-eslint/typescript-eslint/issues/10940.
// Current toolchain pins typescript@^6.0.3 on purpose.

export default eslintConfig;
