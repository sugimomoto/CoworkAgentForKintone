import { defineConfig } from 'astro/config';

// GitHub Pages config — set `site` and `base` to your repository.
// Example: https://<user>.github.io/CoworkAgentForKintone/
const repoName = 'CoworkAgentForKintone';

export default defineConfig({
  site: `https://sugimomoto.github.io/${repoName}`,
  base: `/${repoName}/`,
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
  },
  compressHTML: true,
});
