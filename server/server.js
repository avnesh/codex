import express from 'express'
import * as dotenv from 'dotenv'
import cors from 'cors'
import Groq from 'groq-sdk'

dotenv.config()

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const app = express()

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://codex-llm.vercel.app'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

app.use(express.json({ limit: '10mb' }))

// Groq API call
async function callGroq(prompt) {
  try {
    const response = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.1-8b-instant", // ✅ Groq model
      temperature: 0.7,
      max_tokens: 2000,
    });
    return { success: true, data: response.choices[0].message.content };
  } catch (error) {
    console.error('Groq API Error:', error.message);
    return { success: false, error: error.message };
  }
}

// Routes
app.get('/', (req, res) => {
  res.status(200).send({
    message: '🦙 Groq-only Server is Running!',
    model: 'llama-3.1-8b-instant',
    status: 'Ready',
    endpoint: 'POST /'
  });
});

app.post('/', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).send({ error: 'Prompt is required' });
    }

    console.log('⚡ Received prompt:', prompt.substring(0, 100) + '...');
    
    const result = await callGroq(prompt);

    if (result.success) {
      res.status(200).send({
        bot: result.data   // ✅ only bot returned
      });
    } else {
      res.status(500).send({
        error: result.error
      });
    }

  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).send({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Health check
app.get('/health', async (req, res) => {
  const testPrompt = "Hello";
  const testResult = await callGroq(testPrompt);
  res.status(200).send({
    server: 'healthy',
    timestamp: new Date().toISOString(),
    groq: testResult.success ? 'healthy' : 'unhealthy'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Groq-only server running on http://localhost:${PORT}`);
});
