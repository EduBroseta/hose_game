// --- Canvas Setup ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score-display');
const messageDisplay = document.getElementById('message-display');

let W, H; // Canvas width and height
let hoseX, hoseY; // Hose base position
let hoseLength = 20; // Initial hose length
const MIN_HOSE_LENGTH = 20;
let MAX_HOSE_LENGTH; // Will be H / 2
const HOSE_GROW_SPEED = 2; // Pixels per frame when shaking
const HOSE_SHRINK_SPEED = 1; // Pixels per frame when not shaking
const SHAKE_THRESHOLD = 15; // Magnitude of acceleration to consider a shake
const SHAKE_DEBOUNCE_TIME = 200; // ms to wait before next shake detection
let lastShakeTime = 0;
let isShaking = false;
let shakeAccumulator = 0; // Tracks if shaking is continuous enough to grow hose

let waterStain = {
    x: 0, y: 0, radius: 0, active: false, opacity: 1, color: 'rgba(0, 100, 200, 0.8)'
};
const WATER_STAIN_DURATION = 800; // ms water stays visible
const WATER_STAIN_MAX_RADIUS = 50;

let flowers = [];
const FLOWER_RADIUS = 25;
const FLOWER_SPEED = 1; // Pixels per frame
const FLOWER_SPAWN_INTERVAL = 2000; // ms
let lastFlowerSpawnTime = 0;
let score = 0;

let gameStarted = false;
let gameActive = false; // Controls game loop and shake detection
let gameOver = false;

// --- Utility Functions ---

// Function to resize canvas and set initial positions
function resizeCanvas() {
    // Set canvas dimensions based on screen size for portrait mode
    W = window.innerWidth;
    H = window.innerHeight;

    // Ensure it's in portrait aspect ratio (e.g., limit width to half height)
    // This is a simple way to force aspect ratio for mobile
    const aspectRatio = 9 / 16; // Standard portrait aspect ratio
    if (W / H > aspectRatio) {
        W = H * aspectRatio;
    } else {
        H = W / aspectRatio;
    }

    canvas.width = W;
    canvas.height = H;

    hoseX = W / 2;
    hoseY = H - MIN_HOSE_LENGTH / 2; // Start from bottom center
    MAX_HOSE_LENGTH = H / 2; // Hose reaches vertical middle
}

// Draw the hose
function drawHose() {
    ctx.beginPath();
    ctx.moveTo(hoseX, hoseY);
    ctx.lineTo(hoseX, hoseY - hoseLength);
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'black';
    ctx.stroke();
}

// Draw an irregular water stain (simplified as a circle for now, but can be complex path)
function drawWaterStain() {
    if (!waterStain.active) return;

    ctx.fillStyle = waterStain.color.replace('0.8', waterStain.opacity); // Adjust opacity
    ctx.beginPath();
    // For irregular shape, you'd define a path with multiple points
    // For now, let's use a simple circle for demonstration
    ctx.arc(waterStain.x, waterStain.y, waterStain.radius, 0, Math.PI * 2);
    ctx.fill();
}

// Draw a flower (simple circle for now)
function drawFlower(flower) {
    ctx.fillStyle = flower.hit ? 'rgba(0, 255, 0, 0.5)' : 'red'; // Green if hit, red otherwise
    ctx.beginPath();
    ctx.arc(flower.x, flower.y, FLOWER_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw small circles for flower petals, for a slightly better look
    ctx.fillStyle = 'yellow';
    const petalCount = 6;
    for (let i = 0; i < petalCount; i++) {
        const angle = (i / petalCount) * Math.PI * 2;
        const petalX = flower.x + (FLOWER_RADIUS * 0.7) * Math.cos(angle);
        const petalY = flower.y + (FLOWER_RADIUS * 0.7) * Math.sin(angle);
        ctx.beginPath();
        ctx.arc(petalX, petalY, FLOWER_RADIUS * 0.3, 0, Math.PI * 2);
        ctx.fill();
    }
    // Center of the flower
    ctx.fillStyle = 'orange';
    ctx.beginPath();
    ctx.arc(flower.x, flower.y, FLOWER_RADIUS * 0.2, 0, Math.PI * 2);
    ctx.fill();
}

// --- Game Logic ---

// Handle shake detection
function handleShake(event) {
    if (!gameActive) return;

    const acceleration = event.accelerationIncludingGravity;
    if (!acceleration || !acceleration.x || !acceleration.y || !acceleration.z) return;

    // Calculate magnitude
    const magnitude = Math.sqrt(
        acceleration.x * acceleration.x +
        acceleration.y * acceleration.y +
        acceleration.z * acceleration.z
    );

    const currentTime = Date.now();
    if (magnitude > SHAKE_THRESHOLD && (currentTime - lastShakeTime > SHAKE_DEBOUNCE_TIME)) {
        isShaking = true;
        lastShakeTime = currentTime;
        shakeAccumulator = Math.min(shakeAccumulator + 1, 5); // Accumulate shake strength
    } else if (magnitude <= SHAKE_THRESHOLD * 0.8) { // A lower threshold to detect "stop shaking"
         isShaking = false;
         shakeAccumulator = Math.max(shakeAccumulator - 0.5, 0); // Decay
    }

    // Adjust hose length based on shake status
    if (isShaking && shakeAccumulator > 0.5) { // Ensure consistent shaking
        hoseLength += HOSE_GROW_SPEED;
    } else {
        hoseLength -= HOSE_SHRINK_SPEED;
    }

    hoseLength = Math.max(MIN_HOSE_LENGTH, Math.min(hoseLength, MAX_HOSE_LENGTH));

    // If hose reached max length, trigger water pour
    if (hoseLength >= MAX_HOSE_LENGTH && !waterStain.active) {
        pourWater();
        hoseLength = MIN_HOSE_LENGTH; // Reset hose after pouring
    }
}

function pourWater() {
    waterStain.active = true;
    waterStain.x = hoseX;
    waterStain.y = hoseY - MAX_HOSE_LENGTH; // Tip of the hose
    waterStain.radius = WATER_STAIN_MAX_RADIUS;
    waterStain.opacity = 0.8;

    setTimeout(() => {
        // Start fading the water stain
        const fadeInterval = setInterval(() => {
            waterStain.opacity -= 0.05;
            if (waterStain.opacity <= 0) {
                waterStain.active = false;
                clearInterval(fadeInterval);
            }
        }, WATER_STAIN_DURATION / 16); // Approx 16 steps to fade out
    }, 100); // Short delay before starting fade
}

function spawnFlower() {
    if (!gameActive) return;

    const currentTime = Date.now();
    if (currentTime - lastFlowerSpawnTime > FLOWER_SPAWN_INTERVAL) {
        const startSide = Math.random() < 0.5 ? 'left' : 'right';
        const startX = startSide === 'left' ? -FLOWER_RADIUS : W + FLOWER_RADIUS;
        const direction = startSide === 'left' ? 1 : -1; // 1 for right, -1 for left
        const y = H / 2 - FLOWER_RADIUS - 50 - Math.random() * (H / 4); // Above middle, random height
        flowers.push({
            x: startX,
            y: y,
            direction: direction,
            hit: false,
            id: Date.now() // Unique ID for tracking
        });
        lastFlowerSpawnTime = currentTime;
    }
}

function updateFlowers() {
    for (let i = flowers.length - 1; i >= 0; i--) {
        const flower = flowers[i];
        flower.x += flower.direction * FLOWER_SPEED;

        // Remove flower if off-screen
        if (flower.x < -FLOWER_RADIUS * 2 || flower.x > W + FLOWER_RADIUS * 2) {
            flowers.splice(i, 1);
        }
    }
}

function checkCollisions() {
    if (!waterStain.active) return;

    const waterBounds = {
        x: waterStain.x - waterStain.radius,
        y: waterStain.y - waterStain.radius,
        width: waterStain.radius * 2,
        height: waterStain.radius * 2
    };

    for (const flower of flowers) {
        if (flower.hit) continue; // Skip already hit flowers

        const flowerBounds = {
            x: flower.x - FLOWER_RADIUS,
            y: flower.y - FLOWER_RADIUS,
            width: FLOWER_RADIUS * 2,
            height: FLOWER_RADIUS * 2
        };

        // Simple AABB collision detection
        if (waterBounds.x < flowerBounds.x + flowerBounds.width &&
            waterBounds.x + waterBounds.width > flowerBounds.x &&
            waterBounds.y < flowerBounds.y + flowerBounds.height &&
            waterBounds.y + waterBounds.height > flowerBounds.y) {

            // Collision detected!
            score++;
            scoreDisplay.textContent = `Score: ${score}`;
            flower.hit = true; // Mark flower as hit
            // You could play a sound or animation here
        }
    }
}


// --- Game Loop ---
let lastFrameTime = 0;
function gameLoop(currentTime) {
    if (!gameActive) return;

    const deltaTime = currentTime - lastFrameTime; // Not strictly needed for this game, but good practice
    lastFrameTime = currentTime;

    // Clear canvas
    ctx.clearRect(0, 0, W, H);

    // Update game state
    spawnFlower();
    updateFlowers();
    checkCollisions(); // Check for hits when water is active

    // Draw elements
    drawHose();
    drawWaterStain();
    flowers.forEach(drawFlower);

    // Request next frame
    requestAnimationFrame(gameLoop);
}

// --- Game State Management ---

function startGame() {
    gameStarted = true;
    gameActive = true;
    score = 0;
    scoreDisplay.textContent = `Score: ${score}`;
    hoseLength = MIN_HOSE_LENGTH;
    flowers = [];
    waterStain.active = false;
    lastShakeTime = 0;
    shakeAccumulator = 0;
    isShaking = false;
    messageDisplay.style.display = 'block';
    messageDisplay.textContent = 'Shake to Grow Hose!';

    setTimeout(() => {
        messageDisplay.style.display = 'none'; // Hide instructions after a few seconds
    }, 3000);

    requestAnimationFrame(gameLoop); // Start the game loop
}

function endGame() {
    gameActive = false;
    gameOver = true;
    messageDisplay.style.display = 'block';
    messageDisplay.textContent = `Game Over! Your Score: ${score}`;

    // --- Send score to Telegram (Telegram Web App specific) ---
    // This part requires the game to be running inside Telegram's WebView
    if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.sendData(JSON.stringify({ score: score }));
        // You might want to close the web app after sending score
        // window.Telegram.WebApp.close(); // Optional, depending on game flow
    } else {
        console.log("Telegram Web App not detected. Score not sent.");
    }
    // You could also add a "Play Again" button here for standalone browser play
}


// --- Event Listeners ---

// Listen for device motion (accelerometer)
window.addEventListener('devicemotion', handleShake);

// Initial canvas setup
window.addEventListener('load', () => {
    resizeCanvas();
    // Start game automatically for Telegram Web Apps, or show a start button
    startGame(); // Auto-start for simplicity with Telegram bot
});

// Handle screen orientation changes (though we aim for portrait fixed)
window.addEventListener('resize', resizeCanvas);


// For debugging outside Telegram (optional)
function debugGameControl(event) {
    if (event.key === 's') { // Simulate shake with 's' key
        if (!gameActive) return;
        const mockEvent = {
            accelerationIncludingGravity: { x: 20, y: 20, z: 20 }
        };
        handleShake(mockEvent);
    }
    if (event.key === 'p') { // Pour water manually with 'p' key
        if (!gameActive) return;
        if (hoseLength < MAX_HOSE_LENGTH) hoseLength = MAX_HOSE_LENGTH;
        if (hoseLength >= MAX_HOSE_LENGTH && !waterStain.active) {
            pourWater();
            hoseLength = MIN_HOSE_LENGTH;
        }
    }
    if (event.key === 'g') { // Toggle game active for debug
        if (gameActive) endGame(); else startGame();
    }
}
window.addEventListener('keydown', debugGameControl); // Remove for production