import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toCents(amount: number) {
  const str = amount.toString();
  const int = str.split('.');

  return Number(amount.toFixed(2).replace('.', '').padEnd(int.length === 1 ? 3 : 4, '0'));
}

const moneyFormatter = Intl.NumberFormat('pt-BR', {
  currency: 'brl',
});

export function centsToRealAmount(amountInCents: number) {
  const amount = amountInCents / 100;

  return moneyFormatter.format(amount);
}

export function centsToRealAmountNotFormatted(amountInCents: number) {
  return amountInCents / 100;
}
