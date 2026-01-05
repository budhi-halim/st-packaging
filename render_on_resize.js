/* smart-scale.js */

let committedScale = 1;
let commitTimer = null;
const MAX_RENDER_SCALE = 3; // Performance cap (don't render huge DOMs on mobile)

/**
 * Manages the trade-off between smooth zooming (transform) and sharp resolution (layout).
 * * @param {HTMLElement} element - The .packaging-container element
 * @param {number} targetScale - The current scale level from app.js logic
 * @param {function} onCommit - Callback to trigger a re-render when resolution snaps
 * @returns {number} - The scale value to apply to the CSS transform
 */
export function getSmartScale(element, targetScale, onCommit) {
  // 1. Calculate the 'Visual Scale' (Transform) needed to bridge the gap
  // between the current user zoom and the last committed DOM resolution.
  // Formula: Visual = Total_Desired / Current_Actual_Size
  const visualTransformScale = targetScale / committedScale;

  // 2. Debounce the Resolution Snap
  // We don't want to change actual DOM width while animating (causes lag).
  // We wait until the user stops interacting.
  clearTimeout(commitTimer);

  commitTimer = setTimeout(() => {
    // Only update if the scale has changed significantly (> 1%)
    if (Math.abs(committedScale - targetScale) > 0.01) {
      
      // Cap the resolution to save memory on mobile devices
      // (User zooms to 5x, but we only render at max 3x quality)
      const newRenderScale = Math.min(targetScale, MAX_RENDER_SCALE);

      // 3. Commit the new Resolution
      committedScale = newRenderScale;
      
      // Update the CSS Variable that controls width
      element.style.setProperty('--render-scale', committedScale);

      // Trigger the main loop to update the transform immediately
      if (onCommit) onCommit();
    }
  }, 500); // Wait 500ms after last movement

  // Return the value to be used in `transform: scale(...)`
  // If we just committed to 2.0x resolution and target is 2.0x, this returns 1.0 (Sharp!)
  return visualTransformScale;
}