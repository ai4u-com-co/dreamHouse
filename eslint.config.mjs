import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  basePath: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [".next/*", "next-env.d.ts", ".claude/**", "src/lib/openai-image-core.ts", "src/lib/openai-image-server.ts"], // los dos archivos del núcleo son copias idénticas: no se editan
  },
];

export default eslintConfig;
