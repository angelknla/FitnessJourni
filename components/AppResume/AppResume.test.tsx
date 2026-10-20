import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { refresh, router } = vi.hoisted(() => {
  const refresh = vi.fn();
  return { refresh, router: { refresh } };
});
vi.mock('next/navigation', () => ({ useRouter: () => router }));

import { toISODate } from '@utils/date';
import { AppResume } from './AppResume';

const visibility = (state: DocumentVisibilityState) => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
  act(() => document.dispatchEvent(new Event('visibilitychange')));
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  refresh.mockClear();
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('AppResume', () => {
  it('refreshes an initial server date that differs from the local browser date', () => {
    render(<AppResume initialDate="1969-12-30" timeZone="UTC" />);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('refreshes once when the browser timezone changes', () => {
    render(<AppResume initialDate={toISODate(new Date())} timeZone="Europe/Sofia" />);
    expect(refresh).toHaveBeenCalledTimes(1);
    act(() => window.dispatchEvent(new Event('pageshow')));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('refreshes at local midnight while the app stays open', () => {
    vi.setSystemTime(new Date(2026, 9, 20, 23, 59, 59));
    render(<AppResume />);
    expect(refresh).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1100));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('refreshes after crossing midnight even during a brief app switch', () => {
    vi.setSystemTime(new Date(2026, 9, 20, 23, 59, 59));
    render(<AppResume />);
    visibility('hidden');
    act(() => vi.advanceTimersByTime(2000));
    expect(refresh).not.toHaveBeenCalled();
    visibility('visible');
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('avoids requests on mount and a brief app switch', () => {
    render(<AppResume />);
    visibility('hidden');
    vi.advanceTimersByTime(10_000);
    visibility('visible');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('refreshes once after a longer absence despite multiple resume events', () => {
    render(<AppResume />);
    visibility('hidden');
    vi.advanceTimersByTime(31_000);
    visibility('visible');
    act(() => window.dispatchEvent(new Event('pageshow')));
    act(() => window.dispatchEvent(new Event('online')));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('defers an offline resume until connectivity returns', () => {
    render(<AppResume />);
    visibility('hidden');
    vi.advanceTimersByTime(31_000);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    visibility('visible');
    expect(refresh).not.toHaveBeenCalled();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    act(() => window.dispatchEvent(new Event('online')));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('cleans up listeners when unmounted', () => {
    const { unmount } = render(<AppResume />);
    visibility('hidden');
    unmount();
    vi.advanceTimersByTime(31_000);
    visibility('visible');
    act(() => window.dispatchEvent(new Event('pageshow')));
    expect(refresh).not.toHaveBeenCalled();
  });
});
