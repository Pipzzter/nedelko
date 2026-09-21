import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { files } from './lib/files.js';
import { localLinks } from './lib/docs.js';
import { cli, root } from './lib/process.js';

await cli(async () => {
  process.chdir(root);
  const documents = ['README.md', 'AGENTS.md', 'backend/AGENTS.md', 'frontend/AGENTS.md', ...(await files('docs')).filter(path => path.endsWith('.md'))];
  const broken = [];
  for (const file of documents) {
    for (const link of localLinks(await readFile(file, 'utf8'))) {
      try { await access(resolve(dirname(file), link)); }
      catch { broken.push(`${file}: ${link}`); }
    }
  }
  if (broken.length) throw new Error(`Broken local documentation links:\n${broken.join('\n')}`);
  console.log(`${documents.length} documentation files checked for local links.`);
});
