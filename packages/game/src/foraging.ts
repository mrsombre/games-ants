export const FORAGE_MIN_SECONDS = 5;
export const FORAGE_MAX_SECONDS = 60;

export const forageSeconds = (roll: number) => FORAGE_MIN_SECONDS + roll * (FORAGE_MAX_SECONDS - FORAGE_MIN_SECONDS);
