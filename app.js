/* --- 1. PERFORMANCE CONFIGURATION --- */
const PERFORMANCE_CONFIG = {
  LOW_END_RAM_LIMIT: 4, 
  LOW_END_CPU_LIMIT: 4,
  FORCE_SMOOTHING_ON_MOBILE: true
};

/* --- 2. DEVICE CAPABILITY DETECTION --- */
function shouldEnableSmoothing() {
  if (navigator.deviceMemory && navigator.deviceMemory < PERFORMANCE_CONFIG.LOW_END_RAM_LIMIT) return true;
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= PERFORMANCE_CONFIG.LOW_END_CPU_LIMIT) return true;
  if (PERFORMANCE_CONFIG.FORCE_SMOOTHING_ON_MOBILE) {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) return true;
  }
  return false;
}

/* --- 3. DYNAMIC CSS INJECTION --- */
if (shouldEnableSmoothing()) {
  console.log("Performance Tier: Low/Mobile - Enabling Smoothing");
  const style = document.createElement('style');
  style.textContent = `
    .packaging-container { transition: transform 0.1s linear !important; }
    :root { transition: --rot-x 0.1s linear, --rot-y 0.1s linear !important; }
    .face { transition: filter 0.1s linear !important; }
  `;
  document.head.appendChild(style);
} else {
  console.log("Performance Tier: High - Raw Input Enabled");
}

/* --- 4. APP LOGIC --- */
const variants = {
  original: {
    bg: 'oklch(72% 0.14 210)', 
    accent: 'oklch(20% 0.21 28.5)',
    silhouette: 'oklch(56% 0.14 233)',
    text: 'ORIGINAL',
    pirt: '2053518010553-27'
  },
  barbecue: {
    bg: 'oklch(55% 0.09 60)', 
    accent: 'oklch(20% 0.21 42)',
    silhouette: 'oklch(33% 0.04 55)',
    text: 'BARBECUE',
    pirt: '2053518010554-28'
  },
  cheese: {
    bg: 'oklch(88% 0.17 95)', 
    accent: 'oklch(20% 0.22 50)',
    silhouette: 'oklch(74% 0.18 80)',
    text: 'CHEESE',
    pirt: '2053518010555-29'
  },
  lime: {
    bg: 'oklch(72% 0.16 134)', 
    accent: 'oklch(20% 0.17 142)',
    silhouette: 'oklch(64% 0.17 131)',
    text: 'DAUN JERUK',
    pirt: '2053518010556-30'
  },
  balado: {
    bg: 'oklch(59% 0.20 28)', 
    accent: 'oklch(20% 0.19 96)',
    silhouette: 'oklch(46% 0.21 28)',
    text: 'BALADO',
    pirt: '2053518010557-31'
  }
};

/* --- STATE VARIABLES --- */
let rotX = 0;
let rotY = 0;
let scale = 1;
let panX = 0;
let panY = 0;

let currentRenderState = { rotX: 0, rotY: 0, scale: 1, panX: 0, panY: 0 };

let isRotating = false;
let isPanning = false;
let startX = 0;
let startY = 0;
let panStartX = 0;
let panStartY = 0;

let initialPinchDist = null;
let initialScale = 1;
let lastPinchScale = 1;
let lastPinchCenterX = 0;
let lastPinchCenterY = 0;

let sceneCenterX = 0;
let sceneCenterY = 0;

/* --- DOM ELEMENTS --- */
const scene = document.getElementById('scene-area');
const root = document.documentElement;
const packagingContainer = document.querySelector('.packaging-container');
const packagingShadow = document.querySelector('.packaging-shadow');

// --- WINDOW SIZE ---
let lightX = -window.innerWidth / 2;
let lightY = -window.innerHeight / 2;

window.addEventListener('resize', () => {
  lightX = -window.innerWidth / 2;
  lightY = -window.innerHeight / 2;
});

/* --- VARIANT HANDLING --- */
function applyVariant(key) {
  const data = variants[key];
  packagingContainer.style.setProperty('--pkg-bg', data.bg);
  // packagingContainer.style.setProperty('--pkg-accent', data.accent);
  packagingContainer.style.setProperty('--pkg-silhouette', data.silhouette);
  document.getElementById('variant-text').innerText = data.text;
  document.getElementById('pirt-number').innerText = data.pirt;
}

document.querySelectorAll('.var-pill').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.var-pill').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    applyVariant(e.target.dataset.variant);
  });
});

/* --- RENDER LOOP --- */
function renderLoop() {
  if (
    currentRenderState.rotX !== rotX ||
    currentRenderState.rotY !== rotY ||
    currentRenderState.scale !== scale ||
    currentRenderState.panX !== panX ||
    currentRenderState.panY !== panY ||
    currentRenderState.lightX !== lightX ||
    currentRenderState.lightY !== lightY
  ) {
    // A. UPDATE CSS VARIABLES (Lighting & Rotation)
    if (currentRenderState.rotX !== rotX || currentRenderState.rotY !== rotY) {
      root.style.setProperty('--rot-x', `${rotX}deg`);
      root.style.setProperty('--rot-y', `${rotY}deg`);

      // --- 1. CONFIGURATION ---
      const BASE_BRIGHTNESS = 0.95;
      const LIGHT_RANGE = 0.15;
      
      // Light Vector: TOP (-Y), LEFT (-X), FRONT (+Z)
      // We normalize these values (make length ≈ 1) for accurate math.
      // Top-Left-Front lighting direction:
      const Lx = -0.5; // Light comes from Left
      const Ly = -0.5; // Light comes from Top (Visual top is negative Y)
      const Lz = 0.7;  // Light comes from Front

      // Convert angles to radians
      const radX = rotX * (Math.PI / 180);
      const radY = rotY * (Math.PI / 180);

      const sinX = Math.sin(radX);
      const cosX = Math.cos(radX);
      const sinY = Math.sin(radY);
      const cosY = Math.cos(radY);

      // --- 2. HELPER: 3D ROTATION ---
      // Rotates a face's normal vector by current X and Y angles
      // Order: Rotate Y (Yaw) -> Then Rotate X (Pitch)
      function getBrightnessForFace(nx, ny, nz) {
        // Step A: Rotate around Y-axis (Yaw)
        const yRotX = nx * cosY + nz * sinY;
        const yRotY = ny;
        const yRotZ = -nx * sinY + nz * cosY;

        // Step B: Rotate around X-axis (Pitch)
        const finalX = yRotX;
        const finalY = yRotY * cosX - yRotZ * sinX;
        const finalZ = yRotY * sinX + yRotZ * cosX;

        // Step C: Dot Product (The "Summing" Logic)
        // Multiply rotated normal by light vector and sum them
        const dot = (finalX * Lx) + (finalY * Ly) + (finalZ * Lz);

        // Step D: Apply Base & Range
        return BASE_BRIGHTNESS + (dot * LIGHT_RANGE);
      }

      // --- 3. CALCULATE EACH FACE ---
      // Normals: Front(0,0,1), Back(0,0,-1), Left(-1,0,0), Right(1,0,0), Top(0,-1,0), Bottom(0,1,0)
      
      const lightFront  = getBrightnessForFace(0, 0, 1);
      const lightBack   = getBrightnessForFace(0, 0, -1);
      const lightLeft   = getBrightnessForFace(-1, 0, 0);
      const lightRight  = getBrightnessForFace(1, 0, 0);
      const lightTop    = getBrightnessForFace(0, -1, 0); // CSS Top is -Y
      const lightBottom = getBrightnessForFace(0, 1, 0);  // CSS Bottom is +Y

      // --- 4. INJECT CSS ---
      packagingContainer.style.setProperty('--light-front', lightFront);
      packagingContainer.style.setProperty('--light-back', lightBack);
      packagingContainer.style.setProperty('--light-left', lightLeft);
      packagingContainer.style.setProperty('--light-right', lightRight);
      packagingContainer.style.setProperty('--light-top', lightTop);
      packagingContainer.style.setProperty('--light-bottom', lightBottom);
    }

    // B. APPLY OBJECT TRANSFORM
    packagingContainer.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;

    // C. SHADOW PROJECTION (GROUND-PLANE MODEL)
    // Vector from light → object
    const dx = panX - lightX;
    const dy = panY - lightY;
    
    // Apply Y-rotation influence (object-facing effect)
    const rotYRads = rotY * Math.PI / 180;
    const cosY = Math.cos(rotYRads);
    const sinY = Math.sin(rotYRads); 

    // Normalize direction (safe)
    const dist = Math.hypot(dx, dy) || 1;
    const dirX = dx / dist;
    const dirY = dy / dist;

    // Virtual elevation (ties shadow strength to scale)
    const elevation = 45 * scale;

    // Shadow offset (projected onto ground)
    const offsetX = dirX * elevation;
    const offsetY = dirY * elevation;

    // Shadow length (distance-based, clamped)
    const stretchY = Math.min(2.2, 0.7 + dist * 0.0012);

    // Shadow width reacts to Y-rotation
    const squashX = Math.max(0.18, Math.abs(Math.cos(rotYRads)));

    // Apply transform (IMPORTANT: translate FIRST)
    packagingShadow.style.transform = `
      translate(-50%, 0)
      translateZ(-3000px)
      translate(${offsetX}px, ${offsetY}px)
      scaleX(${squashX})
      scaleY(${stretchY})
    `;

    console.log(lightX)

    // E. UPDATE CACHE
    currentRenderState.rotX = rotX;
    currentRenderState.rotY = rotY;
    currentRenderState.scale = scale;
    currentRenderState.panX = panX;
    currentRenderState.panY = panY;
    currentRenderState.lightX = lightX;
    currentRenderState.lightY = lightY;
  }
  requestAnimationFrame(renderLoop);
}
requestAnimationFrame(renderLoop);

/* --- UI CONTROLS --- */
function triggerButtonAnim(btn) {
  btn.classList.add('clicked');
  setTimeout(() => btn.classList.remove('clicked'), 150);
}

document.getElementById('reset-front').addEventListener('click', function () {
  triggerButtonAnim(this);
  rotX = 0;
  rotY = 0;
  resetTransform();
});

document.getElementById('reset-back').addEventListener('click', function () {
  triggerButtonAnim(this);
  rotX = 0;
  rotY = 180;
});

function resetTransform() {
  scale = 1;
  panX = 0;
  panY = 0;
}

function updateSceneMetrics() {
  const rect = scene.getBoundingClientRect();
  sceneCenterX = rect.left + rect.width / 2;
  sceneCenterY = rect.top + rect.height / 2;
}

/* --- INTERACTION HANDLERS --- */
scene.addEventListener('contextmenu', e => e.preventDefault());

// 1. DESKTOP ZOOM (WHEEL)
scene.addEventListener('wheel', (e) => {
  if (e.ctrlKey) {
    e.preventDefault();
    updateSceneMetrics();

    const zoomIntensity = 0.1;
    const delta = -Math.sign(e.deltaY) * zoomIntensity;
    const newScale = scale + delta;

    if (newScale >= 0.5 && newScale <= 5) {
      const currentContainerX = sceneCenterX + panX;
      const currentContainerY = sceneCenterY + panY;
      const mouseX = e.clientX - currentContainerX;
      const mouseY = e.clientY - currentContainerY;

      panX -= (mouseX / scale) * delta;
      panY -= (mouseY / scale) * delta;
      scale = newScale;
    }
  }
}, { passive: false });

// 2. POINTER HANDLERS
const handleStart = (e) => {
  updateSceneMetrics();

  if (e.touches && e.touches.length === 2) {
    isRotating = false;
    isPanning = false;
    const t1 = e.touches[0];
    const t2 = e.touches[1];
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    initialPinchDist = Math.sqrt(dx * dx + dy * dy);
    initialScale = scale;
    lastPinchScale = scale;
    lastPinchCenterX = (t1.clientX + t2.clientX) / 2;
    lastPinchCenterY = (t1.clientY + t2.clientY) / 2;
    return;
  }

  if (e.button === 2) {
    isPanning = true;
    isRotating = false;
    panStartX = e.clientX;
    panStartY = e.clientY;
    return;
  }

  if (e.button === 0 || (e.touches && e.touches.length === 1)) {
    isRotating = true;
    isPanning = false;
    startX = e.clientX || e.touches[0].clientX;
    startY = e.clientY || e.touches[0].clientY;
  }
};

const handleMove = (e) => {
  if (e.touches && e.touches.length === 2 && initialPinchDist) {
    e.preventDefault();
    const t1 = e.touches[0];
    const t2 = e.touches[1];
    
    // Scale
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    const currentDist = Math.sqrt(dx * dx + dy * dy);
    const pinchRatio = currentDist / initialPinchDist;
    
    let newScale = initialScale * pinchRatio;
    newScale = Math.min(Math.max(0.5, newScale), 5);
    const scaleDiff = newScale - lastPinchScale;

    // Pan
    const currentCenterX = (t1.clientX + t2.clientX) / 2;
    const currentCenterY = (t1.clientY + t2.clientY) / 2;
    const moveX = currentCenterX - lastPinchCenterX;
    const moveY = currentCenterY - lastPinchCenterY;
    
    panX += moveX;
    panY += moveY;

    // Zoom Correction
    const currentContainerX = sceneCenterX + panX;
    const currentContainerY = sceneCenterY + panY;
    const offsetX = currentCenterX - currentContainerX;
    const offsetY = currentCenterY - currentContainerY;

    if (lastPinchScale !== 0) {
      panX -= (offsetX / lastPinchScale) * scaleDiff;
      panY -= (offsetY / lastPinchScale) * scaleDiff;
    }

    scale = newScale;
    lastPinchScale = newScale;
    lastPinchCenterX = currentCenterX;
    lastPinchCenterY = currentCenterY;
    return;
  }

  if (isPanning) {
    const dx = e.clientX - panStartX;
    const dy = e.clientY - panStartY;
    panX += dx;
    panY += dy;
    panStartX = e.clientX;
    panStartY = e.clientY;
    return;
  }

  if (isRotating) {
    const clientX = e.clientX || (e.touches ? e.touches[0].clientX : 0);
    const clientY = e.clientY || (e.touches ? e.touches[0].clientY : 0);
    
    const deltaX = clientX - startX;
    const deltaY = clientY - startY;
    
    const speed = 0.5;

    rotY += deltaX * speed;
    rotX -= deltaY * speed;
    
    startX = clientX;
    startY = clientY;
  }
};

const handleEnd = () => {
  isRotating = false;
  isPanning = false;
  initialPinchDist = null;
};

scene.addEventListener('mousedown', handleStart);
window.addEventListener('mousemove', handleMove);
window.addEventListener('mouseup', handleEnd);

scene.addEventListener('touchstart', handleStart, { passive: false });
window.addEventListener('touchmove', handleMove, { passive: false });
window.addEventListener('touchend', handleEnd);
window.addEventListener('resize', updateSceneMetrics);

applyVariant('original')