import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, it, expect } from 'vitest';

import { PlanPanel } from './PlanPanel';

import type { PlanTodo } from '../../core/chat/planTodos';

const t = (content: string, status: PlanTodo['status'], activeForm = content): PlanTodo => ({
  content,
  status,
  activeForm,
});

describe('PlanPanel (#128)', () => {
  it('plan 無し (空配列) → 何も描画しない', () => {
    const { container } = render(<PlanPanel todos={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('進行中: 展開時に in_progress は activeForm、それ以外は content を表示', () => {
    render(
      <PlanPanel
        todos={[t('取得する', 'completed', '取得中'), t('集計する', 'in_progress', '集計中'), t('出力する', 'pending', '出力中')]}
        defaultCollapsed={false}
      />,
    );
    expect(screen.getByText('取得する')).toBeInTheDocument(); // completed → content
    expect(screen.getByText('集計中')).toBeInTheDocument(); // in_progress → activeForm
    expect(screen.getByText('出力する')).toBeInTheDocument(); // pending → content
    expect(screen.getByText('1 / 3')).toBeInTheDocument(); // completed / total
  });

  it('全完了: 「作業が完了しました」を表示し既定で畳む', () => {
    render(<PlanPanel todos={[t('A', 'completed'), t('B', 'completed')]} />);
    expect(screen.getByText('作業が完了しました')).toBeInTheDocument();
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    // 畳まれているので行 (A/B) は非表示
    expect(screen.queryByText('A')).not.toBeInTheDocument();
  });

  it('ヘッダクリックで開閉トグル / 畳むとタイトルが現在の activeForm に切替わる', () => {
    render(
      <PlanPanel todos={[t('集計する', 'in_progress', '集計中'), t('出力する', 'pending')]} defaultCollapsed={false} />,
    );
    // 展開時のタイトル
    expect(screen.getByText('作業を実行中')).toBeInTheDocument();
    // ヘッダ (最初の button) をクリックして畳む
    fireEvent.click(screen.getAllByRole('button')[0]!);
    // 畳むとタイトルが activeForm に (ヘッダにも行にも「集計中」が出るので getAllByText)
    expect(screen.getAllByText('集計中').length).toBeGreaterThan(0);
  });

  it('停止中 (running=false) に in_progress が残ると「作業を中断しました」+ 中断バッジ表示', () => {
    render(
      <PlanPanel
        todos={[t('取得する', 'completed'), t('集計する', 'in_progress', '集計中')]}
        running={false}
        defaultCollapsed={false}
      />,
    );
    expect(screen.getByText('作業を中断しました')).toBeInTheDocument();
    expect(screen.getByText('中断')).toBeInTheDocument(); // 実行中バッジが中断に変わる
    expect(screen.queryByText('実行中')).not.toBeInTheDocument();
  });

  it('全完了なら running=false でも「中断」ではなく「作業が完了しました」', () => {
    render(<PlanPanel todos={[t('A', 'completed'), t('B', 'completed')]} running={false} />);
    expect(screen.getByText('作業が完了しました')).toBeInTheDocument();
    expect(screen.queryByText('作業を中断しました')).not.toBeInTheDocument();
  });

  it('長い plan: 完了行を「N 件完了」に畳み、開くと展開できる', () => {
    const todos: PlanTodo[] = [
      t('a', 'completed'),
      t('b', 'completed'),
      t('c', 'completed'),
      t('d', 'in_progress', 'd 中'),
      t('e', 'pending'),
      t('f', 'pending'),
      t('g', 'pending'),
      t('h', 'pending'),
    ];
    render(<PlanPanel todos={todos} defaultCollapsed={false} />);
    // 8 件・完了 3 → 完了行は畳まれ「3 件完了」サマリになる
    expect(screen.getByText('3 件完了')).toBeInTheDocument();
    expect(screen.queryByText('a')).not.toBeInTheDocument();
    // サマリをクリックすると完了行が展開される
    fireEvent.click(screen.getByText('3 件完了'));
    expect(screen.getByText('a')).toBeInTheDocument();
  });

  it('完了済み plan が新しい未完了 plan に置き換わると畳み込みがリセットされ展開表示になる', () => {
    // allDone な plan は既定で畳まれる (行非表示)。同一マウントで新 plan に置換すると開く。
    function Harness(): JSX.Element {
      const [todos, setTodos] = useState<PlanTodo[]>([t('A', 'completed'), t('B', 'completed')]);
      return (
        <>
          <button onClick={() => setTodos([t('新規1', 'in_progress', '新規1中'), t('新規2', 'pending')])}>
            next
          </button>
          <PlanPanel todos={todos} />
        </>
      );
    }
    render(<Harness />);
    // 初期 (全完了) は畳まれていて行が見えない
    expect(screen.getByText('作業が完了しました')).toBeInTheDocument();
    expect(screen.queryByText('新規1中')).not.toBeInTheDocument();
    // 新しい未完了 plan に置換 → 自動で開き、行が見える
    fireEvent.click(screen.getByText('next'));
    expect(screen.getByText('新規1中')).toBeInTheDocument();
    expect(screen.getByText('新規2')).toBeInTheDocument();
  });
});
