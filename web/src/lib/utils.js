import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** shadcn / 21st.dev class helper: merge conditional classes, later Tailwind classes win. */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
