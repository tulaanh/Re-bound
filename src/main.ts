import './style.css';
import { GameEngine } from './core/GameEngine';
import { UIManager } from './ui/UIManager';
import { OnlineGameManager } from './network/OnlineGameManager';
import { OnlineUIManager } from './ui/OnlineUIManager';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas element #game-canvas not found!');
    return;
  }

  // Initialize Core Game Engine
  const engine = new GameEngine(canvas);
  (window as any).__ENGINE__ = engine;

  // Initialize HUD & Controls Manager
  const uiManager = new UIManager(engine);

  // Initialize Online Multiplayer Manager
  const onlineManager = new OnlineGameManager(engine);
  const onlineUiManager = new OnlineUIManager(onlineManager);
  (window as any).__ONLINE__ = onlineManager;

  // Check URL query param or hash for instant mode switching
  if (window.location.search.includes('sandbox') || window.location.hash.includes('sandbox')) {
    engine.setGameMode('SANDBOX');
  }

  // Connect loop update to UI
  engine.onUpdateUI = () => {
    uiManager.update();
    onlineUiManager.update();
  };

  // Start the Game Loop
  engine.start();

  console.log('🚀 Re-Bound Arena Game initialized successfully!');
});
