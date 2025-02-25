import { supabase } from '../lib/supabase';
import { AuthSession, User } from '@supabase/supabase-js';
import { EventEmitter } from '../lib/EventEmitter';

/**
 * Service wrapper for Supabase authentication that adds event handling
 * and React integration. This service maintains compatibility with the
 * existing implementation while adding new functionality for the React migration.
 */
export class AuthService {
  private eventEmitter: EventEmitter;
  private currentUser: User | null = null;

  constructor() {
    this.eventEmitter = new EventEmitter();

    // Set up auth state change listener
    supabase.auth.onAuthStateChange((event, session) => {
      this.currentUser = session?.user ?? null;
      this.eventEmitter.emit('authStateChange', { event, session });
    });
  }

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string): Promise<{
    user: User | null;
    error: Error | null;
  }> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      this.currentUser = data.user;
      return { user: data.user, error: null };
    } catch (error) {
      return { user: null, error: error as Error };
    }
  }

  /**
   * Sign up with email and password
   */
  async signUp(email: string, password: string): Promise<{
    user: User | null;
    error: Error | null;
  }> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;
      // Note: User might need to confirm email before being fully signed up
      return { user: data.user, error: null };
    } catch (error) {
      return { user: null, error: error as Error };
    }
  }

  /**
   * Sign out the current user
   */
  async signOut(): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      this.currentUser = null;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }

  /**
   * Get the current session
   */
  async getSession(): Promise<{
    session: AuthSession | null;
    error: Error | null;
  }> {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return { session: data.session, error: null };
    } catch (error) {
      return { session: null, error: error as Error };
    }
  }

  /**
   * Get the current user synchronously
   */
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  /**
   * Subscribe to auth state changes
   */
  subscribe(event: string, callback: (...args: any[]) => void): void {
    this.eventEmitter.on(event, callback);
  }

  /**
   * Unsubscribe from auth state changes
   */
  unsubscribe(event: string, callback: (...args: any[]) => void): void {
    this.eventEmitter.off(event, callback);
  }
} 