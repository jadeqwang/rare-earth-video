import { plateScenes } from './plates.js';
import { spaceScenes } from './space.js';
import { graphicScenes } from './graphics.js';

const inits = [plateScenes.init, spaceScenes.init, graphicScenes.init].filter(Boolean);
const strip = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== 'init'));

export const SCENES = {
  ...strip(plateScenes),
  ...strip(spaceScenes),
  ...strip(graphicScenes),
  __init: { async init(e) { for (const f of inits) await f(e); } },
};
