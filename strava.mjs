import { makeTmsURL } from './lib.mjs';
import { getStravaCookies, makeTms } from './lib.mjs';

export const makeStravaImagery = ({ activities, colors }) => async josm => {
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
};