<div align="center">

# 🥗 MacroPal

**Your Personal Nutrition Tracking Companion**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-19.0.0-blue.svg)](https://reactjs.org/)
[![Ionic](https://img.shields.io/badge/Ionic-8.5.0-blue.svg)](https://ionicframework.com/)
[![Firebase](https://img.shields.io/badge/Firebase-12.6.0-orange.svg)](https://firebase.google.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.1.6-blue.svg)](https://www.typescriptlang.org/)

[Features](#-features) • [Demo](#-demo) • [Installation](#-installation) • [Usage](#-usage) • [Tech Stack](#-tech-stack) • [Contributing](#-contributing) • [Support](#-support)

</div>

<div align="center">

### ☕ Buy Me a Coffee

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Support%20Development-orange?style=for-the-badge&logo=buy-me-a-coffee)](https://buymeacoffee.com/zanci19)

Your support helps keep MacroPal free and ad-free for everyone!

</div>

---

## 📖 About

**MacroPal** is a comprehensive nutrition tracking app designed to help you achieve your health and fitness goals through smart food logging, macro tracking, and personalized recommendations. Whether you're looking to lose weight, gain muscle, or maintain a healthy lifestyle, MacroPal provides the tools you need to stay on track.

Built with modern web technologies and wrapped in a native mobile experience using Capacitor, MacroPal offers a seamless cross-platform experience on iOS, Android, and the web.

## ✨ Features

### 🍽️ **Smart Food Tracking**
- **Quick Add Foods**: Log meals with our extensive food database
- **Quick Add Modal**: Lightning-fast logging of common foods with one tap
- **Barcode Scanner**: Scan product barcodes for instant nutrition info
- **Custom Foods**: Create and save your own food items with detailed macros
- **Meal Templates**: Save favorite meals for quick logging
- **Recent Items**: Quick access to frequently logged foods

### 💧 **Hydration Tracking**
- **Water Intake Tracker**: Monitor daily water consumption
- **Visual Progress**: Beautiful progress bar showing hydration goals
- **Daily Goals**: Customizable water intake targets (default 8 glasses)
- **Goal Celebrations**: Encouraging feedback when you reach your daily goal

### 🧮 **Recipe Calculator**
- **Recipe Builder**: Combine multiple foods to create recipes
- **Nutrition Breakdown**: Automatic calculation of total recipe macros
- **Per-Serving Analysis**: Calculate nutrition for individual servings
- **Export Recipes**: Save and share your recipe calculations as text files

### 📊 **Advanced Analytics**
- **Macro Breakdown**: Track calories, carbs, protein, and fat
- **Visual Charts**: Beautiful charts and graphs to visualize your progress
  - Line charts for macro trends
  - Pie charts for meal distribution
  - Radar charts for macro balance
  - Bar charts for daily comparisons
- **Multiple Time Ranges**: View data for 7, 30, or 60 days
- **Weight Tracking**: Log and monitor your weight over time
- **Export Data**: Download your nutrition data as CSV for offline analysis

### 💪 **Workout Integration**
- **Activity Tracking**: Log workouts and physical activities
- **Calorie Burn Estimation**: Smart calorie burn calculations based on activity type
- **Workout Presets**: Pre-configured exercises with MET values
- **Custom Activities**: Create your own workout types
- **Duration & Intensity Tracking**: Monitor workout details

### 🎯 **Personalized Goals**
- **Smart Recommendations**: AI-powered meal suggestions based on your profile
- **Dietary Preferences**: Support for vegetarian, vegan, and pescatarian diets
- **Macro Focus Options**: Choose from balanced, high-protein, or low-carb
- **Activity Level Adjustment**: Customize based on sedentary to very active lifestyles
- **Goal Setting**: Track progress toward weight loss, maintenance, or gain

### 🎨 **User Experience**
- **Dark & Light Themes**: Beautiful themes with smooth transitions
- **Responsive Design**: Works perfectly on mobile, tablet, and desktop
- **Offline Support**: Continue tracking even without internet
- **Smooth Animations**: Polished UI with Framer Motion animations
- **Inspirational Quotes**: Daily motivation to keep you going
- **Achievement System**: Celebrate your milestones
- **⭐ Favorites System**: Bookmark frequently used foods for quick access
- **⚡ Keyboard Shortcuts**: Power user shortcuts for quick navigation (Ctrl+A to add food, Ctrl+H for home, etc.)
- **📊 Quick Stats Widget**: At-a-glance dashboard showing calories, meals, and workout summary
- **💾 Backup Reminders**: Periodic reminders to export and backup your data
- **🎯 Smart Loading States**: Clear visual feedback during data operations
- **🔔 Toast Notifications**: Informative success and error messages
- **♿ Enhanced Accessibility**: WCAG-compliant with screen reader support and keyboard navigation

### 🔐 **Security & Privacy**
- **Firebase Authentication**: Secure user accounts with email/password and social login
- **Email Verification**: Account security with verified emails
- **Private Data**: Your nutrition data is yours alone
- **Secure Cloud Sync**: All data encrypted and synced via Firebase

### 🌍 **Multi-Platform**
- **iOS**: Native iOS app via Capacitor
- **Android**: Native Android app via Capacitor
- **Web**: Full-featured web application
- **Progressive Web App**: Install on any device

## 🎬 Demo

> 🚀 **Live App**: Coming soon!

### Demo Mode for Presentations

MacroPal includes a special **Demo Mode** designed for showcasing the app to audiences without requiring authentication or Firebase backend.

**Key Features:**
- 🎥 Plays a looping intro video in landscape mode
- 🚀 Bypasses login and goes straight to the app
- 📱 Displays app in portrait mode (9:16) on any screen
- ⏱️ Auto-resets after 1 minute of inactivity
- 💾 Uses localStorage for temporary demo data

**Setup:**
1. Add your video to `/public/assets/demo-loop.mp4`
2. Set `VITE_DEMO_MODE=true` in `.env`
3. Build and launch the app

📖 **Full Documentation**: See [DEMO_MODE.md](DEMO_MODE.md) for detailed setup instructions.

### Screenshots

<div align="center">
  <p><em>Screenshots coming soon - the app is currently in beta testing</em></p>
</div>

## 🚀 Installation

### Prerequisites

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **Firebase account** (for backend services)

### For Users

#### Web Version
Visit our web app at [Coming Soon] and start tracking immediately!

#### Mobile Apps
- **iOS**: Download from the App Store [Coming Soon]
- **Android**: Download from Google Play [Coming Soon]

### For Developers

1. **Clone the repository**
   ```bash
   git clone https://github.com/Zanci19/MacroPal.git
   cd MacroPal
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Firebase**
   - Create a Firebase project at [firebase.google.com](https://firebase.google.com)
   - Enable Authentication (Email/Password, Google, Facebook)
   - Create a Firestore database
   - Enable Storage for profile photos
   - Copy `.env.example` to `.env` and fill in your Firebase config:
   
   ```env
   # Demo Mode (optional)
   VITE_DEMO_MODE=false
   
   # Firebase Configuration
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_GOOGLE_WEB_CLIENT_ID=your_google_client_id
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:8100](http://localhost:8100) in your browser.

5. **Build for production**
   ```bash
   npm run build
   ```

### Building Mobile Apps

#### iOS
```bash
npm run build
npx cap sync ios
npx cap open ios
```
Then build and run from Xcode.

#### Android
```bash
npm run build
npx cap sync android
npx cap open android
```
Then build and run from Android Studio.

## 📱 Usage

### Getting Started

1. **Create an Account**
   - Sign up with email or use social login (Google/Facebook)
   - Verify your email address

2. **Set Up Your Profile**
   - Enter your age, weight, height, and gender
   - Choose your fitness goal (lose, maintain, or gain weight)
   - Select your activity level
   - Set dietary preferences (optional)

3. **Start Tracking**
   - Log your first meal using the "+" button
   - Search for foods or scan a barcode
   - Adjust serving sizes
   - Track throughout the day

4. **View Your Progress**
   - Check the Analytics tab for detailed insights
   - Monitor your macro distribution
   - Track weight changes over time
   - Export data for deeper analysis

5. **Log Workouts**
   - Go to the Workout tab
   - Add activities and durations
   - View estimated calories burned
   - Track your fitness journey

### Pro Tips

- 📸 **Use the barcode scanner** for packaged foods - it's super fast!
- 🍽️ **Create meal templates** for meals you eat regularly
- 📊 **Check Analytics weekly** to spot trends and adjust your diet
- ⚖️ **Weigh yourself consistently** (same time, same conditions) for accurate tracking
- 🎯 **Set realistic goals** and celebrate small wins
- 💡 **Enable smart recommendations** for personalized meal suggestions
- ⭐ **Bookmark favorite foods** for quick access when logging meals
- ⌨️ **Use keyboard shortcuts** for faster navigation (see shortcuts in Settings)
- 💾 **Export your data regularly** to keep backups of your nutrition history

## 🛠️ Tech Stack

### Frontend
- **React 19** - UI library
- **TypeScript** - Type-safe JavaScript
- **Ionic Framework 8** - Cross-platform UI components
- **Framer Motion** - Smooth animations
- **Recharts** - Data visualization
- **Swiper** - Touch sliders

### Mobile
- **Capacitor 8** - Native mobile runtime
- **iOS & Android** - Native mobile apps

### Backend
- **Firebase Authentication** - User management
- **Cloud Firestore** - Real-time database
- **Firebase Storage** - Image storage
- **Firebase Analytics** - Usage tracking
- **Firebase Functions** - Cloud functions (Node.js 20)

### Development Tools
- **Vite 7** - Fast build tool
- **Vitest 4** - Unit testing
- **Cypress 13** - E2E testing
- **ESLint** - Code linting
- **TypeScript ESLint** - Type-aware linting

### Key Libraries
- `@zxing/browser` - Barcode scanning
- `@capgo/capacitor-social-login` - Social authentication
- `react-router-dom` - Navigation
- `ionicons` - Icon library

### Code Quality & Best Practices
- **Type Safety** - Comprehensive TypeScript types with type guards for runtime validation
- **Input Validation** - Robust validation utilities for all user inputs
- **Error Handling** - Graceful error recovery with user-friendly messages
- **Accessibility** - WCAG 2.1 AA compliant with screen reader support
- **Performance** - Memoization, debouncing, and lazy loading optimizations
- **Testing** - Unit tests with Vitest for critical utilities
- **Documentation** - Inline JSDoc comments for complex functions

## 🗂️ Project Structure

```
MacroPal/
├── src/
│   ├── components/        # Reusable UI components
│   │   ├── AnnouncementPopup.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── DebugOverlay.tsx
│   │   ├── ToastNotification.tsx    # Toast messages
│   │   ├── LoadingState.tsx         # Loading indicators
│   │   └── QuickStats.tsx           # Stats widget
│   ├── pages/             # Application screens
│   │   ├── authentication/
│   │   │   ├── Login.tsx
│   │   │   ├── Register.tsx
│   │   │   └── EmailVerification.tsx
│   │   └── home/
│   │       ├── Home.tsx          # Main diary page
│   │       ├── Analytics.tsx     # Charts & insights
│   │       ├── Workout.tsx       # Activity tracking
│   │       └── Settings.tsx      # User settings
│   ├── hooks/             # Custom React hooks
│   │   ├── useProfile.ts
│   │   ├── useKeyboardShortcuts.ts
│   │   ├── usePerformance.ts
│   │   └── version.ts
│   ├── utils/             # Helper functions
│   │   ├── activityCatalog.ts
│   │   ├── exportUtils.ts
│   │   ├── date.ts
│   │   ├── preferences.ts
│   │   ├── validation.ts         # Input validation
│   │   ├── typeGuards.ts         # Runtime type checking
│   │   ├── favorites.ts          # Favorites management
│   │   ├── backupReminder.ts     # Backup reminders
│   │   └── accessibility.ts      # A11y helpers
│   ├── types/             # TypeScript types
│   ├── data/              # Static data
│   │   ├── basicFoods.json
│   │   └── inspirationalQuotes.ts
│   ├── theme/             # CSS styling
│   ├── firebase.ts        # Firebase config
│   ├── App.tsx            # Main app component
│   └── main.tsx           # Entry point
├── functions/             # Firebase Cloud Functions
├── android/               # Android native project
├── ios/                   # iOS native project
├── public/                # Static assets
├── cypress/               # E2E tests
└── admin-app/             # Admin dashboard
```

## 🧪 Testing

MacroPal uses Vitest for unit tests and Cypress for end-to-end tests.

### Unit Tests

Run all unit tests:
```bash
npm test
# or
npm run test.unit
```

Run tests in watch mode (for development):
```bash
npm test -- --watch
```

Generate coverage report:
```bash
npm run test:coverage
```

### E2E Tests

Run end-to-end tests with Cypress:
```bash
npm run test.e2e
```

Open Cypress interactive mode:
```bash
npx cypress open
```

### Linting

Check code style and quality:
```bash
npm run lint
```

Auto-fix linting issues:
```bash
npm run lint:fix
```

### Security Audits

Check for vulnerable dependencies:
```bash
npm run audit
```

Auto-fix dependency vulnerabilities (when possible):
```bash
npm run audit:fix
```

### Running All Checks

Before committing, it's recommended to run:
```bash
npm run lint && npm test && npm run build
```

## 📦 Deployment

### Web (Firebase Hosting)
```bash
npm run build
firebase deploy --only hosting
```

### Firebase Functions
```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

### Mobile App Stores
Follow the standard iOS and Android deployment procedures using Xcode and Android Studio respectively.

## 🤝 Contributing

We welcome contributions! MacroPal is an open-source project and we appreciate help from the community.

### How to Contribute

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/AmazingFeature`)
3. **Commit your changes** (`git commit -m 'Add some AmazingFeature'`)
4. **Push to the branch** (`git push origin feature/AmazingFeature`)
5. **Open a Pull Request**

### Contribution Guidelines

- Write clear, descriptive commit messages
- Follow the existing code style
- Add tests for new features
- Update documentation as needed
- Keep pull requests focused on a single feature/fix

### Areas We Need Help

- 🌐 Internationalization (i18n) support
- 🍎 Food database expansion
- 📱 UI/UX improvements
- 🐛 Bug fixes and performance improvements
- 📝 Documentation improvements
- ✅ Test coverage expansion

## 🙏 Acknowledgments

### Special Thanks

A huge thank you to our **beta testers** who provided invaluable feedback and helped shape MacroPal into what it is today! Your early adoption, bug reports, feature suggestions, and encouragement made all the difference:

- Testing the app in real-world scenarios
- Providing detailed feedback on user experience
- Suggesting features that matter
- Reporting bugs and edge cases
- Spreading the word about MacroPal

This app wouldn't be where it is without your support! 💚

### Built With

- [React](https://reactjs.org/) - The web framework
- [Ionic Framework](https://ionicframework.com/) - Mobile UI components
- [Firebase](https://firebase.google.com/) - Backend infrastructure
- [Capacitor](https://capacitorjs.com/) - Native runtime
- [Recharts](https://recharts.org/) - Charting library
- [Framer Motion](https://www.framer.com/motion/) - Animation library

### Inspiration

Inspired by the need for a modern, user-friendly nutrition tracking app that respects user privacy and provides meaningful insights without the complexity or subscription fees of existing solutions.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 💖 Support MacroPal

If MacroPal has helped you on your health journey, consider supporting its development!

### Other Ways to Support

- ⭐ **Star this repository** - It helps others discover the app
- 🐦 **Share on social media** - Help spread the word
- 🐛 **Report bugs** - Help us improve
- 💡 **Suggest features** - Share your ideas
- 📝 **Write a review** - If you've used the app, share your experience

## 📞 Contact & Links

- **Issues**: [GitHub Issues](https://github.com/Zanci19/MacroPal/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Zanci19/MacroPal/discussions)
- **Email**: support@macropal.app (Coming soon)
- **Website**: [macropal.app](https://macropal.app) (Coming soon)

## 🗺️ Roadmap

### Coming Soon
- [ ] 🌐 Multi-language support
- [ ] 🍽️ Recipe builder
- [ ] 👥 Social features (friend challenges)
- [ ] 🏆 More achievements and gamification
- [ ] 📸 Photo logging for meals
- [ ] 🔗 Integration with fitness trackers (Apple Health, Google Fit)
- [ ] 💧 Water intake tracking
- [ ] 😴 Sleep tracking integration
- [ ] 🥘 Meal planning calendar
- [ ] 📱 Widget support for iOS and Android

### Future Ideas
- [ ] 🤖 AI meal recommendations
- [ ] 🛒 Grocery list generation
- [ ] 👨‍🍳 Integration with recipe websites
- [ ] 📊 Advanced nutrition insights (micronutrients)
- [ ] 🏋️ Workout program templates

---

<div align="center">

**Made with ❤️ by [Zanci19](https://github.com/Zanci19)**

*Track smart. Live healthy. Stay consistent.*

⭐ Star us on GitHub — it motivates us a lot!

</div>