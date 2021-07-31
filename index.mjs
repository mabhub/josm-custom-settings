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
  const xml = await fs.readFile(josmPrefs);
  const josm = await xml2js.parseStringPromise(xml.toString());

  // Extract imagery settings
  const imageries = josm.preferences.maps.find(({ '$': { key } }) => key === 'imagery.entries');

  if (imageries) {
    josm.preferences.maps = josm.preferences.maps.filter(
      ({ '$': { key } }) => key !== 'imagery.entries'
    );

    // Remove all Strava nagScreen dismissal
    josm.preferences.tag = josm.preferences.tag.filter(
      ({ '$': { key } }) => !key.includes('message.imagery.nagPanel.https://heatmap-external-{switch:a,b,c}.strava.com')
    );

    const {
      'CloudFront-Policy': policy,
      'CloudFront-Key-Pair-Id': kpid,
      'CloudFront-Signature': sign,
    } = await getStravaCookies(`${process.env.FIREFOX_PROFiLE_DIR}cookies.sqlite`);

    // Remove previous Strava layers
    imageries.map = imageries.map.filter(
      ({ tag }) => tag?.every(({ '$': { value } }) => !value.includes('strava'))
    );

    colors.forEach(color => {
      activities.forEach(activity => {
        const tms = makeTmsURL({ activity, color, kpid, sign, policy });

        imageries.map.push(makeTms(`Strava ${activity} ${color}`, tms));

        // Dismiss imagery.nagPanel
        josm.preferences.tag.push({
          '$': { key: `message.imagery.nagPanel.${tms}`, value: 'false' },
        });
      });
    });

    josm.preferences.maps.push(imageries);
  }

  const builder = new xml2js.Builder();
  await fs.writeFile(josmPrefs, builder.buildObject(josm));
})();
