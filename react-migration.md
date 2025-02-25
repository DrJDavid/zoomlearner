# Vanilla JS to React Migration Plan

## Phase 1: Setup and Service Layer

### 1. Create Core Services
```typescript
// src/services/ReaderService.ts
export class ReaderService {
  private reader: RSVPReader;
  private eventEmitter: EventEmitter;

  constructor() {
    this.reader = new RSVPReader();
    this.eventEmitter = new EventEmitter();
  }

  // Core functionality
  play() { this.reader.start(); this.eventEmitter.emit('play'); }
  pause() { this.reader.pause(); this.eventEmitter.emit('pause'); }
  setSpeed(wpm: number) { this.reader.setSpeed(wpm); this.eventEmitter.emit('speedChange', wpm); }
  
  // Event subscription
  subscribe(event: string, callback: Function) {
    this.eventEmitter.on(event, callback);
  }
}

// src/services/AuthService.ts
export class AuthService {
  private supabase: SupabaseClient;
  
  constructor() {
    this.supabase = supabase;
  }

  async signIn(email: string, password: string) { /* ... */ }
  async signOut() { /* ... */ }
  onAuthStateChange(callback: (user: User | null) => void) { /* ... */ }
}
```

### 2. Create State Management
```typescript
// src/store/ReaderContext.tsx
export const ReaderContext = createContext<{
  service: ReaderService;
  isPlaying: boolean;
  speed: number;
  currentWord: string;
  text: string;
  fontSize: number;
  isDarkMode: boolean;
}>({});

export function ReaderProvider({ children }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(300);
  // ... other state

  const serviceRef = useRef<ReaderService>(null);
  
  useEffect(() => {
    serviceRef.current = new ReaderService();
    
    // Subscribe to service events
    serviceRef.current.subscribe('play', () => setIsPlaying(true));
    serviceRef.current.subscribe('pause', () => setIsPlaying(false));
    
    return () => {
      // Cleanup subscriptions
    };
  }, []);

  return (
    <ReaderContext.Provider value={{
      service: serviceRef.current,
      isPlaying,
      speed,
      // ... other state
    }}>
      {children}
    </ReaderContext.Provider>
  );
}
```

## Phase 2: Component Creation

### 1. Create Base Components
```typescript
// src/components/Reader/Controls.tsx
export function Controls() {
  const { service, isPlaying, speed } = useContext(ReaderContext);
  
  return (
    <div className="controls">
      <button onClick={() => isPlaying ? service.pause() : service.play()}>
        {isPlaying ? 'Pause' : 'Play'}
      </button>
      <SpeedControl />
      <FontSizeControl />
    </div>
  );
}

// src/components/Reader/WordDisplay.tsx
export function WordDisplay() {
  const { currentWord, fontSize } = useContext(ReaderContext);
  
  return (
    <div className="word-display">
      <div className="word-container" style={{ fontSize: `${fontSize}px` }}>
        {currentWord}
      </div>
    </div>
  );
}
```

### 2. Create Feature Components
```typescript
// src/components/Reader/KeyboardShortcuts.tsx
export function KeyboardShortcuts() {
  const { service, isPlaying, speed } = useContext(ReaderContext);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          isPlaying ? service.pause() : service.play();
          break;
        case 'ArrowUp':
          e.preventDefault();
          service.setSpeed(Math.min(1000, speed + 25));
          break;
        case 'ArrowDown':
          e.preventDefault();
          service.setSpeed(Math.max(60, speed - 25));
          break;
        // ... other shortcuts
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [service, isPlaying, speed]);

  return null;
}
```

## Phase 3: Progressive Implementation

### 1. Create Main App Structure
```typescript
// src/App.tsx
export function App() {
  return (
    <ReaderProvider>
      <AuthProvider>
        <div className="app">
          <Header />
          <main>
            <Controls />
            <WordDisplay />
            <TextInput />
          </main>
          <KeyboardShortcuts />
        </div>
      </AuthProvider>
    </ReaderProvider>
  );
}
```

### 2. Migration Steps for Each Feature:
1. Start with one feature (e.g., play/pause)
2. Create React component
3. Test alongside existing vanilla JS
4. Switch to React component
5. Remove vanilla JS implementation
6. Repeat for next feature

## Phase 4: Testing and Validation

### 1. Create Test Suite
```typescript
// src/components/Reader/__tests__/Controls.test.tsx
describe('Reader Controls', () => {
  it('toggles play/pause', () => {
    const { getByRole } = render(<Controls />);
    const button = getByRole('button', { name: /play|pause/i });
    
    fireEvent.click(button);
    expect(button).toHaveTextContent('Pause');
  });
});
```

## Phase 5: Cleanup and Optimization

### 1. Remove Vanilla JS Code:
- Identify unused event listeners
- Remove old DOM queries
- Clean up old state management
- Remove deprecated functions

### 2. Performance Optimization:
- Implement React.memo where needed
- Optimize useCallback/useMemo usage
- Add error boundaries
- Implement proper loading states

## Implementation Timeline:

### Week 1: Setup and Services
- Day 1-2: Set up ReaderService
- Day 3-4: Set up AuthService
- Day 5: Create contexts and providers

### Week 2: Core Components
- Day 1-2: Implement Controls
- Day 3-4: Implement WordDisplay
- Day 5: Implement KeyboardShortcuts

### Week 3: Feature Migration
- Day 1-2: Migrate play/pause functionality
- Day 3-4: Migrate speed control
- Day 5: Migrate navigation controls

### Week 4: Auth and Polish
- Day 1-2: Migrate auth functionality
- Day 3-4: Add tests
- Day 5: Performance optimization

## Migration Checklist:
- [ ] Create service layer
- [ ] Set up React contexts
- [ ] Create base components
- [ ] Implement keyboard shortcuts
- [ ] Migrate auth system
- [ ] Add tests
- [ ] Remove vanilla JS code
- [ ] Performance optimization
- [ ] Documentation update