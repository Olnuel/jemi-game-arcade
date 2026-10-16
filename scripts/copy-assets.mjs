// start.ng looks for cover.png and startng.json next to the built index.html,
// so copy them into dist/ after every build.
import { copyFileSync, existsSync } from 'node:fs';

const files = ['cover.png', 'startng.json'];
let copied = 0;
for (const file of files) {
  if (existsSync(file)) {
    copyFileSync(file, `dist/${file}`);
    copied += 1;
  } else {
    console.warn(`skipping ${file} (not found)`);
  }
}
console.log(`copied ${copied} file(s) into dist/`);