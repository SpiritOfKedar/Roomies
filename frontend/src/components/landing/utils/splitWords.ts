import { createElement, type ReactNode } from 'react';

export function splitWords(text: string, className?: string): ReactNode[] {
  return text.split(' ').map((word, index) =>
    createElement(
      'span',
      {
        key: `${word}-${index}`,
        className: `inline-block overflow-hidden ${className ?? ''}`.trim(),
      },
      createElement(
        'span',
        {
          className: 'word-inner inline-block',
        },
        word,
      ),
      index < text.split(' ').length - 1 ? '\u00A0' : null,
    ),
  );
}
