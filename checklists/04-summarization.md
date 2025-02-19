# On-Demand Summarization Checklist

## Edge Function Setup (`summarize_text.js`)
- [ ] Create new Supabase Edge Function
- [ ] Import dependencies:
  - [ ] `serve` from Deno
  - [ ] `createClient` from Supabase
  - [ ] Gemini API client

- [ ] Initialize services:
  - [ ] Set up Gemini API client
  - [ ] Create Supabase client

## Summarization Implementation
- [ ] Handle incoming requests:
  - [ ] Parse text input
  - [ ] Get summary parameters
  - [ ] Construct Gemini API prompt
  - [ ] Call Gemini API
  - [ ] Format and return summary

## Frontend Implementation (`script.js`)
- [ ] Add summarization UI:
  - [ ] Create summary button
  - [ ] Add keyboard shortcut
  - [ ] Style the button
  - [ ] Show/hide based on reader state

- [ ] Implement summary request:
  - [ ] Get surrounding text
  - [ ] Call summarization edge function
  - [ ] Handle API response
  - [ ] Display summary

## Summary Display
- [ ] Create summary modal:
  - [ ] Modal container
  - [ ] Summary text area
  - [ ] Close button
  - [ ] Copy to clipboard button

- [ ] Style summary display:
  - [ ] Responsive design
  - [ ] Dark mode support
  - [ ] Loading state

## User Experience
- [ ] Add loading indicators:
  - [ ] Button loading state
  - [ ] Summary generation progress
  - [ ] Error states

- [ ] Implement error handling:
  - [ ] API errors
  - [ ] Network issues
  - [ ] Rate limiting

## Testing
- [ ] Test summarization:
  - [ ] Various text lengths
  - [ ] Different content types
  - [ ] Edge cases

- [ ] Test UI:
  - [ ] Modal behavior
  - [ ] Button states
  - [ ] Keyboard shortcuts

## Analytics
- [ ] Track usage:
  - [ ] Summary requests
  - [ ] Success rates
  - [ ] User engagement

## Documentation
- [ ] Update user guide:
  - [ ] Document feature
  - [ ] Add keyboard shortcuts
  - [ ] Include examples 