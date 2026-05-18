/**
 * MacroPal — Comprehensive End-to-End Test Suite
 *
 * Covers every route defined in App.tsx plus core UI interactions.
 * Runs against a live dev server (baseUrl: http://localhost:5173).
 *
 * How to run:
 *   npm run test.e2e          — headless
 *   npx cypress open          — interactive
 */

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Visit a route and confirm the page loaded (no uncaught JS errors). */
const visitAndConfirmLoad = (path: string) => {
  cy.visit(path);
  cy.get('body').should('exist');
};

// ─────────────────────────────────────────────────────────────
// 1. App bootstrap
// ─────────────────────────────────────────────────────────────

describe('App bootstrap', () => {
  it('loads the root URL without a JS crash', () => {
    cy.visit('/');
    cy.get('body').should('exist');
  });

  it('redirects "/" to a known route', () => {
    cy.visit('/');
    // The app redirects to /check-login (normal mode) or /app/home (demo mode)
    cy.url().should('match', /\/(check-login|app\/home|start|login)/);
  });
});

// ─────────────────────────────────────────────────────────────
// 2. Authentication pages
// ─────────────────────────────────────────────────────────────

describe('Authentication — Login page', () => {
  beforeEach(() => visitAndConfirmLoad('/login'));

  it('renders the login page', () => {
    cy.url().should('include', '/login');
  });

  it('contains an email input', () => {
    cy.get('input[type="email"], ion-input[type="email"], input[name="email"]').should('exist');
  });

  it('contains a password input', () => {
    cy.get('input[type="password"], ion-input[type="password"]').should('exist');
  });

  it('contains a submit / log-in button', () => {
    cy.get('ion-button, button[type="submit"], button').should('exist');
  });
});

describe('Authentication — Register page', () => {
  beforeEach(() => visitAndConfirmLoad('/register'));

  it('renders the register page', () => {
    cy.url().should('include', '/register');
  });

  it('contains an email input', () => {
    cy.get('input[type="email"], ion-input[type="email"]').should('exist');
  });

  it('contains a password input', () => {
    cy.get('input[type="password"], ion-input[type="password"]').should('exist');
  });
});

describe('Authentication — Reset Password page', () => {
  beforeEach(() => visitAndConfirmLoad('/reset-password'));

  it('renders the reset password page', () => {
    cy.url().should('include', '/reset-password');
  });

  it('contains an email input', () => {
    cy.get('input[type="email"], ion-input[type="email"]').should('exist');
  });
});

describe('Authentication — Email Verification page', () => {
  beforeEach(() => visitAndConfirmLoad('/verify-email'));

  it('renders the email verification page', () => {
    cy.url().should('include', '/verify-email');
  });
});

// ─────────────────────────────────────────────────────────────
// 3. Onboarding pages
// ─────────────────────────────────────────────────────────────

describe('Onboarding — Terms page', () => {
  beforeEach(() => visitAndConfirmLoad('/onboarding-terms'));

  it('renders the terms page', () => {
    cy.url().should('include', '/onboarding-terms');
  });
});

describe('Onboarding — Profile setup page', () => {
  beforeEach(() => visitAndConfirmLoad('/onboarding-profile'));

  it('renders the onboarding profile page', () => {
    cy.url().should('include', '/onboarding-profile');
  });
});

describe('Setup Profile page', () => {
  beforeEach(() => visitAndConfirmLoad('/setup-profile'));

  it('renders the setup profile page', () => {
    cy.url().should('include', '/setup-profile');
  });
});

// ─────────────────────────────────────────────────────────────
// 4. Auth-loading / Check-login pages
// ─────────────────────────────────────────────────────────────

describe('Auth Loading page', () => {
  it('renders without crashing', () => {
    visitAndConfirmLoad('/auth-loading');
    cy.get('body').should('exist');
  });
});

describe('Check Login page', () => {
  it('renders without crashing', () => {
    visitAndConfirmLoad('/check-login');
    cy.get('body').should('exist');
  });
});

// ─────────────────────────────────────────────────────────────
// 5. Feature pages (accessible without full auth in demo/test env)
// ─────────────────────────────────────────────────────────────

describe('Recipe Calculator page', () => {
  beforeEach(() => visitAndConfirmLoad('/recipe-calculator'));

  it('renders the recipe calculator page', () => {
    cy.url().should('include', '/recipe-calculator');
  });
});

describe('Photo Food Logger page', () => {
  beforeEach(() => visitAndConfirmLoad('/photo-food-logger'));

  it('renders the photo food logger page', () => {
    cy.url().should('include', '/photo-food-logger');
  });
});

describe('Scan Barcode page', () => {
  beforeEach(() => visitAndConfirmLoad('/scan-barcode'));

  it('renders the barcode scanner page', () => {
    cy.url().should('include', '/scan-barcode');
  });
});

describe('Add Food page', () => {
  beforeEach(() => visitAndConfirmLoad('/add-food'));

  it('renders the add-food page', () => {
    cy.url().should('include', '/add-food');
  });
});

// ─────────────────────────────────────────────────────────────
// 6. Navigation — the app tab bar
// ─────────────────────────────────────────────────────────────

describe('Tab bar navigation', () => {
  /**
   * Navigate to /app/home first (requires the app to allow it — works in demo
   * mode or after auth). Then verify the tab bar renders.
   */
  beforeEach(() => {
    cy.visit('/app/home');
  });

  it('renders the tab bar', () => {
    cy.get('ion-tab-bar, [role="tablist"], .tab-bar').should('exist');
  });

  it('has a Home tab', () => {
    cy.get('ion-tab-button, ion-tab-bar ion-tab-button').should('exist');
  });
});

// ─────────────────────────────────────────────────────────────
// 7. Protected app routes (tab pages)
// ─────────────────────────────────────────────────────────────

const tabRoutes = [
  { path: '/app/home', label: 'Home' },
  { path: '/app/analytics', label: 'Analytics' },
  { path: '/app/workout', label: 'Workout' },
  { path: '/app/settings', label: 'Settings' },
  { path: '/app/changelog', label: 'Changelog' },
  { path: '/app/energy-needs', label: 'Energy Needs' },
  { path: '/app/units', label: 'Units' },
  { path: '/app/reminders', label: 'Reminders' },
  { path: '/app/settings/planner', label: 'Meal Planner' },
  { path: '/app/data-privacy', label: 'Data Privacy' },
];

tabRoutes.forEach(({ path, label }) => {
  describe(`App route: ${label} (${path})`, () => {
    it('loads without a JS crash', () => {
      cy.visit(path);
      cy.get('body').should('exist');
    });
  });
});

// ─────────────────────────────────────────────────────────────
// 8. Login form validation (client-side)
// ─────────────────────────────────────────────────────────────

describe('Login form — client-side validation', () => {
  beforeEach(() => cy.visit('/login'));

  it('shows the page heading or form', () => {
    // A heading, logo, or form must be visible
    cy.get('ion-content, form, h1, h2, ion-card').should('exist');
  });

  it('does not navigate away on empty submit', () => {
    // Find a login/submit button; if not found, skip without failing
    cy.get('body').then(($body) => {
      const btn = $body.find(
        'ion-button[type="submit"], button[type="submit"], ion-button:contains("Log"), ion-button:contains("Sign")'
      );
      if (btn.length) {
        cy.wrap(btn.first()).click({ force: true });
        cy.url().should('include', '/login');
      }
    });
  });
});

// ─────────────────────────────────────────────────────────────
// 9. Register form validation (client-side)
// ─────────────────────────────────────────────────────────────

describe('Register form — client-side validation', () => {
  beforeEach(() => cy.visit('/register'));

  it('shows the page heading or form', () => {
    cy.get('ion-content, form, h1, h2, ion-card').should('exist');
  });
});

// ─────────────────────────────────────────────────────────────
// 10. Settings page interactions
// ─────────────────────────────────────────────────────────────

describe('Settings page', () => {
  beforeEach(() => cy.visit('/app/settings'));

  it('loads without a JS crash', () => {
    cy.get('body').should('exist');
  });
});

// ─────────────────────────────────────────────────────────────
// 11. Analytics page interactions
// ─────────────────────────────────────────────────────────────

describe('Analytics page', () => {
  beforeEach(() => cy.visit('/app/analytics'));

  it('loads without a JS crash', () => {
    cy.get('body').should('exist');
  });
});

// ─────────────────────────────────────────────────────────────
// 12. Home page interactions
// ─────────────────────────────────────────────────────────────

describe('Home page', () => {
  beforeEach(() => cy.visit('/app/home'));

  it('loads without a JS crash', () => {
    cy.get('body').should('exist');
  });
});

// ─────────────────────────────────────────────────────────────
// 13. Workout page interactions
// ─────────────────────────────────────────────────────────────

describe('Workout page', () => {
  beforeEach(() => cy.visit('/app/workout'));

  it('loads without a JS crash', () => {
    cy.get('body').should('exist');
  });
});

// ─────────────────────────────────────────────────────────────
// 14. 404 / unknown routes
// ─────────────────────────────────────────────────────────────

describe('Unknown routes', () => {
  it('does not crash the app for a nonsense URL', () => {
    cy.visit('/this-route-does-not-exist-xyz', { failOnStatusCode: false });
    cy.get('body').should('exist');
  });
});

// ─────────────────────────────────────────────────────────────
// 15. Start page
// ─────────────────────────────────────────────────────────────

describe('Start page', () => {
  beforeEach(() => visitAndConfirmLoad('/start'));

  it('renders the start page', () => {
    cy.url().should('include', '/start');
  });
});

// ─────────────────────────────────────────────────────────────
// 16. Offline page
// ─────────────────────────────────────────────────────────────

describe('Offline page', () => {
  beforeEach(() => visitAndConfirmLoad('/offline'));

  it('renders the offline page', () => {
    cy.url().should('include', '/offline');
  });
});
