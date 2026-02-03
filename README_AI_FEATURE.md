# AI Photo Food Recognition - Quick Reference

## What Is This?

An AI system that identifies food from photos and adds it to your meal diary with nutrition data.

## Two AI Options (You Have Both!)

### 🆓 TensorFlow.js (Default)
- **Status:** ✅ Working RIGHT NOW
- **Setup:** None needed
- **Cost:** $0 forever
- **Privacy:** 100% local (photo never leaves device)
- **Accuracy:** Good for common foods

### 🚀 Google Vision API (Optional)
- **Status:** Available if you want it
- **Setup:** 5 minutes (get API key)
- **Cost:** 1000 free/month, then $1.50 per 1000
- **Privacy:** Photo sent to Google (encrypted)
- **Accuracy:** Better for complex foods

## How to Use

### Basic Usage (TensorFlow - Free)
```
1. Settings → Tools → AI Photo Food Logger
2. Take photo
3. Analyze Photo
4. Select food from matches
5. Adjust portion size
6. Add to meal
```

That's it! No setup needed.

### Enable Google Vision (Optional)
```
1. Get API key: https://console.cloud.google.com/
2. Add to .env: VITE_GOOGLE_VISION_API_KEY=your_key
3. npm run build
4. Toggle ON in app UI
```

## Which One Should I Use?

| If you want... | Use this |
|----------------|----------|
| Free forever | TensorFlow.js |
| No setup | TensorFlow.js |
| Works offline | TensorFlow.js |
| Best privacy | TensorFlow.js |
| Better accuracy | Google Vision |
| Complex foods | Google Vision |
| Don't mind setup | Google Vision |

## Documentation Files

- **QUICK_ANSWER.md** - Visual explanation with diagrams
- **WHAT_IS_THIS_EXPLAINED.md** - Detailed guide with FAQ
- **AI_PHOTO_FOOD_RECOGNITION.md** - Technical documentation
- **IMPLEMENTATION_SUMMARY.md** - Developer guide

## Quick FAQ

**Q: Is it free?**
A: Yes! TensorFlow.js is 100% free. Google Vision has free tier.

**Q: Do I need an API key?**
A: No! TensorFlow works without any API key.

**Q: Which one is better?**
A: Google Vision is more accurate, but TensorFlow is free and works great.

**Q: Can I try both?**
A: Yes! Switch between them with the toggle in the app.

**Q: Does it work right now?**
A: YES! TensorFlow.js works immediately.

---

For more details, see **WHAT_IS_THIS_EXPLAINED.md**
