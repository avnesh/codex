import express from 'express'
import * as dotenv from 'dotenv'
import cors from 'cors'
import { Configuration, OpenAIApi } from 'openai'
import Groq from 'groq-sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'

dotenv.config()

// Initialize all API clients
const openaiConfig = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(openaiConfig);

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const app = express()

// Enhanced CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:5173', 'https://your-frontend-domain.com'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// API call functions
async function callOpenAI(prompt) {
  try {
    const response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0,
      max_tokens: 3000,
      top_p: 1,
      frequency_penalty: 0.5,
      presence_penalty: 0,
    });
    return {
      success: true,
      data: response.data.choices[0].message.content,
      provider: 'OpenAI'
    };
  } catch (error) {
    console.error('OpenAI API Error:', error.message);
    return {
      success: false,
      error: error.message,
      provider: 'OpenAI'
    };
  }
}

async function callGroq(prompt) {
  try {
    const response = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "llama-3.1-8b-instant", // Updated to current model
      temperature: 0,
      max_tokens: 3000,
      top_p: 1,
      frequency_penalty: 0.5,
      presence_penalty: 0,
    });
    return {
      success: true,
      data: response.choices[0].message.content,
      provider: 'Groq'
    };
  } catch (error) {
    console.error('Groq API Error:', error.message);
    return {
      success: false,
      error: error.message,
      provider: 'Groq'
    };
  }
}

async function callGemini(prompt) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    return {
      success: true,
      data: text,
      provider: 'Gemini'
    };
  } catch (error) {
    console.error('Gemini API Error:', error.message);
    return {
      success: false,
      error: error.message,
      provider: 'Gemini'
    };
  }
}

// Main function with auto-switching logic
async function getAIResponse(prompt) {
  const providers = [
    { name: 'OpenAI', func: callOpenAI },
    { name: 'Groq', func: callGroq },
    { name: 'Gemini', func: callGemini }
  ];

  let lastError = null;
  
  for (const provider of providers) {
    console.log(`Trying ${provider.name}...`);
    
    const result = await provider.func(prompt);
    
    if (result.success) {
      console.log(`✅ Success with ${result.provider}`);
      return {
        success: true,
        data: result.data,
        provider: result.provider
      };
    } else {
      console.log(`❌ ${provider.name} failed: ${result.error}`);
      lastError = result.error;
    }
  }
  
  // All providers failed
  return {
    success: false,
    error: `All API providers failed. Last error: ${lastError}`,
    provider: 'None'
  };
}

// Routes
app.get('/', async (req, res) => {
  res.status(200).send({
    message: '🤖 Multi-API CodeX Server is Running!',
    availableProviders: ['OpenAI', 'Groq', 'Gemini'],
    status: 'Ready',
    features: [
      '✅ Auto-switching between providers',
      '✅ Quota limit detection',
      '✅ Authentication error handling',
      '✅ CORS enabled for all origins',
      '✅ Enhanced error reporting'
    ],
    endpoints: {
      'POST /': 'Send AI prompts',
      'GET /health': 'Check provider health',
      'GET /test': 'Quick test endpoint'
    }
  })
})

// Quick test endpoint
app.get('/test', async (req, res) => {
  try {
    const testPrompt = "Say hello in one sentence";
    console.log('🧪 Running quick test...');
    
    const result = await getAIResponse(testPrompt);
    
    res.status(200).send({
      testStatus: result.success ? 'PASSED' : 'FAILED',
      provider: result.provider,
      response: result.success ? result.data : result.error,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).send({
      testStatus: 'ERROR',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
})

app.post('/', async (req, res) => {
  try {
    const prompt = req.body.prompt;

    if (!prompt) {
      return res.status(400).send({
        error: 'Prompt is required in request body'
      });
    }

    console.log('Received prompt:', prompt.substring(0, 100) + '...');
    
    const result = await getAIResponse(prompt);

    if (result.success) {
      res.status(200).send({
        bot: result.data,
        provider: result.provider,
        status: 'success'
      });
    } else {
      res.status(500).send({
        error: result.error,
        provider: result.provider,
        status: 'failed'
      });
    }

  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).send({
      error: 'Internal server error',
      details: error.message
    });
  }
})

// Health check endpoint
app.get('/health', async (req, res) => {
  const healthStatus = {
    server: 'healthy',
    timestamp: new Date().toISOString(),
    providers: {}
  };

  // Test each provider with a simple prompt
  const testPrompt = "Hello";
  
  const testResults = await Promise.allSettled([
    callOpenAI(testPrompt),
    callGroq(testPrompt),
    callGemini(testPrompt)
  ]);

  testResults.forEach((result, index) => {
    const providerNames = ['OpenAI', 'Groq', 'Gemini'];
    const providerName = providerNames[index];
    
    if (result.status === 'fulfilled' && result.value.success) {
      healthStatus.providers[providerName] = 'healthy';
    } else {
      healthStatus.providers[providerName] = 'unhealthy';
    }
  });

  res.status(200).send(healthStatus);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Multi-API server with updated models started on http://localhost:${PORT}`);
  console.log('🤖 OpenAI: gpt-3.5-turbo');
  console.log('🦙 Groq: llama-3.1-8b-instant');
  console.log('💎 Gemini: gemini-1.5-flash');
  console.log('🔄 Auto-switching enabled with current models');
  console.log('🌐 CORS enabled for all origins');
  console.log('💡 Ready to process AI requests!');
});