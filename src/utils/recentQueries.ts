export const ADD_FOOD_RECENT_QUERY_KEY = "mp_add_food_recent_queries";
export const RECENT_QUERIES_CLEARED_EVENT = "mp_recent_queries_cleared";

export const clearAddFoodRecentQueries = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ADD_FOOD_RECENT_QUERY_KEY);
  window.dispatchEvent(new CustomEvent(RECENT_QUERIES_CLEARED_EVENT));
};
