import fs from 'fs';
import path from 'path';

function fixDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      fixDir(full);
    } else if (entry.name.endsWith('.js')) {
      let content = fs.readFileSync(full, 'utf8');
      const newContent = content.replace(
        /from ['"](\.\.?\/[^'"]+)['"]/g,
        (match, importPath) => {
          if (importPath.endsWith('.js')) return match;
          // Resolve the import relative to the current file's directory
          const resolved = path.resolve(path.dirname(full), importPath);
          // If it resolves to a directory, use /index.js; otherwise use .js
          if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
            return `from '${importPath}/index.js'`;
          }
          return `from '${importPath}.js'`;
        }
      );
      if (newContent !== content) {
        fs.writeFileSync(full, newContent);
      }
    }
  }
}

fixDir(path.join(process.cwd(), 'dist'));
console.log('Fixed import extensions in dist/');
