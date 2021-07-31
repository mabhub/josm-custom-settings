#!/bin/sh
":" //# comment; export NVM_DIR="$HOME/.nvm"
":" //# comment; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
":" //# comment; exec /usr/bin/env node -r dotenv/config --max-http-header-size 15000 "$0" "$@"


import { promises as fs } from 'fs';

import xml2js from 'xml2js';
import { makeTmsURL } from './lib.mjs';
import { getStravaCookies, makeTms } from './lib.mjs';

const josmPrefs = `${process.env.JOSM_PREFS_DIR}preferences.xml`;
const activities = process.env.ACTIVITIES.split(',');
const colors = process.env.COLORS.split(',');

(async () => {
  const {
    'CloudFront-Policy': policy,
    'CloudFront-Key-Pair-Id': kpid,
    'CloudFront-Signature': sign,
  } = await getStravaCookies(`${process.env.FIREFOX_PROFiLE_DIR}cookies.sqlite`);

  const xml = await fs.readFile(josmPrefs);
  const data = await xml2js.parseStringPromise(xml.toString());

  // Remove all Strava nagScreen dismissal
  data.preferences.tag = data.preferences.tag.filter(({ '$': { key } }) => !key.includes('message.imagery.nagPanel.https://heatmap-external-{switch:a,b,c}.strava.com'))

  const imageries = data.preferences.maps.find(({ '$': { key } }) => key === 'imagery.entries');
  data.preferences.maps = data.preferences.maps.filter(({ '$': { key } }) => key !== 'imagery.entries');

  if (imageries) {
    // Remove previous Strava layers
    imageries.map = imageries.map.filter(
      ({ tag }) => tag?.every(({ '$': { value } }) => !value.includes('strava'))
    );

    colors.forEach(color => {
      activities.forEach(activity => {
        const tms = makeTmsURL({ activity, color, kpid, sign, policy });

        imageries.map.push(makeTms(`Strava ${activity} ${color}`, tms));

        // Dismiss imagery.nagPanel
        data.preferences.tag.push({
          '$': { key: `message.imagery.nagPanel.${tms}`, value: 'false' },
        });
      });
    });

    data.preferences.maps.push(imageries);
  }

  const builder = new xml2js.Builder();
  const xml2 = builder.buildObject(data);
  await fs.writeFile(josmPrefs, xml2);
})();
