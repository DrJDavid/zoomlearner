// Test script for Supabase Edge Functions
// Run with: node test-edge-functions.js

const { createClient } = require('@supabase/supabase-js');

// Replace with your Supabase URL and anon key
const SUPABASE_URL = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Test configurations
const TEST_FUNCTIONS = [
  {
    name: 'gemini-chat',
    body: {
      prompt: 'Hello, tell me a short joke about programming.',
      systemPrompt: 'You are a helpful assistant who is good at telling jokes.',
      documentContext: ''
    }
  },
  {
    name: 'gemini-summary',
    body: {
      content: 'JavaScript is a programming language that conforms to the ECMAScript specification. JavaScript is high-level, often just-in-time compiled, and multi-paradigm. It has curly-bracket syntax, dynamic typing, prototype-based object-orientation, and first-class functions. Alongside HTML and CSS, JavaScript is one of the core technologies of the World Wide Web.',
      length: 'short'
    }
  },
  {
    name: 'gemini-quiz-generator',
    body: {
      content: 'JavaScript is a programming language that conforms to the ECMAScript specification. JavaScript is high-level, often just-in-time compiled, and multi-paradigm. It has curly-bracket syntax, dynamic typing, prototype-based object-orientation, and first-class functions. Alongside HTML and CSS, JavaScript is one of the core technologies of the World Wide Web.',
      numQuestions: 2,
      difficulty: 'easy'
    }
  }
];

// Test all functions
async function testAllFunctions() {
  console.log('🧪 Testing Supabase Edge Functions');
  console.log('================================\n');

  for (const test of TEST_FUNCTIONS) {
    await testFunction(test.name, test.body);
  }
}

// Test a single function
async function testFunction(functionName, body) {
  console.log(`🔍 Testing function: ${functionName}`);
  console.log(`Request payload: ${JSON.stringify(body, null, 2)}`);
  
  try {
    console.time(`${functionName} execution time`);
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: body
    });
    console.timeEnd(`${functionName} execution time`);

    if (error) {
      console.error(`❌ Error calling ${functionName}:`, error);
      return;
    }

    console.log(`✅ ${functionName} response:`, 
      JSON.stringify(data, null, 2).substring(0, 200) + '...');
    console.log('----------------------------------------\n');
  } catch (err) {
    console.error(`❌ Exception in ${functionName}:`, err);
    console.log('----------------------------------------\n');
  }
}

// Run tests
testAllFunctions().catch(err => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
}); 