#!/bin/sh
":" //# comment; export NVM_DIR="$HOME/.nvm"
":" //# comment; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
":" //# comment; exec /usr/bin/env node -r dotenv/config --max-http-header-size 15000 "$0" "$@"

import { promises as fs } from 'fs';

import xml2js from 'xml2js';
import { setTilesScale } from './scale.mjs';
import { makeStravaImagery } from './strava.mjs';

const josmPrefs = `${process.env.JOSM_PREFS_DIR}preferences.xml`;
const activities = process.env.ACTIVITIES.split(',');
const colors = process.env.COLORS.split(',');

(async () => {
  const xml = await fs.readFile(josmPrefs);
  const josm = await xml2js.parseStringPromise(xml.toString());

  await makeStravaImagery({ activities, colors })(josm);

  setTilesScale(-2)(josm);
  const builder = new xml2js.Builder();
  await fs.writeFile(josmPrefs, builder.buildObject(josm));
})();
