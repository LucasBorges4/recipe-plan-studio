#!/usr/bin/env node
/* Inject custom Grupo W. Geotec CAFUFV login page into n8n's index.html */
const fs = require('fs');
const path = require('path');
const glob = require('child_process').execSync;

function findEditorDist() {
  try {
    const result = glob(
      'find /usr/local/lib/node_modules/n8n/node_modules/.pnpm -path "*/n8n-editor-ui/dist" -type d 2>/dev/null | head -1',
      { encoding: 'utf-8' }
    ).trim();
    if (result && fs.existsSync(result)) return result;
  } catch {}
  return null;
}

function inject(editorDir, loginPath) {
  const indexPath = path.join(editorDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.error('ERROR: index.html not found at', indexPath);
    process.exit(1);
  }

  let content = fs.readFileSync(indexPath, 'utf-8');
  if (content.includes('geos-login-bg')) {
    console.log('Login already injected, skipping.');
    return;
  }

  const loginHtml = fs.readFileSync(loginPath, 'utf-8');

  const marker = '<div id="app"></div>';
  if (!content.includes(marker)) {
    console.error('ERROR: Could not find', marker, 'in index.html');
    process.exit(1);
  }

  content = content.replace(marker, loginHtml + '\n' + marker);

  const backup = indexPath + '.bak';
  if (!fs.existsSync(backup)) {
    fs.copyFileSync(indexPath, backup);
  }

  fs.writeFileSync(indexPath, content, 'utf-8');
  console.log('OK: Custom login injected into', indexPath);
}

const editorDir = findEditorDist();
if (!editorDir) {
  console.error('ERROR: Could not find n8n-editor-ui/dist');
  process.exit(1);
}

const loginPath = '/tmp/custom-login.html';
if (!fs.existsSync(loginPath)) {
  console.error('ERROR:', loginPath, 'not found');
  process.exit(1);
}

inject(editorDir, loginPath);
