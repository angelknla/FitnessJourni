import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Member } from '@/types/fitness';
import { MemberTabs } from './MemberTabs';

const targets = {
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

const setup = (activeId = 'm1') => {
  const onSelect = vi.fn();
  const onAdd = vi.fn();

  render(
    <MemberTabs
      members={members}
      activeId={activeId}
      onSelect={onSelect}
      onAdd={onAdd}
      addOpen={false}
      panelId="panel"
    />
  );

  return { onSelect, onAdd };
};

describe('MemberTabs', () => {
  it('is a real tablist with one tab per person', () => {
    setup();

    expect(screen.getByRole('tablist', { name: 'People' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  it('marks only the active tab as selected and wires it to the panel', () => {
    setup('m2');

    const angel = screen.getByRole('tab', { name: 'Angel' });
    expect(angel).toHaveAttribute('aria-selected', 'true');
    expect(angel).toHaveAttribute('aria-controls', 'panel');
    expect(screen.getByRole('tab', { name: 'Dillon' })).toHaveAttribute('aria-selected', 'false');
  });

  it('uses a roving tabindex so the tablist is one tab stop', () => {
    setup('m1');

    expect(screen.getByRole('tab', { name: 'Dillon' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Angel' })).toHaveAttribute('tabindex', '-1');
  });

  it('selects a person when their tab is clicked', async () => {
    const user = userEvent.setup();
    const { onSelect } = setup();

    await user.click(screen.getByRole('tab', { name: 'Bradley' }));

    expect(onSelect).toHaveBeenCalledWith('m3');
  });

  it('moves selection with the arrow keys and wraps at the ends', async () => {
    const user = userEvent.setup();
    const { onSelect } = setup('m1');

    const dillon = screen.getByRole('tab', { name: 'Dillon' });
    dillon.focus();

    await user.keyboard('{ArrowRight}');
    expect(onSelect).toHaveBeenCalledWith('m2');

    onSelect.mockClear();
    await user.keyboard('{ArrowLeft}');
    expect(onSelect).toHaveBeenCalledWith('m3');
  });

  it('jumps to the last person with End', async () => {
    const user = userEvent.setup();
    const { onSelect } = setup('m1');

    screen.getByRole('tab', { name: 'Dillon' }).focus();
    await user.keyboard('{End}');

    expect(onSelect).toHaveBeenCalledWith('m3');
  });

  it('offers an add button that reports its expanded state', async () => {
    const user = userEvent.setup();
    const { onAdd } = setup();

    const add = screen.getByRole('button', { name: 'Add a person' });
    expect(add).toHaveAttribute('aria-expanded', 'false');

    await user.click(add);
    expect(onAdd).toHaveBeenCalled();
  });

  it('shows edge cues only where more tabs can be scrolled', () => {
    setup();

    const tabs = screen.getByRole('tablist', { name: 'People' });
    const viewport = tabs.parentElement;
    Object.defineProperties(tabs, {
      clientWidth: { configurable: true, value: 200 },
      scrollWidth: { configurable: true, value: 400 },
      scrollLeft: { configurable: true, writable: true, value: 0 },
    });

    fireEvent.scroll(tabs);
    expect(viewport).not.toHaveAttribute('data-scroll-left');
    expect(viewport).toHaveAttribute('data-scroll-right', 'true');

    tabs.scrollLeft = 200;
    fireEvent.scroll(tabs);
    expect(viewport).toHaveAttribute('data-scroll-left', 'true');
    expect(viewport).not.toHaveAttribute('data-scroll-right');
  });

  it('scrolls a newly active off-screen tab into view', () => {
    const scrollIntoView = vi.fn();
    const { rerender } = render(
      <MemberTabs
        members={members}
        activeId="m1"
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        addOpen={false}
        panelId="panel"
      />
    );
    const tabs = screen.getByRole('tablist', { name: 'People' });
    const bradley = screen.getByRole('tab', { name: 'Bradley' });
    vi.spyOn(tabs, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      right: 200,
    } as DOMRect);
    vi.spyOn(bradley, 'getBoundingClientRect').mockReturnValue({
      left: 240,
      right: 330,
    } as DOMRect);
    bradley.scrollIntoView = scrollIntoView;

    rerender(
      <MemberTabs
        members={members}
        activeId="m3"
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        addOpen={false}
        panelId="panel"
      />
    );

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  });

});
