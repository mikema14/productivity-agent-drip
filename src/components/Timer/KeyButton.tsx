import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'amber' | 'outline' | 'ghost' | 'danger';
type Size = 'md' | 'sm';

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: Variant;
  size?: Size;
  /** Key hint rendered after the label, e.g. `↵`. */
  kbd?: string;
  children: ReactNode;
}

const VARIANT: Record<Variant, string> = {
  amber: 'bg-focus text-drip-bg shadow-key-amber hover:brightness-110 disabled:shadow-none',
  outline: 'bg-transparent text-txt-primary border border-txt-dim shadow-key-dark hover:bg-focus/5 hover:border-txt-muted',
  ghost: 'bg-transparent text-txt-muted border border-drip-border hover:text-txt-primary hover:bg-focus/5',
  danger: 'bg-transparent text-txt-muted border border-drip-border hover:text-alert hover:border-alert/40 hover:bg-alert/5',
};

const SIZE: Record<Size, string> = {
  md: 'h-11 px-4 text-[12.5px] gap-3',
  sm: 'h-7 px-2.5 text-[11px] gap-2',
};

/** Physical-key style button: mono uppercase label with a 3px drop edge that presses in. */
export default function KeyButton({ variant = 'outline', size = 'md', kbd, children, className = '', ...rest }: Props) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center font-mono font-medium uppercase tracking-label rounded-[3px] transition-[transform,box-shadow,background-color,color] duration-100 active:translate-y-[2px] active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed disabled:active:translate-y-0 ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...rest}
    >
      <span>{children}</span>
      {kbd && <kbd className="font-mono text-[12px] normal-case tracking-normal opacity-80">{kbd}</kbd>}
    </button>
  );
}
