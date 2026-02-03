/**
 * Food Recognition Utility
 * Provides AI-powered food recognition from photos using:
 * 1. TensorFlow.js with MobileNet (free, runs locally)
 * 2. Google Cloud Vision API (optional, free tier: 1000 requests/month)
 */

import * as mobilenet from '@tensorflow-models/mobilenet';
import * as tf from '@tensorflow/tfjs';

// Food keywords that commonly appear in image classifications
const FOOD_KEYWORDS = [
  'food', 'meal', 'dish', 'cuisine', 'plate', 'bowl',
  'fruit', 'vegetable', 'meat', 'fish', 'chicken', 'beef', 'pork',
  'bread', 'pasta', 'rice', 'noodle', 'soup', 'salad', 'sandwich',
  'pizza', 'burger', 'taco', 'sushi', 'breakfast', 'lunch', 'dinner',
  'snack', 'dessert', 'cake', 'cookie', 'ice cream', 'chocolate',
  'apple', 'banana', 'orange', 'strawberry', 'grape', 'watermelon',
  'carrot', 'broccoli', 'tomato', 'potato', 'corn', 'pepper',
  'cheese', 'yogurt', 'milk', 'egg', 'bacon', 'sausage',
  'coffee', 'tea', 'juice', 'water', 'drink', 'beverage',
  'nut', 'almond', 'walnut', 'peanut', 'cashew',
  'protein', 'bar', 'shake', 'smoothie'
];

export interface FoodPrediction {
  name: string;
  confidence: number;
  source: 'mobilenet' | 'google-vision';
}

export interface RecognitionResult {
  predictions: FoodPrediction[];
  imageUrl?: string;
  success: boolean;
  error?: string;
}

/**
 * Recognize food from an image using TensorFlow.js MobileNet
 * This is completely free and runs locally in the browser
 */
export async function recognizeFoodWithMobileNet(
  imageElement: HTMLImageElement
): Promise<RecognitionResult> {
  try {
    console.log('[FoodRecognition] Loading MobileNet model...');
    const model = await mobilenet.load();
    
    console.log('[FoodRecognition] Running predictions...');
    const predictions = await model.classify(imageElement);
    
    // Filter and map predictions to food-related items
    const foodPredictions: FoodPrediction[] = predictions
      .filter(pred => {
        const className = pred.className.toLowerCase();
        return FOOD_KEYWORDS.some(keyword => className.includes(keyword));
      })
      .map(pred => ({
        name: pred.className,
        confidence: pred.probability,
        source: 'mobilenet' as const
      }))
      .slice(0, 5); // Top 5 results
    
    // If no food-specific predictions, return top 3 general predictions
    if (foodPredictions.length === 0) {
      return {
        predictions: predictions.slice(0, 3).map(pred => ({
          name: pred.className,
          confidence: pred.probability,
          source: 'mobilenet' as const
        })),
        success: true
      };
    }
    
    console.log('[FoodRecognition] Predictions:', foodPredictions);
    return {
      predictions: foodPredictions,
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
