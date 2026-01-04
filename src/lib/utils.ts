import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toCents(amount: number) {
  return Math.round((Math.abs(amount) / 100) * 10000);
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
