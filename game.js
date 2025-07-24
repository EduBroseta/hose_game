// --- Canvas Setup ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score-display');
const messageDisplay = document.getElementById('message-display');

// New: GIF elements
const splashGif = new Image();
splashGif.src = 'splash_animation.gif'; // Ensure this path is correct
let isGifPlaying = false;
let gifElement = null; // To hold the created img element

// New: Titties image
const tittiesImage = new Image();
tittiesImage.src = 'titties.png'; // Ensure this path is correct and image exists

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
    x: 0, y: 0, radius: 0, active: false, opacity: 1, color: 'rgba(0, 100, 200, 0.8)',
    // New: Properties for triangle blob
    baseWidth: 100, // Initial base width of the inverted triangle
    height: 100 // Height of the inverted triangle
};
const WATER_STAIN_DURATION = 800; // ms water stays visible (now used for fading opacity)
const WATER_STAIN_MAX_RADIUS = 50; // Still used for fading logic, though shape is different

let flowers = []; // Renamed from balls to flowers, consistent with original code
const FLOWER_RADIUS = 50; // Original was 25, now 50. This will be the half-width/height of the image
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

// Draw an inverted triangle water stain
function drawWaterStain() {
    if (!waterStain.active) return;

    ctx.fillStyle = waterStain.color.replace('0.8', waterStain.opacity); // Adjust opacity

    ctx.beginPath();
    // Tip of the hose is waterStain.x, waterStain.y
    // Base of the triangle is at waterStain.y + waterStain.height
    // Points: (tip), (bottom-left), (bottom-right)
    ctx.moveTo(waterStain.x, waterStain.y); // Tip of the hose
    ctx.lineTo(waterStain.x - waterStain.baseWidth / 2, waterStain.y + waterStain.height); // Bottom-left
    ctx.lineTo(waterStain.x + waterStain.baseWidth / 2, waterStain.y + waterStain.height); // Bottom-right
    ctx.closePath();
    ctx.fill();
}

// Draw a flower (now an image)
function drawFlower(flower) {
    if (!tittiesImage.complete || !tittiesImage.naturalWidth) {
        // Fallback to drawing a simple circle if image not loaded
        ctx.fillStyle = flower.hit ? 'rgba(0, 255, 0, 0.5)' : '#FFDEAD'; // Flesh tone
        ctx.beginPath();
        ctx.arc(flower.x, flower.y, FLOWER_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = 'brown';
        ctx.beginPath();
        ctx.arc(flower.x, flower.y, FLOWER_RADIUS * 0.2, 0, Math.PI * 2);
        ctx.fill();
        return;
    }

    // Draw the image centered at flower.x, flower.y
    const imgWidth = FLOWER_RADIUS * 2;
    const imgHeight = FLOWER_RADIUS * 2;
    ctx.drawImage(tittiesImage, flower.x - imgWidth / 2, flower.y - imgHeight / 2, imgWidth, imgHeight);

    if (flower.hit) {
        ctx.fillStyle = 'rgba(0, 255, 0, 0.5)'; // Green overlay if hit
        ctx.beginPath();
        ctx.arc(flower.x, flower.y, FLOWER_RADIUS, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(flower.x, flower.y, FLOWER_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
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
    if (hoseLength >= MAX_HOSE_LENGTH && !waterStain.active && !isGifPlaying) { // Check if GIF is not already playing
        pourWater();
        // MODIFICATION: Freeze game and play GIF
        gameActive = false; // Freeze the game
        playSplashGif();
        // The hose will be reset to MIN_HOSE_LENGTH on touch
    }
}

function pourWater() {
    waterStain.active = true;
    waterStain.x = hoseX;
    waterStain.y = hoseY - MAX_HOSE_LENGTH; // Tip of the hose
    waterStain.baseWidth = W * 0.4; // Make the base width proportional to canvas width
    waterStain.height = W * 0.4; // Make height proportional too, adjust as needed

    // Start fading the water stain immediately
    const fadeInterval = setInterval(() => {
        waterStain.opacity -= 0.01; // Slower fade for 'forever' display until tap
        if (waterStain.opacity <= 0) {
            waterStain.opacity = 0; // Don't go below zero
            // clearInterval(fadeInterval); // Do NOT clear interval here, keep it for forever display
        }
    }, 50); // Adjust fade speed
}

// Control single flower appearance
function spawnFlower() {
    if (!gameActive) return;

    const currentTime = Date.now();
    // Only spawn if no flowers are currently active
    if (flowers.length === 0 && (currentTime - lastFlowerSpawnTime > FLOWER_SPAWN_INTERVAL)) {
        const startSide = Math.random() < 0.5 ? 'left' : 'right';
        const startX = startSide === 'left' ? -FLOWER_RADIUS * 2 : W + FLOWER_RADIUS * 2; // Start completely off screen
        const y = H / 2 - FLOWER_RADIUS - 50 - Math.random() * (H / 4); // Above middle, random height

        flowers.push({
            x: startX,
            y: y,
            originalX: startX,
            originalY: y,
            // New: Movement properties
            moveType: Math.floor(Math.random() * 3), // 0: diagonal, 1: circular, 2: irregular
            angle: Math.random() * Math.PI * 2, // For circular movement
            amplitude: FLOWER_RADIUS * (0.5 + Math.random()), // For irregular movement
            phase: Math.random() * Math.PI * 2, // For irregular movement
            direction: startSide === 'left' ? 1 : -1, // 1 for right, -1 for left
            hit: false,
            id: Date.now() // Unique ID for tracking
        });
        lastFlowerSpawnTime = currentTime;
    }
}

function updateFlowers() {
    for (let i = flowers.length - 1; i >= 0; i--) {
        const flower = flowers[i];

        switch (flower.moveType) {
            case 0: // Diagonal movement
                flower.x += flower.direction * FLOWER_SPEED;
                flower.y += (flower.direction * FLOWER_SPEED * 0.5); // Slight vertical component
                break;
            case 1: // Circular movement
                flower.angle += 0.05; // Speed of rotation
                flower.x = flower.originalX + Math.cos(flower.angle) * FLOWER_RADIUS * 1.5;
                flower.y = flower.originalY + Math.sin(flower.angle) * FLOWER_RADIUS * 1.5;
                // Move the center of the circle across the screen
                flower.originalX += flower.direction * FLOWER_SPEED * 0.5;
                break;
            case 2: // Slightly irregular movement (sine wave like)
                flower.x += flower.direction * FLOWER_SPEED;
                flower.y = flower.originalY + Math.sin(flower.x / 50 + flower.phase) * flower.amplitude;
                break;
        }

        // Remove flower if off-screen
        if (flower.x < -FLOWER_RADIUS * 3 || flower.x > W + FLOWER_RADIUS * 3) {
            flowers.splice(i, 1);
        }
    }
}

function checkCollisions() {
    if (!waterStain.active) return;

    // Collision for triangle blob: Check if flower center is within triangle
    // Get the coordinates of the triangle vertices
    const tipX = waterStain.x;
    const tipY = waterStain.y;
    const bottomLeftX = waterStain.x - waterStain.baseWidth / 2;
    const bottomLeftY = waterStain.y + waterStain.height;
    const bottomRightX = waterStain.x + waterStain.baseWidth / 2;
    const bottomRightY = waterStain.y + waterStain.height;

    // Helper function to calculate signed area of a triangle
    function sign(p1x, p1y, p2x, p2y, p3x, p3y) {
        return (p1x - p3x) * (p2y - p3y) - (p2x - p3x) * (p1y - p3y);
    }

    for (const flower of flowers) {
        if (flower.hit) continue; // Skip already hit flowers

        // Check if the center of the flower is inside the triangle
        const d1 = sign(flower.x, flower.y, tipX, tipY, bottomLeftX, bottomLeftY);
        const d2 = sign(flower.x, flower.y, bottomLeftX, bottomLeftY, bottomRightX, bottomRightY);
        const d3 = sign(flower.x, flower.y, bottomRightX, bottomRightY, tipX, tipY);

        const has_neg = (d1 < 0) || (d2 < 0) || (d3 < 0);
        const has_pos = (d1 > 0) || (d2 > 0) || (d3 > 0);

        // If not all same sign, it's inside (or on edge)
        if (!(has_neg && has_pos)) {
            // Collision detected!
            score++;
            scoreDisplay.textContent = `Score: ${score}`;
            flower.hit = true; // Mark flower as hit
            // You could play a sound or animation here
        }
    }
}

// Play Splash GIF
function playSplashGif() {
    if (isGifPlaying) return;

    isGifPlaying = true;
    gifElement = document.createElement('img');
    gifElement.src = 'splash_animation.gif';
    gifElement.id = 'splash-gif';
    gifElement.style.position = 'absolute';
    gifElement.style.zIndex = '100'; // Ensure it's on top

    // Calculate GIF position to match hose tip
    const hoseTipY = hoseY - MAX_HOSE_LENGTH;
    gifElement.style.bottom = `${H - hoseTipY}px`; // Bottom of GIF at hose tip
    gifElement.style.left = '50%';
    gifElement.style.transform = 'translateX(-50%)'; // Center horizontally

    gifElement.style.maxWidth = '90%'; // As big as possible
    gifElement.style.maxHeight = '90%';
    gifElement.style.objectFit = 'contain';
    document.getElementById('game-container').appendChild(gifElement);

    gifElement.onload = () => {
        // We only want the GIF to play once and then disappear
        // The setTimeout should be for the GIF's actual duration.
        // A common trick to ensure one-time playback without precise duration:
        // Duplicate the GIF and play the new one, then remove the old.
        // Or simply remove it after a sensible duration if it loops internally.
        const gifDurationGuess = 1500; // Adjust this based on your GIF's actual duration

        setTimeout(() => {
            if (gifElement) {
                gifElement.remove();
                gifElement = null;
                isGifPlaying = false;
            }
        }, gifDurationGuess);
    };
}

// --- Game Loop ---
let lastFrameTime = 0;
function gameLoop(currentTime) {
    // MODIFICATION: Always draw hose, water stain, and flowers if active, or just if game is frozen but water is active
    ctx.clearRect(0, 0, W, H);
    drawHose();
    drawWaterStain();
    flowers.forEach(drawFlower);

    if (!gameActive) {
        requestAnimationFrame(gameLoop); // Keep requesting frames to show GIF/frozen state
        return;
    }

    const deltaTime = currentTime - lastFrameTime; // Not strictly needed for this game, but good practice
    lastFrameTime = currentTime;

    // Update game state
    spawnFlower();
    updateFlowers();
    checkCollisions(); // Check for hits when water is active

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
    waterStain.opacity = 1; // Reset opacity for new pour
    lastShakeTime = 0;
    shakeAccumulator = 0;
    isShaking = false;
    messageDisplay.style.display = 'block';
    messageDisplay.textContent = 'Shake to Grow Hose!';

    // Remove any existing GIF element
    if (gifElement) {
        gifElement.remove();
        gifElement = null;
    }
    isGifPlaying = false;

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

// MODIFICATION: Resume game on touch
window.addEventListener('touchstart', (event) => {
    // Only respond if game is not active (frozen after pour) and GIF has finished playing
    if (!gameActive && !isGifPlaying && waterStain.active) { // waterStain.active ensures it was a pour that froze it
        hoseLength = MIN_HOSE_LENGTH; // Reset hose
        waterStain.active = false; // Deactivate water stain
        waterStain.opacity = 1; // Reset opacity for next pour
        gameActive = true; // Resume game
        // Optionally re-hide message display if it was shown for game over
        if (messageDisplay.textContent.includes("Game Over!")) {
            messageDisplay.style.display = 'none';
        }
        requestAnimationFrame(gameLoop); // Ensure game loop is active
    } else if (!gameStarted) { // If game hasn't started yet, allow touch to start it
        startGame();
    }
});


// Initial canvas setup
window.addEventListener('load', () => {
    resizeCanvas();
    // Start game automatically for Telegram Web Apps, or show a start button
    messageDisplay.style.display = 'block';
    messageDisplay.textContent = 'Tap to Start!';
    tittiesImage.onload = () => {
        console.log("Titties image loaded successfully.");
    };
    tittiesImage.onerror = () => {
        console.error("Failed to load titties.png. Check path and file existence.");
    };
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
            gameActive = false;
            playSplashGif();
        }
    }
    if (event.key === 'g') { // Toggle game active for debug
        if (gameActive) endGame(); else startGame();
    }
    // Debug key for resuming after pour
    if (event.key === 'r') {
        if (!gameActive && !isGifPlaying && waterStain.active) {
            hoseLength = MIN_HOSE_LENGTH; // Reset hose
            waterStain.active = false;
            waterStain.opacity = 1;
            gameActive = true; // Resume game
            if (messageDisplay.textContent.includes("Game Over!")) {
                messageDisplay.style.display = 'none';
            }
            requestAnimationFrame(gameLoop);
        }
    }
}
window.addEventListener('keydown', debugGameControl); // Remove for production