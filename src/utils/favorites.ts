/**
 * Utilities for managing favorite/bookmarked foods
 * Stores favorites in localStorage for quick access
 */

import type { Meal } from '../types';

const FAVORITES_KEY = 'mp_favorite_foods';
const MAX_FAVORITES = 50;

export interface FavoriteFood {
  id: string;
  meal: Meal;
  addedAt: string;
}

/**
 * Get all favorite foods
 */
export function getFavoriteFoods(): FavoriteFood[] {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    if (!stored) return [];

    const favorites = JSON.parse(stored) as FavoriteFood[];
    return Array.isArray(favorites) ? favorites : [];
  } catch (error) {
    console.error('Failed to load favorite foods:', error);
    return [];
  }
}

/**
 * Add a food to favorites
 */
export function addFavoriteFood(meal: Meal): boolean {
  try {
    const favorites = getFavoriteFoods();

    // Check if already favorited (by name for simplicity)
    const exists = favorites.some((fav) => fav.meal.name === meal.name);
    if (exists) {
      return false;
    }

    // Limit number of favorites
    if (favorites.length >= MAX_FAVORITES) {
      return false;
    }

    const newFavorite: FavoriteFood = {
      id: `fav_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      meal,
      addedAt: new Date().toISOString(),
    };

    favorites.unshift(newFavorite);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    return true;
  } catch (error) {
    console.error('Failed to add favorite food:', error);
    return false;
  }
}

/**
 * Remove a food from favorites
 */
export function removeFavoriteFood(id: string): boolean {
  try {
    const favorites = getFavoriteFoods();
    const filtered = favorites.filter((fav) => fav.id !== id);

    if (filtered.length === favorites.length) {
      return false; // Nothing was removed
    }

    localStorage.setItem(FAVORITES_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('Failed to remove favorite food:', error);
    return false;
  }
}

/**
 * Check if a food is favorited
 */
export function isFoodFavorited(foodName: string): boolean {
  const favorites = getFavoriteFoods();
  return favorites.some((fav) => fav.meal.name === foodName);
}

/**
 * Clear all favorites
 */
export function clearFavoriteFoods(): boolean {
  try {
    localStorage.removeItem(FAVORITES_KEY);
    return true;
  } catch (error) {
    console.error('Failed to clear favorite foods:', error);
    return false;
  }
}

/**
 * Search favorite foods
 */
export function searchFavoriteFoods(query: string): FavoriteFood[] {
  const favorites = getFavoriteFoods();
  const lowerQuery = query.toLowerCase().trim();

  if (!lowerQuery) return favorites;

  return favorites.filter((fav) =>
    fav.meal.name.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get recently added favorites
 */
export function getRecentFavorites(count: number = 5): FavoriteFood[] {
  const favorites = getFavoriteFoods();
  return favorites.slice(0, count);
}
