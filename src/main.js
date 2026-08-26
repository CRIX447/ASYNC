import { Game } from './core/Game.js';
import level0 from './world/levels/level0.js';

const game = new Game(level0);

game.init().catch((err) => {
  console.error(err);
  const overlay = document.getElementById('overlay');
  overlay.innerHTML = `
    <h1 style="font-size:24px">FAILED TO START</h1>
    <p style="max-width:560px;text-align:left;font-size:12px;opacity:0.8">
      ${err.message}
    </p>
    <p style="margin-top:20px;font-size:11px;opacity:0.4">
      Full details are in the browser console (F12).
    </p>
  `;
});

// Handy while you're editing levels.
window.game = game;
