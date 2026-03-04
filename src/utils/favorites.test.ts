import { describe, it, expect, beforeEach } from 'vitest';
import {
  getFavoriteFoods,
  addFavoriteFood,
  removeFavoriteFood,
  isFoodFavorited,
  clearFavoriteFoods,
  searchFavoriteFoods,
  getRecentFavorites,
} from './favorites';
import type { DiaryEntry } from '../types';

const makeDiaryEntry = (name: string): DiaryEntry => ({
  fdcId: Math.floor(Math.random() * 100000),
  name,
  total: { calories: 200, carbs: 20, protein: 15, fat: 8 },
  addedAt: new Date().toISOString(),
});

describe('favorites utilities', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getFavoriteFoods', () => {
    it('should return an empty array when no favorites are stored', () => {
      expect(getFavoriteFoods()).toEqual([]);
    });

    it('should return stored favorites', () => {
      const food = makeDiaryEntry('Chicken Breast');
      addFavoriteFood(food);
      const favorites = getFavoriteFoods();
      expect(favorites).toHaveLength(1);
      expect(favorites[0].food.name).toBe('Chicken Breast');
    });

    it('should return an empty array for corrupted localStorage data', () => {
      localStorage.setItem('mp_favorite_foods', 'not-valid-json{{{');
      expect(getFavoriteFoods()).toEqual([]);
    });
  });

  describe('addFavoriteFood', () => {
    it('should add a food and return true', () => {
      const food = makeDiaryEntry('Brown Rice');
      expect(addFavoriteFood(food)).toBe(true);
      expect(getFavoriteFoods()).toHaveLength(1);
    });

    it('should not add a duplicate food (same name) and return false', () => {
      const food = makeDiaryEntry('Brown Rice');
      addFavoriteFood(food);
      expect(addFavoriteFood(food)).toBe(false);
      expect(getFavoriteFoods()).toHaveLength(1);
    });

    it('should prepend new favorites (most recent first)', () => {
      addFavoriteFood(makeDiaryEntry('Apple'));
      addFavoriteFood(makeDiaryEntry('Banana'));
      const favorites = getFavoriteFoods();
      expect(favorites[0].food.name).toBe('Banana');
      expect(favorites[1].food.name).toBe('Apple');
    });

    it('should assign a unique id and addedAt to each favorite', () => {
      const food = makeDiaryEntry('Salmon');
      addFavoriteFood(food);
      const [fav] = getFavoriteFoods();
      expect(typeof fav.id).toBe('string');
      expect(fav.id).toMatch(/^fav_/);
      expect(typeof fav.addedAt).toBe('string');
    });
  });

  describe('removeFavoriteFood', () => {
    it('should remove a favorite by id and return true', () => {
      addFavoriteFood(makeDiaryEntry('Oats'));
      const [fav] = getFavoriteFoods();
      expect(removeFavoriteFood(fav.id)).toBe(true);
      expect(getFavoriteFoods()).toHaveLength(0);
    });

    it('should return false when the id is not found', () => {
      expect(removeFavoriteFood('nonexistent-id')).toBe(false);
    });

    it('should not remove other favorites', () => {
      addFavoriteFood(makeDiaryEntry('Egg'));
      addFavoriteFood(makeDiaryEntry('Toast'));
      const [latest] = getFavoriteFoods();
      removeFavoriteFood(latest.id);
      expect(getFavoriteFoods()).toHaveLength(1);
      expect(getFavoriteFoods()[0].food.name).toBe('Egg');
    });
  });

  describe('isFoodFavorited', () => {
    it('should return true when the food name is in favorites', () => {
      addFavoriteFood(makeDiaryEntry('Avocado'));
      expect(isFoodFavorited('Avocado')).toBe(true);
    });

    it('should return false when the food is not in favorites', () => {
      expect(isFoodFavorited('Pizza')).toBe(false);
    });

    it('should be case-sensitive', () => {
      addFavoriteFood(makeDiaryEntry('Avocado'));
      expect(isFoodFavorited('avocado')).toBe(false);
    });
  });

  describe('clearFavoriteFoods', () => {
    it('should remove all favorites and return true', () => {
      addFavoriteFood(makeDiaryEntry('A'));
      addFavoriteFood(makeDiaryEntry('B'));
      expect(clearFavoriteFoods()).toBe(true);
      expect(getFavoriteFoods()).toHaveLength(0);
    });

    it('should return true even when already empty', () => {
      expect(clearFavoriteFoods()).toBe(true);
    });
  });

  describe('searchFavoriteFoods', () => {
    beforeEach(() => {
      addFavoriteFood(makeDiaryEntry('Grilled Chicken'));
      addFavoriteFood(makeDiaryEntry('Chicken Salad'));
      addFavoriteFood(makeDiaryEntry('Brown Rice'));
    });

    it('should return all favorites for an empty query', () => {
      expect(searchFavoriteFoods('')).toHaveLength(3);
    });

    it('should filter by query (case-insensitive)', () => {
      const results = searchFavoriteFoods('chicken');
      expect(results).toHaveLength(2);
    });

    it('should return an empty array when no matches', () => {
      expect(searchFavoriteFoods('xyz-no-match')).toHaveLength(0);
    });

    it('should trim whitespace from query', () => {
      const results = searchFavoriteFoods('  rice  ');
      expect(results).toHaveLength(1);
    });
  });

  describe('getRecentFavorites', () => {
    it('should return at most the requested count', () => {
      addFavoriteFood(makeDiaryEntry('Food 1'));
      addFavoriteFood(makeDiaryEntry('Food 2'));
      addFavoriteFood(makeDiaryEntry('Food 3'));
      expect(getRecentFavorites(2)).toHaveLength(2);
    });

    it('should default to 5 items', () => {
      for (let i = 0; i < 10; i++) {
        addFavoriteFood(makeDiaryEntry(`Food ${i}`));
      }
      expect(getRecentFavorites()).toHaveLength(5);
    });

    it('should return all items if fewer than the requested count exist', () => {
      addFavoriteFood(makeDiaryEntry('Only Food'));
      expect(getRecentFavorites(10)).toHaveLength(1);
    });
  });
});
