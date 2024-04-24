import { getStravaCookies, makeTms, makeTmsURLPerso } from './lib.mjs';
import fs from 'fs/promises';
import svg2png from 'convert-svg-to-png';

const ACTIVITIES = {
  run: {
    name: 'Run',
  },
  ride: {
    name: 'Bike',
  },
};

const COLORS = {
  hot: '#ff6600',
  blue: '#0000ff',
  purple: '#aa0077',
  gray: '#aaaaaa',
  bluered: '#aa0077',
};

const makeStravaIcon = async ({ id, color }) => {
  try {
    const png = await fs.readFile(`./strava-${id}.png`);
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch (err) {
    const svg = await fs.readFile('./strava.svg');
    const png = await svg2png.convert(svg, { background: color });
    await fs.writeFile(`./strava-${id}.png`, png);
    return `data:image/png;base64,${png.toString('base64')}`;
  }
};

export const makeStravaImagery = ({ activities, colors, updatePerso }) => async josm => {
  // Extract imagery settings
  const imageries = josm.preferences.maps.find(
    ({ '$': { key } }) => key === 'imagery.entries'
  );

  if (imageries) {
    josm.preferences.maps = josm.preferences.maps.filter(
      ({ '$': { key } }) => key !== 'imagery.entries'
    );

    // Remove all Strava nagScreen dismissal
    josm.preferences.tag = josm.preferences.tag.filter(
      ({ '$': { key } }) => !key.includes('message.imagery.nagPanel.https://heatmap-external-{switch:a,b,c}.strava.com')
    );

    const cookies = await getStravaCookies(`${process.env.FIREFOX_PROFiLE_DIR}cookies.sqlite`);
    const cookiesString = Object.entries(cookies).map(kv => kv.join('=')).join('; ');

    console.log('Cookie:', cookiesString);

    // Remove previous Strava layers
    imageries.map = imageries.map.filter(
      ({ tag }) => tag?.every(({ '$': { value } }) => !value.includes('strava'))
    );

    for await (const color of colors) {
      for await (const activity of activities) {
        const tms = `https://heatmap-external-{switch:a,b,c}.strava.com/tiles-auth/${activity}/${color}/{zoom}/{x}/{y}.png`;

        imageries.map.push(
          makeTms({
            name: `Strava Global ${activity} (${color})`,
            url: tms,
            cookies: cookiesString,
            // extra: { icon: await makeStravaIcon({ name, color }) },
          })
        );

        // Dismiss imagery.nagPanel
        josm.preferences.tag.push({
          '$': { key: `message.imagery.nagPanel.${tms}`, value: 'false' },
        });
      }
    }

    if (updatePerso) {
      const { firefox } = await import('playwright');

      const browser = await firefox.launch({ headless: true });
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto('https://www.strava.com/login');
      await page.type('#email', process.env.STRAVA_LOGIN);
      await page.type('#password', process.env.STRAVA_PASSWORD);
      await page.click('#login-button');
      const cookies = await context.cookies();
      await browser.close();
      const cookie = cookies.find(({ name }) => name === '_strava4_session');

      console.log(`Cookie: _strava4_session=${cookie.value}`);

      const persoColors = [
        {
          id: 'orange',
          name: 'Orange',
          color: 'orange',
        },
        {
          id: 'hot',
          name: 'Rouge',
          color: '#ff3300',
        },
        {
          id: 'blue',
          name: 'Bleu',
          color: 'blue',
        },
        {
          id: 'bluered',
          name: 'Bleu/rouge',
          color: '#8822ff',
        },
        {
          id: 'purple',
          name: 'Violet',
          color: 'purple',
        },
        {
          id: 'gray',
          name: 'Gris',
          color: 'gray',
        },
      ];
      for await (const { id, color, name } of persoColors) {
        const tms = makeTmsURLPerso({ color: id });
        imageries.map.push(makeTms({
          name: `Strava Perso all (${name})`,
          url: tms,
          cookies: `_strava4_session=${cookie.value}`,
          extra: { icon: await makeStravaIcon({ id, color }) },
        }));
        josm.preferences.tag.push({ '$': { key: `message.imagery.nagPanel.${tms}`, value: 'false' } });
      }
    }

    josm.preferences.maps.push(imageries);
  }
};