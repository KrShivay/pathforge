import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { App } from './App';
import { ReportProvider } from './state/report-context';

function renderApp() {
  return render(<ReportProvider><App /></ReportProvider>);
}

test('opens the result-entry workflow from New report', () => {
  renderApp();
  fireEvent.click(screen.getAllByRole('button', { name: /new report/i })[0]);
  fireEvent.click(screen.getByRole('button', { name: /tests/i }));
  fireEvent.click(screen.getByRole('button', { name: /result entry/i }));
  expect(screen.getByRole('heading', { name: 'Result entry' })).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: /fasting blood sugar result/i })).toHaveValue('92');
});

test('shows immutable version history from the navigation pane', () => {
  renderApp();
  fireEvent.click(screen.getByRole('button', { name: /version history/i }));
  expect(screen.getByText('Current issue')).toBeInTheDocument();
  expect(screen.getByText('Initial issue')).toBeInTheDocument();
});
