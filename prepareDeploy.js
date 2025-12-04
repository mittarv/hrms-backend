const fs = require('fs');
const path = require('path');

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);

  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const files = fs.readdirSync(src);
    files.forEach(file => {
      copyRecursive(path.join(src, file), path.join(dest, file));
    });
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function prepareDeployment() {
  if (fs.existsSync('deploy')) {
    fs.rmSync('deploy', { recursive: true, force: true });
  }

  fs.mkdirSync('deploy');

  const filesToCopy = [
    { src: 'package.json', dest: 'deploy/package.json' },
    { src: 'package-lock.json', dest: 'deploy/package-lock.json' },
    { src: '.sequelizerc', dest: 'deploy/.sequelizerc'},
    { src: 'dist', dest: 'deploy/dist'},
  ];

  filesToCopy.forEach(({ src, dest }) => {
    if (fs.existsSync(src)) {
      copyRecursive(src, dest);
    }
  });
}

prepareDeployment();