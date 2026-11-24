interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
}

interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  msExitFullscreen?: () => Promise<void> | void;
}

type OrientationWithOptionalLock = ScreenOrientation & {
  lock?: (
    orientation: 'landscape' | 'landscape-primary' | 'landscape-secondary' | 'portrait' | 'any'
  ) => Promise<void>;
  unlock?: () => void;
};

export function isFullscreenActive(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as FullscreenDocument;
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
}

export function isLandscapeViewport(): boolean {
  if (typeof window === 'undefined') return true;
  const mediaLandscape = window.matchMedia?.('(orientation: landscape)')?.matches;
  return Boolean(mediaLandscape) || window.innerWidth >= window.innerHeight;
}

export function isMobilePortraitViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return !isLandscapeViewport() && window.innerWidth < 900;
}

export function triggerViewportResize(): void {
  if (typeof window === 'undefined') return;
  window.requestAnimationFrame(() => {
    window.dispatchEvent(new Event('resize'));
  });
}

/**
 * Triggers document.documentElement.requestFullscreen() combined with
 * screen.orientation.lock('landscape') for 16:9 mobile arcade gameplay.
 */
export async function enterLandscapeFullscreen(
  targetEl?: HTMLElement | null
): Promise<{ fullscreen: boolean; orientationLocked: boolean }> {
  let fullscreen = false;
  let orientationLocked = false;

  if (typeof document === 'undefined') {
    return { fullscreen, orientationLocked };
  }

  const element = (targetEl ?? document.documentElement) as FullscreenElement;

  try {
    if (!isFullscreenActive()) {
      if (element.requestFullscreen) {
        await element.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions);
        fullscreen = true;
      } else if (element.webkitRequestFullscreen) {
        await element.webkitRequestFullscreen();
        fullscreen = true;
      } else if (element.msRequestFullscreen) {
        await element.msRequestFullscreen();
        fullscreen = true;
      }
    } else {
      fullscreen = true;
    }
  } catch {
    // Fullscreen can be blocked by browser policy without user gesture
  }

  try {
    const orientation = window.screen?.orientation as OrientationWithOptionalLock | undefined;
    if (orientation?.lock) {
      await orientation.lock('landscape');
      orientationLocked = true;
    }
  } catch {
    // Browsers with auto-rotate off or iOS Safari reject orientation.lock; CSS Force-Landscape handles fallback
  }

  triggerViewportResize();
  return { fullscreen, orientationLocked };
}

/**
 * Unlocks screen orientation and exits fullscreen cleanly when returning to the home portal.
 */
export async function exitLandscapeFullscreen(): Promise<void> {
  if (typeof document === 'undefined') return;

  try {
    const orientation = window.screen?.orientation as OrientationWithOptionalLock | undefined;
    if (orientation?.unlock) {
      orientation.unlock();
    }
  } catch {
    // Ignore unsupported unlock
  }

  const doc = document as FullscreenDocument;
  try {
    if (doc.fullscreenElement && doc.exitFullscreen) {
      await doc.exitFullscreen();
    } else if (doc.webkitFullscreenElement && doc.webkitExitFullscreen) {
      await doc.webkitExitFullscreen();
    } else if (doc.msExitFullscreen) {
      await doc.msExitFullscreen();
    }
  } catch {
    // Ignore exit errors if already exited
  }

  triggerViewportResize();
}
