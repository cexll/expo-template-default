import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { ChangeBadge } from '@/components/ChangeBadge';

describe('ChangeBadge', () => {
  it('renders increase variant with symbol and value', () => {
    render(<ChangeBadge type="increase" value="+1.5mm" />);

    expect(screen.getByText('▲ +1.5mm')).toBeTruthy();
  });

  it('renders decrease variant with symbol and value', () => {
    render(<ChangeBadge type="decrease" value="-1.8mm" />);

    expect(screen.getByText('▼ -1.8mm')).toBeTruthy();
  });

  it('renders unchanged variant', () => {
    render(<ChangeBadge type="unchanged" />);

    expect(screen.getByText(/未变/)).toBeTruthy();
  });

  it('renders new variant', () => {
    render(<ChangeBadge type="new" />);

    expect(screen.getByText('新出现')).toBeTruthy();
  });
});
