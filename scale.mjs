export const setTilesScale = (scale = 0) => josm => {
  const zoomOffsetTag = josm.preferences.tag.find(
    ({ $: { key } }) => key === 'imagery.generic.zoom_offset'
  );

  if (zoomOffsetTag) {
    zoomOffsetTag.$.value = scale;
  } else {
    josm.preferences.tag.push({ $: { key: 'imagery.generic.zoom_offset', value: scale } });
  }

  return josm;
};
