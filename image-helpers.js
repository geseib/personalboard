// Detect WebP support (runs once at module load)
const supportsWebP = (() => {
  if (typeof document === 'undefined') return false;
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
})();

function isMobileViewport() {
  return typeof window !== 'undefined' && window.innerWidth <= 960;
}

/**
 * Given an original image path like "./images/Slide2.png",
 * returns the optimized version path.
 */
export function getOptimizedImageUrl(originalPath) {
  const match = originalPath.match(/Slide(\d+)\.png$/);
  if (!match) return originalPath;

  const slideName = `Slide${match[1]}`;
  const suffix = isMobileViewport() ? '-mobile' : '';
  const ext = supportsWebP ? 'webp' : 'jpg';

  return `./images/optimized/${slideName}${suffix}.${ext}`;
}

/**
 * Prefetch images for adjacent pages using idle time.
 */
export function prefetchImages(urls) {
  if (typeof window === 'undefined') return;

  const doFetch = () => {
    urls.forEach(url => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.as = 'image';
      link.href = url;
      document.head.appendChild(link);
    });
  };

  if ('requestIdleCallback' in window) {
    requestIdleCallback(doFetch);
  } else {
    setTimeout(doFetch, 2000);
  }
}
