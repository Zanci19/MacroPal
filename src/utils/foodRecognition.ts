/**
 * Food Recognition Utility
 * Provides AI-powered food recognition from photos using:
 * 1. TensorFlow.js with MobileNet (free, runs locally)
 * 2. CocoSSD for object detection and portion size estimation
 * 3. Google Cloud Vision API (optional, free tier: 1000 requests/month)
 */

import * as mobilenet from '@tensorflow-models/mobilenet';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as tf from '@tensorflow/tfjs';

// Import TensorFlow.js backends
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';

// Initialize TensorFlow backend
let tfInitialized = false;

async function initializeTensorFlow() {
  if (tfInitialized) return;
  
  try {
    // Try to set WebGL backend first (faster)
    await tf.setBackend('webgl');
    await tf.ready();
    console.log('[FoodRecognition] TensorFlow.js initialized with WebGL backend');
    tfInitialized = true;
  } catch (error) {
    console.warn('[FoodRecognition] WebGL backend failed, falling back to CPU:', error);
    try {
      // Fall back to CPU backend
      await tf.setBackend('cpu');
      await tf.ready();
      console.log('[FoodRecognition] TensorFlow.js initialized with CPU backend');
      tfInitialized = true;
    } catch (cpuError) {
      console.error('[FoodRecognition] Failed to initialize any TensorFlow backend:', cpuError);
      throw new Error('Failed to initialize TensorFlow.js backend');
    }
  }
}

// Food keywords that commonly appear in image classifications - Enhanced list
const FOOD_KEYWORDS = [
  // General food terms
  'food', 'meal', 'dish', 'cuisine', 'plate', 'bowl', 'snack', 'breakfast', 'lunch', 'dinner',
  
  // Fruits
  'fruit', 'apple', 'banana', 'orange', 'strawberry', 'grape', 'watermelon', 'berry', 'blueberry',
  'raspberry', 'mango', 'pineapple', 'peach', 'pear', 'cherry', 'plum', 'kiwi', 'melon', 'lemon',
  'lime', 'grapefruit', 'apricot', 'fig', 'date', 'pomegranate', 'papaya', 'guava', 'passion fruit',
  
  // Vegetables
  'vegetable', 'veggie', 'carrot', 'broccoli', 'tomato', 'potato', 'corn', 'pepper', 'onion',
  'lettuce', 'spinach', 'cabbage', 'cauliflower', 'cucumber', 'celery', 'radish', 'beet',
  'zucchini', 'squash', 'pumpkin', 'eggplant', 'mushroom', 'asparagus', 'artichoke', 'kale',
  'chard', 'arugula', 'bell pepper', 'chili', 'jalapeno', 'garlic', 'ginger', 'peas', 'beans',
  
  // Proteins
  'meat', 'fish', 'chicken', 'beef', 'pork', 'turkey', 'lamb', 'duck', 'salmon', 'tuna',
  'shrimp', 'prawn', 'crab', 'lobster', 'steak', 'bacon', 'sausage', 'ham', 'venison',
  'protein', 'tofu', 'tempeh', 'seitan', 'egg', 'eggs',
  
  // Grains & Carbs
  'bread', 'pasta', 'rice', 'noodle', 'grain', 'wheat', 'cereal', 'oat', 'oatmeal', 'quinoa',
  'barley', 'couscous', 'bagel', 'muffin', 'croissant', 'biscuit', 'cracker', 'tortilla',
  'wrap', 'pita', 'roll', 'bun', 'toast', 'waffle', 'pancake', 'crepe',
  
  // Prepared dishes
  'soup', 'salad', 'sandwich', 'pizza', 'burger', 'taco', 'burrito', 'sushi', 'curry',
  'stir fry', 'casserole', 'stew', 'chili', 'pasta', 'lasagna', 'spaghetti', 'mac and cheese',
  'risotto', 'paella', 'biryani', 'pad thai', 'pho', 'ramen', 'udon',
  
  // Dairy
  'cheese', 'yogurt', 'milk', 'cream', 'butter', 'dairy', 'ice cream', 'gelato',
  
  // Desserts & Sweets
  'dessert', 'cake', 'cookie', 'chocolate', 'candy', 'sweet', 'pie', 'tart', 'brownie',
  'cupcake', 'donut', 'doughnut', 'pastry', 'pudding', 'mousse', 'truffle', 'fudge',
  'caramel', 'macaron', 'eclair', 'tiramisu', 'cheesecake',
  
  // Nuts & Seeds
  'nut', 'almond', 'walnut', 'peanut', 'cashew', 'pecan', 'pistachio', 'hazelnut',
  'macadamia', 'seed', 'sunflower', 'pumpkin seed', 'chia', 'flax',
  
  // Beverages
  'coffee', 'tea', 'juice', 'water', 'drink', 'beverage', 'smoothie', 'shake', 'latte',
  'cappuccino', 'espresso', 'soda', 'cola', 'beer', 'wine', 'cocktail',
  
  // Misc
  'bar', 'granola', 'trail mix', 'popcorn', 'chip', 'pretzel', 'hummus', 'dip', 'sauce',
  'condiment', 'honey', 'jam', 'jelly', 'syrup', 'oil', 'dressing'
];

export interface FoodPrediction {
  name: string;
  confidence: number;
  source: 'mobilenet' | 'google-vision' | 'coco-ssd';
}

export interface PortionEstimate {
  size: 'small' | 'medium' | 'large' | 'extra-large';
  estimatedGrams: number;
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface RecognitionResult {
  predictions: FoodPrediction[];
  portionEstimate?: PortionEstimate;
  imageUrl?: string;
  success: boolean;
  error?: string;
}

/**
 * Preprocess image for better recognition
 * Adjusts contrast, brightness, and normalizes the image
 */
function preprocessImage(imageElement: HTMLImageElement): tf.Tensor3D {
  // Convert image to tensor
  let tensor = tf.browser.fromPixels(imageElement);
  
  // Normalize to [0, 1]
  tensor = tf.div(tensor, 255.0);
  
  // Adjust contrast (1.2x)
  const mean = tf.mean(tensor);
  tensor = tf.add(tf.mul(tf.sub(tensor, mean), 1.2), mean);
  
  // Clip values to [0, 1]
  tensor = tf.clipByValue(tensor, 0, 1);
  
  return tensor as tf.Tensor3D;
}

/**
 * Estimate portion size using object detection
 */
async function estimatePortionSize(
  imageElement: HTMLImageElement
): Promise<PortionEstimate | undefined> {
  try {
    console.log('[FoodRecognition] Loading CocoSSD for portion estimation...');
    const model = await cocoSsd.load();
    
    const predictions = await model.detect(imageElement);
    
    // Filter for food-related objects
    const foodObjects = predictions.filter(pred => {
      const className = pred.class.toLowerCase();
      return FOOD_KEYWORDS.some(keyword => className.includes(keyword)) ||
             ['bowl', 'cup', 'bottle', 'plate', 'fork', 'knife', 'spoon'].includes(className);
    });
    
    if (foodObjects.length === 0) {
      return undefined;
    }
    
    // Use the largest detected object
    const largestObject = foodObjects.reduce((max, obj) => {
      const area = obj.bbox[2] * obj.bbox[3]; // width * height
      const maxArea = max.bbox[2] * max.bbox[3];
      return area > maxArea ? obj : max;
    });
    
    // Calculate relative size based on bounding box area
    const imageArea = imageElement.width * imageElement.height;
    const objectArea = largestObject.bbox[2] * largestObject.bbox[3];
    const relativeSize = objectArea / imageArea;
    
    // Estimate size category and approximate grams
    let size: PortionEstimate['size'];
    let estimatedGrams: number;
    
    if (relativeSize < 0.1) {
      size = 'small';
      estimatedGrams = 50;
    } else if (relativeSize < 0.25) {
      size = 'medium';
      estimatedGrams = 100;
    } else if (relativeSize < 0.5) {
      size = 'large';
      estimatedGrams = 200;
    } else {
      size = 'extra-large';
      estimatedGrams = 300;
    }
    
    console.log('[FoodRecognition] Portion estimate:', { size, estimatedGrams, relativeSize });
    
    return {
      size,
      estimatedGrams,
      confidence: largestObject.score,
      boundingBox: {
        x: largestObject.bbox[0],
        y: largestObject.bbox[1],
        width: largestObject.bbox[2],
        height: largestObject.bbox[3]
      }
    };
  } catch (error) {
    console.error('[FoodRecognition] Portion estimation error:', error);
    return undefined;
  }
}

/**
 * Recognize food from an image using TensorFlow.js MobileNet
 * This is completely free and runs locally in the browser
 * Enhanced with image preprocessing and better filtering
 */
export async function recognizeFoodWithMobileNet(
  imageElement: HTMLImageElement
): Promise<RecognitionResult> {
  try {
    // Initialize TensorFlow backend first
    await initializeTensorFlow();
    
    console.log('[FoodRecognition] Loading MobileNet model...');
    const model = await mobilenet.load();
    
    // Preprocess image for better recognition
    const processedTensor = preprocessImage(imageElement);
    
    console.log('[FoodRecognition] Running predictions with preprocessing...');
    const predictions = await model.classify(processedTensor);
    
    // Clean up tensor
    processedTensor.dispose();
    
    // Also try with original image for comparison
    const originalPredictions = await model.classify(imageElement);
    
    // Combine and deduplicate predictions
    const allPredictions = [...predictions, ...originalPredictions];
    const uniquePredictions = allPredictions.reduce((acc, pred) => {
      const existing = acc.find(p => p.className.toLowerCase() === pred.className.toLowerCase());
      if (!existing || pred.probability > existing.probability) {
        return [...acc.filter(p => p.className.toLowerCase() !== pred.className.toLowerCase()), pred];
      }
      return acc;
    }, [] as typeof predictions);
    
    // Filter and map predictions to food-related items with higher confidence threshold
    const foodPredictions: FoodPrediction[] = uniquePredictions
      .filter(pred => {
        const className = pred.className.toLowerCase();
        const isFoodRelated = FOOD_KEYWORDS.some(keyword => className.includes(keyword));
        return isFoodRelated && pred.probability > 0.1; // Increased threshold
      })
      .map(pred => ({
        name: pred.className,
        confidence: pred.probability,
        source: 'mobilenet' as const
      }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5); // Top 5 results
    
    // Try to estimate portion size
    const portionEstimate = await estimatePortionSize(imageElement);
    
    // If no food-specific predictions, return top 3 general predictions
    if (foodPredictions.length === 0) {
      return {
        predictions: uniquePredictions.slice(0, 3).map(pred => ({
          name: pred.className,
          confidence: pred.probability,
          source: 'mobilenet' as const
        })),
        portionEstimate,
        success: true
      };
    }
    
    console.log('[FoodRecognition] Predictions:', foodPredictions);
    console.log('[FoodRecognition] Portion estimate:', portionEstimate);
    
    return {
      predictions: foodPredictions,
      portionEstimate,
      success: true
    };
  } catch (error) {
    console.error('[FoodRecognition] MobileNet error:', error);
    return {
      predictions: [],
      success: false,
      error: error instanceof Error ? error.message : 'Failed to recognize food'
    };
  }
}

/**
 * Recognize food using Google Cloud Vision API
 * Requires API key configured in environment variables
 * Free tier: 1000 requests per month
 */
export async function recognizeFoodWithGoogleVision(
  imageBase64: string,
  apiKey?: string
): Promise<RecognitionResult> {
  const key = apiKey || import.meta.env.VITE_GOOGLE_VISION_API_KEY;
  
  if (!key) {
    return {
      predictions: [],
      success: false,
      error: 'Google Vision API key not configured'
    };
  }
  
  try {
    console.log('[FoodRecognition] Calling Google Cloud Vision API...');
    
    // Remove data URL prefix if present
    const base64Image = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${key}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requests: [
            {
              image: {
                content: base64Image
              },
              features: [
                { type: 'LABEL_DETECTION', maxResults: 10 },
                { type: 'WEB_DETECTION', maxResults: 5 }
              ]
            }
          ]
        })
      }
    );
    
    if (!response.ok) {
      throw new Error(`Google Vision API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    const result = data.responses[0];
    
    if (result.error) {
      throw new Error(result.error.message);
    }
    
    // Combine label and web detection results
    const labels = result.labelAnnotations || [];
    const webEntities = result.webDetection?.webEntities || [];
    
    // Filter for food-related labels
    const foodLabels = labels
      .filter((label: any) => {
        const desc = label.description.toLowerCase();
        return FOOD_KEYWORDS.some(keyword => desc.includes(keyword));
      })
      .map((label: any) => ({
        name: label.description,
        confidence: label.score,
        source: 'google-vision' as const
      }));
    
    // Add web entities that might be food-related
    const foodEntities = webEntities
      .filter((entity: any) => entity.description && entity.score > 0.5)
      .map((entity: any) => ({
        name: entity.description,
        confidence: entity.score,
        source: 'google-vision' as const
      }));
    
    const allPredictions = [...foodLabels, ...foodEntities]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
    
    console.log('[FoodRecognition] Google Vision predictions:', allPredictions);
    
    return {
      predictions: allPredictions,
      success: true
    };
  } catch (error) {
    console.error('[FoodRecognition] Google Vision error:', error);
    return {
      predictions: [],
      success: false,
      error: error instanceof Error ? error.message : 'Failed to recognize food with Google Vision'
    };
  }
}

/**
 * Load an image from a data URL and return an HTMLImageElement
 */
export function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Convert HTMLImageElement to base64 data URL
 */
export function imageToBase64(image: HTMLImageElement): string {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');
  ctx.drawImage(image, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.9);
}

/**
 * Main function to recognize food from a photo
 * Tries MobileNet first (free), optionally falls back to Google Vision
 */
export async function recognizeFood(
  imageDataUrl: string,
  useGoogleVision = false,
  googleApiKey?: string
): Promise<RecognitionResult> {
  try {
    // Load the image
    const img = await loadImageFromDataUrl(imageDataUrl);
    
    // Try MobileNet first (always free)
    const mobileNetResult = await recognizeFoodWithMobileNet(img);
    
    // If MobileNet worked and user doesn't want Google Vision, return
    if (mobileNetResult.success && !useGoogleVision) {
      return mobileNetResult;
    }
    
    // If user wants Google Vision and has API key, try it
    if (useGoogleVision && googleApiKey) {
      const googleResult = await recognizeFoodWithGoogleVision(imageDataUrl, googleApiKey);
      
      // If Google Vision worked, combine results
      if (googleResult.success) {
        const combinedPredictions = [
          ...googleResult.predictions,
          ...mobileNetResult.predictions
        ]
          .reduce((acc, pred) => {
            // Remove duplicates by name
            if (!acc.find(p => p.name.toLowerCase() === pred.name.toLowerCase())) {
              acc.push(pred);
            }
            return acc;
          }, [] as FoodPrediction[])
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, 5);
        
        return {
          predictions: combinedPredictions,
          success: true
        };
      }
    }
    
    // Return MobileNet result as fallback
    return mobileNetResult;
  } catch (error) {
    console.error('[FoodRecognition] Error:', error);
    return {
      predictions: [],
      success: false,
      error: error instanceof Error ? error.message : 'Failed to recognize food'
    };
  }
}

// OpenFoodFacts API configuration
const OPENFOODFACTS_API_BASE = "https://europe-west1-macropal-zanci19.cloudfunctions.net";

// Type for OpenFoodFacts search response
interface OpenFoodFactsSearchResponse {
  products: Array<{
    product_name: string;
    code?: string;
    nutriments?: any;
    serving_size?: string;
    brands?: string;
  }>;
}

/**
 * Search OpenFoodFacts database for foods matching a query
 * Uses the same cloud function as AddFood.tsx for consistency
 */
export async function searchOpenFoodFacts(
  query: string,
  pageSize = 10
): Promise<Array<{
  product_name: string;
  code?: string;
  nutriments?: any;
  serving_size?: string;
  brands?: string;
}>> {
  try {
    const url = new URL(`${OPENFOODFACTS_API_BASE}/offSearch`);
    url.searchParams.set('q', query);
    url.searchParams.set('page', '1');
    url.searchParams.set('page_size', String(pageSize));

    console.log('[FoodRecognition] Searching OpenFoodFacts for:', query);
    
    const response = await fetch(url.toString());
    if (!response.ok) {
      console.error('[FoodRecognition] OpenFoodFacts search failed:', response.statusText);
      return [];
    }

    const data: OpenFoodFactsSearchResponse = await response.json();
    const foods = Array.isArray(data?.products) ? data.products : [];
    
    // Filter out foods without any meaningful nutrition data
    // Requires at least one macro nutrient (calories, carbs, protein, or fat) to be > 0
    const validFoods = foods.filter(food => {
      const nutri = food.nutriments;
      if (!nutri) return false;
      
      const calories = nutri['energy-kcal_100g'] ?? 0;
      const carbs = nutri['carbohydrates_100g'] ?? 0;
      const protein = nutri['proteins_100g'] ?? 0;
      const fat = nutri['fat_100g'] ?? 0;
      
      return calories > 0 || carbs > 0 || protein > 0 || fat > 0;
    });
    
    console.log('[FoodRecognition] OpenFoodFacts returned', validFoods.length, 'valid foods');
    return validFoods;
  } catch (error) {
    console.error('[FoodRecognition] Error searching OpenFoodFacts:', error);
    return [];
  }
}

/**
 * Match recognized food names to items in the food database
 * Returns matches with full nutrition data
 */
export function matchFoodToDatabase(
  predictions: FoodPrediction[],
  foodDatabase: Array<{ 
    product_name: string; 
    code?: string;
    nutriments?: any;
    serving_size?: string;
    brands?: string;
  }>
): Array<{ 
  prediction: FoodPrediction; 
  matches: Array<{ 
    product_name: string; 
    code?: string;
    nutriments?: any;
    serving_size?: string;
    brands?: string;
    matchScore: number;
  }> 
}> {
  return predictions.map(prediction => {
    const searchTerms = prediction.name.toLowerCase().split(/[\s,]+/).filter(t => t.length > 2);
    
    const matches = foodDatabase
      .map(food => {
        const foodName = food.product_name.toLowerCase();
        const brandName = (food.brands || '').toLowerCase();
        
        // Calculate match score
        let score = 0;
        for (const term of searchTerms) {
          if (foodName.includes(term)) score += 2;
          if (brandName.includes(term)) score += 1;
        }
        
        // Bonus for exact word matches
        const foodWords = foodName.split(/\s+/);
        for (const term of searchTerms) {
          if (foodWords.includes(term)) score += 3;
        }
        
        return {
          ...food,
          matchScore: score
        };
      })
      .filter(food => food.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 5); // Top 5 matches
    
    return {
      prediction,
      matches
    };
  });
}

/**
 * Match recognized food names by searching OpenFoodFacts API
 * This provides comprehensive search results beyond the local database
 */
export async function matchFoodWithOpenFoodFacts(
  predictions: FoodPrediction[]
): Promise<Array<{
  prediction: FoodPrediction;
  matches: Array<{
    product_name: string;
    code?: string;
    nutriments?: any;
    serving_size?: string;
    brands?: string;
    matchScore: number;
  }>;
}>> {
  const results = await Promise.all(
    predictions.map(async (prediction) => {
      // Search OpenFoodFacts with the prediction name
      const searchResults = await searchOpenFoodFacts(prediction.name, 10);
      
      // Score the results similar to matchFoodToDatabase
      const searchTerms = prediction.name.toLowerCase().split(/[\s,]+/).filter(t => t.length > 2);
      
      const scoredMatches = searchResults.map(food => {
        const foodName = food.product_name.toLowerCase();
        const brandName = (food.brands || '').toLowerCase();
        
        // Calculate match score
        let score = 0;
        for (const term of searchTerms) {
          if (foodName.includes(term)) score += 2;
          if (brandName.includes(term)) score += 1;
        }
        
        // Bonus for exact word matches
        const foodWords = foodName.split(/\s+/);
        for (const term of searchTerms) {
          if (foodWords.includes(term)) score += 3;
        }
        
        return {
          ...food,
          matchScore: score
        };
      });
      
      // Sort by score and return top matches
      const topMatches = scoredMatches
        .filter(food => food.matchScore > 0)
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 5);
      
      return {
        prediction,
        matches: topMatches
      };
    })
  );
  
  return results;
}
