import React from 'react';
import { render, screen } from '@testing-library/react-native';

import SummaryIndexPage from '@/app/summary/index';

describe('Summary index route', () => {
  it('renders the contract-specific invalid profile state for /summary/', () => {
    render(<SummaryIndexPage />);

    expect(screen.getByText('档案 ID 无效')).toBeTruthy();
  });
});
