import { describe, expect, it } from 'vitest';
import { fitWithin, IMAGE_MAX_EDGE, shrinkImage } from './image';

describe('fitWithin', () => {
  it('leaves a picture that already fits alone', () => {
    expect(fitWithin(400, 300, 512)).toEqual({ width: 400, height: 300 });
    expect(fitWithin(512, 512, 512)).toEqual({ width: 512, height: 512 });
  });

  it('scales the longest edge down to the limit, keeping the ratio', () => {
    expect(fitWithin(4000, 3000, 512)).toEqual({ width: 512, height: 384 });
    expect(fitWithin(3000, 4000, 512)).toEqual({ width: 384, height: 512 });
    expect(fitWithin(1024, 1024, 512)).toEqual({ width: 512, height: 512 });
  });

  it('never rounds an extreme ratio away to nothing', () => {
    // A 6000x10 banner would scale its height to 0.85px.
    expect(fitWithin(6000, 10, 512).height).toBe(1);
    expect(fitWithin(10, 6000, 512).width).toBe(1);
  });

  it('tolerates a zero dimension rather than dividing by it', () => {
    expect(fitWithin(0, 0, 512)).toEqual({ width: 0, height: 0 });
  });

  it('defaults to a limit comfortably above what these are drawn at', () => {
    // The largest of them is a 7rem circle, so 3x wants ~336 device pixels.
    expect(IMAGE_MAX_EDGE).toBeGreaterThanOrEqual(336);
    expect(fitWithin(4000, 4000)).toEqual({ width: IMAGE_MAX_EDGE, height: IMAGE_MAX_EDGE });
  });
});

describe('shrinkImage', () => {
  /*
   * jsdom has no createImageBitmap, which is exactly the "cannot shrink here" path.
   * It must hand back the original rather than throw — an upload should never fail
   * because an optimisation could not run.
   */
  it('returns the original when the browser cannot decode it', async () => {
    const file = new File(['not really an image'], 'photo.png', { type: 'image/png' });

    await expect(shrinkImage(file)).resolves.toBe(file);
  });

  it('leaves a non-image alone', async () => {
    const file = new File(['x'], 'notes.txt', { type: 'text/plain' });

    await expect(shrinkImage(file)).resolves.toBe(file);
  });
});
