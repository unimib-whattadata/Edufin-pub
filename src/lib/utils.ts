import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const randomUUID = () => {
  function* generateUUID() {
    while (true) {
      const uuidv4 = () => {
        // Generate a random number from 0 to 15
        function randomDigit() {
          return Math.floor(Math.random() * 16);
        }
        // Generate a random hex digit
        function randomHex() {
          return randomDigit().toString(16);
        }
        // Generate a random segment of 4 hex digits
        function randomSegment() {
          return randomHex() + randomHex() + randomHex() + randomHex();
        }
        // Generate a UUID following the 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx' pattern
        return (
          randomSegment() +
          "-" +
          randomSegment() +
          "-4" +
          randomSegment().substring(1, 3) +
          "-" +
          randomHex() +
          randomSegment().substring(1, 3) +
          "-" +
          randomSegment() +
          randomSegment()
        );
      };
      yield uuidv4();
    }
  }
  return generateUUID().next().value as string;
};
