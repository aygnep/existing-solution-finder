import { fireEvent, render, screen } from '@testing-library/react';
import { App } from './App';

describe('Solution Guide', () => {
  it('shows an editable search plan before discovery starts', () => {
    render(<App discover={jest.fn()} />);

    fireEvent.change(screen.getByLabelText('Describe the problem'), {
      target: { value: 'Vite cannot find module' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create search plan' }));

    expect(screen.getByRole('heading', { name: 'Search plan' })).toBeInTheDocument();
    expect(screen.getByLabelText('GitHub')).toBeChecked();
  });
});
