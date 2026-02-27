import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | string, prefix: string = "UGX"): string {
  const num = typeof amount === 'string' ? parseFloat(amount) || 0 : amount;
  return `${prefix} ${Math.round(num).toLocaleString()}`;
}
