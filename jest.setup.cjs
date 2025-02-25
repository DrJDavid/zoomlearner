require('@testing-library/jest-dom');

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  clear: jest.fn(),
  removeItem: jest.fn(),
};
global.localStorage = localStorageMock;

// Set up test environment variables
process.env.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
process.env.VITE_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'mock-key';

// Mock File API
global.File = class {
  constructor(bits, name, options = {}) {
    this.name = name;
    this.size = bits.length;
    this.type = options.type || '';
    this._bits = bits;
  }

  text() {
    return Promise.resolve(this._bits.join(''));
  }
}; 