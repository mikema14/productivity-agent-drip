import { formatTime } from '../../utils/time';

interface Props {
  remainingSeconds: number;
  /** Colon blinks. */
  running?: boolean;
  /** Digits recede. */
  paused?: boolean;
  tone?: 'amber' | 'emerald';
  /** `xl`: the running card's larger digits. */
  size?: 'md' | 'xl';
}

/** The big `.now-digits` countdown over the ghost `88:88` segments (shared by every timer state). */
export default function CountdownDigits({ remainingSeconds, running = false, paused = false, tone = 'amber', size = 'md' }: Props) {
  const [mins, secs] = formatTime(remainingSeconds).split(':');
  const digitColor = tone === 'emerald' ? 'text-break' : paused ? 'text-txt-secondary' : 'text-txt-primary';

  return (
    <div className={`relative now-digits ${size === 'xl' ? 'now-digits-xl' : ''} -ml-1.5`}>
      <span aria-hidden className="absolute left-0 top-0 text-drip-ghost">88:88</span>
      <div role="timer" aria-label="Time remaining" className={`relative ${digitColor}`}>
        <span>{mins}</span>
        <span className={running ? 'colon-blink' : ''}>:</span>
        <span>{secs}</span>
      </div>
    </div>
  );
}
