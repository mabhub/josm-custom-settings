#!/bin/sh
":" //# comment; export NVM_DIR="$HOME/.nvm"
":" //# comment; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
":" //# comment; nvm use 20 --silent
":" //# comment; exec /usr/bin/env node --no-warnings -r dotenv/config --max-http-header-size 15000 "$0" "$@"

import { promises as fs } from 'fs';
import xml2js from 'xml2js';

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { setTilesScale } from './scale.mjs';
import { makeStravaImagery } from './strava.mjs';

const { argv, argv: { hdpi = false, perso = false } } = yargs(hideBin(process.argv))
  .alias('h', 'help')
  .option('hdpi', { type: 'boolean', default: false })
  .option('perso', { type: 'boolean', default: true })
  .option('scale', { type: 'number', default: 0 });

// console.log(argv);
// const { hdpi } = argv;
// process.exit();
// process.exit();
const josmPrefs = `${process.env.JOSM_PREFS_DIR}preferences.xml`;
console.log(josmPrefs);
const activities = process.env.ACTIVITIES.split(',');
const colors = process.env.COLORS.split(',');

(async () => {
  const xml = await fs.readFile(josmPrefs);
  const josm = await xml2js.parseStringPromise(xml.toString());

  await makeStravaImagery({ activities, colors, updatePerso: perso })(josm);

  setTilesScale(hdpi ? -2 : 0)(josm);
  const builder = new xml2js.Builder();
  await fs.writeFile(josmPrefs, builder.buildObject(josm));
})();
