import sqlite3 from 'sqlite3';

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

export const makeTmsURL = ({ activity, color, kpid, sign, policy }) => [
  `https://heatmap-external-{switch:a,b,c}.strava.com/tiles-auth/${activity}/${color}/{zoom}/{x}/{y}.png?`,
  // `Key-Pair-Id=${kpid}`,
  // `Signature=${sign}`,
  // `Policy=${policy}`,
].join('&');

export const makeTmsURLPerso = ({ color = 'purple' } = {}) => [
  `https://personal-heatmaps-external.strava.com/tiles/11229548/${color}/{zoom}/{x}/{y}@2x.png?`,
  `filter_type=web_all`,
  `respect_privacy_zones=false`,
  `include_everyone=true`,
  `include_followers_only=true`,
  `include_only_me=true`,
].join('&');

export const makeTms = ({
  name,
  url,
  cookies = '',
  extra = {},
}) => ({
  tag: [
    { '$': { key:'min-zoom', value: '9' } },
    { '$': { key:'max-zoom', value: '14' } },
    { '$': { key:'transparent', value: 'true' } },
    { '$': { key:'name', value: name } },
    { '$': { key:'type', value: 'tms' } },
    { '$': { key:'url', value: url } },
    { '$': { key:'cookies', value: cookies } },
    ...Object.entries(extra)
      .map(([key, value]) => ({ '$': { key, value } })),
  ],
});

export const getStravaCookies = async dbFile => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'foo-'));
  const tmpDbFile = path.join(tmpDir, 'temp.sqlite');
  await fs.copyFile(dbFile, tmpDbFile);

  const getCookies = q => new Promise((resolve, reject) => {
    const db = new sqlite3.Database(tmpDbFile, sqlite3.OPEN_READONLY);
    db.all(q, (err, res) => err ? reject(err) : resolve(res));
  });

  const allCookies = await getCookies(`SELECT * from moz_cookies WHERE host LIKE '.strava.com'`);
  const cookies = Object.fromEntries(allCookies.map(({ name, value }) => ([name, value])));

  await fs.unlink(tmpDbFile);
  await fs.unlink(`${tmpDbFile}-shm`);
  await fs.unlink(`${tmpDbFile}-wal`);
  await fs.rmdir(tmpDir);

  return cookies;
};
