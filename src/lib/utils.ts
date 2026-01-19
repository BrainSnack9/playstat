import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { ko, enUS, ja, es, de } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getDateLocale(locale: string) {
  switch (locale) {
    case 'ko':
      return ko
    case 'ja':
      return ja
    case 'es':
      return es
    case 'de':
      return de
    case 'en':
    default:
      return enUS
  }
}
