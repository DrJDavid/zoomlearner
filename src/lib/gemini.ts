import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Gemini API client
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
}

// Initialize the API client
const genAI = new GoogleGenerativeAI(API_KEY);

// Get the Gemini Pro model
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

// Helper function to generate quiz questions
export async function generateQuizQuestions(text: string, numQuestions: number = 5) {
    try {
        const prompt = `
        Generate ${numQuestions} multiple-choice quiz questions based on the following text. 
        For each question:
        - Create a clear, concise question
        - Provide one correct answer
        - Provide three incorrect but plausible answers
        - Include a brief explanation of why the correct answer is right
        - Assign a difficulty level (easy, medium, or hard)

        Format the response as a JSON array with objects containing:
        {
            "question_text": string,
            "correct_answer": string,
            "incorrect_answers": string[],
            "explanation": string,
            "difficulty": "easy" | "medium" | "hard"
        }

        Text to generate questions from:
        ${text}
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const jsonStr = response.text();
        
        try {
            return JSON.parse(jsonStr);
        } catch (e) {
            console.error('Failed to parse Gemini response as JSON:', e);
            throw new Error('Invalid response format from Gemini API');
        }
    } catch (error) {
        console.error('Error generating quiz questions:', error);
        throw error;
    }
}

// Helper function to analyze text complexity
export async function analyzeTextComplexity(text: string) {
    try {
        const prompt = `
        Analyze the following text and provide:
        1. Reading level (elementary, intermediate, advanced)
        2. Key concepts covered
        3. Technical terms used
        4. Suggested quiz difficulty based on content

        Format the response as JSON with these fields.

        Text to analyze:
        ${text}
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const jsonStr = response.text();
        
        try {
            return JSON.parse(jsonStr);
        } catch (e) {
            console.error('Failed to parse Gemini response as JSON:', e);
            throw new Error('Invalid response format from Gemini API');
        }
    } catch (error) {
        console.error('Error analyzing text complexity:', error);
        throw error;
    }
}

// Helper function to generate explanations for incorrect answers
export async function generateAnswerExplanation(
    question: string,
    userAnswer: string,
    correctAnswer: string,
    context: string
) {
    try {
        const prompt = `
        Explain why "${userAnswer}" is incorrect for the question "${question}".
        The correct answer is "${correctAnswer}".
        
        Provide a helpful explanation based on this context:
        ${context}
        
        Format the response as a clear, concise explanation that helps the user understand their mistake.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error('Error generating answer explanation:', error);
        throw error;
    }
}

export const gemini = {
    model,
    generateQuizQuestions,
    analyzeTextComplexity,
    generateAnswerExplanation
}; 