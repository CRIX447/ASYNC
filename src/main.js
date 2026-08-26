import { Game } from './core/Game.js';

const game = new Game();

game.init().catch((err) => {
  console.error(err);
  const overlay = document.getElementById('overlay');
  overlay.innerHTML = `
    <div class="menu-inner">
      <h1 data-text="FAILED" style="font-size:26px">FAILED TO START</h1>
      <p class="brief" style="text-align:left">${err.message}</p>
      <div class="footnote">FULL DETAILS IN THE CONSOLE (F12)</div>
    </div>`;
});

window.game = game;
