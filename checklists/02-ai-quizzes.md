# AI-Generated Quizzes Checklist

## Supabase Edge Function Setup (`quiz_generation.js`)
- [ ] Create new Supabase Edge Function
- [ ] Import required dependencies:
  - [ ] `serve` from Deno
  - [ ] `createClient` from Supabase
  - [ ] Gemini API client
- [ ] Set up environment variables for API keys
- [ ] Initialize Gemini API client
- [ ] Create Supabase client

## Quiz Generation Implementation
- [ ] Handle incoming requests:
  - [ ] Parse text input
  - [ ] Construct Gemini API prompt
  - [ ] Call Gemini API
  - [ ] Parse response
  - [ ] Format questions and answers as JSON

## Frontend Implementation (`script.js`)
- [ ] Add quiz toggle UI:
  - [ ] Create checkbox for enabling/disabling quizzes
  - [ ] Style the toggle element
  - [ ] Save preference to user profile

- [ ] Implement quiz timer:
  - [ ] Set up `setInterval` for quiz triggers
  - [ ] Make interval configurable
  - [ ] Store interval in user profile
  - [ ] Handle pause/resume states

- [ ] Edge function integration:
  - [ ] Extract relevant text for quiz generation
  - [ ] Call quiz generation edge function
  - [ ] Handle API responses
  - [ ] Parse returned JSON

## Quiz UI Components
- [ ] Create quiz modal:
  - [ ] Modal container
  - [ ] Question display
  - [ ] Multiple choice radio buttons
  - [ ] Submit button
  - [ ] Close button

- [ ] Implement answer evaluation:
  - [ ] Compare selected answers with correct answers
  - [ ] Calculate score
  - [ ] Display feedback
  - [ ] Store results in Supabase

## Analytics
- [ ] Create quiz results table in Supabase:
  - [ ] `id` (UUID)
  - [ ] `user_id` (UUID)
  - [ ] `score` (integer)
  - [ ] `timestamp` (datetime)
  - [ ] `reading_session_id` (UUID)

- [ ] Implement analytics display:
  - [ ] Create UI for showing quiz history
  - [ ] Display performance trends
  - [ ] Show success rate

## Testing
- [ ] Test quiz generation:
  - [ ] Verify question quality
  - [ ] Check answer accuracy
  - [ ] Test edge cases (short text, long text)

- [ ] Test UI functionality:
  - [ ] Modal display/hide
  - [ ] Answer selection
  - [ ] Score calculation
  - [ ] Results storage

- [ ] Test integration:
  - [ ] Timer functionality
  - [ ] API calls
  - [ ] Error handling
  - [ ] Performance impact 