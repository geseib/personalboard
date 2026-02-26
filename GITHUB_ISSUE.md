# perf: Background images slow to load — 32MB of unoptimized PNGs

**Labels:** `bug`, `performance`

## Problem

Users report slow background image loading on the Personal Board of Directors app. Investigation reveals **12 unoptimized PNG files totaling ~32MB** are used as full-screen CSS backgrounds. These are photographic images (hiking/nature scenes exported from PowerPoint) stored as PNG — a format ideal for graphics, not photos.

Each page navigation downloads a 1.5-4.7MB PNG before the background appears.

## Root Causes

| # | Cause | Severity |
|---|-------|----------|
| 1 | **PNG format for photos** — 1.5-4.7MB each, ~32MB total | HIGH |
| 2 | **No build-time optimization** — `cp -r` copies raw files | HIGH |
| 3 | **No preloading** — initial image loads only after JS executes | MEDIUM |
| 4 | **No prefetching** — adjacent pages not pre-cached | MEDIUM |
| 5 | **`background-attachment: fixed`** on all devices | LOW-MEDIUM |
| 6 | **24hr image cache** — could be longer for static assets | LOW |

## Image Size Audit

| Image | Original PNG | Optimized WebP (desktop) | Optimized WebP (mobile) | Reduction |
|-------|-------------|--------------------------|--------------------------|-----------|
| Slide2 (Intro) | 2.4 MB | 63 KB | 25 KB | 97% |
| Slide4 (Connectors) | 2.6 MB | 105 KB | 42 KB | 96% |
| Slide6 (Coaches) | 2.0 MB | 53 KB | 17 KB | 97% |
| Slide7 (Mentors) | 4.0 MB | 546 KB | 129 KB | 87% |
| Slide8 (Sponsors) | 4.7 MB | 721 KB | 183 KB | 85% |
| Slide9 (Peers) | 2.6 MB | 67 KB | 23 KB | 97% |
| Slide10 (Board) | 2.4 MB | 112 KB | 46 KB | 95% |
| Slide11 (You) | 3.2 MB | 158 KB | 39 KB | 95% |
| Slide12 (Goals) | 1.5 MB | 109 KB | 37 KB | 93% |
| **Total (9 used)** | **~25 MB** | **~2.0 MB** | **~541 KB** | **92-98%** |

## Fix Applied

1. **Image optimization build script** (`scripts/optimize-images.js`) — Uses `sharp` to convert PNGs to WebP + JPEG at desktop (1920px) and mobile (960px) sizes
2. **Image helper module** (`image-helpers.js`) — Client-side WebP detection, viewport-aware format resolver, idle-time prefetching
3. **app.js changes** — Uses `getOptimizedImageUrl()` for background rendering, prefetches adjacent page images on navigation
4. **HTML preload hints** — `<link rel="preload">` for intro background starts download before JS executes
5. **Mobile CSS fix** — Disabled `background-attachment: fixed` on viewports < 768px to eliminate GPU compositing jank
6. **Deploy script** — Optimized images served with 30-day immutable cache
7. **Admin page** — Updated to use optimized WebP background

## Results

- **Desktop:** ~25MB → ~2MB (92% reduction)
- **Mobile:** ~25MB → ~541KB (98% reduction)
- **Initial page load (Slide2):** 2.4MB → 63KB desktop / 25KB mobile
- **Prefetching** ensures near-instant tab switching after first load
- **HTML preload** eliminates blank screen flash on initial visit

## Future Optimization Opportunities

- [ ] AVIF format support (additional 20-30% over WebP, growing browser support)
- [ ] Responsive images via `srcset` / `<picture>` element for finer breakpoints
- [ ] Service worker for offline caching and instant repeat visits
- [ ] Image CDN (e.g., CloudFront Functions for on-the-fly resize/format negotiation)
