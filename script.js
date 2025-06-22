document.addEventListener("DOMContentLoaded", function () {
  // 🎮 Setup canvas and UI
  const canvas = document.getElementById("gameCanvas");
  canvas.width = 400;
  canvas.height = 400;
  const ctx = canvas.getContext("2d");

  const scoreDisplay = document.getElementById("score");
  const levelDisplay = document.getElementById("level");
  const eatSound = document.getElementById("eatSound");
  const gameOverSound = document.getElementById("gameOverSound");

  const tileCount = 20;
  const tileSize = canvas.width / tileCount;

  // 🐍 Game state variables
  let snake = [{ x: 10, y: 10 }];
  let velocity = { x: 0, y: 0 };
  let food = { x: 5, y: 5 };
  let energyFood = null;
  let bombFood = null;

  let showEnergy = false;
  let showBomb = false;
  let showTongue = false;

  let isPaused = false;


  let score = 0;
  let level = 1;
  let speed = 250;
  let highScore = localStorage.getItem("highScore") || 0;

  let wallSpawnInterval = null;
  let difficulty = "normal"; // default difficulty


// 👇 Event listener to detect dropdown selection change
document.getElementById("difficulty").addEventListener("change", function () {
  difficulty = this.value;
  this.blur(); // ✅ Immediately remove focus after selection
  setupDifficultyMode(); // Restart wall interval
});


  let gameInterval;
  let staticWalls = [];
  let movingWall = [];
  let lastWallAddedAt = 0;

  let lobesUnlocked = false;
  let lobeMessageTimer = null;

  const lobePairs = [
    { from: { x: 10, y: 0 }, to: { x: 10, y: 19 } },
    { from: { x: 10, y: 19 }, to: { x: 10, y: 0 } },
    { from: { x: 0, y: 10 }, to: { x: 19, y: 10 } },
    { from: { x: 19, y: 10 }, to: { x: 0, y: 10 } },
    { from: { x: 0, y: 0 }, to: { x: 19, y: 19 } },
    { from: { x: 19, y: 19 }, to: { x: 0, y: 0 } },
    { from: { x: 0, y: 19 }, to: { x: 19, y: 0 } },
    { from: { x: 19, y: 0 }, to: { x: 0, y: 19 } },
  ];

  function getLobePositions() {
    return lobePairs.map(pair => pair.from);
  }

  function showPopup(message) {
    const popup = document.getElementById("popupMessage");
    popup.textContent = message;
    popup.classList.remove("hidden");
    setTimeout(() => popup.classList.add("hidden"), 2000);
  }

  function drawGame() {
    ctx.fillStyle = "grey";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 🍇 Energy food
    if (showEnergy && energyFood) {
      ctx.fillStyle = "purple";
      ctx.beginPath();
      ctx.arc(
        energyFood.x * tileSize + tileSize / 2,
        energyFood.y * tileSize + tileSize / 2,
        tileSize * 0.9, 0, Math.PI * 2
      );
      ctx.fill();
    }

    // 💣 Bomb food
    if (showBomb && bombFood) {
      ctx.fillStyle = "black";
      ctx.beginPath();
      ctx.arc(
        bombFood.x * tileSize + tileSize / 2,
        bombFood.y * tileSize + tileSize / 2,
        tileSize * 0.9, 0, Math.PI * 2
      );
      ctx.fill();
    }

    // 🧱 Static walls
    staticWalls.flat().forEach(wall => {
      const x = wall.x * tileSize;
      const y = wall.y * tileSize;
      const gradient = ctx.createLinearGradient(x, y, x + tileSize, y + tileSize);
      gradient.addColorStop(0, "#5C3317");
      gradient.addColorStop(1, "#D2B48C");
      ctx.globalAlpha = wall.opacity || 1;
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, tileSize, tileSize);
      ctx.strokeStyle = "#222";
      ctx.strokeRect(x, y, tileSize, tileSize);
      ctx.globalAlpha = 1;
    });

    // 🔴 Moving walls
    movingWall.forEach(wall => {
      const x = wall.x * tileSize;
      const y = wall.y * tileSize;
      const gradient = ctx.createLinearGradient(x, y, x + tileSize, y);
      gradient.addColorStop(0, "#ff4d4d");
      gradient.addColorStop(1, "#800000");
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, tileSize, tileSize);
      ctx.strokeStyle = "#440000";
      ctx.strokeRect(x, y, tileSize, tileSize);
    });

    // 🐍 Snake
    snake.forEach((segment, index) => {
      const centerX = segment.x * tileSize + tileSize / 2;
      const centerY = segment.y * tileSize + tileSize / 2;
      const radius = tileSize / 2 - 2;

      if (index === 0) {
        const gradient = ctx.createRadialGradient(centerX, centerY, 2, centerX, centerY, radius);
        gradient.addColorStop(0, "#00ff00");
        gradient.addColorStop(1, "#003300");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "blue";
        ctx.shadowColor = "cyan";
        ctx.shadowBlur = 10;

        const eyeOffsetX = velocity.x * 4;
        const eyeOffsetY = velocity.y * 4;
        ctx.beginPath();
        ctx.arc(centerX - 4 + eyeOffsetX, centerY - 4 + eyeOffsetY, 2, 0, Math.PI * 2);
        ctx.arc(centerX + 4 + eyeOffsetX, centerY - 4 + eyeOffsetY, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        if (showTongue && (velocity.x !== 0 || velocity.y !== 0)) {
          ctx.strokeStyle = "red";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(centerX + velocity.x * 10, centerY + velocity.y * 10);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = "#66cc66";
        ctx.beginPath();
        ctx.roundRect(segment.x * tileSize + 2, segment.y * tileSize + 2, tileSize - 4, tileSize - 4, 4);
        ctx.fill();
      }
    });

    // 🍎 Normal food
    ctx.fillStyle = "orange";
    ctx.beginPath();
    ctx.arc(food.x * tileSize + tileSize / 2, food.y * tileSize + tileSize / 2, tileSize / 2 - 2, 0, Math.PI * 2);
    ctx.fill();

    // 🌀 Lobe teleporters
    if (level >= 3) {
      ctx.fillStyle = "#0011aa";
      ctx.shadowColor = "#00ccff";
      ctx.shadowBlur = 20;
      lobePairs.forEach(pair => {
        ctx.fillRect(pair.from.x * tileSize, pair.from.y * tileSize, tileSize, tileSize);
      });
      ctx.shadowBlur = 0;
    }
  }
  function updateSnake() {
  let head = { x: snake[0].x + velocity.x, y: snake[0].y + velocity.y };

  // Teleport using lobe
  if (level >= 3) {
    const teleport = lobePairs.find(p => p.from.x === head.x && p.from.y === head.y);
    if (teleport) head = { x: teleport.to.x, y: teleport.to.y };
  }

  snake.unshift(head);

  // 🍎 Eat normal food
  if (head.x === food.x && head.y === food.y) {
    score += 10;
    scoreDisplay.textContent = `Score: ${score}`;
    eatSound.play();
    showTongue = true;
    setTimeout(() => (showTongue = false), 300);
    spawnFood();

    if (score >= lastWallAddedAt + 100 && difficulty === "normal") {
      const newWall = generateStaticWall2Bricks();
      staticWalls.push(newWall);
      lastWallAddedAt = score - (score % 100);
    }

    if (score % 50 === 0) {
      level++;
      levelDisplay.textContent = `Level: ${level}`;
      speed = Math.max(70, speed - 20);
      clearInterval(gameInterval);
      gameInterval = setInterval(gameLoop, speed);

      if (level === 3 && !lobesUnlocked) {
        lobesUnlocked = true;
        const msg = document.getElementById("lobeMessage");
        msg.classList.remove("hidden");
        clearTimeout(lobeMessageTimer);
        lobeMessageTimer = setTimeout(() => msg.classList.add("hidden"), 4000);
      }
    }

  // ⚡ Energy food
  } else if (
    showEnergy && energyFood &&
    head.x === energyFood.x && head.y === energyFood.y
  ) {
    score += 30;
    scoreDisplay.textContent = `Score: ${score}`;
    showEnergy = false;
    energyFood = null;
    eatSound.play();
    showPopup("⚡ Energy Boost! +30");

  // 💣 Bomb food
  } else if (
    showBomb && bombFood &&
    head.x === bombFood.x && head.y === bombFood.y
  ) {
    showBomb = false;
    bombFood = null;
    eatSound.play();
    showPopup("💣 Wall Destroyed!");
    if (staticWalls.length > 0) staticWalls.pop();

  // 🐍 Normal move
  } else {
    snake.pop();
  }
}


  function checkCollision() {
    const head = snake[0];
    const allWalls = [...staticWalls.flat(), ...movingWall];

    if (
      head.x < 0 || head.x >= tileCount ||
      head.y < 0 || head.y >= tileCount ||
      snake.slice(1).some(s => s.x === head.x && s.y === head.y) ||
      allWalls.some(w => w.x === head.x && w.y === head.y)
    ) {
      clearInterval(gameInterval);
      gameOverSound.play();
      if (score > highScore) {
        highScore = score;
        localStorage.setItem("highScore", highScore);
      }
      document.getElementById("finalScore").textContent = score;
      document.getElementById("highScore").textContent = "High Score: " + highScore;
      document.getElementById("gameOverScreen").classList.remove("hidden");
    }
  }

  function gameLoop() {
  if (isPaused) return; // ⏸️ Skip updates when paused
  updateSnake();
  checkCollision();
  drawGame();
}


  function spawnFood() {
  const avoid = snake.concat(staticWalls.flat(), movingWall, [energyFood, bombFood], getLobePositions());
  let newFood;
  do {
    newFood = {
      x: Math.floor(Math.random() * tileCount),
      y: Math.floor(Math.random() * tileCount)
    };
  } while (avoid.some(p => p && p.x === newFood.x && p.y === newFood.y));
  food = newFood;
}

  function generateStaticWall2Bricks() {
    const dir = Math.random() < 0.5 ? "horizontal" : "vertical";
    const baseX = Math.floor(Math.random() * (tileCount - (dir === "horizontal" ? 2 : 1)));
    const baseY = Math.floor(Math.random() * (tileCount - (dir === "vertical" ? 2 : 1)));
    return Array.from({ length: 2 }, (_, j) => ({
      x: dir === "horizontal" ? baseX + j : baseX,
      y: dir === "vertical" ? baseY + j : baseY
    }));
  }

  function generateWallBlock() {
    const dir = Math.random() < 0.5 ? "horizontal" : "vertical";
    const baseX = Math.floor(Math.random() * (tileCount - (dir === "horizontal" ? 3 : 1)));
    const baseY = Math.floor(Math.random() * (tileCount - (dir === "vertical" ? 3 : 1)));
    return Array.from({ length: 3 }, (_, j) => ({
      x: dir === "horizontal" ? baseX + j : baseX,
      y: dir === "vertical" ? baseY + j : baseY
    }));
  }

  function spawnMovingWall() {
  let newWall;
  const head = snake[0];
  const nextPos = {
    x: head.x + velocity.x,
    y: head.y + velocity.y,
  };

  do {
    newWall = generateWallBlock();
  } while (
    // Avoid overlapping snake body, static walls, current food
    newWall.some(n =>
      snake.some(s => s.x === n.x && s.y === n.y) ||
      staticWalls.flat().some(w => w.x === n.x && w.y === n.y) ||
      (food && food.x === n.x && food.y === n.y) ||
      (energyFood && energyFood.x === n.x && energyFood.y === n.y) ||
      (bombFood && bombFood.x === n.x && bombFood.y === n.y) ||
      (level >= 3 && getLobePositions().some(l => l.x === n.x && l.y === n.y)) ||

      // 🚫 Avoid snake's current head or next step
      (n.x === head.x && n.y === head.y) ||
      (n.x === nextPos.x && n.y === nextPos.y)
    )
  );

  movingWall = newWall;
}



  function spawnEnergyFood() {
  let newFood;
  const avoid = [
    ...snake,
    ...staticWalls.flat(),
    ...movingWall,
    food,          // Don't overlap with normal food
    bombFood,      // Don't overlap with bomb
    ...getLobePositions() // Avoid teleporters
  ].filter(Boolean); // Removes any null/undefined from list

  do {
    newFood = {
      x: Math.floor(Math.random() * tileCount),
      y: Math.floor(Math.random() * tileCount)
    };
    // ❗ Ensure food is within bounds and not on walls, snake, food, or lobe
  } while (
    avoid.some(p => p.x === newFood.x && p.y === newFood.y) ||
    newFood.x < 0 || newFood.x >= tileCount ||
    newFood.y < 0 || newFood.y >= tileCount
  );

  energyFood = newFood;
  showEnergy = true;

  // ❗ Clear after 5 seconds
  setTimeout(() => {
    showEnergy = false;
    energyFood = null;
  }, 5000);
}


function spawnBombFood() {
  let newFood;
  const avoid = [
    ...snake,
    ...staticWalls.flat(),
    ...movingWall,
    food,
    energyFood,
    ...getLobePositions()
  ].filter(Boolean);  // Removes null items

  do {
    newFood = {
      x: Math.floor(Math.random() * tileCount),
      y: Math.floor(Math.random() * tileCount),
    };
  } while (
    avoid.some(obj => obj.x === newFood.x && obj.y === newFood.y)
  );

  bombFood = newFood;
  showBomb = true;

  // Hide bomb after 5 seconds
  setTimeout(() => {
    showBomb = false;
    bombFood = null;
  }, 5000);
}



  function resetGame() {
  snake = [{ x: 10, y: 10 }];
  velocity = { x: 1, y: 0 }; // ⬅️ Snake moves right when game starts
  score = 0;
  level = 1;
  speed = 250;
  staticWalls = [];
  movingWall = [];
  lastWallAddedAt = 0;
  lobesUnlocked = false;
  clearTimeout(lobeMessageTimer);
  clearInterval(gameInterval);
  clearInterval(wallTimer); // 👈 custom timer for medium/hard

  scoreDisplay.textContent = "Score: 0";
  levelDisplay.textContent = "Level: 1";
  document.getElementById("lobeMessage").classList.add("hidden");
  document.getElementById("gameOverScreen").classList.add("hidden");

  staticWalls.push(generateWallBlock(), generateWallBlock());
  spawnMovingWall();
  spawnFood();

  gameInterval = setInterval(gameLoop, speed);
  setupDifficultyMode(); // apply wall spawning based on selected difficulty
}

let wallTimer = null;

function setupDifficultyMode() {
  if (wallSpawnInterval) clearInterval(wallSpawnInterval);

  if (difficulty === "medium") {
    wallSpawnInterval = setInterval(() => {
      const newWall = generateStaticWall2Bricks();
      if (newWall.every(w => !snake.concat(staticWalls.flat(), movingWall, [food]).some(p => p.x === w.x && p.y === w.y))) {
        staticWalls.push(newWall.map(b => ({ ...b, opacity: 1 })));
      }
    }, 60000); // every 60 seconds
  }

  if (difficulty === "hard") {
    wallSpawnInterval = setInterval(() => {
      const newWall = generateStaticWall2Bricks();
      if (newWall.every(w => !snake.concat(staticWalls.flat(), movingWall, [food]).some(p => p.x === w.x && p.y === w.y))) {
        staticWalls.push(newWall.map(b => ({ ...b, opacity: 1 })));
      }
    }, 20000); // every 20 seconds
  }
}


function addStaticWallSafely() {
  let newWall;
  do {
    newWall = generateStaticWall2Bricks();
  } while (
    newWall.some(n =>
      snake.concat(staticWalls.flat(), movingWall, [food, energyFood, bombFood], getLobePositions())
        .some(e => e.x === n.x && e.y === n.y)
    )
  );
  staticWalls.push(newWall.map(w => ({ ...w, opacity: 1 })));
}


  // 🔁 Intervals
  setInterval(spawnEnergyFood, 25000);
  setInterval(spawnBombFood, 40000);
  setInterval(spawnMovingWall, 10000);

  // 🎮 Controls
  document.addEventListener("keydown", function (e) {
  const active = document.activeElement;

  // ✅ If the focused element is a dropdown or input, block snake movement
  if (active && (active.tagName === "SELECT" || active.tagName === "INPUT")) {
    return; // ⛔ Don’t handle arrow keys when dropdown is focused
  }

  // ✅ Prevent default arrow key behavior (like scrolling or dropdown navigation)
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
    e.preventDefault();
  }

  // 🐍 Snake movement
  switch (e.key) {
    case "ArrowUp":
      if (velocity.y === 0) velocity = { x: 0, y: -1 };
      break;
    case "ArrowDown":
      if (velocity.y === 0) velocity = { x: 0, y: 1 };
      break;
    case "ArrowLeft":
      if (velocity.x === 0) velocity = { x: -1, y: 0 };
      break;
    case "ArrowRight":
      if (velocity.x === 0) velocity = { x: 1, y: 0 };
      break;
  }
});


// 🔘 Allow pause/resume via keyboard
document.addEventListener("keydown", e => {
  if (e.key === "p" || e.key === "P") {
    document.getElementById("pauseBtn").click();
  }
});



  document.getElementById("upBtn").addEventListener("click", () => {
  if (velocity.y === 0) velocity = { x: 0, y: -1 };
});
document.getElementById("downBtn").addEventListener("click", () => {
  if (velocity.y === 0) velocity = { x: 0, y: 1 };
});
document.getElementById("leftBtn").addEventListener("click", () => {
  if (velocity.x === 0) velocity = { x: -1, y: 0 };
});
document.getElementById("rightBtn").addEventListener("click", () => {
  if (velocity.x === 0) velocity = { x: 1, y: 0 };
});


// 🎯 Restart button (top button)
document.getElementById("restartBtn").addEventListener("click", resetGame);

document.getElementById("pauseBtn").addEventListener("click", function () {
  isPaused = !isPaused;
  const btn = document.getElementById("pauseBtn");
  btn.textContent = isPaused ? "Resume" : "Pause";

  if (!isPaused) {
    clearInterval(gameInterval);
    gameInterval = setInterval(gameLoop, speed);
  }
});


// ✅ Play Again button (game over popup)
document.getElementById("playAgainBtn").addEventListener("click", resetGame);

// Canvas keyboard focus
canvas.setAttribute("tabindex", "0");
canvas.focus();
canvas.addEventListener("blur", () => {
  setTimeout(() => {
    const active = document.activeElement;
    const tag = active.tagName.toLowerCase();
    if (tag !== "select" && tag !== "input" && tag !== "button") {
      canvas.focus(); // Only refocus if not interacting with UI
    }
  }, 100);
});



  // 🚀 Start game
  resetGame();
});

