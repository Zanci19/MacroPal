# AI Photo Food Recognition Feature

## Overview

MacroPal now includes AI-powered food recognition that allows users to take photos of their meals and automatically identify foods with complete nutritional data (calories, protein, carbs, fat).

## How It Works

### 1. **Photo Capture**
- Users can take a photo with their device camera or select from gallery
- Works on mobile (iOS/Android) and web platforms

### 2. **AI Recognition** (Two Options)

#### Option A: TensorFlow.js with MobileNet (Default - FREE)
- Runs entirely in the browser/device
- No API costs
- No internet required after initial model load
- Good accuracy for common foods
- Privacy-friendly (photos never leave device)

#### Option B: Google Cloud Vision API (Optional - Enhanced)
- More accurate recognition
- Better for complex dishes
- Free tier: 1000 requests/month
- Requires API key configuration

### 3. **Food Matching**
- AI predictions are matched against **both** MacroPal's local database AND the comprehensive OpenFoodFacts database
- Searches happen in parallel for optimal performance  
- OpenFoodFacts provides access to **millions of foods** worldwide
- Shows multiple matches with complete nutrition data per 100g
- Smart scoring algorithm prioritizes best matches
- Results are deduplicated and sorted by relevance

### 4. **Add to Diary**
- Select recognized food
- Adjust serving size (grams)
- Nutrition automatically calculated
- Added to meal diary with photo attached
- Same workflow as AddFood.tsx

## Setup Instructions

### Basic Setup (Free - TensorFlow.js only)

No additional setup required! The feature works out of the box with local AI.

### Enhanced Setup (Optional - Google Cloud Vision)

1. **Get Google Cloud Vision API Key**
   ```
   1. Go to https://console.cloud.google.com/
   2. Create a new project or select existing
   3. Enable "Cloud Vision API"
   4. Go to Credentials → Create Credentials → API Key
   5. Copy your API key
   ```

2. **Configure Environment Variable**
   ```bash
   # In .env file:
   VITE_GOOGLE_VISION_API_KEY=your_api_key_here
   ```

3. **Rebuild the app**
   ```bash
   npm run build
   ```

## Usage

### For Users

1. Navigate to **Settings** → **Tools** → **AI Photo Food Logger**
2. Take a photo of your food
3. Tap **Analyze Photo**
4. Review detected foods with nutrition data
5. Select a food and adjust serving size
6. Tap **Add to [meal]** to save

### Access Points

- **Settings Page**: Settings → Tools → AI Photo Food Logger
- **Direct URL**: `/photo-food-logger?meal=breakfast&date=2024-01-15`

## Technical Details

### Dependencies

```json
{
  "@capacitor/camera": "^8.0.0",
  "@tensorflow/tfjs": "^4.x.x",
  "@tensorflow-models/mobilenet": "^2.x.x"
}
```

### Files Added/Modified

**New Files:**
- `src/pages/PhotoFoodLogger.tsx` - Main component
- `src/pages/PhotoFoodLogger.css` - Styling
- `src/utils/foodRecognition.ts` - AI recognition logic + OpenFoodFacts integration

**Modified Files:**
- `src/App.tsx` - Added route
- `src/pages/home/Settings.tsx` - Added link
- `.env.example` - Added Google Vision API key documentation
- `package.json` - Added dependencies

**Recent Updates (OpenFoodFacts Integration):**
- `src/utils/foodRecognition.ts` - Added `searchOpenFoodFacts()` and `matchFoodWithOpenFoodFacts()` functions
- `src/pages/PhotoFoodLogger.tsx` - Updated to search both local and OpenFoodFacts databases in parallel
- `.env.example` - Added Google Vision API key documentation
- `package.json` - Added dependencies

### Data Flow

```
1. User takes photo
   ↓
2. Photo → TensorFlow.js MobileNet or Google Vision API
   ↓
3. Get predictions (e.g., "pizza", "salad", "chicken")
   ↓
4. Parallel search in:
   - Local basicFoods.json database (~6,000 foods)
   - OpenFoodFacts API (millions of foods worldwide)
   ↓
5. Combine and deduplicate results (OpenFoodFacts prioritized)
   ↓
6. Display top matches with nutrition per 100g
   ↓
7. User selects food & amount
   ↓
8. Calculate total nutrition (amount/100 × per100g)
   ↓
9. Add to Firebase with same structure as AddFood.tsx
```

### Food Recognition Algorithm

The system uses a comprehensive three-step approach:

1. **AI Recognition**: Identifies food types from image
   - TensorFlow MobileNet: General object/food classification
   - Google Vision: Labels + web entities for better accuracy

2. **Database Matching**: Maps AI predictions to known foods from multiple sources
   - **Local Database**: Searches basicFoods.json (~6,000 curated foods)
   - **OpenFoodFacts API**: Searches millions of foods worldwide via cloud function
   - Both searches run in parallel for optimal performance
   
3. **Scoring & Ranking**: Intelligent result combination
   - Tokenizes prediction names for fuzzy matching
   - Scores matches based on:
     - Name similarity (word-level matching)
     - Exact word matches (bonus points)
     - Brand matching (if applicable)
   - Combines results with OpenFoodFacts prioritized
   - Deduplicates by product code or normalized name
   - Returns top 5 matches per prediction

### Nutrition Calculation

Uses the same logic as AddFood.tsx:

```typescript
// Per 100g macros from database
const per100g = {
  calories: 250,
  protein: 15,
  carbs: 30,
  fat: 8
};

// User selects 150g
const grams = 150;
const factor = grams / 100; // 1.5

// Calculate total
const total = {
  calories: 250 * 1.5 = 375,
  protein: 15 * 1.5 = 22.5,
  carbs: 30 * 1.5 = 45,
  fat: 8 * 1.5 = 12
};
```

## Advantages

### ✅ Free Option Available
- TensorFlow.js runs locally, no costs
- No API limits or quotas

### ✅ Comprehensive Food Database
- Access to **millions of foods** via OpenFoodFacts
- Local database + worldwide coverage
- Constantly updated with new products

### ✅ Privacy-Focused
- Photos can be processed entirely on-device
- No data sent to third parties (unless user enables Google Vision)

### ✅ Accurate Nutrition Data
- Uses OpenFoodFacts and MacroPal's curated food database
- Complete macro breakdown (calories, protein, carbs, fat)
- Supports micronutrients (sugar, fiber, saturated fat)

### ✅ Seamless Integration
- Follows same patterns as AddFood.tsx
- Photos stored with diary entries
- Compatible with existing meal tracking workflow

### ✅ User-Friendly
- Simple photo → analyze → add workflow
- Visual confirmation of recognized foods
- Adjustable serving sizes

### ✅ Smart Search
- Parallel database queries for speed
- Intelligent result ranking and deduplication
- OpenFoodFacts results prioritized for better matches

## Limitations

### TensorFlow.js Mode
- General food categories (may not identify specific brands)
- Best for simple, single-item foods
- Can struggle with complex dishes

### Google Vision Mode
- Requires API key and internet
- 1000 free requests/month (then $1.50 per 1000)
- Better accuracy but still not perfect

### General
- Recognition quality depends on photo clarity
- Works best with well-lit, clear photos
- May need manual selection from multiple matches
- OpenFoodFacts provides extensive coverage but recognition still depends on AI accuracy

## Future Enhancements

Potential improvements:
- [ ] Fine-tuned food-specific AI model
- [ ] Multi-food detection (identify all items in photo)
- [ ] Automatic portion size estimation
- [ ] Recipe recognition
- [ ] Meal history learning (personalized suggestions)
- [ ] Offline model caching
- [ ] Photo editing/cropping before analysis

## Cost Analysis

### TensorFlow.js (Default)
- **Cost**: $0
- **Requests**: Unlimited
- **Speed**: Fast (after initial model load ~100MB)
- **Privacy**: Complete (on-device)

### Google Cloud Vision API (Optional)
- **Free Tier**: 1000 requests/month
- **Paid Tier**: $1.50 per 1000 requests
- **Speed**: ~1-3 seconds per request
- **Privacy**: Photos sent to Google

Example monthly costs:
- 5 photos/day × 30 days = 150 requests/month = **FREE**
- 50 photos/day × 30 days = 1500 requests/month = **$0.75/month**

## Security Considerations

1. **API Key Protection**
   - Store Google Vision API key in environment variables
   - Never commit .env file to git
   - Consider server-side proxy for production

2. **Photo Storage**
   - Photos stored in Firebase Storage
   - Access controlled by Firebase Security Rules
   - Consider size limits to manage storage costs

3. **Data Privacy**
   - Photos processed locally by default
   - Google Vision mode explicitly opt-in
   - Clear privacy disclosures in UI

## Testing

### Manual Testing
1. Take photo of known food (e.g., apple, banana)
2. Verify AI recognizes it
3. Check nutrition data accuracy
4. Confirm food added to diary correctly
5. Verify photo stored with entry

### Edge Cases
- ✅ Unclear/blurry photos
- ✅ Multiple foods in one photo
- ✅ No matches found
- ✅ Network failure (Google Vision mode)
- ✅ Large photos/file size limits

## Support

For issues or questions:
- GitHub Issues: [MacroPal Issues](https://github.com/Zanci19/MacroPal/issues)
- Feature Documentation: This file
- Code: `src/pages/PhotoFoodLogger.tsx`

---

**Built with ❤️ for MacroPal users**

*Making nutrition tracking easier, one photo at a time!*
