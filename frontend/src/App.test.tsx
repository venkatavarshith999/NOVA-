import { test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { NotFound } from './pages/ErrorPages';

test('renders 404 page correctly', () => {
  render(
    <BrowserRouter>
      <NotFound />
    </BrowserRouter>
  );
  const textElements = screen.queryAllByText(/404/i);
  expect(textElements.length).toBeGreaterThan(0);
});
