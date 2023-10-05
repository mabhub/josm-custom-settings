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

const makeStravaIcon = async (color = 'hot') => {
  try {
    const png = await fs.readFile(`./strava-${color}.png`);
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch (err) {
    const svg = await fs.readFile('./strava.svg');
    const png = await svg2png.convert(svg, { background: COLORS[color] });
    await fs.writeFile(`./strava-${color}.png`, png);
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
            extra: { icon: await makeStravaIcon(color) },
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

      for await (const color of colors) {
        const tms = makeTmsURLPerso({ color });
        imageries.map.push(makeTms({
          name: `Strava Perso all (${color})`,
          url: tms,
          cookies: `_strava4_session=${cookie.value}`,
          extra: { icon: await makeStravaIcon(color) },
        }));
        josm.preferences.tag.push({ '$': { key: `message.imagery.nagPanel.${tms}`, value: 'false' } });
      }
    }

    josm.preferences.maps.push(imageries);
  }
};