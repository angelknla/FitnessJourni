import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MemberAvatar } from './MemberAvatar';

describe('MemberAvatar', () => {
  it('shows the saved avatar image', () => {
    const { container } = render(
      <MemberAvatar member={{ name: 'Dillon', accent: 'blue', avatarPath: '/avatars/tempo.svg' }} />
    );

    expect(container.querySelector('img')).toHaveAttribute('src', '/avatars/tempo.svg');
  });

  it('falls back to the member initial', () => {
    const { container } = render(
      <MemberAvatar member={{ name: 'Angel', accent: 'orange', avatarPath: null }} />
    );

    expect(container.firstElementChild).toHaveAttribute('data-initial', 'A');
    expect(container).not.toHaveTextContent('A');
  });
});
