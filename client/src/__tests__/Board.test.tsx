import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Board from '../components/Board';
import { createInitialState, applyMove } from '../utils/gameLogic';

describe('Board component', () => {
  it('renderiza 9 células', () => {
    const state = createInitialState();
    render(<Board state={state} onMove={vi.fn()} />);
    const board = screen.getByTestId('board');
    expect(board.querySelectorAll('button')).toHaveLength(9);
  });

  it('chama onMove com o índice correto ao clicar em célula vazia', () => {
    const onMove = vi.fn();
    const state = createInitialState();
    render(<Board state={state} onMove={onMove} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[4]); // centro
    expect(onMove).toHaveBeenCalledWith(4);
  });

  it('não chama onMove em célula ocupada', () => {
    const onMove = vi.fn();
    let state = createInitialState();
    state = applyMove(state, 0); // X em 0
    render(<Board state={state} onMove={onMove} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]); // célula 0 já tem X
    expect(onMove).not.toHaveBeenCalled();
  });

  it('desabilita todas as células quando disabled=true', () => {
    const state = createInitialState();
    render(<Board state={state} onMove={vi.fn()} disabled={true} />);
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => expect(btn).toBeDisabled());
  });

  it('mostra X e O no tabuleiro', () => {
    let state = createInitialState();
    state = applyMove(state, 0); // X
    state = applyMove(state, 4); // O
    render(<Board state={state} onMove={vi.fn()} />);
    expect(screen.getByText('X')).toBeInTheDocument();
    expect(screen.getByText('O')).toBeInTheDocument();
  });
});
