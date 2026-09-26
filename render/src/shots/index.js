import { ACT1, initAct1 } from './act1.js';
import { ACT2, initAct2 } from './act2.js';
import { ACT3 } from './act3.js';
import { ACT5 } from './act5.js';
import { ACT7, initAct7 } from './act7.js';
export const SHOTS = [
  async (ctx) => { await initAct1(ctx); return ACT1; },
  async (ctx) => { await initAct2(ctx); return ACT2; },
  () => ACT3,
  () => ACT5,
  async (ctx) => { await initAct7(ctx); return ACT7; },
];
