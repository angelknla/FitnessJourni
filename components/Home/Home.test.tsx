import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DailyLog, Member, MemberTargets } from '@/types/fitness';

// Mocked so the real modules (and next/cache with them) stay out of jsdom.
vi.mock('@/app/actions', () => ({
  saveDailyLog: vi.fn(async () => ({ ok: true, message: 'Data saved.' })),
  saveSleep: vi.fn(async () => ({ ok: true })),
  updateTargets: vi.fn(async () => ({ ok: false })),
  logWorkout: vi.fn(async () => ({ ok: false })),
  deleteWorkout: vi.fn(async () => ({ ok: false })),
  addMember: vi.fn(async () => ({ ok: false })),
}));
vi.mock('@/app/auth-actions', () => ({
  unlock: vi.fn(async () => ({})),
  lock: vi.fn(async () => undefined),
}));
const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation }));

import { Home } from './Home';

const targets: MemberTargets = {
  calories: 2500,
  protein: 156,
  carbs: 313,
  fat: 69,
  steps: 10000,
  stepsMin: 8000,
  waterMl: 2500,
  workoutsPerWeek: 4,
};

const members: Member[] = [
  { id: 'm1', name: 'Dillon', accent: 'blue', sortOrder: 0, targets },
  { id: 'm2', name: 'Angel', accent: 'orange', sortOrder: 1, targets },
  { id: 'm3', name: 'Bradley', accent: 'aqua', sortOrder: 2, targets },
];

const date = '2026-09-25';

const log = (memberId: string): DailyLog => ({
  memberId,
  date,
  steps: 9000,
  waterMl: 2000,
  calories: 2400,
  proteinG: 150,
  carbsG: 300,
  fatG: 60,
  sleepHours: null,
});

const props = (viewerId: string | null) => ({
  members,
  logs: { m1: log('m1'), m2: log('m2'), m3: log('m3') },
  workouts: [],
  tallies: {},
  date,
  today: date,
  datePickerLabel: 'Today',
  dateLabel: 'Friday, 25 September',
  viewerId,
});

const setup = (viewerId: string | null) => render(<Home {...props(viewerId)} />);

const selectedTab = () =>
  screen.getAllByRole('tab').find((tab) => tab.getAttribute('aria-selected') === 'true');

const quickEntry = () => screen.queryByRole('button', { name: /Log .*'s day/ });

describe('Home', () => {
  it('defaults the date picker to today and prevents future dates', () => {
    setup('m1');

    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Friday, 25 September' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Choose dashboard date, Today' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Dashboard date value')).toHaveAttribute('value', date);
    expect(screen.getByLabelText('Dashboard date value')).toHaveAttribute('max', date);
  });

  it('opens the native picker from the whole visible date button', () => {
    setup('m1');
    const input = screen.getByLabelText('Dashboard date value') as HTMLInputElement;
    const showPicker = vi.fn();
    input.showPicker = showPicker;

    fireEvent.click(screen.getByRole('button', { name: 'Choose dashboard date, Today' }));

    expect(showPicker).toHaveBeenCalledOnce();
  });

  it('opens a past date through the URL', () => {
    navigation.push.mockClear();
    setup('m1');

    fireEvent.change(screen.getByLabelText('Dashboard date value'), {
      target: { value: '2026-09-20' },
    });

    expect(navigation.push).toHaveBeenCalledWith('/?date=2026-09-20');
  });

  it('steps back from today without offering a future-day control', () => {
    navigation.push.mockClear();
    setup('m1');

    expect(screen.queryByRole('button', { name: 'Next day' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }));

    expect(navigation.push).toHaveBeenCalledWith('/?date=2026-09-24');
  });

  it('steps forward from a historical date', () => {
    navigation.push.mockClear();
    render(
      <Home
        {...props('m1')}
        date="2026-09-24"
        datePickerLabel="Yesterday"
        dateLabel="Thursday, 24 September"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next day' }));

    expect(navigation.push).toHaveBeenCalledWith('/');
  });

  it('labels historical dates and returns to the clean route for today', () => {
    navigation.push.mockClear();
    render(
      <Home
        {...props('m1')}
        date="2026-09-24"
        datePickerLabel="Yesterday"
        dateLabel="Thursday, 24 September"
      />
    );

    expect(screen.getByText('Yesterday')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Everyone on this day' })).toBeInTheDocument();
    expect(screen.getByText('Not logged on this day')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Dashboard date value'), {
      target: { value: date },
    });

    expect(navigation.push).toHaveBeenCalledWith('/');
  });

  it('opens on the signed-in person, not on whoever sorts first', () => {
    setup('m3');

    expect(selectedTab()).toHaveTextContent('Bradley');
  });

  it('still opens on the first person for a visitor, who has nobody to open on', () => {
    setup(null);

    expect(selectedTab()).toHaveTextContent('Dillon');
  });

  it('lets you edit your own day', () => {
    setup('m1');

    expect(quickEntry()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Edit Dillon's macro targets" })).toBeInTheDocument();
  });

  it('adds estimated step calories to the calorie ring target only', () => {
    setup('m1');
    const summary = screen.getByRole('heading', { name: 'Macros' }).closest('section');

    expect(
      screen.getByRole('img', {
        name: 'Calories: 2,400 of 2,500 target plus 360 burned, 84 percent',
      })
    ).toBeInTheDocument();
    expect(summary).toHaveTextContent('of 2,500');
    expect(summary).toHaveTextContent('+ 360');
    expect(summary).toHaveTextContent('360 kcal burned from steps');
    expect(screen.queryByText(/The tick on Steps marks/)).not.toBeInTheDocument();
    expect(targets.calories).toBe(2500);
  });

  it('swaps the targets pencil for a close icon while editing', async () => {
    const user = userEvent.setup();
    setup('m1');

    const edit = screen.getByRole('button', { name: "Edit Dillon's macro targets" });
    expect(edit.querySelector('path')).toHaveAttribute(
      'd',
      'M11.1 2.4l2.5 2.5-7.4 7.4-3.1.6.6-3.1z'
    );

    await user.click(edit);

    const close = screen.getByRole('button', { name: 'Stop editing macro targets' });
    expect(close.querySelector('path')).toHaveAttribute('d', 'M4.4 4.4l7.2 7.2M11.6 4.4l-7.2 7.2');

    await user.click(close);

    expect(
      screen.getByRole('button', { name: "Edit Dillon's macro targets" }).querySelector('path')
    ).toHaveAttribute('d', 'M11.1 2.4l2.5 2.5-7.4 7.4-3.1.6.6-3.1z');
  });

  it('opens the sleep target editor from the Sleep section pencil', async () => {
    const user = userEvent.setup();
    setup('m1');

    await user.click(screen.getByRole('button', { name: "Edit Dillon's sleep target" }));

    expect(screen.getByRole('spinbutton', { name: 'Hours per night' })).toHaveValue(8);
    expect(screen.getByRole('button', { name: 'Stop editing sleep target' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save sleep target' })).toBeInTheDocument();
  });

  it('keeps daily inputs collapsed until its title is opened', async () => {
    const user = userEvent.setup();
    setup('m1');

    const toggle = screen.getByRole('button', { name: "Log Dillon's day" });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('spinbutton', { name: 'Steps' })).not.toBeInTheDocument();

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('spinbutton', { name: 'Steps' })).toBeInTheDocument();
  });

  it('only enables Save while daily inputs differ from their loaded values', async () => {
    const user = userEvent.setup();
    setup('m1');
    await user.click(screen.getByRole('button', { name: "Log Dillon's day" }));

    const steps = screen.getByRole('spinbutton', { name: 'Steps' });
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();

    await user.clear(steps);
    await user.type(steps, '9500');
    expect(save).toBeEnabled();

    await user.clear(steps);
    await user.type(steps, '9000');
    expect(save).toBeDisabled();
  });

  it('confirms when daily inputs are saved', async () => {
    const user = userEvent.setup();
    setup('m1');
    await user.click(screen.getByRole('button', { name: "Log Dillon's day" }));

    const steps = screen.getByRole('spinbutton', { name: 'Steps' });
    await user.clear(steps);
    await user.type(steps, '9500');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Data saved.');
  });

  it('turns another person’s tab read-only without showing a redundant notice', async () => {
    const user = userEvent.setup();
    setup('m1');

    await user.click(screen.getByRole('tab', { name: 'Angel' }));

    expect(quickEntry()).not.toBeInTheDocument();
    expect(screen.queryByText(/signed in as someone else/)).not.toBeInTheDocument();
    // The point of the app is comparing, so their read-only figures must survive.
    expect(screen.getByRole('heading', { name: 'Macros' }).closest('section')).toHaveTextContent(
      'Protein: 150 of 156 grams'
    );
  });

  it('slides the member panels out and the next member in when swiped', () => {
    setup('m1');
    const panel = screen.getByRole('heading', { name: 'Macros' }).closest('section');
    const tabpanel = screen.getByRole('tabpanel');
    const track = tabpanel.querySelector('[data-swipe-phase]');
    const measurements = screen.getByRole('img', { name: /^Steps:/ });

    expect(panel).not.toBeNull();
    expect(track).not.toBeNull();
    expect(panel).toContainElement(measurements);
    fireEvent.touchStart(measurements!, { touches: [{ clientX: 180, clientY: 100 }] });
    fireEvent.touchMove(measurements!, { touches: [{ clientX: 120, clientY: 105 }] });
    expect(track).toHaveAttribute('data-swipe-phase', 'dragging');
    expect(track).toHaveStyle({ '--swipe-offset': '-60px' });

    fireEvent.touchEnd(measurements!, { changedTouches: [{ clientX: 80, clientY: 105 }] });
    expect(track).toHaveAttribute('data-swipe-phase', 'exiting');
    expect(selectedTab()).toHaveTextContent('Dillon');

    fireEvent.transitionEnd(track!, { propertyName: 'transform' });
    expect(selectedTab()).toHaveTextContent('Angel');
    expect(track).toHaveAttribute('data-swipe-phase', 'positioning');
  });

  it('hides the targets pencil on someone else’s tab', async () => {
    const user = userEvent.setup();
    setup('m1');

    await user.click(screen.getByRole('tab', { name: 'Angel' }));

    expect(screen.queryByRole('button', { name: /macro targets/ })).not.toBeInTheDocument();
  });

  it('gives a visitor no editing anywhere, and says how to fix that', () => {
    setup(null);

    expect(quickEntry()).not.toBeInTheDocument();
    expect(screen.getByText(/visitor/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /macro targets/ })).not.toBeInTheDocument();
  });

  /* Picking an identity refreshes the server tree without remounting this, so a
     mount-time initialiser alone left a fresh login on the first person's tab. */
  it('moves to your tab when you sign in without a remount', () => {
    const { rerender } = render(<Home {...props(null)} />);
    expect(selectedTab()).toHaveTextContent('Dillon');

    rerender(<Home {...props('m3')} />);

    expect(selectedTab()).toHaveTextContent('Bradley');
  });

  it('follows a switch from one person to another', () => {
    const { rerender } = render(<Home {...props('m1')} />);

    rerender(<Home {...props('m2')} />);

    expect(selectedTab()).toHaveTextContent('Angel');
  });

  /* Every save revalidates and re-renders with the same viewer; being thrown back
     to your own tab each time would make another person's day unreadable. */
  it('leaves the chosen tab alone when a refresh changes nothing about who you are', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Home {...props('m1')} />);

    await user.click(screen.getByRole('tab', { name: 'Bradley' }));
    expect(selectedTab()).toHaveTextContent('Bradley');

    rerender(<Home {...props('m1')} />);

    expect(selectedTab()).toHaveTextContent('Bradley');
  });

  it('leaves a visitor where they are, having nobody to move to', () => {
    const { rerender } = render(<Home {...props('m2')} />);

    rerender(<Home {...props(null)} />);

    expect(selectedTab()).toHaveTextContent('Angel');
  });

  it('puts you first in the strip, with everyone else in their usual order', () => {
    setup('m3');

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Bradley',
      'Dillon',
      'Angel',
    ]);
  });

  it('leaves the usual order alone for a visitor, who is nobody to hoist', () => {
    setup(null);

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Dillon',
      'Angel',
      'Bradley',
    ]);
  });

  it('puts the signed-in person first in Everyone today', () => {
    setup('m3');

    const strip = screen.getByRole('region', { name: 'Everyone today' });
    expect(strip.textContent).toMatch(/Bradley[\s\S]*Dillon[\s\S]*Angel/);
  });

  it('keeps the usual Everyone today order for a visitor', () => {
    setup(null);

    const strip = screen.getByRole('region', { name: 'Everyone today' });
    expect(strip.textContent).toMatch(/Dillon[\s\S]*Angel[\s\S]*Bradley/);
  });

  it('places sleep after workouts and before Everyone today', () => {
    setup('m1');

    const pageText = document.body.textContent ?? '';
    expect(pageText.indexOf('Workouts')).toBeLessThan(pageText.indexOf('Sleep'));
    expect(pageText.indexOf('Sleep')).toBeLessThan(pageText.indexOf('Everyone today'));
    expect(screen.getByRole('link', { name: 'See sleep logs' })).toHaveAttribute(
      'href',
      '/logs?period=week'
    );
  });

  it('reorders as soon as the identity changes, without a remount', () => {
    const { rerender } = render(<Home {...props('m1')} />);

    rerender(<Home {...props('m2')} />);

    expect(screen.getAllByRole('tab')[0]).toHaveTextContent('Angel');
  });
});
