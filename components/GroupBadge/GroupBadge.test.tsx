import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GroupBadge } from './GroupBadge';

describe('GroupBadge', () => {
  it('names the active group and links to group management', () => {
    render(<GroupBadge groupName="Nine Elms" />);

    const link = screen.getByRole('link', { name: 'Nine Elms — manage groups' });
    expect(link).toHaveAttribute('href', '/groups');
    expect(link).toHaveTextContent('Nine Elms');
    expect(link).toHaveAttribute('title', 'Nine Elms — manage groups');
  });

  it('says what it is for, so it does not read as a label', () => {
    render(<GroupBadge groupName="Nine Elms" />);

    expect(screen.getByText('Manage')).toBeInTheDocument();
  });

  it('says Personal rather than going blank when there is no group', () => {
    render(<GroupBadge groupName={null} />);

    expect(screen.getByRole('link', { name: /^Personal —/ })).toHaveTextContent('Personal');
  });

  it('marks waiting invitations and requests, and counts them in the label', () => {
    const { container, rerender } = render(<GroupBadge groupName="Nine Elms" pendingCount={2} />);

    expect(container.querySelector('[class*="pending"]')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Nine Elms — manage groups, 2 requests waiting' })
    ).toBeInTheDocument();

    rerender(<GroupBadge groupName="Nine Elms" pendingCount={1} />);
    expect(
      screen.getByRole('link', { name: 'Nine Elms — manage groups, 1 request waiting' })
    ).toBeInTheDocument();
  });

  it('shows no marker when nothing is waiting', () => {
    const { container } = render(<GroupBadge groupName="Nine Elms" pendingCount={0} />);

    expect(container.querySelector('[class*="pending"]')).not.toBeInTheDocument();
  });
});
