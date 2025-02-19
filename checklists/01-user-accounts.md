# User Accounts (Supabase Auth) Checklist

## Dependencies
- [ ] Install Supabase JS Client (`npm install @supabase/supabase-js`)

## Initial Setup
- [ ] Initialize Supabase Client in `script.js`
- [ ] Set up Supabase project URL and anon key (as environment variables)

## UI Components
- [ ] Add sign-up/login modal trigger button
- [ ] Create modal dialog with:
  - [ ] Email input field
  - [ ] Password input field
  - [ ] "Sign Up" button
  - [ ] "Log In" button
  - [ ] "Close" button

## Authentication Implementation
- [ ] Implement Sign-Up functionality:
  - [ ] Get email and password from input fields
  - [ ] Use `supabase.auth.signUp()`
  - [ ] Handle success cases
  - [ ] Handle error cases
  - [ ] Show appropriate user feedback

- [ ] Implement Login functionality:
  - [ ] Get email and password
  - [ ] Use `supabase.auth.signInWithPassword()`
  - [ ] Handle success cases
  - [ ] Handle error cases
  - [ ] Update UI for logged-in state

- [ ] Implement Logout functionality:
  - [ ] Add logout button (hidden until logged in)
  - [ ] Use `supabase.auth.signOut()`
  - [ ] Handle success/error cases
  - [ ] Update UI appropriately

## User Preferences
- [ ] Create `profiles` table in Supabase with columns:
  - [ ] `id` (UUID, reference to `auth.users`)
  - [ ] `wpm` (integer)
  - [ ] `font_size` (integer)
  - [ ] `dark_mode` (boolean)
  - [ ] `quizzes_enabled` (boolean)
  - [ ] `autopause_enabled` (boolean)

## Data Management
- [ ] Implement user data loading on login:
  - [ ] Set up `onAuthStateChange` listener
  - [ ] Fetch user profile data
  - [ ] Update UI with user preferences
  - [ ] Initialize RSVP reader state

- [ ] Implement profile updates:
  - [ ] Create UI elements for preference changes
  - [ ] Handle real-time updates to profile
  - [ ] Sync changes with Supabase

## Testing
- [ ] Test sign-up flow
- [ ] Test login flow
- [ ] Test logout flow
- [ ] Test preference persistence
- [ ] Test error handling
- [ ] Test UI state management 