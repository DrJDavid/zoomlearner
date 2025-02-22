import { AuthService } from '../AuthService';
import { supabase } from '../../lib/supabase';
import { AuthSession, User } from '@supabase/supabase-js';

// Mock supabase client
jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
  },
}));

describe('AuthService', () => {
  let authService: AuthService;
  const mockUser: User = {
    id: 'test-user-id',
    email: 'test@example.com',
    created_at: '2024-02-22',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
  };
  const mockSession: AuthSession = {
    access_token: 'test-token',
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    expires_at: 1234567890,
    token_type: 'bearer',
    user: mockUser,
  };

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Set up auth state change mock
    (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation((callback) => {
      callback('INITIAL_SESSION', null);
      return {
        data: { subscription: { unsubscribe: jest.fn() } },
      };
    });

    // Create a new instance for each test
    authService = new AuthService();
  });

  describe('Constructor', () => {
    it('should create a new instance', () => {
      expect(authService).toBeInstanceOf(AuthService);
      expect(supabase.auth.onAuthStateChange).toHaveBeenCalled();
    });
  });

  describe('Authentication Methods', () => {
    it('should handle sign in', async () => {
      const email = 'test@example.com';
      const password = 'password123';

      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const result = await authService.signIn(email, password);

      expect(result).toEqual({ user: mockUser, error: null });
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email,
        password,
      });
    });

    it('should handle sign up', async () => {
      const email = 'test@example.com';
      const password = 'password123';

      (supabase.auth.signUp as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const result = await authService.signUp(email, password);

      expect(result).toEqual({ user: mockUser, error: null });
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email,
        password,
      });
    });

    it('should handle sign out', async () => {
      (supabase.auth.signOut as jest.Mock).mockResolvedValue({
        error: null,
      });

      const result = await authService.signOut();

      expect(result).toEqual({ error: null });
      expect(supabase.auth.signOut).toHaveBeenCalled();
    });

    it('should get current session', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const result = await authService.getSession();

      expect(result).toEqual({ session: mockSession, error: null });
      expect(supabase.auth.getSession).toHaveBeenCalled();
    });

    it('should get current user', () => {
      // Simulate auth state change with a user
      const authStateCallback = (supabase.auth.onAuthStateChange as jest.Mock).mock.calls[0][0];
      authStateCallback('SIGNED_IN', { user: mockUser });

      const user = authService.getCurrentUser();
      expect(user).toEqual(mockUser);
    });
  });

  describe('Event Handling', () => {
    it('should handle event subscriptions', () => {
      const mockCallback = jest.fn();
      
      // Subscribe to auth state changes
      authService.subscribe('authStateChange', mockCallback);

      // Simulate auth state change
      const authStateCallback = (supabase.auth.onAuthStateChange as jest.Mock).mock.calls[0][0];
      authStateCallback('SIGNED_IN', mockSession);

      expect(mockCallback).toHaveBeenCalledWith({ 
        event: 'SIGNED_IN', 
        session: mockSession 
      });

      // Unsubscribe and verify no more calls
      authService.unsubscribe('authStateChange', mockCallback);
      authStateCallback('SIGNED_OUT', null);
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('should handle null session in auth state change', () => {
      const mockCallback = jest.fn();
      authService.subscribe('authStateChange', mockCallback);

      // Simulate auth state change with null session
      const authStateCallback = (supabase.auth.onAuthStateChange as jest.Mock).mock.calls[0][0];
      authStateCallback('SIGNED_OUT', null);

      expect(mockCallback).toHaveBeenCalledWith({ 
        event: 'SIGNED_OUT', 
        session: null 
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle sign in errors', async () => {
      const error = new Error('Invalid credentials');
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { user: null },
        error,
      });

      const result = await authService.signIn('test@example.com', 'wrong-password');

      expect(result.error).toBe(error);
      expect(result.user).toBeNull();
    });

    it('should handle sign up errors', async () => {
      const error = new Error('Email already exists');
      (supabase.auth.signUp as jest.Mock).mockResolvedValue({
        data: { user: null },
        error,
      });

      const result = await authService.signUp('existing@example.com', 'password123');

      expect(result.error).toBe(error);
      expect(result.user).toBeNull();
    });

    it('should handle sign out errors', async () => {
      const error = new Error('Network error');
      (supabase.auth.signOut as jest.Mock).mockResolvedValue({
        error,
      });

      const result = await authService.signOut();

      expect(result.error).toBe(error);
    });

    it('should handle session retrieval errors', async () => {
      const error = new Error('Session expired');
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error,
      });

      const result = await authService.getSession();

      expect(result.error).toBe(error);
      expect(result.session).toBeNull();
    });
  });
}); 